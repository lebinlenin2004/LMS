import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";

const app = express();

app.use(cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173"] }));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (req, res) => res.json({ success: true, status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/reviews", reviewRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: "Route not found." }));

// Central error handler: log details on the server, send a safe message to the client.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const details = `${err.message || ""} ${err.status || ""} ${err.code || ""}`;
  const quotaError = /429|quota|rate.?limit|resource.?exhausted/i.test(details);
  const status = err.statusCode || err.status || err.response?.status || (quotaError ? 429 : 500);
  if (status >= 500) console.error("❌", err); // expected 4xx errors (bad input, no permission) are not logged
  let message = status < 500 ? err.message : "Something went wrong on the server.";
  if ([401, 403].includes(err.status) || /api key|api_key|unauthorized/i.test(details)) {
    message = "Gemini rejected the API key. Check GOOGLE_API_KEY in .env.";
  } else if (status === 429 || quotaError) {
    message = "Gemini rate limit or quota reached. Check your Google AI Studio API key and Gemini quota.";
  }
  res.status(status >= 400 && status < 600 ? status : 500).json({ success: false, message });
});

export default app;
