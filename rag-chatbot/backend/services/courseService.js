// Course data + the access rules that decide who can see or change a course.
import { getCoursesCollection, getDocumentsCollection, getChunksCollection, getUsersCollection, getChatsCollection, getReviewsCollection } from "../config/database.js";
import { HttpError, toObjectId } from "../utils/helpers.js";

// Admin sees everything; an instructor sees courses they teach; a student sees courses they are enrolled in.
export function courseFilterFor(user) {
  if (user.role === "admin") return {};
  if (user.role === "instructor") return { instructorId: user.id };
  return { studentIds: user.id };
}

export const isCourseInstructor = (user, course) =>
  user.role === "instructor" && course.instructorId && String(course.instructorId) === String(user.id);

// Admin or the course's own instructor may change it, enrol students, and manage its PDFs.
export const canManageCourse = (user, course) => user.role === "admin" || isCourseInstructor(user, course);

export const isEnrolled = (user, course) =>
  user.role === "student" && (course.studentIds || []).some((s) => String(s) === String(user.id));

export const canViewCourse = (user, course) => canManageCourse(user, course) || isEnrolled(user, course);

// Only instructors and enrolled students may chat. Admin is limited to user/course management.
export const canChat = (user, course) => isCourseInstructor(user, course) || isEnrolled(user, course);

// Load a course and check access. Responds 404 (not 403) when the user cannot view it,
// so people cannot discover which course ids exist.
export async function getCourseFor(user, courseIdString, check = canViewCourse) {
  const course = await getCoursesCollection().findOne({ _id: toObjectId(courseIdString, "course id") });
  if (!course || !canViewCourse(user, course)) throw new HttpError(404, "Course not found.");
  if (!check(user, course)) throw new HttpError(403, "You do not have permission to do this.");
  return course;
}

// Adds instructor name and student count, so the UI does not need extra requests.
export async function presentCourses(courses) {
  const instructorIds = [...new Set(courses.map((c) => c.instructorId).filter(Boolean).map(String))];
  const instructors = instructorIds.length
    ? await getUsersCollection()
        .find({ _id: { $in: instructorIds.map(toObjectId) } }, { projection: { name: 1, email: 1 } })
        .toArray()
    : [];
  const byId = new Map(instructors.map((i) => [String(i._id), i]));

  return courses.map((c) => ({
    id: c._id,
    title: c.title,
    code: c.code,
    description: c.description,
    status: c.status,
    instructor: c.instructorId && byId.has(String(c.instructorId))
      ? { id: c.instructorId, name: byId.get(String(c.instructorId)).name, email: byId.get(String(c.instructorId)).email }
      : null,
    studentCount: (c.studentIds || []).length,
    createdAt: c.createdAt,
  }));
}

// Deleting a course also deletes its PDFs and all their chunks/embeddings.
export async function deleteCourseCascade(courseId) {
  const id = String(courseId);
  await getChunksCollection().deleteMany({ courseId: id });
  await getDocumentsCollection().deleteMany({ courseId: id });
  await getChatsCollection().deleteMany({ courseId: id });
  await getReviewsCollection().deleteMany({ courseId: courseId });
  await getCoursesCollection().deleteOne({ _id: courseId });
}
