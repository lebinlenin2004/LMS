import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { uploadPdf } from "../middleware/uploadMiddleware.js";
import {
  listCourses, getCourse, createCourse, updateCourse, deleteCourse,
  listCourseStudents, enrollStudent, removeStudent,
} from "../controllers/courseController.js";
import { uploadDocument, getDocuments, removeDocument } from "../controllers/documentController.js";

const router = Router();
router.use(authenticate);

router.get("/", listCourses); // role-filtered list
router.post("/", requireRole("admin"), createCourse);
router.get("/:courseId", getCourse);
router.patch("/:courseId", requireRole("admin", "instructor"), updateCourse);
router.delete("/:courseId", requireRole("admin"), deleteCourse);

// Students enrolled in a course (admin, or that course's instructor - checked in the controller)
router.get("/:courseId/students", requireRole("admin", "instructor"), listCourseStudents);
router.post("/:courseId/students", requireRole("admin", "instructor"), enrollStudent);
router.delete("/:courseId/students/:studentId", requireRole("admin", "instructor"), removeStudent);

// Course documents (PDFs)
router.get("/:courseId/documents", getDocuments);
router.post("/:courseId/documents", requireRole("admin", "instructor"), uploadPdf, uploadDocument);
router.delete("/:courseId/documents/:documentId", requireRole("admin", "instructor"), removeDocument);

export default router;
