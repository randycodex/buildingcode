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
const meansOfEgressChapterHTML = await readFile(
  join(historicalConstructionContentRoot, "chapters", "bc-10.html"),
  "utf8"
);
const fireResistanceChapterHTML = await readFile(
  join(historicalConstructionContentRoot, "chapters", "bc-7.html"),
  "utf8"
);

assert.equal(source.libraryID, "nyc-2014-construction-codes");
assert.equal(source.chapterPDFs.length, 111, "Every official DOB chapter and appendix PDF must be inventoried.");
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

const meansOfEgressChapter = source.chapterPDFs.find((record) =>
  record.fileName === "2014CC_BC_Chapte_10_Means_of_Egress.pdf"
);
assert(meansOfEgressChapter, "The official DOB Building Code Chapter 10 PDF is missing.");
assert.equal(
  meansOfEgressChapter.sourceSHA256,
  "cdac0477eb744ed215557e18d6ef6980625231dca533abd90a1f419b5aa5e3cb"
);
assert.equal(meansOfEgressChapter.semanticHTML.publisher, "International Code Council");
assert.equal(meansOfEgressChapter.semanticHTML.role, "secondary semantic structure reference");
assert.equal(meansOfEgressChapter.semanticHTML.verifiedStructuredTableCount, 11);
assert.equal(meansOfEgressChapter.semanticHTML.officialPDFCorrectedCellCount, 1);
assert.equal(meansOfEgressChapter.semanticHTML.officialPDFRecoveredSectionTextCount, 2);
assert(meansOfEgressChapter.semanticHTML.verifiedSectionHTMLCount > 300);
assert(meansOfEgressChapter.semanticHTML.fallbackSectionHTMLCount > 0);
assert.equal(source.secondaryHTMLReferences.length, 1);
assert.equal(
  source.secondaryHTMLReferences[0].sourceURL,
  "https://codes.iccsafe.org/content/NYNYCBC2014E1014/chapter-10-means-of-egress"
);
assert.equal(
  (meansOfEgressChapterHTML.match(/<table\b/g) || []).length,
  11,
  "Every verified Chapter 10 table must be present in the native-reader source HTML."
);
assert.match(
  meansOfEgressChapterHTML,
  /data-table-id="nyc-2014-table-bc-10-1004-1-1"/
);
assert.match(
  fireResistanceChapterHTML,
  /<img src="\.\.\/assets\/2014-bc-7-p0008-figure-01\.png" alt="FIGURE 705\.7">/
);

const rampScope = catalog.find((section) =>
  section.codePrefix === "BC" && section.sectionNumber === "1010.1"
);
assert(rampScope, "BC 1010.1 is missing from the 2014 Building Code corpus.");
assert.equal(rampScope.chapterID, 40000111, "The newly discovered chapter must use an appended stable ID.");
assert.equal(rampScope.id, 41009494, "The new ramp provision must retain its first published stable ID.");
const rampWidth = catalog.find((section) =>
  section.codePrefix === "BC" && section.sectionNumber === "1010.5.1"
);
assert(rampWidth, "BC 1010.5.1 is missing from the 2014 Building Code corpus.");
const rampWidthBody = await historicalConstructionSection(rampWidth.id);
assert.match(rampWidthBody.officialText, /36 inches \(914 mm\) minimum/);
assert.equal(rampWidthBody.officialText.includes("\nmm)"), false);
const rampSlope = catalog.find((section) =>
  section.codePrefix === "BC" && section.sectionNumber === "1010.2"
);
assert(rampSlope, "BC 1010.2 is missing from the 2014 Building Code corpus.");
const rampSlopeBody = await historicalConstructionSection(rampSlope.id);
assert.equal(
  rampSlopeBody.blocks[0].verificationStatus,
  "semantic-html-token-verified-against-official-pdf"
);
assert.match(
  rampSlopeBody.blocks[0].html,
  /<ol class="code-explicit-list"><li><p>1\. Aisle ramp slope/
);
assert.equal(rampSlopeBody.blocks[0].html.includes("codes.iccsafe.org"), false);

