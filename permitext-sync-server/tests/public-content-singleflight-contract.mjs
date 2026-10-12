import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";

const originalRead = fs.readFile;
const counts = new Map();
let failedPath = null;
let failNext = null;
fs.readFile = async function (path, ...args) {
  const name = String(path);
  if (name.includes("/CodeContent/")) counts.set(name, (counts.get(name) || 0) + 1);
  if (failNext?.(name)) {
    failNext = null;
    failedPath = name;
    throw Object.assign(new Error("Synthetic transient bundled content read failure"), { code: "EIO" });
  }
  return originalRead.call(this, path, ...args);
};
syncBuiltinESMExports();

try {
  for (const [file, prefix, directory] of [
    ["historical-construction-content.mjs", "historicalConstruction", "2014-construction-codes"],
    ["existing-building-content.mjs", "existingBuilding", "2026-existing-building-code"],
    ["zoning-content.mjs", "zoning", "2026-zoning-resolution"]
  ]) {
    const content = await import(`../${file}`);
    const catalog = content[`${prefix}SectionCatalog`];
    const searchIndex = content[`${prefix}SearchIndex`];
    failNext = name => name.includes(`/${directory}/prepared/chapters/`) && name.endsWith(".json");
    const failedCatalogs = await Promise.allSettled(Array.from({ length: 16 }, () => catalog()));
    assert.ok(failedCatalogs.every(result => result.status === "rejected" && result.reason.code === "EIO"));
    assert.equal(counts.get(failedPath), 1, `${prefix}: concurrent catalog failures must share one read`);
    const failedChapter = failedPath;
    const catalogs = await Promise.all(Array.from({ length: 16 }, () => catalog()));
    assert.ok(catalogs[0].length > 100);
    assert.ok(catalogs.every(value => value === catalogs[0]), `${prefix}: all callers reuse the exact successful catalog`);
    assert.equal(await catalog(), catalogs[0]);
    const chapters = await content[`${prefix}ChapterIndex`]();
    for (const chapter of chapters) {
      const path = [...counts.keys()].find(name => name.endsWith(`/${directory}/prepared/chapters/${chapter.id}.json`));
      assert.ok(path, `${prefix}: every chapter remains represented`);
      assert.equal(counts.get(path), path === failedChapter ? 2 : 1, `${prefix}: chapter JSON must be loaded once after retry`);
      const source = JSON.parse(await originalRead(path, "utf8"));
      const sourceSections = (source.groups || []).flatMap(group => group.sections || []);
      const summaries = catalogs[0].filter(section => String(section.chapterID) === String(chapter.id));
      assert.deepEqual(summaries.map(section => [section.id, section.sectionNumber, section.title]),
        sourceSections.map(section => [section.id, section.sectionNumber, section.title]),
        `${prefix}: shared catalog must preserve source order, section identity and title`);
    }

    failNext = name => name.endsWith(`/${directory}/prepared/searchIndex.json`);
    const failedIndexes = await Promise.allSettled(Array.from({ length: 16 }, () => searchIndex()));
    assert.ok(failedIndexes.every(result => result.status === "rejected" && result.reason.code === "EIO"));
    const indexPath = failedPath;
    assert.equal(counts.get(indexPath), 1);
    const indexes = await Promise.all(Array.from({ length: 16 }, () => searchIndex()));
    assert.ok(indexes.every(value => value === indexes[0]));
    assert.equal(await searchIndex(), indexes[0]);
    assert.equal(counts.get(indexPath), 2, `${prefix}: only one retry may read and parse the search index`);
    const source = JSON.parse(await originalRead(indexPath, "utf8"));
    assert.equal(indexes[0].size, Object.keys(source.tokens).length);
    for (const [token, ids] of Object.entries(source.tokens)) {
      assert.deepEqual(indexes[0].get(token), [...ids].sort((left, right) => left - right));
    }
  }
  console.log("Public content singleflight passed: 16 concurrent callers share each real catalog/index, preserve source content, retry transient failures, and retain successful loads across all three editions.");
} finally {
  fs.readFile = originalRead;
  syncBuiltinESMExports();
}
