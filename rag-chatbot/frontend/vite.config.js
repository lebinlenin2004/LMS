import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // In development, /api/* is forwarded to the Express backend (no CORS headaches).
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        timeout: 180000,
        proxyTimeout: 180000,
      },
    },
  },
});
