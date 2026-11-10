import { Router } from "express";
import rateLimitLogin from "../middleware/loginLimiter.js";
import { authenticate } from "../middleware/auth.js";
import { login, me, changePassword, requestPasswordReset, resetPassword } from "../controllers/authController.js";

const router = Router();
router.post("/login", rateLimitLogin, login); // POST /api/auth/login
router.post("/forgot-password", rateLimitLogin, requestPasswordReset);
router.post("/reset-password", resetPassword);
router.get("/me", authenticate, me); // GET  /api/auth/me
router.post("/change-password", authenticate, changePassword);
export default router;
