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
const imageManifest = await readJSON(join(historicalConstructionContentRoot, "prepared", "images.json"));
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
assert.equal(imageManifest.storage, "bundled-local-assets");
assert(
  discrepancies.records
    .filter((record) => record.kind === "unverified-table" || record.kind === "official-pdf-figure")
    .every((record) => record.researchClaimEligible === false && record.reviewRequired === true),
  "Unreviewed table and figure images must remain ineligible for Research claims."
);
assert(
  discrepancies.records
    .filter((record) => record.kind === "official-pdf-figure")
    .every((record) => /^\*?\s*FIGURE\s+[A-Z0-9.-]+/i.test(record.caption || "")),
  "Only actual PDF figure-caption lines may create figure assets."
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

const referencedCodes = catalog.find((section) =>
  section.codePrefix === "BC" && section.sectionNumber === "101.4"
);
assert(referencedCodes, "BC 101.4 is missing from the 2014 Building Code corpus.");
const referencedCodesBody = await historicalConstructionSection(referencedCodes.id);
assert.equal(
  referencedCodesBody.officialText.includes("\n"),
  false,
  "Physical PDF line endings must not become hard breaks inside ordinary prose."
);
assert.equal(
  referencedCodesBody.blocks[0].html.includes("<br>"),
  false,
  "Reader HTML must allow ordinary BC 101.4 prose to reflow."
);
assert.match(
  referencedCodesBody.officialText,
  /shall be considered part of the requirements/,
  "Soft-wrapped words must remain separated after normalization."
);

const firePrevention = catalog.find((section) =>
  section.codePrefix === "BC" && section.sectionNumber === "101.4.5"
);
assert(firePrevention, "BC 101.4.5 is missing from the 2014 Building Code corpus.");
const firePreventionBody = await historicalConstructionSection(firePrevention.id);
assert.match(firePreventionBody.officialText, /:\n1\. The manufacturing/);
assert.match(firePreventionBody.officialText, /;\n2\. The design/);
assert.match(
  firePreventionBody.blocks[0].html,
  /<br>1\. The manufacturing/,
  "Numbered legal items must retain intentional Reader breaks."
);

const fireRatedInspection = catalog.find((section) =>
  section.codePrefix === "BC" && section.sectionNumber === "110.3.4"
);
assert(fireRatedInspection, "BC 110.3.4 is missing from the 2014 Building Code corpus.");
const fireRatedInspectionBody = await historicalConstructionSection(fireRatedInspection.id);
assert.equal(/fire-\s+resistance-rated/i.test(fireRatedInspectionBody.officialText), false);
assert.match(
  fireRatedInspectionBody.officialText,
  /fire-resistance-rated construction/,
  "Words hyphenated across a physical PDF line must rejoin without an inserted space."
);

const siteSafetyTraining = catalog.find((section) =>
  section.codePrefix === "BC" && section.sectionNumber === "3321.1"
);
assert(siteSafetyTraining, "Amendment-marked BC 3321.1 must be parsed as its own legal section.");

const appendixP = catalog.find((section) =>
  section.codePrefix === "BC" && section.sectionNumber === "P102.8.6"
);
assert(appendixP, "Appendix P section P102.8.6 is missing.");
const appendixPBody = await historicalConstructionSection(appendixP.id);
assert.match(appendixPBody.officialText, /Toilet paper dispensers/i);
assert.match(appendixPBody.officialText, /within an area 24 inches/);
assert.equal(/within an are a 24 inches/.test(appendixPBody.officialText), false);
assert.equal(
  /FIGURE P102\.8\.6/.test(appendixPBody.officialText),
  false,
  "Figure captions must be owned by the visual block rather than duplicated in legal prose."
);
assert(
  appendixPBody.blocks.some((block) => block.kind === "image" && /figure/i.test(block.caption || "")),
  "The official Appendix P figure must remain bound as page-cited visual evidence."
);
const appendixPFigure = discrepancies.records.find((record) =>
  record.kind === "official-pdf-figure" && record.asset === "2014-bc-p-p0003-figure-01.png"
);
assert(appendixPFigure, "The Appendix P dispenser figure crop record is missing.");
assert.equal(appendixPFigure.cropMethod, "embedded-pdf-image-bbox-clipped-at-next-section");
assert(appendixPFigure.bbox[1] <= appendixPFigure.embeddedImageBBox[1]);
assert(appendixPFigure.bbox[3] >= appendixPFigure.embeddedImageBBox[3]);
assert(
  appendixPFigure.sourceEmbeddedImageBBox[3] > appendixPFigure.embeddedImageBBox[3],
  "The official PDF image's trailing white box must be clipped before the next legal section heading."
);

const accessibleUnits = catalog.find((section) =>
  section.codePrefix === "BC" && section.sectionNumber === "1107.6.1.1"
);
assert(accessibleUnits, "BC 1107.6.1.1 is missing.");
const accessibleUnitsBody = await historicalConstructionSection(accessibleUnits.id);
const accessibleUnitsTable = accessibleUnitsBody.blocks.find((block) =>
  block.kind === "table" && block.tableID === "nyc-2014-table-bc-11-p0012-01"
);
assert(accessibleUnitsTable, "BC Table 1107.6.1.1 is not bound to its Reader section.");
assert.match(accessibleUnitsTable.html, /<table\b/i);
assert.match(accessibleUnitsTable.html, /TABLE 1107\.6\.1\.1/i);
assert.equal(
  /MINIMUM REQUIRED NUMBER OF/.test(accessibleUnitsBody.officialText),
  false,
  "Structured table cells must not be duplicated as paragraph text."
);

assert(searchIndex.get("vision")?.includes(visionPanel.id));
assert(bundle.tables.length > 0, "No independently verified structured tables were emitted.");
for (const table of bundle.tables) {
  assert.match(table.officialPDFProvenance.sourceSHA256, /^[a-f0-9]{64}$/);
  assert(Number.isInteger(table.officialPDFProvenance.pdfPage));
  assert.equal(table.officialPDFProvenance.extraction, "pdfplumber-grid verified against Poppler bbox text");
  assert(
    !table.caption || /^\*?\s*TABLE\s+[A-Z0-9]/i.test(table.caption),
    `Table ${table.id} has a prose reference instead of an actual table caption.`
  );
}
const boundTableIDs = new Set();
for (const section of catalog) {
  const body = await historicalConstructionSection(section.id);
  assert.equal(
    new RegExp(`(?:^|\\n)\\*?SECTION\\s+${section.codePrefix}\\s+[A-Z0-9.-]+`)
      .test(body.officialText || ""),
    false,
    `${section.codePrefix} ${section.sectionNumber} contains a presentation-only section banner.`
  );
  for (const block of body.blocks || []) {
    if (block.kind === "image") {
      assert.match(block.imageID || "", /^2014-(?:ac|bc|pc|mc|fgc)-[a-z0-9.-]+\.png$/i);
      assert.equal(/:\/\//.test(block.imageID || ""), false, "Reader images must never hot-link externally.");
      const localPath = imageManifest.items[block.imageID];
      assert(localPath, `Image ${block.imageID} is missing from the bundled image manifest.`);
      assert.equal(/:\/\//.test(localPath), false);
      await access(join(historicalConstructionContentRoot, localPath));
    }
    if (block.kind !== "table") continue;
    assert.match(block.html || "", /<table\b/i, `Table ${block.tableID} has no Reader HTML.`);
    boundTableIDs.add(block.tableID);
  }
}
assert.deepEqual(
  [...boundTableIDs].sort(),
  bundle.tables.map((table) => table.id).sort(),
  "Every verified table must be bound to exactly one or more reachable Reader sections."
);

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
