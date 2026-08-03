import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8887";

export default defineConfig({
  plugins: [react()],
  server: { port: 5373, strictPort: true, proxy: { "/api": apiTarget } },
  preview: { port: 5373, strictPort: true, proxy: { "/api": apiTarget } },
  build: { sourcemap: true }
});
