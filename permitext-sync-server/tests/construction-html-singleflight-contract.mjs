import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";

const original = fs.readFile;
const counts = new Map();
let failChapter34 = true;

fs.readFile = async function (path, ...args) {
  const name = String(path);
  if (name.includes("/chapters/") && name.endsWith(".html")) {
    counts.set(name, (counts.get(name) || 0) + 1);
    if (failChapter34 && name.endsWith("/34.html")) {
      failChapter34 = false;
      throw Object.assign(new Error("Synthetic transient read error"), { code: "EIO" });
    }
  }
  return original.call(this, path, ...args);
};
syncBuiltinESMExports();

try {
  const { constructionChapterHTMLSource } = await import("../construction-html-content.mjs");
  const results = await Promise.all(
    Array.from({ length: 32 }, (_, index) => constructionChapterHTMLSource(
      index % 2 ? " bc " : "BC",
      index % 2 ? " 33 " : "33"
    ))
  );
  const first = results[0];
  assert.ok(first.html.length > 1000);
  assert.ok(results.every((result) => result === first), "Concurrent readers share the exact resolved object");
  assert.equal(counts.get(first.path), 1);
  assert.equal(first.html, await original(first.path, "utf8"), "Shared payload retains exact source bytes");
  assert.equal(await constructionChapterHTMLSource("BC", "33"), first);
  assert.equal(counts.get(first.path), 1);

  const [a, b] = await Promise.all([
    constructionChapterHTMLSource("BC", "31"),
    constructionChapterHTMLSource("BC", "32")
  ]);
  assert.ok(a && b);
  assert.notEqual(a.path, b.path);
  assert.notEqual(a, b);
  assert.equal(counts.get(a.path), 1);
  assert.equal(counts.get(b.path), 1);

  const errors = await Promise.allSettled(
    Array.from({ length: 32 }, () => constructionChapterHTMLSource("BC", "34"))
  );
  assert.ok(errors.every((result) => result.status === "rejected" && result.reason.code === "EIO"));
  const retry = await constructionChapterHTMLSource("BC", "34");
  assert.ok(retry?.html);
  assert.equal(counts.get(retry.path), 2, "Transient errors are not cached and next call retries");

  const missing = await Promise.all(
    Array.from({ length: 32 }, () => constructionChapterHTMLSource("BC", "999999"))
  );
  assert.ok(missing.every((result) => result === null));
  const missingCounts = [...counts].filter(([path]) => path.includes("999999"));
  assert.ok(missingCounts.length);
  assert.ok(missingCounts.every(([, count]) => count === 1), "Missing search probes are shared across concurrent callers");
  await constructionChapterHTMLSource("BC", "999999");
  assert.deepEqual(
    [...counts].filter(([path]) => path.includes("999999")),
    missingCounts,
    "Resolved missing chapters retain negative cache"
  );

  console.log("Construction HTML singleflight passed: 32 real reads coalesce to 1, exact bytes/object, chapter isolation, transient retry and missing probes.");
} finally {
  fs.readFile = original;
  syncBuiltinESMExports();
}
