import { ObjectId } from "mongodb";
import { getCoursesCollection, getReviewsCollection, getUsersCollection } from "../config/database.js";
import { HttpError, requireString, toObjectId } from "../utils/helpers.js";

function parseReviewDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, "Choose a valid review date.");
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, "Choose a valid review date.");
  }
  return value;
}

async function getAssignedIntern(internId, actor) {
  const intern = await getUsersCollection().findOne({ _id: toObjectId(internId, "intern id"), role: "student" });
  if (!intern || (actor.role === "instructor" && String(intern.assignedInstructorId) !== String(actor.id))) {
    throw new HttpError(404, "Intern not found.");
  }
  return intern;
}

async function validateCourseForIntern(courseId, intern, actor) {
  const course = await getCoursesCollection().findOne({
    _id: toObjectId(courseId, "course id"),
    studentIds: intern._id,
  });
  if (!course) throw new HttpError(400, "Choose a course assigned to this intern.");
  return course;
}

function presentReview(review, intern, course) {
  return {
    id: review._id,
    title: review.title,
    date: review.date,
    reviewerName: review.reviewerName,
    intern: { id: intern._id, name: intern.name, email: intern.email },
    course: { id: course._id, title: course.title, code: course.code },
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

export async function listReviews(req, res, next) {
  try {
    const filter = {};
    if (req.user.role === "student") filter.internId = req.user.id;
    if (req.user.role === "instructor") {
      const interns = await getUsersCollection().find({ role: "student", assignedInstructorId: req.user.id }, { projection: { _id: 1 } }).toArray();
      filter.internId = { $in: interns.map((intern) => intern._id) };
    }
    const reviews = await getReviewsCollection().find(filter).sort({ date: 1, createdAt: -1 }).toArray();
    if (!reviews.length) return res.json({ success: true, reviews: [] });

    const internIds = [...new Map(reviews.map((review) => [String(review.internId), review.internId])).values()];
    const courseIds = [...new Map(reviews.map((review) => [String(review.courseId), review.courseId])).values()];
    const [interns, courses] = await Promise.all([
      getUsersCollection().find({ _id: { $in: internIds } }, { projection: { name: 1, email: 1 } }).toArray(),
      getCoursesCollection().find({ _id: { $in: courseIds } }, { projection: { title: 1, code: 1 } }).toArray(),
    ]);
    const internsById = new Map(interns.map((intern) => [String(intern._id), intern]));
    const coursesById = new Map(courses.map((course) => [String(course._id), course]));
    const result = reviews
      .filter((review) => internsById.has(String(review.internId)) && coursesById.has(String(review.courseId)))
      .map((review) => presentReview(review, internsById.get(String(review.internId)), coursesById.get(String(review.courseId))));
    res.json({ success: true, reviews: result });
  } catch (err) { next(err); }
}

export async function createReview(req, res, next) {
  try {
    const body = req.body ?? {};
    const intern = await getAssignedIntern(body.internId, req.user);
    const course = await validateCourseForIntern(body.courseId, intern, req.user);
    const now = new Date();
    const review = {
      internId: intern._id,
      advisorId: intern.assignedInstructorId || null,
      courseId: course._id,
      date: parseReviewDate(body.date),
      title: requireString(body.title, "Review title", { max: 150 }),
      reviewerName: requireString(body.reviewerName, "Reviewer name", { max: 100 }),
      createdBy: req.user.id,
      createdAt: now,
      updatedAt: now,
    };
    const { insertedId } = await getReviewsCollection().insertOne(review);
    res.status(201).json({ success: true, review: presentReview({ ...review, _id: insertedId }, intern, course) });
  } catch (err) { next(err); }
}

export async function updateReview(req, res, next) {
  try {
    if (!ObjectId.isValid(req.params.reviewId)) throw new HttpError(404, "Review not found.");
    const reviews = getReviewsCollection();
    const review = await reviews.findOne({ _id: new ObjectId(req.params.reviewId) });
    if (!review) throw new HttpError(404, "Review not found.");
    const intern = await getAssignedIntern(String(review.internId), req.user);
    const body = req.body ?? {};
    const selectedIntern = body.internId === undefined ? intern : await getAssignedIntern(body.internId, req.user);
    const course = await validateCourseForIntern(body.courseId ?? String(review.courseId), selectedIntern, req.user);
    const set = {
      date: body.date === undefined ? review.date : parseReviewDate(body.date),
      title: body.title === undefined ? review.title : requireString(body.title, "Review title", { max: 150 }),
      reviewerName: body.reviewerName === undefined ? review.reviewerName : requireString(body.reviewerName, "Reviewer name", { max: 100 }),
      courseId: course._id,
      internId: selectedIntern._id,
      advisorId: selectedIntern.assignedInstructorId || null,
      updatedAt: new Date(),
    };
    const updated = await reviews.findOneAndUpdate({ _id: review._id }, { $set: set }, { returnDocument: "after" });
    res.json({ success: true, review: presentReview(updated || { ...review, ...set }, selectedIntern, course) });
  } catch (err) { next(err); }
}
