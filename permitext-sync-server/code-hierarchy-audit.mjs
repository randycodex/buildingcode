import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyHierarchyIssue,
  isPlaceholderSectionNumber,
  parseLogicalChapterHeading,
  projectSourceChapterToNavigation,
  visibleSectionNumber
} from "./code-navigation-hierarchy.mjs";
import {
  enactedChapter,
  enactedChapterIndex,
  enactedContentMetadata,
  enactedNavigationChapterIndex,
  enactedSearchIndex,
  enactedSection,
  enactedSectionCatalog
} from "./enacted-code-content.mjs";
import {
  existingBuildingChapter,
  existingBuildingChapterIndex,
  existingBuildingContentMetadata,
  existingBuildingSearchIndex,
  existingBuildingSection,
  existingBuildingSectionCatalog
} from "./existing-building-content.mjs";
import {
  zoningChapter,
  zoningChapterIndex,
  zoningContentMetadata,
  zoningSearchIndex,
  zoningSection,
  zoningSectionCatalog
} from "./zoning-content.mjs";

const serverRoot = dirname(fileURLToPath(import.meta.url));
const authoredRoot = join(
  serverRoot,
  "..",
  "NYC CC APP",
  "permitext",
  "Resources",
  "CodeContent",
  "authored",
  "new-york-city"
);
const constructionRoot = join(authoredRoot, "2022-construction-codes");

const CONSTRUCTION_PREFIXES = {
  1: "BC",
  3: "AC",
  4: "FGC",
  5: "PC",
  6: "MC"
};

const EXPECTED_SOURCE_CHAPTERS = {
  BC: 58,
  AC: 5,
  PC: 22,
  MC: 18,
  FGC: 15,
  ECC: 13,
  EC: 9,
  EBC: 31,
  FC: 2,
  BC68: 19,
  HMC: 5,
  T24: 11,
  T25: 8,
  T26: 38,
  T28: 12,
  LL: 39,
  ZR: 117
};

const AUDIT_PREFIXES = [
  "BC", "AC", "PC", "MC", "FGC", "ECC", "EC", "EBC",
  "FC", "BC68", "HMC", "T24", "T25", "T26", "T28", "LL", "ZR"
];

