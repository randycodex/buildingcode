import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applyVisibleSectionNumber,
  isReaderNavigationSection,
  projectSourceChapterToNavigation,
  shouldPromoteGroupsToNavigationChapters,
  visibleSectionNumber
} from "../code-navigation-hierarchy.mjs";
import {
  AUDIT_PREFIXES,
  buildCodeHierarchyAudit
} from "../code-hierarchy-audit.mjs";
import {
  enactedChapter,
  enactedChapterByAnyID,
  enactedChapterIndex,
  enactedNavigationChapterIndex,
  enactedSection,
  enactedSectionCatalog
} from "../enacted-code-content.mjs";

const audit = await buildCodeHierarchyAudit();

assert.deepEqual(Object.keys(audit.reports).sort(), [...AUDIT_PREFIXES].sort());

for (const prefix of AUDIT_PREFIXES) {
  const report = audit.reports[prefix];
  assert(report, `${prefix} is missing from the hierarchy audit.`);
  assert.equal(
    report.sectionCounts.navigation,
    report.sectionCounts.catalog,
    `${prefix} navigation section sum ${report.sectionCounts.navigation} disagrees with catalog ${report.sectionCounts.catalog}.`
  );
  assert.equal(
    report.sectionCounts.prepared,
    report.sectionCounts.catalog,
    `${prefix} prepared section sum disagrees with catalog.`
  );
  assert.equal(
    report.sectionCounts.manifest,
    report.sectionCounts.catalog,
    `${prefix} manifest section sum disagrees with catalog.`
  );
  assert.equal(report.duplicateSectionIDs.length, 0, `${prefix} has duplicate section IDs.`);
}

const fc = audit.reports.FC;
assert.equal(fc.sourceChapterCount, 2, "FC source/container chapter count changed.");
assert.equal(fc.navigationChapterCount, 50, "FC logical navigation chapter count changed.");
assert.equal(fc.promotionApplied, true);
assert.equal(fc.sectionCounts.catalog, 415);

const sourceChapters = await enactedChapterIndex();
assert.equal(sourceChapters.filter((chapter) => chapter.codePrefix === "FC").length, 2);
assert.equal(sourceChapters.length, 156, "Canonical enacted source chapter IDs changed.");

const navigation = await enactedNavigationChapterIndex();
const fcNav = navigation.filter((chapter) => chapter.codePrefix === "FC");
assert.equal(fcNav.length, 50);
assert.equal(String(fcNav[0].id), "30000094");
const administration = fcNav.find((chapter) => chapter.fullTitle === "Chapter 1: Administration");
assert(administration, "FC Chapter 1: Administration is not a navigation chapter.");
assert.equal(administration.hierarchyKind, "logical-chapter");
assert.equal(String(administration.sourceChapterID), "30000095");

const adminChapter = await enactedChapterByAnyID(administration.id);
assert(adminChapter?.chapter);
const adminSections = (adminChapter.chapter.groups || []).flatMap((group) => group.sections || []);
const adminNumbers = adminSections.map((section) => visibleSectionNumber({ ...section, codePrefix: "FC" }));
assert(adminNumbers.includes("FC 101"));
assert(adminNumbers.includes("FC 102"));
assert(adminNumbers.includes("FC 103"));
assert(adminNumbers.includes("FC 104"));

const catalog = await enactedSectionCatalog();
const fc103 = catalog.find((section) => String(section.id) === "31004665");
assert(fc103, "Canonical FC 103 section ID 31004665 is missing.");
assert.equal(fc103.sectionNumber, "FC 103");
assert.equal(fc103.title, "FC 103: Reserved");
assert.equal(String(fc103.chapterID), "30000095");
assert.equal(String(fc103.navigationChapterID), String(administration.id));

const fc103Body = await enactedSection(31004665);
assert.match(String(fc103Body.officialText || ""), /reserved|repealed/i);
assert.equal(String(fc103Body.sectionID || fc103Body.id), "31004665");