const corridorWidth = catalog.find((section) =>
  section.codePrefix === "BC" && section.sectionNumber === "1018.2"
);
assert(corridorWidth, "BC 1018.2 is missing from the 2014 Building Code corpus.");
const corridorWidthBody = await historicalConstructionSection(corridorWidth.id);
assert.match(corridorWidthBody.officialText, /not less than 44 inches \(1118 mm\)/);
assert.match(
  corridorWidthBody.blocks[0].html,
  /<ol class="code-explicit-list"><li><p>1\. Twenty-four inches/
);
assert.equal(
  corridorWidthBody.officialText.includes("\nChapter 11"),
  false,
  "A physical PDF wrap before Chapter 11 must not create a legal paragraph break."
);

const singleExit = catalog.find((section) =>
  section.codePrefix === "BC" && section.sectionNumber === "1021.2"
);
assert(singleExit, "BC 1021.2 is missing.");
const singleExitBody = await historicalConstructionSection(singleExit.id);
assert.match(singleExitBody.officialText, /1\. Stories in buildings as described in Table 1021\.2/);
assert.match(singleExitBody.officialText, /4\.1\. The building does not exceed four stories/);
assert.match(singleExitBody.officialText, /4\.7\. The stairway is enclosed in 2-hour fire-rated walls/);
assert.match(singleExitBody.officialText, /4\.8\. The building shall be equipped throughout/);
assert.match(singleExitBody.officialText, /5\. Buildings of Group R-2 occupancy/);
assert.equal(
  singleExitBody.blocks[0].verificationStatus,
  "complete-semantic-passage-token-verified-against-official-pdf"
);
assert.equal(
  singleExitBody.historicalConstructionCode.semanticTextRecovery.previousPDFDerivedTokenCount,
  70
);
assert.deepEqual(
  singleExitBody.historicalConstructionCode.semanticTextRecovery
    .officialPDFProvenance.pdfPages,
  [41, 42]
);
assert.match(
  singleExitBody.blocks[0].html,
  /<ol class="code-explicit-list"><li><p>1\. Stories in buildings/
);
assert.match(
  singleExitBody.blocks[0].html,
  /<ol class="code-explicit-list"><li><p>4\.1\. The building does not exceed four stories/
);

const assemblyCommonPath = catalog.find((section) =>
  section.codePrefix === "BC" && section.sectionNumber === "1028.8"
);
assert(assemblyCommonPath, "BC 1028.8 is missing.");
const assemblyCommonPathBody = await historicalConstructionSection(assemblyCommonPath.id);
assert.match(assemblyCommonPathBody.officialText, /1\. For areas, such as box seats/);
assert.match(assemblyCommonPathBody.officialText, /2\. For smoke-protected assembly seating/);
assert.equal(
  assemblyCommonPathBody.blocks[0].verificationStatus,
  "complete-semantic-passage-token-verified-against-official-pdf"
);

const table1004 = bundle.tables.find((table) =>
  table.id === "nyc-2014-table-bc-10-1004-1-1"
);
assert(table1004, "Complete semantic Table 1004.1.1 is missing.");
assert.equal(table1004.rowCount, 57);
assert.equal(table1004.columnCount, 2);
assert.deepEqual(table1004.officialPDFProvenance.pdfPages, [5, 6]);
assert.equal(table1004.verificationStatus, "cell-by-cell-verified-against-official-pdf");
assert.match(table1004.footnotes[0], /^C\*-capacity of all passenger vehicles/);
const occupantLoadSection = catalog.find((section) =>
  section.codePrefix === "BC" && section.sectionNumber === "1004.1.1"
);
assert(occupantLoadSection, "BC 1004.1.1 is missing.");
const occupantLoadBody = await historicalConstructionSection(occupantLoadSection.id);
assert.equal(
  occupantLoadBody.officialText.includes("C*-capacity"),
  false,
  "The official table footnote must not leak into Section 1004.1.1 prose."
);
assert.equal(
  bundle.tables.some((table) => table.id === "nyc-2014-table-bc-10-p0006-01"),
  false,
  "The partial page-six continuation must not survive beside complete Table 1004.1.1."
);

