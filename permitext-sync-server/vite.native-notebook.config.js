import { resolve } from "node:path";
import { copyFileSync } from "node:fs";
import { defineConfig } from "vite";

const output = resolve("../NYC CC APP/permitext/Resources/NotebookEditor");
export default defineConfig({
  base: "./",
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  publicDir: false,
  plugins: [
    { name: "native-notebook-html", closeBundle() {
      copyFileSync(resolve("src/native-notebook.html"), resolve(output, "index.html"));
    } },
    { name: "native-notebook-emoji-locale", transform(code, id) {
      if (!id.endsWith("/@blocknote/core/dist/emoji-data.js")) return;
      // The editor uses BlockNote's English dictionary. Keep its emoji picker
      // data and avoid embedding every translation in the offline script.
      const english = code.match(/\ben:\s*\(\)\s*=>\s*import\(("\.\/en-[\w-]+\.js")\)/)?.[1];
      if (!english) return;
      return code.replace(/import\("\.\/[a-z]{2}(?:-[a-z]+)?-[\w-]+\.js"\)/g, `import(${english})`);
    } }
  ],
  build: {
    outDir: output,
    emptyOutDir: false,
    lib: { entry: resolve("src/native-notebook.js"), formats: ["iife"], name: "PermitextNotebookBundle", fileName: () => "native-notebook.js" },
    rollupOptions: { output: { inlineDynamicImports: true, assetFileNames: (asset) => asset.name?.endsWith(".css") ? "native-notebook.css" : "[name][extname]" } }
  }
});
