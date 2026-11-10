import { ObjectId } from "mongodb";

// Small error type that carries an HTTP status; the central error handler uses it.
export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function toObjectId(value, label = "id") {
  if (typeof value !== "string" || !ObjectId.isValid(value) || String(new ObjectId(value)) !== value) {
    throw new HttpError(400, `Invalid ${label}.`);
  }
  return new ObjectId(value);
}

export const isEmail = (v) => typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export const ROLES = ["admin", "instructor", "student"];

export function requireString(value, label, { min = 1, max = 200 } = {}) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) {
    throw new HttpError(400, `${label} is required (${min}-${max} characters).`);
  }
  return value.trim();
}