async function readJSON(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function flattenPrepared(chapter) {
  return (chapter?.groups || []).flatMap((group) =>
    (group.sections || []).map((section) => ({
      ...section,
      groupID: group.id,
      headerLine: group.headerLine,
      headingLine: group.headingLine
    }))
  );
}

function unique(values) {
  return [...new Set(values)];
}

function countSearchIDs(index, catalogIDs) {
  const indexed = new Set();
  for (const ids of index.values()) {
    for (const id of ids) {
      if (catalogIDs.has(String(id))) indexed.add(String(id));
    }
  }
  return indexed.size;
}

function reservedLike(section, body = null) {
  const text = [
    section?.title,
    section?.sectionNumber,
    body?.officialText,
    body?.previewText,
    ...(body?.blocks || []).map((block) => block.plainText)
  ].filter(Boolean).join(" ");
  return /\b(reserved|repealed)\b/i.test(text);
}

async function auditConstruction() {
  const [bundle, manifest, searchPayload] = await Promise.all([
    readJSON(join(constructionRoot, "bundle.json")),
    readJSON(join(constructionRoot, "prepared", "manifest.json")),
    readJSON(join(constructionRoot, "prepared", "searchIndex.json"))
  ]);
  const prefixByCodeSectionID = new Map(
    (bundle.codeSections || []).map((entry) => [Number(entry.id), CONSTRUCTION_PREFIXES[entry.id] || entry.prefix])
  );
  const manifestByID = new Map((manifest.chapters || []).map((chapter) => [String(chapter.chapterID), chapter]));
  const searchIDs = new Set(Object.values(searchPayload.tokens || {}).flat().map(String));
  const byPrefix = new Map(AUDIT_PREFIXES.filter((prefix) => ["BC", "AC", "PC", "MC", "FGC"].includes(prefix)).map((prefix) => [prefix, {
    chapters: [],
    sections: [],
    searchIDs: new Set()
  }]));

  for (const chapter of bundle.chapters || []) {
    const prefix = prefixByCodeSectionID.get(Number(chapter.codeSectionID));
    if (!byPrefix.has(prefix)) continue;
    const prepared = await readJSON(join(constructionRoot, "prepared", "chapters", `${chapter.id}.json`));
    const manifestChapter = manifestByID.get(String(chapter.id));
    const sections = flattenPrepared(prepared).map((section) => ({
      ...section,
      chapterID: chapter.id,
      chapterNumber: String(manifestChapter?.chapterNumber || chapter.chapterNumber),
      codePrefix: prefix,
      headerLine: section.headerLine
    }));
    byPrefix.get(prefix).chapters.push({
      id: chapter.id,
      chapterNumber: String(manifestChapter?.chapterNumber || chapter.chapterNumber),
      title: chapter.title,
      groupCount: prepared.groups?.length || 0,
      sectionCount: sections.length,
      manifestSectionCount: manifestChapter?.sectionCount || 0,
      groupHeaders: (prepared.groups || []).map((group) => group.headerLine),
      chapterLikeGroups: (prepared.groups || []).filter((group) => parseLogicalChapterHeading(group.headerLine)).length
    });
    byPrefix.get(prefix).sections.push(...sections);
  }

  const metadata = {
    id: "nyc-2022-construction-codes",
    sourceAuthority: "New York City Department of Buildings",
    sourceURL: "https://www.nyc.gov/site/buildings/codes/2022-construction-codes.page",
    statedCurrency: "2022-11-07"
  };

  const reports = [];
  for (const [prefix, data] of byPrefix) {
    const catalogIDs = new Set(data.sections.map((section) => String(section.id)));
    for (const id of catalogIDs) {
      if (searchIDs.has(id)) data.searchIDs.add(id);
    }
    reports.push(summarizePrefix({
      prefix,
      packageID: metadata.id,
      metadata,
      sourceChapters: data.chapters,
      navigationChapters: data.chapters.map((chapter) => ({
        ...chapter,
        sourceChapterID: chapter.id,
        hierarchyKind: "source-chapter"
      })),
      sections: data.sections,
      catalogCount: data.sections.length,
      searchCount: data.searchIDs.size,
      loadSection: null
    }));
  }
  return reports;
}

async function auditEnacted() {
  const [metadata, sourceChapters, navigationChapters, catalog] = await Promise.all([
    enactedContentMetadata(),
    enactedChapterIndex(),
    enactedNavigationChapterIndex(),
    enactedSectionCatalog()
  ]);
  const searchIndex = await enactedSearchIndex();
  const metadataByPrefix = new Map();
  for (const library of metadata) {
    for (const prefix of library.codePrefixes || []) {
      metadataByPrefix.set(prefix, {
        id: library.id,
        sourceAuthority: library.sourceAuthority,
        sourceURL: prefix === "ECC" ? library.energySourceURL : prefix === "EC" ? library.electricalSourceURL : library.sourceURL,
        statedCurrency: prefix === "ECC"
          ? library.energyEffectiveDate
          : prefix === "EC"
            ? library.electricalEffectiveDate
            : library.statedCurrency,
        verificationStatus: library.verificationStatus
      });
    }
  }
  const reports = [];
  const enactedPrefixes = ["T24", "T25", "T26", "BC68", "HMC", "T28", "FC", "LL", "ECC", "EC"];
  for (const prefix of enactedPrefixes) {
    const prefixSource = sourceChapters.filter((chapter) => chapter.codePrefix === prefix);
    const prefixNav = navigationChapters.filter((chapter) => chapter.codePrefix === prefix);
    const prefixCatalog = catalog.filter((section) => section.codePrefix === prefix);
    const catalogIDs = new Set(prefixCatalog.map((section) => String(section.id)));
    const sourceDetails = [];
    for (const summary of prefixSource) {
      const prepared = await enactedChapter(summary.id);
      const sections = flattenPrepared(prepared);
      sourceDetails.push({
        id: summary.id,
        chapterNumber: summary.chapterNumber,
        title: summary.fullTitle || summary.displayTitle || summary.title,
        groupCount: prepared.groups?.length || 0,
        sectionCount: sections.length,
        manifestSectionCount: summary.manifestSectionCount || summary.sectionCount,
        groupHeaders: (prepared.groups || []).map((group) => group.headerLine),
        chapterLikeGroups: (prepared.groups || []).filter((group) => parseLogicalChapterHeading(group.headerLine)).length
      });
    }
    reports.push(summarizePrefix({
      prefix,
      packageID: metadataByPrefix.get(prefix)?.id,
      metadata: metadataByPrefix.get(prefix),
      sourceChapters: sourceDetails,
      navigationChapters: prefixNav,
      sections: prefixCatalog,
      catalogCount: prefixCatalog.length,
      searchCount: countSearchIDs(searchIndex, catalogIDs),
      loadSection: enactedSection
    }));
  }
  return reports;
}

async function auditExistingBuilding() {
  const [metadata, chapters, catalog] = await Promise.all([
    existingBuildingContentMetadata(),
    existingBuildingChapterIndex(),
    existingBuildingSectionCatalog()
  ]);
  const searchIndex = await existingBuildingSearchIndex();
  const details = [];
  for (const summary of chapters) {
    const prepared = await existingBuildingChapter(summary.id);
    const sections = flattenPrepared(prepared);
    details.push({
      id: summary.id,
      chapterNumber: summary.chapterNumber,
      title: summary.fullTitle || summary.displayTitle || summary.title,
      groupCount: prepared.groups?.length || 0,
      sectionCount: sections.length,
      manifestSectionCount: summary.manifestSectionCount || summary.sectionCount,
      groupHeaders: (prepared.groups || []).map((group) => group.headerLine),
      chapterLikeGroups: (prepared.groups || []).filter((group) => parseLogicalChapterHeading(group.headerLine)).length
    });
  }
  return [summarizePrefix({
    prefix: "EBC",
    packageID: metadata.id,
    metadata: {
      id: metadata.id,
      sourceAuthority: metadata.sourceAuthority,
      sourceURL: metadata.sourceURL,
      statedCurrency: metadata.effectiveDate
    },
    sourceChapters: details,
    navigationChapters: chapters.map((chapter) => ({ ...chapter, sourceChapterID: chapter.id, hierarchyKind: "source-chapter" })),
    sections: catalog,
    catalogCount: catalog.length,
    searchCount: countSearchIDs(searchIndex, new Set(catalog.map((section) => String(section.id)))),
    loadSection: existingBuildingSection
  })];
}

async function auditZoning() {
  const [metadata, chapters, catalog] = await Promise.all([
    zoningContentMetadata(),
    zoningChapterIndex(),
    zoningSectionCatalog()
  ]);
  const searchIndex = await zoningSearchIndex();
  const details = [];
  for (const summary of chapters) {
    const prepared = await zoningChapter(summary.id);
    const sections = flattenPrepared(prepared);
    details.push({
      id: summary.id,
      chapterNumber: summary.chapterNumber,
      title: summary.fullTitle || summary.displayTitle || summary.title,
      groupCount: prepared.groups?.length || 0,
      sectionCount: sections.length,
      manifestSectionCount: summary.manifestSectionCount || summary.sectionCount,
      groupHeaders: (prepared.groups || []).map((group) => group.headerLine),
      chapterLikeGroups: (prepared.groups || []).filter((group) => parseLogicalChapterHeading(group.headerLine)).length
    });
  }
  return [summarizePrefix({
    prefix: "ZR",
    packageID: metadata.id,
    metadata: {
      id: metadata.id,
      sourceAuthority: metadata.sourceAuthority,
      sourceURL: metadata.sourceURL,
      statedCurrency: metadata.textChangesThrough
    },
    sourceChapters: details,
    navigationChapters: chapters.map((chapter) => ({ ...chapter, sourceChapterID: chapter.id, hierarchyKind: "source-chapter" })),
    sections: catalog,
    catalogCount: catalog.length,
    searchCount: countSearchIDs(searchIndex, new Set(catalog.map((section) => String(section.id)))),
    loadSection: zoningSection
  })];
}

function summarizePrefix({
  prefix,
  packageID,
  metadata,
  sourceChapters,
  navigationChapters,
  sections,
  catalogCount,
  searchCount,
  loadSection
}) {
  const preparedCount = sourceChapters.reduce((count, chapter) => count + (chapter.sectionCount || 0), 0);
  const manifestCount = sourceChapters.reduce((count, chapter) => count + (chapter.manifestSectionCount || 0), 0);
  const navigationCount = navigationChapters.reduce((count, chapter) => count + (chapter.sectionCount || 0), 0);
  const ids = sections.map((section) => String(section.id));
  const duplicateIDs = unique(ids.filter((id, index) => ids.indexOf(id) !== index));
  const numbers = sourceChapters.map((chapter) => String(chapter.chapterNumber));
  const titles = sourceChapters.map((chapter) => String(chapter.title || ""));
  const rawPlaceholderSections = sections.filter((section) =>
    isPlaceholderSectionNumber(section.storedSectionNumber ?? section.rawSectionNumber ?? section.sectionNumber)
  );
  const recoveredPlaceholders = rawPlaceholderSections.filter((section) =>
    !isPlaceholderSectionNumber(section.sectionNumber)
  );

  const missingNumbers = sections.filter((section) => !compactOrEmpty(visibleSectionNumber(section)));
  const chapterNumbers = new Map(sourceChapters.map((chapter) => [String(chapter.id), String(chapter.chapterNumber)]));
  const wrongChapter = sections.filter((section) => {
    const expected = chapterNumbers.get(String(section.chapterID || section.sourceChapterID));
    return expected && String(section.sourceChapterNumber || section.chapterNumber) !== expected;
  });

  const issues = classifyHierarchyIssue({
    sourceChapterCount: sourceChapters.length,
    navigationChapterCount: navigationChapters.length,
    catalogCount,
    preparedCount,
    manifestCount,
    searchCount,
    placeholderCount: rawPlaceholderSections.length,
    recoveredPlaceholderCount: recoveredPlaceholders.length,
    promotionApplied: navigationChapters.some((chapter) => chapter.hierarchyKind === "logical-chapter")
  });

  if (sourceChapters.length !== (EXPECTED_SOURCE_CHAPTERS[prefix] ?? sourceChapters.length)) {
    issues.push({
      kind: "missing-source-content",
      detail: `Source chapter count ${sourceChapters.length} differs from expected ${EXPECTED_SOURCE_CHAPTERS[prefix]}.`
    });
  }
  if (duplicateIDs.length) {
    issues.push({ kind: "incorrect-source-extraction", detail: `${duplicateIDs.length} duplicate section IDs.` });
  }
  if (navigationCount !== catalogCount) {
    issues.push({
      kind: "incomplete-api-exposure",
      detail: `Navigation chapter section sum ${navigationCount} disagrees with catalog ${catalogCount}.`
    });
  }

  return {
    prefix,
    packageID: packageID || null,
    metadata: metadata || {},
    expectedSourceChapterCount: EXPECTED_SOURCE_CHAPTERS[prefix] ?? null,
    sourceChapterCount: sourceChapters.length,
    navigationChapterCount: navigationChapters.length,
    sourceChapters: sourceChapters.map((chapter) => ({
      id: chapter.id,
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      groupCount: chapter.groupCount,
      sectionCount: chapter.sectionCount,
      manifestSectionCount: chapter.manifestSectionCount,
      chapterLikeGroups: chapter.chapterLikeGroups,
      sampleGroupHeaders: (chapter.groupHeaders || []).slice(0, 6)
    })),
    navigationChapters: navigationChapters.map((chapter) => ({
      id: chapter.id,
      sourceChapterID: chapter.sourceChapterID || chapter.id,
      hierarchyKind: chapter.hierarchyKind || "source-chapter",
      chapterNumber: chapter.chapterNumber,
      title: chapter.fullTitle || chapter.displayTitle || chapter.title,
      sectionCount: chapter.sectionCount
    })),
    duplicateChapterNumbers: unique(numbers.filter((number, index) => numbers.indexOf(number) !== index)),
    duplicateChapterTitles: unique(titles.filter((title, index) => title && titles.indexOf(title) !== index)),
    sectionCounts: {
      manifest: manifestCount,
      prepared: preparedCount,
      catalog: catalogCount,
      navigation: navigationCount,
      searchIndex: searchCount
    },
    duplicateSectionIDs: duplicateIDs,
    missingSectionNumbers: missingNumbers.map((section) => section.id),
    placeholderSectionNumbers: rawPlaceholderSections.length,
    recoveredVisibleSectionNumbers: recoveredPlaceholders.length,
    sectionsAssignedToWrongChapter: wrongChapter.map((section) => section.id),
    promotionApplied: navigationChapters.some((chapter) => chapter.hierarchyKind === "logical-chapter"),
    issues,
    samples: {
      firstNavigationChapters: navigationChapters.slice(0, 6).map((chapter) => ({
        id: chapter.id,
        title: chapter.fullTitle || chapter.displayTitle || chapter.title,
        sectionCount: chapter.sectionCount
      })),
      placeholderExamples: sections.filter((section) => /^FC\s+/i.test(section.title || "") && prefix === "FC").slice(0, 4).map((section) => ({
        id: section.id,
        sectionNumber: section.sectionNumber,
        title: section.title,
        navigationChapterID: section.navigationChapterID
      }))
    }
  };
}

function compactOrEmpty(value) {
  return String(value || "").trim();
}

export async function inspectReservedSection(sectionID) {
  const body = await enactedSection(sectionID);
  const catalog = await enactedSectionCatalog();
  const summary = catalog.find((section) => String(section.id) === String(sectionID));
  return {
    summary,
    body: body ? {
      id: body.sectionID || body.id,
      sectionNumber: body.sectionNumber,
      title: body.title,
      officialText: body.officialText,
      blockCount: body.blocks?.length || 0
    } : null,
    reserved: reservedLike(summary, body)
  };
}

export async function buildCodeHierarchyAudit() {
  const [construction, enacted, ebc, zr] = await Promise.all([
    auditConstruction(),
    auditEnacted(),
    auditExistingBuilding(),
    auditZoning()
  ]);
  const prefixes = Object.fromEntries(
    [...construction, ...enacted, ...ebc, ...zr]
      .sort((left, right) => AUDIT_PREFIXES.indexOf(left.prefix) - AUDIT_PREFIXES.indexOf(right.prefix))
      .map((report) => [report.prefix, report])
  );
  const fc = prefixes.FC;
  const administration = fc?.navigationChapters.find((chapter) => /Chapter 1:\s*Administration/i.test(chapter.title));
  const fc103 = await inspectReservedSection(31004665);
  return {
    generatedAt: new Date().toISOString(),
    prefixes: AUDIT_PREFIXES,
    reports: prefixes,
    fireCode: {
      sourceChapterCount: fc?.sourceChapterCount || 0,
      navigationChapterCount: fc?.navigationChapterCount || 0,
      administrationChapter: administration || null,
      reservedSection: fc103
    },
    fuelGasCode: {
      sourceChapterCount: prefixes.FGC?.sourceChapterCount || 0,
      navigationChapterCount: prefixes.FGC?.navigationChapterCount || 0,
      chapters: prefixes.FGC?.sourceChapters || []
    }
  };
}

export function renderHierarchyAuditMatrix(audit) {
  const rows = [
    "| Prefix | Package | Source ch. | Nav ch. | Manifest | Prepared | Catalog | Search | Placeholders recovered | Promotion | Issues |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |"
  ];
  for (const prefix of audit.prefixes) {
    const report = audit.reports[prefix];
    if (!report) {
      rows.push(`| ${prefix} | missing | — | — | — | — | — | — | — | — | missing prefix |`);
      continue;
    }
    const issueKinds = unique((report.issues || []).map((issue) => issue.kind)).join(", ") || "none";
    rows.push([
      prefix,
      report.packageID || "—",
      report.sourceChapterCount,
      report.navigationChapterCount,
      report.sectionCounts.manifest,
      report.sectionCounts.prepared,
      report.sectionCounts.catalog,
      report.sectionCounts.searchIndex,
      `${report.recoveredVisibleSectionNumbers}/${report.placeholderSectionNumbers}`,
      report.promotionApplied ? "logical groups" : "source chapters",
      issueKinds
    ].join(" | ").replace(/^/, "| ").concat(" |"));
  }
  return [
    "# Permitext code hierarchy audit",
    "",
    `Generated ${audit.generatedAt}.`,
    "",
    "Counts treat enacted text, extraction metadata, and Reader navigation as separate concerns.",
    "Placeholder recovery changes visible section labels only; canonical section IDs are unchanged.",
    "",
    ...rows,
    "",
    "## Fire Code",
    "",
    `- Source/container chapters: ${audit.fireCode.sourceChapterCount}`,
    `- Logical navigation chapters: ${audit.fireCode.navigationChapterCount}`,
    `- Administration chapter: ${audit.fireCode.administrationChapter?.title || "missing"} (${audit.fireCode.administrationChapter?.id || "—"})`,
    `- FC 103 canonical ID: ${audit.fireCode.reservedSection.summary?.id}`,
    `- FC 103 visible number: ${audit.fireCode.reservedSection.summary?.sectionNumber}`,
    `- FC 103 reserved representation: ${audit.fireCode.reservedSection.reserved ? "preserved" : "missing"}`,
    "",
    "## Fuel Gas Code",
    "",
    `- Source/navigation chapters: ${audit.fuelGasCode.sourceChapterCount}`,
    ...audit.fuelGasCode.chapters.map((chapter) => `- ${chapter.chapterNumber}: ${chapter.title} (${chapter.sectionCount} sections)`),
    "",
    "## Remaining extraction defects",
    "",
    ...AUDIT_PREFIXES.flatMap((prefix) => {
      const report = audit.reports[prefix];
      if (!report) return [];
      const leftover = report.placeholderSectionNumbers - report.recoveredVisibleSectionNumbers;
      const notes = [];
      if (leftover > 0) {
        notes.push(`- ${prefix}: ${leftover} stored section numbers remain placeholders after title recovery. Canonical IDs were not changed.`);
      }
      if (report.duplicateChapterNumbers?.length) {
        notes.push(`- ${prefix}: duplicate source chapter numbers ${report.duplicateChapterNumbers.join(", ")}.`);
      }
      return notes;
    }),
    ""
  ].join("\n");
}

export { AUDIT_PREFIXES, EXPECTED_SOURCE_CHAPTERS, projectSourceChapterToNavigation };
