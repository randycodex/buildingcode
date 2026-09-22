// Read-only public endpoints only. No account, sync, or Research requests.
// Defaults to an isolated local server; --origin explicitly selects a remote.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  assert.ok(args[index + 1] && !args[index + 1].startsWith("--"), `Missing value for ${name}`);
  return args[index + 1];
}
for (let index = 0; index < args.length; index += 2) {
  assert.ok(["--samples", "--origin"].includes(args[index]), `Unknown option: ${args[index]}`);
}
const samples = Number(option("--samples", "30"));
assert.ok(Number.isInteger(samples) && samples >= 1 && samples <= 100);
let origin = option("--origin", "");
let server;
let directory;
const suite = [
  { name: "broad-search", path: "/code/search?q=egress&limit=25" },
  { name: "section-search", path: "/code/search?q=1005.3.1&limit=25" },
  { name: "chapter-33-manifest", path: "/code/chapters/33" },
  { name: "chapter-33-five-bodies", path: "/code/chapters/33?include=body&bodyStart=0&bodyLimit=5" }
];
const percentile = (values, fraction) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return +sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)].toFixed(2);
};
try {
  if (!origin) {
    directory = await mkdtemp(join(tmpdir(), "permitext-public-profile-"));
    process.env.NODE_ENV = "test";
    process.env.VERCEL = "";
    process.env.VERCEL_ENV = "";
    process.env.PERMITEXT_SYNC_DATA_PATH = join(directory, "sync-store.json");
    for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL",
      "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL"]) delete process.env[key];
    const { handleRequest } = await import("../app.mjs");
    server = createServer(handleRequest);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
  } else {
    const url = new URL(origin);
    assert.ok(["http:", "https:"].includes(url.protocol));
    assert.equal(url.username + url.password + url.search + url.hash, "", "Use an origin without credentials, query, or fragment.");
    assert.equal(url.pathname, "/", "Use an origin, not a path.");
    origin = url.origin;
  }
  let revision = "unknown";
  try { revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch {}
  console.log(JSON.stringify({ type: "environment", timestamp: new Date().toISOString(), origin,
    localSourceRevision: revision, runtime: process.version, platform: process.platform,
    firstObservedSamples: 1, repeatSamples: samples,
    boundary: "HTTP response completion, not browser paint; first observed is not proven OS/process-cold; source may contain uncommitted measurement changes." }));
  let failures = 0;
  for (const entry of suite) {
    const successfulRepeats = [];
    for (let index = 0; index <= samples; index += 1) {
      const start = performance.now();
      let record;
      try {
        const response = await fetch(origin + entry.path, { signal: AbortSignal.timeout(20_000), redirect: "error" });
        const headersMs = performance.now() - start;
        const body = await response.text();
        const totalMs = performance.now() - start;
        assert.equal(response.status, 200);
        const payload = JSON.parse(body);
        assert.ok(payload && typeof payload === "object");
        record = { type: "sample", name: entry.name, sample: index, phase: index ? "repeat" : "first-observed",
          headersMs: +headersMs.toFixed(2), totalMs: +totalMs.toFixed(2), decodedBytes: Buffer.byteLength(body),
          cacheControl: response.headers.get("cache-control"), etag: response.headers.get("etag"),
          cdnCache: response.headers.get("x-vercel-cache"),
          bodyRange: payload.bodyRange ?? payload.chapter?.bodyRange ?? null, hasMore: payload.hasMore ?? null };
        if (index) successfulRepeats.push(totalMs);
      } catch (error) {
        failures += 1;
        record = { type: "failure", name: entry.name, sample: index,
          elapsedMs: +(performance.now() - start).toFixed(2), error: error.message };
      }
      console.log(JSON.stringify(record));
    }
    console.log(JSON.stringify({ type: "summary", name: entry.name, successfulRepeats: successfulRepeats.length,
      requestedRepeats: samples, p50Ms: percentile(successfulRepeats, 0.5), p95Ms: percentile(successfulRepeats, 0.95),
      note: "Percentiles exclude failures; inspect failure records and successful sample count." }));
  }
  if (failures) process.exitCode = 1;
} finally {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  if (directory) await rm(directory, { recursive: true, force: true });
}