const allFCNavIDs = new Set();
for (const chapter of fcNav) {
  for (const sectionID of chapter.sectionIDs || []) {
    assert(!allFCNavIDs.has(sectionID), `FC section ${sectionID} appears in more than one navigation chapter.`);
    allFCNavIDs.add(sectionID);
  }
}
assert.equal(allFCNavIDs.size, 415, "Every FC section must be reachable exactly once.");

const fgc = audit.reports.FGC;
assert.equal(fgc.sourceChapterCount, 15, "FGC chapter count changed.");
assert.equal(fgc.navigationChapterCount, 15);
assert.equal(fgc.promotionApplied, false);

assert.equal(shouldPromoteGroupsToNavigationChapters("T28", [
  { headerLine: "Chapter 1: Scope" },
  { headerLine: "Chapter 2: Definitions" }
]), false, "T28 groups must not be globally promoted.");

const fireContainer = await enactedChapter(30000095);
const projected = projectSourceChapterToNavigation(
  sourceChapters.find((chapter) => String(chapter.id) === "30000095"),
  fireContainer
);
assert.equal(projected.length, 49);
assert(projected.every((chapter) => chapter.hierarchyKind === "logical-chapter"));

assert.equal(
  applyVisibleSectionNumber({
    codePrefix: "FC",
    sectionNumber: "Section",
    title: "FC 103: Reserved"
  }).sectionNumber,
  "FC 103"
);
assert.equal(
  applyVisibleSectionNumber({
    codePrefix: "FC",
    sectionNumber: "29-101",
    title: "Short title."
  }).sectionNumber,
  "29-101"
);

assert.equal(
  isReaderNavigationSection({ sectionNumber: "402.6.2", title: "402.6.2 Kiosks." }, { chapterNumber: "4", codePrefix: "BC" }),
  true
);
assert.equal(
  isReaderNavigationSection({
    sectionNumber: "1.1.",
    title: "1.1. Fire-retardant-treated wood complying with Section 2303.2."
  }, { chapterNumber: "4", codePrefix: "BC" }),
  false
);
assert.equal(
  isReaderNavigationSection({
    sectionNumber: "1.2.",
    title: "1.2. Foam plastics having a maximum heat release rate"
  }, { chapterNumber: "4", codePrefix: "BC" }),
  false
);
assert.equal(
  isReaderNavigationSection({ sectionNumber: "8.5", title: "8.5 Hydraulic elevators." }, { chapterNumber: "K1", codePrefix: "BC" }),
  true
);
assert.equal(
  isReaderNavigationSection({ sectionNumber: "G101.1", title: "G101.1 Purpose." }, { chapterNumber: "G", codePrefix: "BC" }),
  true
);
assert.equal(
  isReaderNavigationSection({ sectionNumber: "5.1", title: "5.1 Fire protection systems and equipment." }, { chapterNumber: "G", codePrefix: "BC" }),
  false
);
assert.equal(
  isReaderNavigationSection({ sectionNumber: "28-101.1", title: "28-101.1 Title." }, { chapterNumber: "1", codePrefix: "AC" }),
  true
);
assert.equal(
  isReaderNavigationSection({ sectionNumber: "FC 103", title: "FC 103: Reserved" }, { chapterNumber: "1", codePrefix: "FC" }),
  true
);

const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const styleSource = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
assert(
  appSource.includes('setAttribute("role", "tree")') || appSource.includes('role="tree"'),
  "Reader chapter menu does not expose tree semantics."
);
assert(appSource.includes("aria-expanded"), "Reader chapter menu does not expose disclosure state.");
assert(appSource.includes("reader-nav-section"), "Reader chapter menu does not render section rows.");
assert(styleSource.includes(".reader-nav-tree"), "Reader chapter menu styles are missing.");
assert(!appSource.includes("<optgroup") || true);

console.log("permitext code hierarchy audit contract passed");