const corridorRatingTable = bundle.tables.find((table) =>
  table.id === "nyc-2014-table-bc-10-1018-1-1"
);
assert(corridorRatingTable, "Table 1018.1.1 is missing.");
assert.equal(corridorRatingTable.columnCount, 4);
assert(corridorRatingTable.cells.some((cell) => cell.rowSpan === 2));
assert(corridorRatingTable.cells.some((cell) => cell.columnSpan === 2));
const corridorRatingSection = catalog.find((section) =>
  section.codePrefix === "BC" && section.sectionNumber === "1018.1.1"
);
assert(corridorRatingSection, "BC 1018.1.1 is missing.");
const corridorRatingBody = await historicalConstructionSection(corridorRatingSection.id);
assert.match(
  corridorRatingBody.blocks[0].html,
  /<ol class="code-explicit-list"><li><p>1\. A fire-resistance rating/
);
assert.equal(
  /1018\.1\.1 INTERIOR CORRIDOR FIRE-RESISTANCE RATING\s*$/i.test(corridorRatingBody.officialText),
  false,
  "A repeated structured-table caption must not leak into Section 1018.1.1 prose."
);

const oneExitTable = bundle.tables.find((table) =>
  table.id === "nyc-2014-table-bc-10-1021-2"
);
assert(oneExitTable, "Table 1021.2 is missing.");
assert(oneExitTable.cells.some((cell) => cell.rowSpan === 5));

const assemblyAisleTable = bundle.tables.find((table) =>
  table.id === "nyc-2014-table-bc-10-1028-10-1"
);
assert(assemblyAisleTable, "Table 1028.10.1 is missing.");
assert.equal(
  assemblyAisleTable.cells.find((cell) => cell.plainText === "10,000")?.row,
  assemblyAisleTable.cells.find((cell) => cell.plainText === "17")?.row,
  "The official DOB value 17 must occupy the 10,000-seat row."
);
assert.deepEqual(assemblyAisleTable.semanticCorrections, [{
  cell: "10,000 seats / maximum seats per row",
  semanticHTMLValue: "7",
  officialPDFValue: "17",
  resolution: "official NYC DOB PDF controls"
}]);

const visionPanel = catalog.find((section) =>
  section.codePrefix === "BC" && section.sectionNumber === "715.4.7.1"
);
assert(visionPanel, "BC 715.4.7.1 is missing from the 2014 Building Code corpus.");
assert.equal(visionPanel.id, 41001820, "Existing published Reader section IDs must not be renumbered.");
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

const unexposedSurface = catalog.find((section) =>
  section.codePrefix === "BC" && section.sectionNumber === "705.7"
);
assert(unexposedSurface, "BC 705.7 is missing.");
const unexposedSurfaceBody = await historicalConstructionSection(unexposedSurface.id);
assert.match(unexposedSurfaceBody.officialText, /A_e = A \+ \(A_f × F_eo\) \(Equation 7-1\)/);
assert.equal(/\(Equation 7-1\) e f where/.test(unexposedSurfaceBody.officialText), false);
assert.match(unexposedSurfaceBody.blocks[0].html, /class="code-equation"/);
assert.match(unexposedSurfaceBody.blocks[0].html, /A<sub>e<\/sub>/);
assert.match(unexposedSurfaceBody.blocks[0].html, /F<sub>eo<\/sub>/);
assert.equal(unexposedSurfaceBody.blocks[0].html.includes("<br>where:"), false);
assert(
  unexposedSurfaceBody.blocks.some((block) =>
    block.kind === "image" && block.imageID === "2014-bc-7-p0008-figure-01.png"
  ),
  "BC 705.7 must retain the complete official-PDF Figure 705.7 asset."
);

