import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { chat, listConversations, createConversation, getConversation } from "../controllers/chatController.js";

const router = Router();
// Admins manage users/courses only; instructors and students use the chatbot.
router.post("/", authenticate, requireRole("instructor", "student"), chat); // POST /api/chat
router.get("/conversations", authenticate, requireRole("instructor", "student"), listConversations);
router.post("/conversations", authenticate, requireRole("instructor", "student"), createConversation);
router.get("/conversations/:conversationId", authenticate, requireRole("instructor", "student"), getConversation);
export default router;
