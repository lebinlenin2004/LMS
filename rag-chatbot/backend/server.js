import "dotenv/config";
import app from "./app.js";
import { connectDatabase, ensureSetup, closeDatabase } from "./config/database.js";
import { seedAdmin } from "./services/userService.js";

const PORT = process.env.PORT || 5000;

async function start() {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is missing. Add your Gemini API key to .env.");
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    throw new Error("JWT_SECRET is missing or too short (use at least 16 random characters).");
  }
  await connectDatabase();
  await ensureSetup();
  await seedAdmin();

  const server = app.listen(PORT, () => console.log(`🚀 API running on http://localhost:${PORT}`));

  const shutdown = async () => {
    server.close();
    await closeDatabase();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});
