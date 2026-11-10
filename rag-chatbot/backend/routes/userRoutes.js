import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import {
  listUsers, listStudents, createUserHandler, updateUser, deleteUser,
  createStudent, getStudentProfile, updateStudentProfile,
} from "../controllers/userController.js";

const router = Router();
router.use(authenticate);

// Instructors may only read and update profiles assigned to them. Keep these before "/:id".
router.get("/students", requireRole("admin", "instructor"), listStudents);
router.post("/students", requireRole("admin"), createStudent);
router.get("/students/:studentId", requireRole("admin", "instructor"), getStudentProfile);
router.patch("/students/:studentId", requireRole("admin", "instructor"), updateStudentProfile);

// Everything below: admin only.
router.use(requireRole("admin"));
router.get("/", listUsers);
router.post("/", createUserHandler);
router.patch("/:id", updateUser);
router.delete("/:id", deleteUser);
export default router;
