import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseZoningChapterHTML,
  stableZoningChapterID,
  stableZoningSectionID,
  zoningResolutionContract
} from "../zoning-resolution.mjs";

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const contentRoot = join(
  serverRoot,
  "..",
  "NYC CC APP",
  "permitext",
  "Resources",
  "CodeContent",
  "authored",
  "new-york-city",
  "2026-zoning-resolution"
);
const preparedRoot = join(contentRoot, "prepared");
const sectionRoot = join(preparedRoot, "sections");
const chapterHTMLRoot = join(contentRoot, "chapters");
const assetRoot = join(contentRoot, "assets");

async function readJSON(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

const definitionFixture = parseZoningChapterHTML(`
  <article class="node node--type-section node--view-mode-default" data-node-id="18523"
    data-section="12-10" about="/article-i/chapter-2/12-10">
    <span class="field--name-title">12-10</span>
    <h3>DEFINITIONS</h3>
    <div class="sec-body">
      <div class="field--name-body field__item"><p>Definitions preamble.</p></div>
      <article class="node--type-defined-term">
        <h2>cellar</h2><p>Operative cellar definition.</p>
      </article>
    </div>
  </article>
`, {
  articleRoman: "I",
  articleTitle: "General Provisions",
  chapterNumber: "2",
  chapterTitle: "Construction of Language and Definitions",
  canonicalChapterNumber: "I-2",
  sourcePath: "/article-i/chapter-2"
});
assert.match(definitionFixture.sections[0].plainText, /Definitions preamble/);
assert.match(definitionFixture.sections[0].plainText, /Operative cellar definition/);

const [bundle, sourceManifest, preparedManifest, searchIndex, sectionFileNames, chapterHTMLFileNames] =
  await Promise.all([
    readJSON(join(contentRoot, "bundle.json")),
    readJSON(join(contentRoot, "source-manifest.json")),
    readJSON(join(preparedRoot, "manifest.json")),
    readJSON(join(preparedRoot, "searchIndex.json")),
    readdir(sectionRoot),
    readdir(chapterHTMLRoot)
  ]);

assert.equal(sourceManifest.libraryID, zoningResolutionContract.libraryID);
assert.equal(sourceManifest.sourceAuthority, "New York City Department of City Planning");
assert.equal(sourceManifest.textChangesThrough, zoningResolutionContract.textChangesThrough);
assert.equal(sourceManifest.researchEligibility, false);
assert.match(sourceManifest.researchBlockedReason, /evaluation gates/i);
assert.equal(bundle.zoningContract.researchEligibility, false);
assert.equal(bundle.codes[0].name, zoningResolutionContract.codeVersion);
assert.equal(preparedManifest.codeVersion, zoningResolutionContract.codeVersion);
assert.equal(preparedManifest.textChangesThrough, zoningResolutionContract.textChangesThrough);

const summary = sourceManifest.validationSummary;
assert.equal(summary.articles, 14);
assert(summary.chapters >= zoningResolutionContract.minimums.chapters);
assert(summary.sections >= zoningResolutionContract.minimums.sections);
assert(summary.tables >= zoningResolutionContract.minimums.tables);
assert(summary.appendixPages >= zoningResolutionContract.minimums.appendices);
assert(summary.mapReferences > 0);
assert(summary.amendmentEvents > 0);
assert(summary.assets > 0);
assert.equal(preparedManifest.chapters.length, summary.chapters + summary.appendixPages);
assert.equal(sectionFileNames.length, summary.sections);
assert.equal(chapterHTMLFileNames.filter((name) => name.endsWith(".html")).length, summary.chapters + summary.appendixPages);
assert.equal(sourceManifest.documents.length, summary.chapters + summary.appendixPages + 15);
assert.equal(sourceManifest.assets.length, summary.assets);
assert.deepEqual(
  sourceManifest.sectionCompletenessRepairs.map((repair) => [repair.sectionID, repair.sectionNumber]),
  [[20_018_523, "12-10"]]
);

const chapterIDs = bundle.chapters.map((chapter) => chapter.id);
assert.equal(new Set(chapterIDs).size, chapterIDs.length);
assert.equal(stableZoningChapterID("I", "2"), 15_000_102);
assert.equal(stableZoningSectionID(18_521), 20_018_521);
assert(bundle.chapters.some((chapter) => chapter.chapterNumber === "I-2"));
assert(bundle.chapters.some((chapter) => chapter.chapterNumber.startsWith("APP-")));

const sectionIDs = [];
let tableCount = 0;
let mapReferenceCount = 0;
let amendmentEventCount = 0;
let subsectionCount = 0;
let specialDistrictCount = 0;
let appendixSectionCount = 0;
let localAssetReferenceCount = 0;
let sectionTwelveOne = null;
let sectionTwelveTen = null;
for (const fileName of sectionFileNames) {
  assert.match(fileName, /^\d+\.json$/);
  const section = await readJSON(join(sectionRoot, fileName));
  const zoning = section.zoning;
  sectionIDs.push(section.sectionID);
  assert.equal(fileName, `${section.sectionID}.json`);
  assert.equal(stableZoningSectionID(zoning.sourceNodeID), section.sectionID);
  assert.match(zoning.sourceURL, /^https:\/\/zr\.planning\.nyc\.gov\//);
  assert.match(zoning.sourceContentHash, /^[a-f0-9]{64}$/);
  assert.equal(zoning.version, zoningResolutionContract.codeVersion);
  assert.equal(zoning.researchEligibility, false);
  assert(section.blocks.length > 0);
  assert(section.previewText.trim().length > 0);
  assert(Array.isArray(zoning.amendmentHistory));
  tableCount += zoning.tables.length;
  mapReferenceCount += zoning.mapReferences.length;
  amendmentEventCount += zoning.amendmentHistory.length;
  subsectionCount += zoning.subsections.length;
  specialDistrictCount += zoning.specialDistrict ? 1 : 0;
  appendixSectionCount += zoning.appendix ? 1 : 0;
  localAssetReferenceCount += section.blocks.reduce(
    (count, block) => count + (String(block.html || "").match(/\.\.\/\.\.\/\.\.\/assets\/zr-/g)?.length || 0),
    0
  );
  if (section.sectionNumber === "12-01") sectionTwelveOne = section;
  if (section.sectionNumber === "12-10") sectionTwelveTen = section;
}

assert.equal(new Set(sectionIDs).size, sectionIDs.length);
assert.equal(tableCount, summary.tables);
assert.equal(mapReferenceCount, summary.mapReferences);
assert.equal(amendmentEventCount, summary.amendmentEvents);
assert.equal(subsectionCount, summary.subsections);
assert(specialDistrictCount > 0);
assert(appendixSectionCount > 0);
assert(localAssetReferenceCount > 0);
assert(sectionTwelveOne);
assert.match(sectionTwelveOne.previewText, /particular shall control the general/i);
assert(sectionTwelveOne.zoning.amendmentHistory.length > 0);
assert(searchIndex.tokens.particular.includes(sectionTwelveOne.sectionID));
assert(sectionTwelveTen);
assert(sectionTwelveTen.blocks.map((block) => block.plainText).join("\n").length > 100_000);
assert(sectionTwelveTen.zoning.subsections.length > 100);
assert.match(sectionTwelveTen.blocks.map((block) => block.plainText).join("\n"), /zoning lot/i);
assert.match(sectionTwelveTen.blocks.map((block) => block.plainText).join("\n"), /cellar/i);
assert.match(sectionTwelveTen.blocks.map((block) => block.plainText).join("\n"), /floor area/i);
assert(searchIndex.tokens.cellar.includes(sectionTwelveTen.sectionID));

for (const asset of sourceManifest.assets) {
  assert.match(asset.fileName, /^zr-[a-f0-9]{16}-[a-zA-Z0-9._-]+$/);
  const path = join(assetRoot, asset.fileName);
  const fileStat = await stat(path);
  assert.equal(fileStat.size, asset.byteCount);
  assert.equal(sha256(await readFile(path)), asset.contentHash);
}

console.log(
  `zoning resolution contract passed: ${summary.sections} provisions, ` +
  `${summary.tables} tables, ${summary.mapReferences} map references, ${summary.amendmentEvents} amendment events`
);
