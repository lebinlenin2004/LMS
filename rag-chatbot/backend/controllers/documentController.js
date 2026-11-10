import { toObjectId, HttpError } from "../utils/helpers.js";
import { ingestPdf, listDocuments, deleteDocument } from "../services/documentService.js";
import { getCourseFor, canManageCourse } from "../services/courseService.js";

const present = (d) => ({
  id: d._id,
  name: d.name,
  pageCount: d.pageCount,
  chunkCount: d.chunkCount,
  createdAt: d.createdAt,
});

// Upload: admin or the course's instructor.
export async function uploadDocument(req, res, next) {
  try {
    const course = await getCourseFor(req.user, req.params.courseId, canManageCourse);
    if (!req.file) throw new HttpError(400, "No PDF uploaded. Send it in the 'file' field.");

    const { document, duplicate } = await ingestPdf({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      courseId: course._id,
      uploadedBy: req.user.id,
    });
    res.status(duplicate ? 200 : 201).json({
      success: true,
      duplicate,
      message: duplicate ? "This document was already uploaded to this course." : "Document processed successfully.",
      document: present(document),
    });
  } catch (error) {
    next(error);
  }
}

// List: anyone who can view the course (admin, its instructor, enrolled students).
export async function getDocuments(req, res, next) {
  try {
    const course = await getCourseFor(req.user, req.params.courseId);
    const docs = await listDocuments(course._id);
    res.json({ success: true, documents: docs.map(present) });
  } catch (error) {
    next(error);
  }
}

export async function removeDocument(req, res, next) {
  try {
    const course = await getCourseFor(req.user, req.params.courseId, canManageCourse);
    const removed = await deleteDocument(course._id, toObjectId(req.params.documentId, "document id"));
    if (!removed) throw new HttpError(404, "Document not found.");
    res.json({ success: true, message: "Document deleted." });
  } catch (error) {
    next(error);
  }
}
