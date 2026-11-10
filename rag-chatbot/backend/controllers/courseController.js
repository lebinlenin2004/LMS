import { getCoursesCollection, getUsersCollection } from "../config/database.js";
import { HttpError, requireString, toObjectId } from "../utils/helpers.js";
import {
  courseFilterFor, getCourseFor, presentCourses, canManageCourse, deleteCourseCascade,
} from "../services/courseService.js";

const STATUSES = ["active", "archived"];

async function resolveInstructor(instructorId) {
  if (instructorId === null || instructorId === "") return null;
  const user = await getUsersCollection().findOne({ _id: toObjectId(instructorId, "instructor id"), role: "instructor", active: true });
  if (!user) throw new HttpError(400, "Instructor must be an active user with the instructor role.");
  return user._id;
}

export async function listCourses(req, res, next) {
  try {
    const courses = await getCoursesCollection().find(courseFilterFor(req.user)).sort({ createdAt: -1 }).toArray();
    res.json({ success: true, courses: await presentCourses(courses) });
  } catch (err) {
    next(err);
  }
}

export async function getCourse(req, res, next) {
  try {
    const course = await getCourseFor(req.user, req.params.courseId);
    const [presented] = await presentCourses([course]);
    res.json({ success: true, course: presented });
  } catch (err) {
    next(err);
  }
}

// Admin only
export async function createCourse(req, res, next) {
  try {
    const { title, code, description = "", instructorId = null } = req.body ?? {};
    const doc = {
      title: requireString(title, "Title", { max: 150 }),
      code: requireString(code, "Course code", { max: 30 }).toUpperCase(),
      description: typeof description === "string" ? description.trim().slice(0, 2000) : "",
      status: "active",
      instructorId: await resolveInstructor(instructorId),
      studentIds: [],
      createdBy: req.user.id,
      createdAt: new Date(),
    };
    try {
      const { insertedId } = await getCoursesCollection().insertOne(doc);
      const [presented] = await presentCourses([{ ...doc, _id: insertedId }]);
      res.status(201).json({ success: true, course: presented });
    } catch (err) {
      if (err.code === 11000) throw new HttpError(409, "A course with this code already exists.");
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

// Admin: any field. Instructor of the course: description and status only.
export async function updateCourse(req, res, next) {
  try {
    const course = await getCourseFor(req.user, req.params.courseId, canManageCourse);
    const { title, code, description, status, instructorId } = req.body ?? {};
    const isAdmin = req.user.role === "admin";
    const set = {};

    if (description !== undefined) set.description = String(description).trim().slice(0, 2000);
    if (status !== undefined) {
      if (!STATUSES.includes(status)) throw new HttpError(400, "Status must be active or archived.");
      set.status = status;
    }
    if (title !== undefined || code !== undefined || instructorId !== undefined) {
      if (!isAdmin) throw new HttpError(403, "Only an admin can change the title, code or instructor.");
      if (title !== undefined) set.title = requireString(title, "Title", { max: 150 });
      if (code !== undefined) set.code = requireString(code, "Course code", { max: 30 }).toUpperCase();
      if (instructorId !== undefined) set.instructorId = await resolveInstructor(instructorId);
    }

    try {
      await getCoursesCollection().updateOne({ _id: course._id }, { $set: set });
    } catch (err) {
      if (err.code === 11000) throw new HttpError(409, "A course with this code already exists.");
      throw err;
    }
    const updated = await getCoursesCollection().findOne({ _id: course._id });
    const [presented] = await presentCourses([updated]);
    res.json({ success: true, course: presented });
  } catch (err) {
    next(err);
  }
}

// Admin only
export async function deleteCourse(req, res, next) {
  try {
    const course = await getCourseFor(req.user, req.params.courseId, canManageCourse);
    await deleteCourseCascade(course._id);
    res.json({ success: true, message: "Course and its documents were deleted." });
  } catch (err) {
    next(err);
  }
}

// ----- Enrolment (admin or the course's instructor) -----

export async function listCourseStudents(req, res, next) {
  try {
    const course = await getCourseFor(req.user, req.params.courseId, canManageCourse);
    const studentFilter = { _id: { $in: course.studentIds || [] }, role: "student" };
    if (req.user.role === "instructor") studentFilter.assignedInstructorId = req.user.id;
    const students = course.studentIds?.length
      ? await getUsersCollection().find(studentFilter, { projection: { name: 1, email: 1, active: 1 } }).sort({ name: 1 }).toArray()
      : [];
    res.json({ success: true, students: students.map((s) => ({ id: s._id, name: s.name, email: s.email, active: s.active })) });
  } catch (err) {
    next(err);
  }
}

export async function enrollStudent(req, res, next) {
  try {
    const course = await getCourseFor(req.user, req.params.courseId, canManageCourse);
    const studentFilter = { _id: toObjectId(req.body?.studentId, "student id"), role: "student", active: true };
    if (req.user.role === "instructor") studentFilter.assignedInstructorId = req.user.id;
    const student = await getUsersCollection().findOne(studentFilter);
    if (!student) throw new HttpError(400, "Student must be active and assigned to you before you can enrol them.");
    await getCoursesCollection().updateOne({ _id: course._id }, { $addToSet: { studentIds: student._id } });
    res.status(201).json({ success: true, message: `${student.name} enrolled.` });
  } catch (err) {
    next(err);
  }
}

export async function removeStudent(req, res, next) {
  try {
    const course = await getCourseFor(req.user, req.params.courseId, canManageCourse);
    const studentId = toObjectId(req.params.studentId, "student id");
    if (req.user.role === "instructor") {
      const student = await getUsersCollection().findOne({ _id: studentId, role: "student", assignedInstructorId: req.user.id });
      if (!student) throw new HttpError(404, "Student not found.");
    }
    await getCoursesCollection().updateOne({ _id: course._id }, { $pull: { studentIds: studentId } });
    res.json({ success: true, message: "Student removed from the course." });
  } catch (err) {
    next(err);
  }
}
