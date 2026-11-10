// Tiny in-memory brute-force guard: max 10 login attempts per IP per 15 minutes.
// (For production use a shared store such as Redis / express-rate-limit.)
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map();

export default function loginLimiter(req, res, next) {
  const now = Date.now();
  const entry = attempts.get(req.ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    attempts.set(req.ip, { start: now, count: 1 });
    return next();
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    return res.status(429).json({ success: false, message: "Too many login attempts. Try again in a few minutes." });
  }
  next();
}
