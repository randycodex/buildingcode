import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  historicalConstructionContentRoot,
  historicalConstructionContentMetadata,
  historicalConstructionSearchIndex,
  historicalConstructionSection,
  historicalConstructionSectionCatalog
} from "../historical-construction-content.mjs";

const readJSON = async (path) => JSON.parse(await readFile(path, "utf8"));
const source = await readJSON(join(historicalConstructionContentRoot, "source-manifest.json"));
const ledger = await readJSON(join(historicalConstructionContentRoot, "amendment-ledger.json"));
const discrepancies = await readJSON(join(historicalConstructionContentRoot, "discrepancy-manifest.json"));
const bundle = await readJSON(join(historicalConstructionContentRoot, "bundle.json"));
const metadata = await historicalConstructionContentMetadata();
const catalog = await historicalConstructionSectionCatalog();
const searchIndex = await historicalConstructionSearchIndex();

assert.equal(source.libraryID, "nyc-2014-construction-codes");
assert.equal(source.chapterPDFs.length, 110, "Every official DOB chapter and appendix PDF must be inventoried.");
assert.equal(ledger.updatePackets.length, 90, "Every official DOB update packet must be hashed.");
assert.match(source.baselineSourceSHA256, /^[a-f0-9]{64}$/);
assert.match(source.amendmentIndexSHA256, /^[a-f0-9]{64}$/);
assert.equal(metadata.applicabilityStatus, "prior-edition-case-specific");
assert.equal(metadata.researchEligibility, true);
assert.deepEqual(metadata.codePrefixes, ["AC", "BC", "PC", "MC", "FGC"]);
assert(catalog.length > 5_000, "The 2014 corpus unexpectedly contains too few granular sections.");
assert.equal(discrepancies.failClosed, true);
assert(
  discrepancies.records
    .filter((record) => record.kind === "unverified-table" || record.kind === "official-pdf-figure")
    .every((record) => record.researchClaimEligible === false && record.reviewRequired === true),
  "Unreviewed table and figure images must remain ineligible for Research claims."
);

const urls = [
  source.sourcePageURL,
  source.updatePageURL,
  source.baselineSourceURL,
  source.amendmentIndexURL,
  ...source.chapterPDFs.map((record) => record.sourceURL),
  ...ledger.updatePackets.map((record) => record.sourceURL)
];
assert(urls.every((url) => /^https:\/\/(?:www\.)?nyc\.gov\//i.test(url)));
assert.equal(urls.some((url) => /up\.codes/i.test(url)), false);

const visionPanel = catalog.find((section) =>
  section.codePrefix === "BC" && section.sectionNumber === "715.4.7.1"
);
assert(visionPanel, "BC 715.4.7.1 is missing from the 2014 Building Code corpus.");
const visionPanelBody = await historicalConstructionSection(visionPanel.id);
assert.match(visionPanelBody.officialText, /not more than 100 square inches/i);
assert.match(visionPanelBody.officialText, /without a dimension exceeding 10 inches/i);
assert.match(visionPanelBody.officialText, /having a 11\/2-hour fire protection rating/i);
assert(
  visionPanelBody.historicalConstructionCode.sourcePages.every((page) =>
    /^[a-f0-9]{64}$/.test(page.sourceSHA256) &&
    Number.isInteger(page.pdfPage) &&
    Array.isArray(page.contentBBox)
  ),
  "BC 715.4.7.1 must retain source hash, PDF page, and bounding-box provenance."
);

const appendixP = catalog.find((section) =>
  section.codePrefix === "BC" && section.sectionNumber === "P102.8.6"
);
assert(appendixP, "Appendix P section P102.8.6 is missing.");
const appendixPBody = await historicalConstructionSection(appendixP.id);
assert.match(appendixPBody.officialText, /Toilet paper dispensers/i);
assert(
  appendixPBody.blocks.some((block) => block.kind === "image" && /figure/i.test(block.caption || "")),
  "The official Appendix P figure must remain bound as page-cited visual evidence."
);

assert(searchIndex.get("vision")?.includes(visionPanel.id));
assert(bundle.tables.length > 0, "No independently verified structured tables were emitted.");
for (const table of bundle.tables) {
  assert.match(table.officialPDFProvenance.sourceSHA256, /^[a-f0-9]{64}$/);
  assert(Number.isInteger(table.officialPDFProvenance.pdfPage));
  assert.equal(table.officialPDFProvenance.extraction, "pdfplumber-grid verified against Poppler bbox text");
}

const assetNames = await readdir(join(historicalConstructionContentRoot, "assets"));
assert(assetNames.length > 0, "The official-PDF visual fallback directory is empty.");
assert(assetNames.every((name) => /^2014-(?:ac|bc|pc|mc|fgc)-/.test(name)));
for (const name of assetNames.slice(0, 5)) {
  await access(join(historicalConstructionContentRoot, "assets", name));
}

console.log("permitext 2014 historical Construction Code contract passed", {
  chapters: source.chapterPDFs.length,
  sections: catalog.length,
  tables: bundle.tables.length,
  discrepancies: discrepancies.records.length,
  assets: assetNames.length
});
