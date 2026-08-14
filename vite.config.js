import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The existing backend's Socket.IO CORS config is hardcoded to
// http://localhost:3000 (see backend/app.js). We keep this app on the same
// port so the signaling connection keeps working without touching the backend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
  },
  preview: {
    port: 3000,
    strictPort: true,
  },
});
