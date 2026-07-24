import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/web/notebook-assets/",
  publicDir: false,
  build: {
    outDir: resolve("public/notebook-assets"),
    emptyOutDir: true,
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
