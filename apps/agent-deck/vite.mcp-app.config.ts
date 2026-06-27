import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../../packages/mcp-app/dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "mcp-app.html"),
    },
  },
});
