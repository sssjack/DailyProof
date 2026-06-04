import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/DailyProof/",
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/DailyProof/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true
      }
    }
  }
});
