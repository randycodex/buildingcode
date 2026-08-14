import { access, readdir, readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = dirname(fileURLToPath(import.meta.url));
const authoredRoot = join(
  serverRoot,
  "..",
  "NYC CC APP",
  "permitext",
  "Resources",
  "CodeContent",
  "authored",
  "new-york-city"
);

const allowedAssetName = /^[a-zA-Z0-9._-]+$/;
const allowedExtensions = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const mimeByExtension = Object.freeze({
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
});

const preferredRootOrder = Object.freeze([
  "2022-construction-codes",
  "2026-zoning-resolution",
  "2026-existing-building-code",
  "2025-specialty-codes",
  "2026-enacted-administrative-code"
]);

let cachedRootsPromise = null;

export function isAllowedCodeAssetFileName(fileName) {
  const name = String(fileName || "").trim();
  return Boolean(name) && allowedAssetName.test(name) && allowedExtensions.has(extname(name).toLowerCase());
}

export function codeAssetContentType(fileName) {
  return mimeByExtension[extname(String(fileName || "")).toLowerCase()] || null;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

export async function listCodeAssetRoots() {
  if (cachedRootsPromise) return cachedRootsPromise;
  cachedRootsPromise = (async () => {
    const entries = await readdir(authoredRoot, { withFileTypes: true });
    const discovered = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.includes(" ")) continue;
      const assetDir = join(authoredRoot, entry.name, "assets");
      if (await exists(assetDir)) {
        discovered.push({
          id: entry.name,
          directory: entry.name,
          path: assetDir
        });
      }
    }
    const rank = new Map(preferredRootOrder.map((name, index) => [name, index]));
    discovered.sort((left, right) => {
      const leftRank = rank.has(left.id) ? rank.get(left.id) : preferredRootOrder.length + left.id.localeCompare(right.id);
      const rightRank = rank.has(right.id) ? rank.get(right.id) : preferredRootOrder.length;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return left.id.localeCompare(right.id);
    });
    return discovered;
  })().catch((error) => {
    cachedRootsPromise = null;
    throw error;
  });
  return cachedRootsPromise;
}

export async function resolveCodeAsset(fileName) {
  const name = String(fileName || "").trim();
  if (!isAllowedCodeAssetFileName(name)) {
    return { path: null, rootId: null, reason: "unsupported-filename" };
  }
  for (const root of await listCodeAssetRoots()) {
    const candidate = join(root.path, name);
    if (await exists(candidate)) {
      return { path: candidate, rootId: root.id, reason: null };
    }
  }
  return { path: null, rootId: null, reason: "missing" };
}

export async function readCodeAsset(fileName) {
  const resolved = await resolveCodeAsset(fileName);
  if (!resolved.path) return { ...resolved, body: null, mediaType: null };
  return {
    ...resolved,
    body: await readFile(resolved.path),
    mediaType: codeAssetContentType(fileName)
  };
}

export function rewriteCodeAssetURLs(html, versionQuery = "") {
  const suffix = versionQuery ? `?v=${versionQuery}` : "";
  return String(html || "").replace(
    /\b(src|href)=(["'])(?:\.\.\/)+assets\/([^"']+)\2/gi,
    (_match, attribute, quote, fileName) =>
      `${attribute}=${quote}/code/assets/${encodeURIComponent(fileName)}${suffix}${quote}`
  );
}
