import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activeCodeSourceCatalog, findActiveCodeSource, buildActiveCodeSourceOptions, readActiveCodeSourceMetadata } from "../active-code-source-catalog.mjs";
import { codeSourceKey } from "../public/active-code-sources.js";
import { enactedContentMetadata, enactedChapterIndex } from "../enacted-code-content.mjs";
import { historicalConstructionChapterIndex } from "../historical-construction-content.mjs";

const catalog = await activeCodeSourceCatalog();
assert.equal(catalog.length, 22);
assert.equal(new Set(catalog.map(source => source.canonicalEdition)).size, 6);
assert.equal(new Set(catalog.map(codeSourceKey)).size, 22);
assert.ok(Object.isFrozen(catalog) && catalog.every(Object.isFrozen));
assert.equal(await activeCodeSourceCatalog(), catalog);
const edition = directory => `CodeContent/authored/new-york-city/${directory}/bundle.json#1`;
const old = await findActiveCodeSource({ canonicalEdition: edition("2026-enacted-administrative-code"), codePrefix: "BC68" });
const gas = await findActiveCodeSource({ canonicalEdition: edition("2022-construction-codes"), codePrefix: "FGC" });
assert.deepEqual([old.jurisdictionID, old.codeID, old.categoryID], [1, 1, 4]);
assert.deepEqual([gas.jurisdictionID, gas.codeID, gas.categoryID], [1, 1, 4]);
assert.notEqual(codeSourceKey(old), codeSourceKey(gas));
const bc2014 = await findActiveCodeSource({ canonicalEdition: edition("2014-construction-codes"), codePrefix: "BC" });
const bc2022 = await findActiveCodeSource({ canonicalEdition: edition("2022-construction-codes"), codePrefix: "BC" });
assert.equal(bc2014.categoryID, 2);
assert.equal(bc2022.categoryID, 1);
assert.notEqual(codeSourceKey(bc2014), codeSourceKey(bc2022));
assert.equal(await findActiveCodeSource({ codePrefix: "BC" }), null);
assert.equal(await findActiveCodeSource({ canonicalEdition: "missing", codePrefix: "BC" }), null);
assert.equal(await findActiveCodeSource({ canonicalEdition: bc2014.canonicalEdition, categoryID: 1, codePrefix: "BC" }), null);
// Compare explicit mappings with existing serving providers, including administrative
// source-manifest prefix ordering and historical chapter metadata.
for (const metadata of await enactedContentMetadata()) {
  assert.deepEqual(catalog.filter(source => source.canonicalEdition === metadata.syncCodeVersion).map(source => source.codePrefix).sort(), [...metadata.codePrefixes].sort());
}
for (const chapter of [...await enactedChapterIndex(), ...await historicalConstructionChapterIndex()]) {
  const source = await findActiveCodeSource({ canonicalEdition: chapter.codeVersion, categoryID: chapter.codeSectionID });
  assert.ok(source, `No exact source for chapter ${chapter.id}`);
  assert.equal(source.codePrefix, chapter.codePrefix);
}
const metadata = { jurisdictions: [{ id: 7 }], codes: [{ id: 9, jurisdictionID: 7, name: "Book" }], codeSections: [{ id: 42, codeID: 9, name: 'Category [with "quotes"]' }] };
assert.equal(buildActiveCodeSourceOptions(metadata, "exact-edition", { 42: "X" })[0].jurisdictionID, 7);
assert.throws(() => buildActiveCodeSourceOptions(metadata, "exact-edition", { 41: "X" }));
assert.throws(() => buildActiveCodeSourceOptions({ ...metadata, codes: [] }, "exact-edition", { 42: "X" }));
const directory = await mkdtemp(join(tmpdir(), "permitext-source-metadata-"));
try {
  const path = join(directory, "bundle.json");
  // Invalid trailing body proves the metadata reader does not parse passage/table bodies.
  await writeFile(path, JSON.stringify(metadata).slice(0, -1) + ',"tables":[' + 'invalid body '.repeat(100000));
  assert.deepEqual(await readActiveCodeSourceMetadata(path), metadata);
  await writeFile(path, '{"codes":[]}');
  await assert.rejects(readActiveCodeSourceMetadata(path), /metadata/);
} finally { await rm(directory, { recursive: true, force: true }); }
console.log("PASS active code source catalog: 22 exact sources, 6 packs, provider parity, bounded metadata reads");
