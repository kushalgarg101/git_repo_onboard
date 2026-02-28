import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxies API calls to local FastAPI backend.
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["three"],
  },
  server: {
    port: 5173,
    proxy: {
      "/analyze": "http://127.0.0.1:8000",
      "/graph": "http://127.0.0.1:8000",
    },
  },
});
