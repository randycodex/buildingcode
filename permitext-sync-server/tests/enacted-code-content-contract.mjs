import assert from "node:assert/strict";
import {
  enactedChapter,
  enactedChapterIndex,
  enactedCodePrefixes,
  enactedContentMetadata,
  enactedSearchIndex,
  enactedSection,
  enactedSectionCatalog,
  enactedSectionSummary,
  enactedSyncCodeVersionForPrefix,
  isEnactedCodeChapterID,
  isEnactedCodeSectionID
} from "../enacted-code-content.mjs";

const expectedSectionCounts = {
  T24: 408,
  T25: 261,
  T26: 228,
  BC68: 949,
  HMC: 211,
  T28: 2602,
  FC: 415,
  LL: 225,
  ECC: 68,
  EC: 293
};

const metadata = await enactedContentMetadata();
assert.equal(metadata.length, 2);
assert.deepEqual(
  metadata.flatMap((library) => library.codePrefixes).sort(),
  Object.keys(expectedSectionCounts).sort()
);
assert.equal(metadata[0].verificationStatus.includes("republication-rights review required"), true);
assert.equal(Array.isArray(metadata[0].codeSections), true);
assert.equal(metadata[0].codeSections.some((section) => section.prefix === "FC"), true);
assert.match(metadata[0].sourceURL, /^https:\/\//);
assert.equal(metadata[1].energyEffectiveDate, "2026-03-30");
assert.equal(metadata[1].electricalEffectiveDate, "2025-12-21");
assert.match(metadata[1].energySourceURL, /^https:\/\//);
assert.match(metadata[1].electricalSourceURL, /^https:\/\//);
assert.match(metadata[1].extractionBoundary, /NFPA 70|amendments/i);

const chapters = await enactedChapterIndex();
assert.equal(chapters.length, 156);
assert(chapters.every((chapter) => chapter.sectionCount > 0));
assert(chapters.every((chapter) => enactedCodePrefixes.has(chapter.codePrefix)));
assert(chapters.every((chapter) => isEnactedCodeChapterID(chapter.id)));
assert.equal((await enactedChapter(chapters[0].id)).groups.length > 0, true);

const catalog = await enactedSectionCatalog();
assert.equal(catalog.length, 5660);
for (const [prefix, expectedCount] of Object.entries(expectedSectionCounts)) {
  assert.equal(
    catalog.filter((section) => section.codePrefix === prefix).length,
    expectedCount,
    `${prefix} section count changed`
  );
}
assert(catalog.every((section) => isEnactedCodeSectionID(section.id)));

const samples = [
  ["T25", "25-303", "landmarks"],
  ["BC68", "27-101", "1968 building code"],
  ["HMC", "27-2001", "housing maintenance code"],
  ["T28", "28-101.1", "administration"],
  ["FC", "29-101", "fire code"],
  ["ECC", "101", "energy conservation"],
  ["EC", "110.2", "electrical"]
];

for (const [prefix, sectionNumber, expectedText] of samples) {
  const summary = catalog.find(
    (section) => section.codePrefix === prefix && section.sectionNumber === sectionNumber
  );
  assert(summary, `${prefix} ${sectionNumber} is missing`);
  assert.equal((await enactedSectionSummary(summary.id)).id, summary.id);
  const detail = await enactedSection(summary.id);
  assert(detail.blocks.length > 0);
  assert(
    `${detail.title} ${detail.officialText}`.toLowerCase().includes(expectedText),
    `${prefix} ${sectionNumber} lost expected enacted text`
  );
  assert(!detail.officialText.includes("[ALP S-"));
  assert(!detail.officialText.includes("Editor's note:"));
  assert(enactedSyncCodeVersionForPrefix(prefix));
}

const localLaw = catalog.find((section) => section.codePrefix === "LL");
assert(localLaw);
const localLawBody = await enactedSection(localLaw.id);
assert.match(localLaw.sectionNumber, /^L\.L\.\s+\d{4}\/\d+/);
assert.match(localLawBody.officialText, /take effect|effective|construction|building|housing|landmark|fire/i);

const index = await enactedSearchIndex();
assert(index.get("landmark")?.size > 0);
assert(index.get("electrical")?.size > 0);
assert(index.get("effective")?.size > 0);

console.log("permitext enacted-code content contract passed");
