import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
  "2026-existing-building-code"
);
const preparedRoot = join(contentRoot, "prepared");

async function readJSON(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

const [bundle, source, manifest, sectionFiles, chapterFiles] = await Promise.all([
  readJSON(join(contentRoot, "bundle.json")),
  readJSON(join(contentRoot, "source-manifest.json")),
  readJSON(join(preparedRoot, "manifest.json")),
  readdir(join(preparedRoot, "sections")),
  readdir(join(preparedRoot, "chapters"))
]);

assert.equal(source.libraryID, "nyc-existing-building-code");
assert.equal(source.localLaw, "Local Law 33 of 2026");
assert.equal(source.enactedDate, "2026-01-17");
assert.equal(source.effectiveDate, "2027-07-17");
assert.equal(source.effectiveStatus, "enacted-not-yet-effective");
assert.equal(source.sourcePageCount, 270);
assert.match(source.sourceSHA256, /^[a-f0-9]{64}$/);
assert.equal(source.effectiveDateAuthority, "Local Law 42 of 2026");
assert.equal(source.validationSummary.conditionalEffectiveDateProvisionCaptured, true);
assert.equal(bundle.existingBuildingCodeContract.sourceSHA256, source.sourceSHA256);
assert.equal(bundle.codes[0].name, source.codeVersion);
assert.equal(manifest.chapters.length, source.validationSummary.chapterCount);
assert.equal(sectionFiles.length, source.validationSummary.sectionCount);
assert.equal(chapterFiles.length, source.validationSummary.chapterCount);
assert(bundle.chapters.some((chapter) => chapter.chapterNumber === "1"));
assert(bundle.chapters.some((chapter) => chapter.chapterNumber === "D1"));
assert(bundle.chapters.some((chapter) => chapter.chapterNumber === "H"));

let section101;
for (const fileName of sectionFiles) {
  assert.match(fileName, /^\d+\.json$/);
  const section = await readJSON(join(preparedRoot, "sections", fileName));
  assert.equal(section.existingBuildingCode.effectiveStatus, "enacted-not-yet-effective");
  assert.equal(section.existingBuildingCode.sourceSHA256, source.sourceSHA256);
  assert(section.blocks.some((block) => block.plainText.trim().length > 0));
  if (section.sectionNumber === "101") section101 = section;
}

assert(section101);
assert.match(section101.blocks[0].plainText, /repair, alteration, change of occupancy/i);
assert.equal(section101.existingBuildingCode.researchEligibility, true);

console.info("Existing Building Code content contract passed.");
