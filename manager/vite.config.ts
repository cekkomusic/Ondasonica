import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: true },
  // Firebase pesa ~240 kB gzip: accettabile per questa app.
  build: { chunkSizeWarningLimit: 1000 },
});
