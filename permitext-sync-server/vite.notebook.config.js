import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/web/notebook-assets/",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production")
  },
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
        assetFileNames: (assetInfo) => assetInfo.name?.endsWith(".css")
          ? "notebook.css"
          : "[name][extname]",
        chunkFileNames: "[name]-[hash].js"
      }
    }
  }
});
