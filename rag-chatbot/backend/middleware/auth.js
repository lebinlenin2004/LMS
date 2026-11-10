// Authentication (who are you?) and authorization (what may you do?).
import jwt from "jsonwebtoken";
import { getUsersCollection } from "../config/database.js";
import { HttpError, toObjectId } from "../utils/helpers.js";

// Reads "Authorization: Bearer <token>", verifies it, then loads the user from the DB.
// Loading from the DB means a deactivated or deleted user is locked out immediately,
// even if their token has not expired yet.
export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new HttpError(401, "Please log in.");

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw new HttpError(401, "Your session has expired. Please log in again.");
    }

    const user = await getUsersCollection().findOne({ _id: toObjectId(payload.sub) });
    if (!user || !user.active) throw new HttpError(401, "This account is no longer available.");

    req.user = { id: user._id, name: user.name, email: user.email, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

// Usage: router.post("/", authenticate, requireRole("admin"), handler)
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return next(new HttpError(403, "You do not have permission to do this."));
    }
    next();
  };
