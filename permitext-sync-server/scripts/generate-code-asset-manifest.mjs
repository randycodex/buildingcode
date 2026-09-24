import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { listCodeAssetRoots, isAllowedCodeAssetFileName } from "../code-asset-store.mjs";
import { codeAssetManifestRevision, validateCodeAssetManifest } from "../code-asset-manifest.mjs";

// Roots come directly from the serving resolver's precedence, including future
// discovered editions. A duplicate filename uses only its first served source.
export async function buildCodeAssetManifest(roots = null) {
  const assets = {};
  for (const root of roots || await listCodeAssetRoots()) {
    for (const name of (await readdir(root.path)).sort()) {
      if (!isAllowedCodeAssetFileName(name) || Object.hasOwn(assets, name)) continue;
      const bytes = await readFile(join(root.path, name));
      assets[name] = { sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, rootId: root.id };
    }
  }
  const ordered = Object.fromEntries(Object.keys(assets).sort().map(name => [name, assets[name]]));
  return { schemaVersion: 1, assetRevision: codeAssetManifestRevision(ordered), assets: ordered };
}

export async function verifyCodeAssetManifest(file, roots = null) {
  const stored = validateCodeAssetManifest(JSON.parse(await readFile(file, "utf8")));
  const generated = await buildCodeAssetManifest(roots);
  if (JSON.stringify(stored) !== JSON.stringify(generated)) throw new Error("Public code asset manifest is stale; run scripts/generate-code-asset-manifest.mjs");
  return generated;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = new URL("../generated/code-asset-manifest.json", import.meta.url);
  const manifest = process.argv.includes("--verify")
    ? await verifyCodeAssetManifest(output) : await buildCodeAssetManifest();
  if (!process.argv.includes("--verify")) await writeFile(output, JSON.stringify(manifest) + "\n");
  console.log(`${process.argv.includes("--verify") ? "Verified" : "Generated"} ${Object.keys(manifest.assets).length} served public assets; revision ${manifest.assetRevision}`);
}
