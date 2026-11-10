import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getUsersCollection, getCoursesCollection } from "../config/database.js";
import { HttpError, isEmail, requireString, ROLES } from "../utils/helpers.js";

// Never send the password hash to the client.
export function publicUser(u) {
  return {
    id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    createdAt: u.createdAt,
  };
}

export function signToken(user) {
  const secret = process.env.JWT_SECRET;
  return jwt.sign({ sub: String(user._id), role: user.role }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8 || password.length > 100) {
    throw new HttpError(400, "Password must be 8-100 characters.");
  }
  return password;
}

export async function createUser({ name, email, password, role }, createdBy = null) {
  name = requireString(name, "Name", { max: 100 });
  if (!isEmail(email)) throw new HttpError(400, "A valid email is required.");
  if (!ROLES.includes(role)) throw new HttpError(400, `Role must be one of: ${ROLES.join(", ")}.`);
  validatePassword(password);

  const doc = {
    name,
    email: email.trim().toLowerCase(),
    passwordHash: await bcrypt.hash(password, 10),
    role,
    active: true,
    createdBy,
    createdAt: new Date(),
  };
  try {
    const { insertedId } = await getUsersCollection().insertOne(doc);
    return { ...doc, _id: insertedId };
  } catch (err) {
    if (err.code === 11000) throw new HttpError(409, "A user with this email already exists.");
    throw err;
  }
}

export async function verifyLogin(email, password) {
  const user = await getUsersCollection().findOne({ email: String(email || "").trim().toLowerCase() });
  // Same message for unknown email / wrong password so attackers cannot probe which emails exist.
  const ok = user && (await bcrypt.compare(String(password || ""), user.passwordHash));
  if (!ok) throw new HttpError(401, "Invalid email or password.");
  if (!user.active) throw new HttpError(403, "This account has been deactivated. Contact an administrator.");
  return user;
}

export async function hashPassword(password) {
  return bcrypt.hash(validatePassword(password), 10);
}

// Called on startup: creates the first admin from .env if no admin exists yet.
export async function seedAdmin() {
  const users = getUsersCollection();
  if (await users.findOne({ role: "admin" })) return;

  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.warn("⚠️  No admin exists. Set ADMIN_EMAIL and ADMIN_PASSWORD in .env and restart.");
    return;
  }
  await createUser({ name: ADMIN_NAME || "Administrator", email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: "admin" });
  console.log(`✅ Created first admin account: ${ADMIN_EMAIL}`);
}

// When a user is removed, clean up their links to courses.
export async function detachUserFromCourses(userId) {
  const courses = getCoursesCollection();
  await courses.updateMany({ instructorId: userId }, { $set: { instructorId: null } });
  await courses.updateMany({ studentIds: userId }, { $pull: { studentIds: userId } });
}
