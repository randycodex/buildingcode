import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { handleRequest } from "../app.mjs";
import {
  codeAssetContentType,
  isAllowedCodeAssetFileName,
  listCodeAssetRoots,
  resolveCodeAsset,
  rewriteCodeAssetURLs
} from "../code-asset-store.mjs";

const constructionAsset = "plumbing-code-figure-606-5-4-methods-of-connecting-overflow-from-gravity-house-and-suction-water-supply-tanks.png";
const zoningAsset = "zr-cb9efe3ace35b565-06-Hunts-Point-Map-3-Subarea-2-01_0.jpg";

async function request(path) {
  const server = createServer(handleRequest);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    const body = Buffer.from(await response.arrayBuffer());
    return {
      status: response.status,
      mediaType: response.headers.get("content-type"),
      cacheControl: response.headers.get("cache-control"),
      body
    };
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

assert.equal(isAllowedCodeAssetFileName(constructionAsset), true);
assert.equal(isAllowedCodeAssetFileName(zoningAsset), true);
assert.equal(isAllowedCodeAssetFileName("../secret.png"), false);
assert.equal(isAllowedCodeAssetFileName("nested/file.png"), false);
assert.equal(isAllowedCodeAssetFileName("notes.txt"), false);
assert.equal(codeAssetContentType(constructionAsset), "image/png");
assert.equal(codeAssetContentType(zoningAsset), "image/jpeg");

const roots = await listCodeAssetRoots();
assert(roots.some((root) => root.id === "2022-construction-codes"), "Construction asset root is not allowlisted.");
assert(roots.some((root) => root.id === "2026-zoning-resolution"), "Zoning asset root is not allowlisted.");
assert(roots.some((root) => root.id === "2026-enacted-administrative-code"), "Enacted-admin asset root is not allowlisted.");
assert.equal(roots[0].id, "2022-construction-codes");

const construction = await resolveCodeAsset(constructionAsset);
assert.equal(construction.rootId, "2022-construction-codes");
assert(construction.path.endsWith(constructionAsset));

const zoning = await resolveCodeAsset(zoningAsset);
assert.equal(zoning.rootId, "2026-zoning-resolution");
assert(zoning.path.endsWith(zoningAsset));

const missing = await resolveCodeAsset("does-not-exist-in-any-root.png");
assert.equal(missing.path, null);
assert.equal(missing.reason, "missing");

const rewritten = rewriteCodeAssetURLs(
  `<a href="../../../assets/${zoningAsset}"><img src="../../../assets/${constructionAsset}"></a>`,
  "test"
);
assert.match(rewritten, new RegExp(`/code/assets/${constructionAsset.replaceAll(".", "\\.")}\\?v=test`));
assert.match(rewritten, new RegExp(`/code/assets/${zoningAsset.replaceAll(".", "\\.")}\\?v=test`));
assert.doesNotMatch(
  rewriteCodeAssetURLs('<a href="https://zr.planning.nyc.gov/article-vi/chapter-2#62-513">62-513</a>'),
  /\/code\/assets\//
);

const servedConstruction = await request(`/code/assets/${encodeURIComponent(constructionAsset)}`);
assert.equal(servedConstruction.status, 200);
assert.equal(servedConstruction.mediaType, "image/png");
assert.match(servedConstruction.cacheControl || "", /max-age=3600/);
assert(servedConstruction.body.length > 0);
assert.deepEqual(servedConstruction.body, await readFile(construction.path));

const servedZoning = await request(`/code/assets/${encodeURIComponent(zoningAsset)}`);
assert.equal(servedZoning.status, 200);
assert.match(servedZoning.mediaType || "", /image\/jpeg/);
assert(servedZoning.body.length > 0);

const notFound = await request("/code/assets/does-not-exist-in-any-root.png");
assert.equal(notFound.status, 404);

const traversal = await request("/code/assets/..%2Fpackage.json");
assert.equal(traversal.status, 404);

const unsupported = await request("/code/assets/NYCadmin.CSS");
assert.equal(unsupported.status, 404);

const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
assert(
  appSource.includes("(src|href)=") && appSource.includes("+assets"),
  "Web rewriteCodeHTML no longer rewrites both src and href asset paths."
);
assert(
  appSource.includes("complete searchable enacted-code library"),
  "Offline settings copy still describes Construction Codes only."
);

console.log("permitext code asset serving contract passed", {
  roots: roots.map((root) => root.id),
  constructionBytes: servedConstruction.body.length,
  zoningBytes: servedZoning.body.length
});