const exteriorOpenings = catalog.find((section) =>
  section.codePrefix === "BC" && section.sectionNumber === "705.8"
);
assert(exteriorOpenings, "BC 705.8 is missing.");
const exteriorOpeningsBody = await historicalConstructionSection(exteriorOpenings.id);
const exteriorOpeningsTableBlock = exteriorOpeningsBody.blocks.find((block) =>
  block.kind === "table" && block.tableID === "nyc-2014-table-bc-7-705-8"
);
assert(exteriorOpeningsTableBlock, "Complete Table 705.8 is not bound to BC 705.8.");
assert.match(exteriorOpeningsTableBlock.html, /rowspan="3"/);
assert.equal((exteriorOpeningsTableBlock.html.match(/<tr>/g) || []).length, 25);
assert.match(exteriorOpeningsTableBlock.html, /30 or greater/);
assert.match(exteriorOpeningsTableBlock.html, /m\. Upon special application/);
assert.equal(
  exteriorOpeningsBody.blocks.some((block) => block.imageID === "2014-bc-7-p0009-table-review-01.png"),
  false,
  "The partial page-9 image must not remain beside the complete Table 705.8."
);
const exteriorOpeningsTable = bundle.tables.find((table) =>
  table.id === "nyc-2014-table-bc-7-705-8"
);
assert(exteriorOpeningsTable, "Complete Table 705.8 is missing from the table registry.");
assert.equal(exteriorOpeningsTable.rowCount, 25);
assert.deepEqual(exteriorOpeningsTable.officialPDFProvenance.pdfPages, [9, 10]);
assert.equal(exteriorOpeningsTable.footnotes.length, 17);

const verticalSeparation = catalog.find((section) =>
  section.codePrefix === "BC" && section.sectionNumber === "705.8.6"
);
assert(verticalSeparation, "BC 705.8.6 is missing.");
const verticalSeparationBody = await historicalConstructionSection(verticalSeparation.id);
assert.equal(/MAXIMUM AREA OF EXTERIOR WALL OPENINGS/.test(verticalSeparationBody.officialText), false);
assert.equal(/Upon special application/.test(verticalSeparationBody.officialText), false);

const exteriorWallJoints = catalog.find((section) =>
  section.codePrefix === "BC" && section.sectionNumber === "705.9"
);
assert(exteriorWallJoints, "BC 705.9 is missing.");
const exteriorWallJointsBody = await historicalConstructionSection(exteriorWallJoints.id);
assert.equal(
  exteriorWallJointsBody.blocks.some((block) => block.kind === "table"),
  false,
  "The continuation of Table 705.8 must not be attached to BC 705.9."
);

const reserved5032 = catalog.find((section) =>
  section.codePrefix === "BC" && section.sectionNumber === "503.2"
);
assert(reserved5032, "BC 503.2 is missing.");
const reserved5032Body = await historicalConstructionSection(reserved5032.id);
assert.equal(
  reserved5032Body.officialText,
  "",
  "Table 503 continuation notes must not leak into the reserved BC 503.2 section."
);

assert(searchIndex.get("vision")?.includes(visionPanel.id));
assert(bundle.tables.length > 0, "No independently verified structured tables were emitted.");
for (const table of bundle.tables) {
  assert.match(table.officialPDFProvenance.sourceSHA256, /^[a-f0-9]{64}$/);
  if (table.id === "nyc-2014-table-bc-7-705-8") {
    assert.deepEqual(table.officialPDFProvenance.pdfPages, [9, 10]);
    assert.match(table.officialPDFProvenance.extraction, /verified cell-by-cell/i);
  } else if (table.id.startsWith("nyc-2014-table-bc-10-")) {
    assert(Array.isArray(table.officialPDFProvenance.pdfPages));
    assert.match(table.officialPDFProvenance.extraction, /ICC semantic grid independently reconciled/i);
    assert.equal(table.htmlStructureReference.publisher, "International Code Council");
    assert.equal(table.htmlStructureReference.role, "secondary semantic structure reference");
  } else {
    assert(Number.isInteger(table.officialPDFProvenance.pdfPage));
    assert.equal(table.officialPDFProvenance.extraction, "pdfplumber-grid verified against Poppler bbox text");
  }
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
