// Multer handles multipart/form-data uploads. We keep the file in memory (a Buffer)
// because we only need to parse it once - no need to save it on disk.
import multer from "multer";

export const MAX_FILE_SIZE_MB = 10;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const isPdf = file.mimetype === "application/pdf" && file.originalname.toLowerCase().endsWith(".pdf");
    if (!isPdf) return cb(new Error("Only PDF files are allowed."));
    cb(null, true);
  },
});

// Wrapper so upload errors become clean JSON responses instead of crashing.
export function uploadPdf(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();
    const message =
      err.code === "LIMIT_FILE_SIZE" ? `File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.` : err.message;
    return res.status(400).json({ success: false, message });
  });
}
