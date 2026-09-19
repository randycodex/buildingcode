import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/web/",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production")
  },
  publicDir: false,
  build: {
    outDir: resolve("public/web"),
    emptyOutDir: false,
    lib: {
      entry: resolve("src/web-analytics.js"),
      formats: ["es"],
      fileName: () => "analytics.js"
    }
  }
});
