import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    transformer: "lightningcss",
  },
  build: {
    cssMinify: "lightningcss",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/")
          ) {
            return "vendor-react";
          }
          if (id.includes("node_modules/lucide-react/")) {
            return "vendor-icons";
          }
          if (
            id.includes("node_modules/jszip/") ||
            id.includes("node_modules/jose/") ||
            id.includes("node_modules/spark-md5/") ||
            id.includes("node_modules/react-dropzone/")
          ) {
            return "vendor-utils";
          }
          return undefined;
        },
      },
    },
  },
});
