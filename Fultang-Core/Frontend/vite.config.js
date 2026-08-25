import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/",
  plugins: [react()],
  preview: {
    port: 5173,
    strictPort: true,
    host: true,
    allowedHosts: ["localhost", "127.0.0.1"],
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    allowedHosts: ["localhost", "127.0.0.1"],
  },
});
