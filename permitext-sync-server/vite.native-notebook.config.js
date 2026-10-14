import { resolve } from "node:path";
import { copyFileSync } from "node:fs";
import { defineConfig } from "vite";

const output = resolve("../NYC CC APP/permitext/Resources/NotebookEditor");
export default defineConfig({
  base: "./",
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  publicDir: false,
  plugins: [{ name: "native-notebook-html", closeBundle() {
    copyFileSync(resolve("src/native-notebook.html"), resolve(output, "index.html"));
  } }],
  build: {
    outDir: output,
    emptyOutDir: false,
    lib: { entry: resolve("src/native-notebook.js"), formats: ["iife"], name: "PermitextNotebookBundle", fileName: () => "native-notebook.js" },
    rollupOptions: { output: { inlineDynamicImports: true, assetFileNames: (asset) => asset.name?.endsWith(".css") ? "native-notebook.css" : "[name][extname]" } }
  }
});
