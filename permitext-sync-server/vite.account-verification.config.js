import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/web/account-verification-assets/",
  // The shared Clerk instance and publishable key are supplied at runtime.
  // Keep local and hosting VITE_* settings out of this standalone bundle.
  envDir: false,
  envPrefix: [],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  publicDir: false,
  build: {
    outDir: resolve("public/account-verification-assets"),
    emptyOutDir: false,
    lib: {
      entry: resolve("src/account-verification.js"),
      formats: ["es"],
      fileName: () => "account-verification.js"
    },
    rollupOptions: { output: { chunkFileNames: "[name]-[hash].js" } }
  }
});
