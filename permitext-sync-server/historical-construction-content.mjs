import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizedSortedPostingList } from "./search-postings.mjs";

const serverRoot = dirname(fileURLToPath(import.meta.url));
export const historicalConstructionContentRoot = join(
  serverRoot,
  "..",
  "NYC CC APP",
  "permitext",
  "Resources",
  "CodeContent",
  "authored",
  "new-york-city",
  "2014-construction-codes"
);
const preparedRoot = join(historicalConstructionContentRoot, "prepared");
const preparedChaptersRoot = join(preparedRoot, "chapters");
const preparedSectionsRoot = join(preparedRoot, "sections");

export const historicalConstructionCodePrefixes = Object.freeze(["AC", "BC", "PC", "MC", "FGC"]);
export const historicalConstructionSyncCodeVersion =
  "CodeContent/authored/new-york-city/2014-construction-codes/bundle.json#1";

let cachedBundle;
let cachedManifest;
let cachedSourceManifest;
let cachedCatalog;
let cachedSearchIndex;
const cachedChapters = new Map();
const cachedSections = new Map();

async function readJSON(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export function isHistoricalConstructionChapterID(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 40_000_000 && parsed < 41_000_000;
}

export function isHistoricalConstructionSectionID(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed >= 41_000_000 && parsed < 42_000_000;
}

async function bundle() {
  cachedBundle ||= await readJSON(join(historicalConstructionContentRoot, "bundle.json"));
  return cachedBundle;
}

async function manifest() {
  cachedManifest ||= await readJSON(join(preparedRoot, "manifest.json"));
  return cachedManifest;
}

async function sourceManifest() {
  cachedSourceManifest ||= await readJSON(join(historicalConstructionContentRoot, "source-manifest.json"));
  return cachedSourceManifest;
}

export async function historicalConstructionContentMetadata() {
  const [contentBundle, source] = await Promise.all([bundle(), sourceManifest()]);
  return {
    id: source.libraryID,
    codePrefixes: historicalConstructionCodePrefixes,
    codeVersion: contentBundle.codes?.[0]?.name || "2014 NYC Construction Codes",
    syncCodeVersion: historicalConstructionSyncCodeVersion,
    displayName: "2014 Construction Codes",
    effectiveDate: "2014-12-31",
    supersededDate: "2022-11-07",
    applicabilityStatus: "prior-edition-case-specific",
    sourceAuthority: source.sourceAuthority,
    sourceURL: source.sourcePageURL,
    baselineSourceURL: source.baselineSourceURL,
    amendmentIndexURL: source.amendmentIndexURL,
    researchEligibility: true,
    validationSummary: source.validationSummary
  };
}

export async function historicalConstructionChapterIndex() {
  const [contentBundle, contentManifest] = await Promise.all([bundle(), manifest()]);
  const byID = new Map(
    (contentManifest.chapters || []).map((chapter) => [String(chapter.chapterID), chapter])
  );
  return (contentBundle.chapters || []).map((chapter) => {
    const record = byID.get(String(chapter.id)) || {};
    return {
      id: chapter.id,
      codePrefix: record.codePrefix || historicalConstructionCodePrefixes[0],
      codeSectionID: chapter.codeSectionID,
      codeVersion: historicalConstructionSyncCodeVersion,
      chapterNumber: chapter.chapterNumber,
      displayTitle: chapter.title,
      fullTitle: chapter.title,
      title: chapter.title,
      groupCount: 1,
      sectionCount: record.sectionCount || 0,
      manifestSectionCount: record.sectionCount || 0,
      applicabilityStatus: "prior-edition-case-specific"
    };
  });
}

export async function historicalConstructionChapter(chapterID) {
  const key = String(chapterID || "").trim();
  if (!isHistoricalConstructionChapterID(key)) return null;
  if (!cachedChapters.has(key)) {
    cachedChapters.set(key, await readJSON(join(preparedChaptersRoot, `${key}.json`)));
  }
  return cachedChapters.get(key);
}

function flattenedSections(chapter) {
  return (chapter?.groups || []).flatMap((group) =>
    (group.sections || []).map((section) => ({
      ...section,
      groupID: group.id,
      headerLine: group.headerLine,
      headingLine: group.headingLine
    }))
  );
}

export async function historicalConstructionSectionCatalog() {
  if (cachedCatalog) return cachedCatalog;
  const chapters = await historicalConstructionChapterIndex();
  const result = [];
  for (const chapterSummary of chapters) {
    const chapter = await historicalConstructionChapter(chapterSummary.id);
    for (const section of flattenedSections(chapter)) {
      result.push({
        id: section.id,
        chapterID: chapterSummary.id,
        codePrefix: chapterSummary.codePrefix,
        codeSectionID: chapterSummary.codeSectionID,
        codeVersion: historicalConstructionSyncCodeVersion,
        chapterNumber: chapterSummary.chapterNumber,
        sectionNumber: section.sectionNumber,
        title: section.title,
        headerLine: section.headerLine,
        headingLine: section.headingLine,
        applicabilityStatus: "prior-edition-case-specific"
      });
    }
  }
  cachedCatalog = result;
  return cachedCatalog;
}

export async function historicalConstructionSectionSummary(sectionID) {
  const key = String(sectionID || "").trim();
  if (!isHistoricalConstructionSectionID(key)) return null;
  return (await historicalConstructionSectionCatalog())
    .find((section) => String(section.id) === key) || null;
}

export async function historicalConstructionSection(sectionID) {
  const key = String(sectionID || "").trim();
  if (!isHistoricalConstructionSectionID(key)) return null;
  if (!cachedSections.has(key)) {
    cachedSections.set(key, await readJSON(join(preparedSectionsRoot, `${key}.json`)));
  }
  return cachedSections.get(key);
}

export async function historicalConstructionSearchIndex() {
  if (!cachedSearchIndex) {
    const payload = await readJSON(join(preparedRoot, "searchIndex.json"));
    cachedSearchIndex = new Map(
      Object.entries(payload.tokens || {}).map(([token, ids]) => [
        token,
        normalizedSortedPostingList(ids)
      ])
    );
  }
  return cachedSearchIndex;
}
