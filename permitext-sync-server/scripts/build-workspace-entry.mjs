import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { build } from "vite";

// Keep the authored modules available for development and existing offline
// manifests. Only the deployable entry is bundled: its URL and shell generation
// stay the same, and optional editors still load on demand from /web/.
export async function buildWorkspaceEntry(source, output) {
  const entry = resolve(source, "app.js");
  const sourceBytes = Buffer.byteLength(await readFile(entry));
  const result = await build({
    configFile: false,
    publicDir: false,
    base: "/web/",
    logLevel: "warn",
    build: {
      write: false,
      target: "es2022",
      minify: true,
      dynamicImportVarsOptions: { exclude: [/app\.js$/] },
      lib: { entry, formats: ["es"], fileName: () => "app.js" },
      rolldownOptions: {
        external: (id) => id.startsWith("/web/"),
        output: { codeSplitting: false }
      }
    }
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(item => item.output);
  const chunks = outputs.filter(item => item.type === "chunk");
  if (outputs.some(item => item.type !== "chunk")) {
    throw new Error("Workspace entry emitted additional assets; include them in the deployment and offline manifest before bundling.");
  }
  if (chunks.length !== 1 || chunks[0].fileName !== "app.js" || chunks[0].imports.length) {
    throw new Error("Workspace entry must contain its complete eager module graph.");
  }
  if (chunks[0].dynamicImports.some(id => !id.startsWith("/web/"))) {
    throw new Error("Optional workspace imports must retain their versioned /web/ URLs.");
  }
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "app.js"), chunks[0].code);
  return { sourceBytes, bundleBytes: Buffer.byteLength(chunks[0].code),
    gzipBytes: gzipSync(chunks[0].code).length, eagerRequests: 1,
    bundledModules: Object.keys(chunks[0].modules).length };
}
