import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAllowedCodeAssetFileName } from "./code-asset-store.mjs";

export function codeAssetManifestRevision(assets) {
  const pairs = Object.keys(assets).sort().map(name => [name, assets[name].sha256]);
  return createHash("sha256").update(JSON.stringify(pairs)).digest("hex");
}

export function validateCodeAssetManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || !manifest.assets || Array.isArray(manifest.assets)) throw new Error("Invalid public asset manifest");
  for (const [name, entry] of Object.entries(manifest.assets)) {
    if (!isAllowedCodeAssetFileName(name) || !/^[a-f0-9]{64}$/.test(entry?.sha256 || "") ||
        !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || typeof entry.rootId !== "string") {
      throw new Error(`Invalid public asset manifest entry: ${name}`);
    }
  }
  if (manifest.assetRevision !== codeAssetManifestRevision(manifest.assets)) throw new Error("Public asset manifest revision mismatch");
  return manifest;
}

let manifestPromise;
export function loadCodeAssetManifest() {
  manifestPromise ||= readFile(new URL("./generated/code-asset-manifest.json", import.meta.url), "utf8")
    .then(text => validateCodeAssetManifest(JSON.parse(text)))
    .catch(error => { manifestPromise = null; throw error; });
  return manifestPromise;
}
export async function codeAssetRevision() { return (await loadCodeAssetManifest()).assetRevision; }
export async function codeAssetManifestEntry(name) { return (await loadCodeAssetManifest()).assets[name] || null; }
