import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/web/notebook-assets/",
  publicDir: false,
  build: {
    outDir: resolve("public/notebook-assets"),
    // This directory can contain user-created notebook exports alongside the
    // generated bundle. Overwrite the known bundle without deleting siblings.
    emptyOutDir: false,
    lib: {
      entry: resolve("src/notebook-editor.js"),
      formats: ["es"],
      fileName: () => "notebook.js"
    },
    rollupOptions: {
      output: {
        assetFileNames: "[name][extname]",
        chunkFileNames: "[name]-[hash].js"
      }
    }
  }
});
