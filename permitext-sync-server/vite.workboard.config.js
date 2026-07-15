import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/web/workboard-assets/",
  publicDir: false,
  define: {
    "process.env.IS_PREACT": "false",
    "process.env.NODE_ENV": JSON.stringify("production")
  },
  plugins: [react()],
  build: {
    outDir: resolve("public/workboard-assets"),
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: resolve("src/workboard.jsx"),
      formats: ["es"],
      cssFileName: "workboard",
      fileName: () => "workboard.js"
    },
    rollupOptions: {
      output: {
        assetFileNames: "[name][extname]",
        chunkFileNames: "[name]-[hash].js"
      }
    }
  }
});
