import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";

const directory = await fs.mkdtemp(join(tmpdir(), "permitext-construction-singleflight-"));
for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL", "BLOB_READ_WRITE_TOKEN", "VERCEL_OIDC_TOKEN"]) delete process.env[key];
Object.assign(process.env, { NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "", PERMITEXT_SYNC_DATA_PATH: join(directory, "sync.json") });
const originalRead = fs.readFile;
const counts = new Map();
let failNext = null;
let failedPath = null;
fs.readFile = async function (path, ...args) {
  const name = String(path);
  if (name.includes("/2022-construction-codes/prepared/")) counts.set(name, (counts.get(name) || 0) + 1);
  if (failNext?.(name)) {
    failNext = null;
    failedPath = name;
    // Keep the failure pending until the concurrent HTTP callers have joined.
    await new Promise(resolve => setTimeout(resolve, 20));
    throw Object.assign(new Error("Synthetic transient bundled content failure"), { code: "EIO" });
  }
  return originalRead.call(this, path, ...args);
};
syncBuiltinESMExports();
const { handleRequest } = await import("../app.mjs");
const server = createServer(handleRequest);
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const originalFetch = globalThis.fetch;
globalThis.fetch = (url, ...args) => {
  assert.equal(new URL(url).origin, base, "This fixture must never make external requests");
  return originalFetch(url, ...args);
};
const request = async path => {
  const response = await fetch(base + path);
  return { status: response.status, cacheControl: response.headers.get("cache-control"), body: await response.json() };
};

try {
  const chapterPaths = ["BC", "PC", "MC", "AC"].map(code => `/code/chapters?code=${code}&view=startup`);
  failNext = name => name.includes("/2022-construction-codes/prepared/chapters/") && name.endsWith(".json");
  const failed = await Promise.all(chapterPaths.map(request));
  assert.ok(failed.every(result => result.status === 500 && result.cacheControl === "no-store"));
  const firstChapter = failedPath;
  assert.equal(counts.get(firstChapter), 1);
  const chapters = await Promise.all(chapterPaths.map(request));
  assert.ok(chapters.every(result => result.status === 200 && result.body.chapters.length > 0));
  const chapterReads = [...counts].filter(([path]) => path.includes("/prepared/chapters/") && path.endsWith(".json"));
  assert.ok(chapterReads.length > 100);
  assert.ok(chapterReads.every(([path, count]) => count === (path === firstChapter ? 2 : 1)),
    "Four cold selectors must share one complete chapter-metadata pass");

  const searches = ["concrete", "fire", "egress", "ramp"].map(query => `/code/search?q=${query}&code=BC&match=exact&candidateOffset=0&limit=5`);
  failNext = name => name.endsWith("/2022-construction-codes/prepared/searchIndex.json");
  const failedSearches = await Promise.all(searches.map(request));
  assert.ok(failedSearches.every(result => result.status === 500 && result.cacheControl === "no-store"));
  const indexPath = failedPath;
  assert.equal(counts.get(indexPath), 1);
  const results = await Promise.all(searches.map(request));
  assert.ok(results.every(result => result.status === 200 && result.body.results.length === 5));
  assert.equal(counts.get(indexPath), 2, "Four concurrent searches must share the successful index retry");
  for (const [index, path] of searches.entries()) {
    assert.deepEqual(await request(path), results[index], "Cached response must preserve snippets, ranking and cursor metadata");
    const first = results[index].body;
    const next = await request(`${path.replace("candidateOffset=0", `candidateOffset=${first.nextCandidateOffset}`)}&offset=5`);
    const larger = await request(path.replace("limit=5", "limit=10"));
    assert.deepEqual([...first.results, ...next.body.results], larger.body.results,
      "Sharing immutable loads must retain exact-search pagination");
  }
  console.log("Construction singleflight HTTP passed: concurrent chapter/search loads share one attempt, transient errors remain uncached and retry, and exact-search response/cursor parity is preserved.");
} finally {
  globalThis.fetch = originalFetch;
  fs.readFile = originalRead;
  syncBuiltinESMExports();
  await new Promise(resolve => server.close(resolve));
  await fs.rm(directory, { recursive: true, force: true });
}
