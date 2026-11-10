import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { createReview, listReviews, updateReview } from "../controllers/reviewController.js";

const router = Router();
router.use(authenticate);
router.get("/", requireRole("admin", "instructor", "student"), listReviews);
router.post("/", requireRole("admin", "instructor"), createReview);
router.patch("/:reviewId", requireRole("admin", "instructor"), updateReview);

export default router;
