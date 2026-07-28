import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = dirname(fileURLToPath(import.meta.url));
export const zoningContentRoot = join(
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
const preparedRoot = join(zoningContentRoot, "prepared");
const preparedChaptersRoot = join(preparedRoot, "chapters");
const preparedSectionsRoot = join(preparedRoot, "sections");
const assetRoot = join(zoningContentRoot, "assets");

export const zoningCodePrefix = "ZR";
export const zoningSyncCodeVersion =
  "CodeContent/authored/new-york-city/2026-zoning-resolution/bundle.json#1";

let cachedBundle = null;
let cachedManifest = null;
let cachedSourceManifest = null;
let cachedCatalog = null;
let cachedSearchIndex = null;
const cachedChapters = new Map();
const cachedSections = new Map();

async function readJSON(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export function isZoningChapterID(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed >= 15_000_000 && parsed < 20_000_000;
}

export function isZoningSectionID(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed >= 20_000_000 && parsed < 25_000_000;
}

export async function zoningBundle() {
  cachedBundle ||= await readJSON(join(zoningContentRoot, "bundle.json"));
  return cachedBundle;
}

export async function zoningManifest() {
  cachedManifest ||= await readJSON(join(preparedRoot, "manifest.json"));
  return cachedManifest;
}

export async function zoningSourceManifest() {
  cachedSourceManifest ||= await readJSON(join(zoningContentRoot, "source-manifest.json"));
  return cachedSourceManifest;
}

export async function zoningContentMetadata() {
  const [bundle, source] = await Promise.all([zoningBundle(), zoningSourceManifest()]);
  return {
    id: source.libraryID,
    codePrefix: zoningCodePrefix,
    codeVersion: bundle.codes?.[0]?.name || source.codeVersion,
    syncCodeVersion: zoningSyncCodeVersion,
    displayName: "NYC Zoning Resolution",
    textChangesThrough: source.textChangesThrough,
    sourceAuthority: source.sourceAuthority,
    sourceURL: source.sourceHomepageURL,
    researchEligibility: source.researchEligibility === true,
    validationSummary: source.validationSummary
  };
}

export async function zoningChapterIndex() {
  const [bundle, manifest] = await Promise.all([zoningBundle(), zoningManifest()]);
  const manifestByID = new Map((manifest.chapters || []).map((chapter) => [String(chapter.chapterID), chapter]));
  return (bundle.chapters || []).map((chapter) => {
    const prepared = manifestByID.get(String(chapter.id));
    return {
      id: chapter.id,
      codePrefix: zoningCodePrefix,
      codeSectionID: chapter.codeSectionID || 1,
      codeVersion: zoningSyncCodeVersion,
      chapterNumber: chapter.chapterNumber,
      displayTitle: chapter.title,
      fullTitle: chapter.title,
      title: chapter.title,
      groupCount: 1,
      sectionCount: prepared?.sectionCount || 0,
      manifestSectionCount: prepared?.sectionCount || 0
    };
  });
}

export async function zoningChapter(chapterID) {
  const key = String(chapterID || "").trim();
  if (!isZoningChapterID(key)) return null;
  if (cachedChapters.has(key)) return cachedChapters.get(key);
  try {
    const payload = await readJSON(join(preparedChaptersRoot, `${key}.json`));
    cachedChapters.set(key, payload);
    return payload;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function flattenedChapterSections(chapter) {
  return (chapter?.groups || []).flatMap((group) =>
    (group.sections || []).map((section) => ({
      ...section,
      groupID: group.id,
      headerLine: group.headerLine,
      headingLine: group.headingLine
    }))
  );
}

export async function zoningSectionCatalog() {
  if (cachedCatalog) return cachedCatalog;
  const chapters = await zoningChapterIndex();
  const summaries = [];
  for (const summary of chapters) {
    const chapter = await zoningChapter(summary.id);
    for (const section of flattenedChapterSections(chapter)) {
      summaries.push({
        id: section.id,
        chapterID: summary.id,
        codePrefix: zoningCodePrefix,
        codeSectionID: 1,
        codeVersion: zoningSyncCodeVersion,
        chapterNumber: summary.chapterNumber,
        sectionNumber: section.sectionNumber,
        title: section.title,
        headerLine: section.headerLine,
        headingLine: section.headingLine
      });
    }
  }
  cachedCatalog = summaries;
  return cachedCatalog;
}

export async function zoningSectionSummary(sectionID) {
  const key = String(sectionID || "").trim();
  if (!isZoningSectionID(key)) return null;
  return (await zoningSectionCatalog()).find((section) => String(section.id) === key) || null;
}

export async function zoningSection(sectionID) {
  const key = String(sectionID || "").trim();
  if (!isZoningSectionID(key)) return null;
  if (cachedSections.has(key)) return cachedSections.get(key);
  try {
    const payload = await readJSON(join(preparedSectionsRoot, `${key}.json`));
    cachedSections.set(key, payload);
    return payload;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function zoningSearchIndex() {
  if (!cachedSearchIndex) {
    const payload = await readJSON(join(preparedRoot, "searchIndex.json"));
    cachedSearchIndex = new Map(
      Object.entries(payload.tokens || {}).map(([token, ids]) => [token, new Set(ids)])
    );
  }
  return cachedSearchIndex;
}

export async function zoningAssetFilePath(fileName) {
  const normalized = String(fileName || "").trim();
  if (!/^zr-[a-f0-9]{16}-[a-zA-Z0-9._-]+$/.test(normalized)) return null;
  const path = join(assetRoot, normalized);
  try {
    await access(path);
    return path;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
