// Staff management is admin-only; student profiles are shared with assigned instructors.
import { getUsersCollection, getChatsCollection, getCoursesCollection, getReviewsCollection } from "../config/database.js";
import { HttpError, ROLES, toObjectId, isEmail, requireString } from "../utils/helpers.js";
import { createUser, publicUser, hashPassword, detachUserFromCourses } from "../services/userService.js";

export async function listUsers(req, res, next) {
  try {
    const filter = {};
    if (req.query.role) {
      if (!ROLES.includes(req.query.role)) throw new HttpError(400, "Invalid role filter.");
      filter.role = req.query.role;
    }
    const users = await getUsersCollection().find(filter).sort({ createdAt: -1 }).toArray();
    res.json({ success: true, users: users.map(publicUser) });
  } catch (err) {
    next(err);
  }
}

// Admins see every intern; instructors see only interns assigned to them.
export async function listStudents(req, res, next) {
  try {
    const filter = { role: "student" };
    if (req.user.role === "instructor") filter.assignedInstructorId = req.user.id;
    const students = await getUsersCollection()
      .find(filter, { projection: { name: 1, email: 1, active: 1, assignedInstructorId: 1 } })
      .sort({ name: 1 })
      .toArray();
    const ids = students.map((s) => s._id);
    const courseRows = ids.length
      ? await getCoursesCollection().find({ studentIds: { $in: ids } }, { projection: { title: 1, code: 1, studentIds: 1, instructorId: 1 } }).toArray()
      : [];
    const instructors = [...new Set(students.map((s) => s.assignedInstructorId).filter(Boolean).map(String))];
    const instructorRows = instructors.length
      ? await getUsersCollection().find({ _id: { $in: instructors.map(toObjectId) } }, { projection: { name: 1 } }).toArray()
      : [];
    const instructorNames = new Map(instructorRows.map((i) => [String(i._id), i.name]));
    const coursesByStudent = new Map(ids.map((id) => [String(id), []]));
    for (const course of courseRows) {
      for (const studentId of course.studentIds || []) {
        coursesByStudent.get(String(studentId))?.push({ id: course._id, title: course.title, code: course.code, instructorId: course.instructorId });
      }
    }
    res.json({ success: true, students: students.map((s) => ({
      id: s._id, name: s.name, email: s.email, active: s.active,
      assignedInstructorId: s.assignedInstructorId || null,
      assignedInstructorName: s.assignedInstructorId ? instructorNames.get(String(s.assignedInstructorId)) || null : null,
      courses: coursesByStudent.get(String(s._id)) || [],
    })) });
  } catch (err) {
    next(err);
  }
}

async function resolveStudentAssignments(body, actor, student = null) {
  let assignedInstructorId = student?.assignedInstructorId || null;
  if (actor.role === "admin" && body.assignedInstructorId !== undefined) {
    if (body.assignedInstructorId) {
      assignedInstructorId = toObjectId(body.assignedInstructorId, "instructor id");
      const instructor = await getUsersCollection().findOne({ _id: assignedInstructorId, role: "instructor", active: true });
      if (!instructor) throw new HttpError(400, "Choose an active instructor.");
    } else {
      assignedInstructorId = null;
    }
  }

  let courseIds;
  if (body.courseIds !== undefined) {
    if (!Array.isArray(body.courseIds)) throw new HttpError(400, "Course assignments must be a list.");
    const requested = [...new Set(body.courseIds.map((id) => String(toObjectId(id, "course id"))))];
    const selectedCourses = requested.length
      ? await getCoursesCollection().find({ _id: { $in: requested.map(toObjectId) } }).toArray()
      : [];
    if (selectedCourses.length !== requested.length) throw new HttpError(400, "One or more selected courses no longer exist.");
    if (actor.role === "instructor" && selectedCourses.some((course) => String(course.instructorId) !== String(actor.id))) {
      throw new HttpError(403, "You can only assign your own courses to your assigned interns.");
    }
    courseIds = requested.map(toObjectId);
    if (actor.role === "instructor" && student) {
      const current = await getCoursesCollection().find({ studentIds: student._id }).toArray();
      const otherInstructorCourses = current
        .filter((course) => String(course.instructorId) !== String(actor.id))
        .map((course) => course._id);
      courseIds = [...new Map([...otherInstructorCourses, ...courseIds].map((id) => [String(id), id])).values()];
    }
  }
  return { assignedInstructorId, courseIds };
}

export async function createStudent(req, res, next) {
  try {
    const body = req.body ?? {};
    const assignments = await resolveStudentAssignments(body, req.user);
    const user = await createUser({ ...body, role: "student" }, req.user.id);
    const set = {};
    if (assignments.assignedInstructorId) set.assignedInstructorId = assignments.assignedInstructorId;
    if (Object.keys(set).length) await getUsersCollection().updateOne({ _id: user._id }, { $set: set });
    if (assignments.courseIds) {
      await getCoursesCollection().updateMany({ _id: { $in: assignments.courseIds } }, { $addToSet: { studentIds: user._id } });
    }
    res.status(201).json({ success: true, user: publicUser(user) });
  } catch (err) { next(err); }
}

async function findStudentForActor(idString, actor) {
  const student = await getUsersCollection().findOne({ _id: toObjectId(idString, "student id"), role: "student" });
  if (!student || (actor.role === "instructor" && String(student.assignedInstructorId) !== String(actor.id))) {
    throw new HttpError(404, "Student not found.");
  }
  return student;
}

