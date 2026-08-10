import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizedSortedPostingList } from "./search-postings.mjs";

const serverRoot = dirname(fileURLToPath(import.meta.url));
export const existingBuildingContentRoot = join(
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
const preparedRoot = join(existingBuildingContentRoot, "prepared");
const preparedChaptersRoot = join(preparedRoot, "chapters");
const preparedSectionsRoot = join(preparedRoot, "sections");

export const existingBuildingCodePrefix = "EBC";
export const existingBuildingSyncCodeVersion =
  "CodeContent/authored/new-york-city/2026-existing-building-code/bundle.json#1";

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

export function isExistingBuildingChapterID(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 25_000_000 && parsed < 26_000_000;
}

export function isExistingBuildingSectionID(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed >= 26_000_000 && parsed < 27_000_000;
}

async function bundle() {
  cachedBundle ||= await readJSON(join(existingBuildingContentRoot, "bundle.json"));
  return cachedBundle;
}

async function manifest() {
  cachedManifest ||= await readJSON(join(preparedRoot, "manifest.json"));
  return cachedManifest;
}

async function sourceManifest() {
  cachedSourceManifest ||= await readJSON(join(existingBuildingContentRoot, "source-manifest.json"));
  return cachedSourceManifest;
}

export async function existingBuildingContentMetadata() {
  const [contentBundle, source] = await Promise.all([bundle(), sourceManifest()]);
  return {
    id: source.libraryID,
    codePrefix: existingBuildingCodePrefix,
    codeVersion: contentBundle.codes?.[0]?.name || source.codeVersion,
    syncCodeVersion: existingBuildingSyncCodeVersion,
    displayName: "NYC Existing Building Code",
    enactedDate: source.enactedDate,
    effectiveDate: source.effectiveDate,
    effectiveDateAuthority: source.effectiveDateAuthority,
    effectiveDateSourceURL: source.effectiveDateSourceURL,
    effectiveStatus: source.effectiveStatus,
    sourceAuthority: source.sourceAuthority,
    sourceURL: source.sourceURL,
    researchEligibility: source.researchEligibility === true,
    validationSummary: source.validationSummary
  };
}

export async function existingBuildingChapterIndex() {
  const [contentBundle, contentManifest] = await Promise.all([bundle(), manifest()]);
  const byID = new Map(
    (contentManifest.chapters || []).map((chapter) => [String(chapter.chapterID), chapter])
  );
  return (contentBundle.chapters || []).map((chapter) => ({
    id: chapter.id,
    codePrefix: existingBuildingCodePrefix,
    codeSectionID: chapter.codeSectionID || 1,
    codeVersion: existingBuildingSyncCodeVersion,
    chapterNumber: chapter.chapterNumber,
    displayTitle: chapter.title,
    fullTitle: chapter.title,
    title: chapter.title,
    groupCount: 1,
    sectionCount: byID.get(String(chapter.id))?.sectionCount || 0,
    manifestSectionCount: byID.get(String(chapter.id))?.sectionCount || 0
  }));
}

export async function existingBuildingChapter(chapterID) {
  const key = String(chapterID || "").trim();
  if (!isExistingBuildingChapterID(key)) return null;
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

export async function existingBuildingSectionCatalog() {
  if (cachedCatalog) return cachedCatalog;
  const chapters = await existingBuildingChapterIndex();
  const result = [];
  for (const chapterSummary of chapters) {
    const chapter = await existingBuildingChapter(chapterSummary.id);
    for (const section of flattenedSections(chapter)) {
      result.push({
        id: section.id,
        chapterID: chapterSummary.id,
        codePrefix: existingBuildingCodePrefix,
        codeSectionID: 1,
        codeVersion: existingBuildingSyncCodeVersion,
        chapterNumber: chapterSummary.chapterNumber,
        sectionNumber: section.sectionNumber,
        title: section.title,
        headerLine: section.headerLine,
        headingLine: section.headingLine
      });
    }
  }
  cachedCatalog = result;
  return cachedCatalog;
}

export async function existingBuildingSectionSummary(sectionID) {
  const key = String(sectionID || "").trim();
  if (!isExistingBuildingSectionID(key)) return null;
  return (await existingBuildingSectionCatalog()).find((section) => String(section.id) === key) || null;
}

export async function existingBuildingSection(sectionID) {
  const key = String(sectionID || "").trim();
  if (!isExistingBuildingSectionID(key)) return null;
  if (!cachedSections.has(key)) {
    cachedSections.set(key, await readJSON(join(preparedSectionsRoot, `${key}.json`)));
  }
  return cachedSections.get(key);
}

export async function existingBuildingSearchIndex() {
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