export async function getStudentProfile(req, res, next) {
  try {
    const student = await findStudentForActor(req.params.studentId, req.user);
    const courses = await getCoursesCollection().find({ studentIds: student._id }, { projection: { title: 1, code: 1, instructorId: 1 } }).toArray();
    let assignedInstructorName = null;
    if (student.assignedInstructorId) {
      const instructor = await getUsersCollection().findOne({ _id: student.assignedInstructorId }, { projection: { name: 1 } });
      assignedInstructorName = instructor?.name || null;
    }
    res.json({ success: true, student: {
      id: student._id, name: student.name, email: student.email, active: student.active,
      assignedInstructorId: student.assignedInstructorId || null, assignedInstructorName,
      courses: courses.map((course) => ({ id: course._id, title: course.title, code: course.code, instructorId: course.instructorId })),
    } });
  } catch (err) { next(err); }
}

export async function updateStudentProfile(req, res, next) {
  try {
    const student = await findStudentForActor(req.params.studentId, req.user);
    const body = req.body ?? {};
    const set = {};
    if (body.name !== undefined) set.name = requireString(body.name, "Name", { max: 100 });
    if (body.email !== undefined) {
      if (!isEmail(body.email)) throw new HttpError(400, "A valid email is required.");
      set.email = body.email.trim().toLowerCase();
    }
    if (body.active !== undefined) {
      if (typeof body.active !== "boolean") throw new HttpError(400, "'active' must be true or false.");
      set.active = body.active;
    }
    const assignments = await resolveStudentAssignments(body, req.user, student);
    if (req.user.role === "admin" && body.assignedInstructorId !== undefined) {
      if (assignments.assignedInstructorId) set.assignedInstructorId = assignments.assignedInstructorId;
      else set.assignedInstructorId = null;
    }
    try {
      if (Object.keys(set).length) await getUsersCollection().updateOne({ _id: student._id }, { $set: set });
    } catch (err) {
      if (err.code === 11000) throw new HttpError(409, "A user with this email already exists.");
      throw err;
    }
    if (assignments.courseIds) {
      await getCoursesCollection().updateMany({ _id: { $in: assignments.courseIds } }, { $addToSet: { studentIds: student._id } });
      await getCoursesCollection().updateMany({ _id: { $nin: assignments.courseIds } }, { $pull: { studentIds: student._id } });
    }
    const updated = await getUsersCollection().findOne({ _id: student._id });
    res.json({ success: true, student: publicUser(updated) });
  } catch (err) { next(err); }
}

export async function createUserHandler(req, res, next) {
  try {
    const user = await createUser(req.body ?? {}, req.user.id);
    res.status(201).json({ success: true, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

async function wouldRemoveLastAdmin(target, change) {
  const losingAdmin = target.role === "admin" && (change.role !== "admin" || change.active === false);
  if (!losingAdmin) return false;
  const otherAdmins = await getUsersCollection().countDocuments({ role: "admin", active: true, _id: { $ne: target._id } });
  return otherAdmins === 0;
}

export async function updateUser(req, res, next) {
  try {
    const id = toObjectId(req.params.id, "user id");
    const users = getUsersCollection();
    const target = await users.findOne({ _id: id });
    if (!target) throw new HttpError(404, "User not found.");

    const { name, email, role, active, password } = req.body ?? {};
    const set = {};
    if (name !== undefined) set.name = requireString(name, "Name", { max: 100 });
    if (email !== undefined) {
      if (!isEmail(email)) throw new HttpError(400, "A valid email is required.");
      set.email = email.trim().toLowerCase();
    }
    if (role !== undefined) {
      if (!ROLES.includes(role)) throw new HttpError(400, "Invalid role.");
      set.role = role;
    }
    if (active !== undefined) {
      if (typeof active !== "boolean") throw new HttpError(400, "'active' must be true or false.");
      set.active = active;
    }
    if (password) set.passwordHash = await hashPassword(password); // admin password reset

    if (String(id) === String(req.user.id) && (set.role && set.role !== "admin" || set.active === false)) {
      throw new HttpError(400, "You cannot remove your own admin access or deactivate yourself.");
    }
    if (await wouldRemoveLastAdmin(target, set)) throw new HttpError(400, "At least one active admin must remain.");

    try {
      await users.updateOne({ _id: id }, { $set: set });
    } catch (err) {
      if (err.code === 11000) throw new HttpError(409, "A user with this email already exists.");
      throw err;
    }

    // A role change makes old course links meaningless (e.g. instructor -> student).
    if (set.role && set.role !== target.role) await detachUserFromCourses(id);

    res.json({ success: true, user: publicUser(await users.findOne({ _id: id })) });
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const id = toObjectId(req.params.id, "user id");
    if (String(id) === String(req.user.id)) throw new HttpError(400, "You cannot delete your own account.");
    const users = getUsersCollection();
    const target = await users.findOne({ _id: id });
    if (!target) throw new HttpError(404, "User not found.");
    if (await wouldRemoveLastAdmin(target, { active: false })) throw new HttpError(400, "At least one active admin must remain.");

    await users.deleteOne({ _id: id });
    await getChatsCollection().deleteMany({ userId: id });
    await getReviewsCollection().deleteMany({ internId: id });
    await detachUserFromCourses(id);
    res.json({ success: true, message: "User deleted." });
  } catch (err) {
    next(err);
  }
}
