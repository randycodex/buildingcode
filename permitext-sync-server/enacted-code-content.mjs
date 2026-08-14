import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyVisibleSectionNumber,
  decorateSectionForNavigation,
  filterChapterToNavigation,
  projectSourceChapterToNavigation
} from "./code-navigation-hierarchy.mjs";
import { normalizedSortedPostingList } from "./search-postings.mjs";

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

const packageDefinitions = [
  {
    id: "nyc-enacted-administrative-code",
    directory: "2026-enacted-administrative-code",
    syncCodeVersion:
      "CodeContent/authored/new-york-city/2026-enacted-administrative-code/bundle.json#1",
    displayName: "NYC Enacted Administrative Code",
    chapterRange: [30_000_000, 31_000_000],
    sectionRange: [31_000_000, 32_000_000]
  },
  {
    id: "nyc-2025-specialty-codes",
    directory: "2025-specialty-codes",
    syncCodeVersion:
      "CodeContent/authored/new-york-city/2025-specialty-codes/bundle.json#1",
    displayName: "2025 NYC Energy Conservation and Electrical Codes",
    chapterRange: [32_000_000, 33_000_000],
    sectionRange: [33_000_000, 34_000_000]
  }
].map((definition) => ({
  ...definition,
  root: join(authoredRoot, definition.directory)
}));

export const enactedCodePrefixes = new Set([
  "T24",
  "T25",
  "T26",
  "BC68",
  "HMC",
  "T28",
  "FC",
  "LL",
  "ECC",
  "EC"
]);

const packageCaches = new Map();
let mergedSearchIndexPromise = null;
let cachedNavigationIndex = null;
let cachedNavigationIndexPromise = null;
let cachedDecoratedCatalog = null;
let cachedDecoratedCatalogPromise = null;

function cacheFor(definition) {
  if (!packageCaches.has(definition.id)) {
    packageCaches.set(definition.id, {
      bundle: null,
      manifest: null,
      source: null,
      catalog: null,
      chapters: new Map(),
      sections: new Map()
    });
  }
  return packageCaches.get(definition.id);
}

async function readJSON(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function definitionForID(value, rangeKey) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed)) return null;
  return packageDefinitions.find((definition) => {
    const [start, end] = definition[rangeKey];
    return parsed >= start && parsed < end;
  }) || null;
}

async function packageBundle(definition) {
  const cache = cacheFor(definition);
  cache.bundle ||= await readJSON(join(definition.root, "bundle.json"));
  return cache.bundle;
}

async function packageManifest(definition) {
  const cache = cacheFor(definition);
  cache.manifest ||= await readJSON(join(definition.root, "prepared", "manifest.json"));
  return cache.manifest;
}

async function packageSource(definition) {
  const cache = cacheFor(definition);
  cache.source ||= await readJSON(join(definition.root, "source-manifest.json"));
  return cache.source;
}

async function packageCatalog(definition) {
  const cache = cacheFor(definition);
  if (!cache.catalog) {
    const payload = await readJSON(join(definition.root, "prepared", "sectionCatalog.json"));
    cache.catalog = (payload.sections || []).map((section) => applyVisibleSectionNumber(section));
  }
  return cache.catalog;
}

async function packageSearchIndex(definition) {
  const payload = await readJSON(join(definition.root, "prepared", "searchIndex.json"));
  return new Map(
    Object.entries(payload.tokens || {}).map(([token, ids]) => [
      token,
      normalizedSortedPostingList(ids)
    ])
  );
}

export function isEnactedCodeChapterID(value) {
  return Boolean(definitionForID(value, "chapterRange"));
}

export function isEnactedCodeSectionID(value) {
  return Boolean(definitionForID(value, "sectionRange"));
}

export function enactedSyncCodeVersionForPrefix(prefix) {
  const normalized = String(prefix || "").trim().toUpperCase();
  if (!enactedCodePrefixes.has(normalized)) return null;
  return normalized === "ECC" || normalized === "EC"
    ? packageDefinitions[1].syncCodeVersion
    : packageDefinitions[0].syncCodeVersion;
}

export async function enactedContentMetadata() {
  return Promise.all(packageDefinitions.map(async (definition) => {
    const [bundle, source] = await Promise.all([
      packageBundle(definition),
      packageSource(definition)
    ]);
    const prefixes = source.codeSections?.map((entry) => entry.prefix) ||
      (definition.id === "nyc-2025-specialty-codes" ? ["ECC", "EC"] : []);
    return {
      id: definition.id,
      codeVersion: bundle.codes?.[0]?.name || source.codeVersion,
      syncCodeVersion: definition.syncCodeVersion,
      displayName: definition.displayName,
      codePrefixes: prefixes,
      codeSections: source.codeSections || [],
      sourceAuthority: source.sourceAuthority,
      sourceURL: source.overviewURL || null,
      statedCurrency: source.statedCurrency || null,
      energySourceURL: source.energySourceURL || null,
      energyEffectiveDate: source.energyEffectiveDate || null,
      electricalSourceURL: source.electricalSourceURL || null,
      electricalEffectiveDate: source.electricalEffectiveDate || null,
      extractionBoundary: source.extractionBoundary || source.electricalBoundary || null,
      verificationStatus: source.verificationStatus || "official-source-extracted",
      researchEligibility: true
    };
  }));
}

export async function enactedChapterIndex() {
  const results = [];
  for (const definition of packageDefinitions) {
    const [bundle, manifest, source] = await Promise.all([
      packageBundle(definition),
      packageManifest(definition),
      packageSource(definition)
    ]);
    const prefixByCodeSectionID = new Map(
      (source.codeSections || []).map((entry, index) => [index + 1, entry.prefix])
    );
    if (definition.id === "nyc-2025-specialty-codes") {
      prefixByCodeSectionID.set(1, "ECC");
      prefixByCodeSectionID.set(2, "EC");
    }
    const manifestByID = new Map(
      (manifest.chapters || []).map((chapter) => [String(chapter.chapterID), chapter])
    );
    for (const chapter of bundle.chapters || []) {
      const prepared = manifestByID.get(String(chapter.id));
      results.push({
        id: chapter.id,
        codePrefix: prepared?.codePrefix || prefixByCodeSectionID.get(chapter.codeSectionID) || "",
        codeSectionID: chapter.codeSectionID,
        codeVersion: definition.syncCodeVersion,
        chapterNumber: chapter.chapterNumber,
        displayTitle: chapter.title,
        fullTitle: chapter.title,
        title: chapter.title,
        groupCount: null,
        sectionCount: prepared?.sectionCount || 0,
        manifestSectionCount: prepared?.sectionCount || 0
      });
    }
  }
  return results;
}

export async function enactedNavigationChapterIndex() {
  if (cachedNavigationIndex) return cachedNavigationIndex;
  if (cachedNavigationIndexPromise) return cachedNavigationIndexPromise;
  cachedNavigationIndexPromise = (async () => {
    const sourceChapters = await enactedChapterIndex();
    const projected = [];
    for (const summary of sourceChapters) {
      const prepared = await enactedChapter(summary.id);
      const projectedChapters = projectSourceChapterToNavigation(summary, prepared);
      for (const navigation of projectedChapters) {
        const groups = navigation.hierarchyKind === "logical-chapter"
          ? (prepared.groups || []).filter((group) => String(group.id) === String(navigation.groupID))
          : prepared.groups || [];
        navigation.sectionIDs = groups.flatMap((group) =>
          (group.sections || []).map((section) => String(section.id))
        );
        projected.push(navigation);
      }
    }
    cachedNavigationIndex = projected;
    return projected;
  })().catch((error) => {
    cachedNavigationIndexPromise = null;
    throw error;
  });
  try {
    return await cachedNavigationIndexPromise;
  } finally {
    cachedNavigationIndexPromise = null;
  }
}

export function isEnactedNavigationChapterID(value) {
  return /^enacted-\d+-group-\d+$/.test(String(value || "").trim());
}

export async function enactedChapterByAnyID(chapterID) {
  const key = String(chapterID || "").trim();
  if (!key) return null;
  const navigationIndex = await enactedNavigationChapterIndex();
  const navigationSummary = navigationIndex.find((entry) => String(entry.id) === key) || null;
  const sourceID = navigationSummary?.sourceChapterID || (isEnactedCodeChapterID(key) ? key : "");
  if (!sourceID) return null;
  const [prepared, sourceIndex] = await Promise.all([
    enactedChapter(sourceID),
    enactedChapterIndex()
  ]);
  if (!prepared) return null;
  const sourceSummary = sourceIndex.find((entry) => String(entry.id) === String(sourceID)) || navigationSummary;
  const summary = navigationSummary || {
    ...sourceSummary,
    sourceChapterID: sourceSummary?.id,
    sourceChapterNumber: sourceSummary?.chapterNumber,
    hierarchyKind: "source-chapter",
    navigationChapterID: sourceSummary?.id
  };
  return {
    summary,
    sourceSummary,
    chapter: filterChapterToNavigation(prepared, summary)
  };
}

export async function enactedChapter(chapterID) {
  const definition = definitionForID(chapterID, "chapterRange");
  if (!definition) return null;
  const key = String(chapterID);
  const cache = cacheFor(definition);
  if (!cache.chapters.has(key)) {
    cache.chapters.set(
      key,
      await readJSON(join(definition.root, "prepared", "chapters", `${key}.json`))
    );
  }
  return cache.chapters.get(key);
}

async function rawEnactedSectionCatalog() {
  const results = [];
  for (const definition of packageDefinitions) {
    results.push(...await packageCatalog(definition));
  }
  return results;
}

export async function enactedSectionCatalog() {
  if (cachedDecoratedCatalog) return cachedDecoratedCatalog;
  if (cachedDecoratedCatalogPromise) return cachedDecoratedCatalogPromise;
  cachedDecoratedCatalogPromise = (async () => {
    const [raw, navigationIndex, sourceChapters] = await Promise.all([
      rawEnactedSectionCatalog(),
      enactedNavigationChapterIndex(),
      enactedChapterIndex()
    ]);
    const navigationBySection = new Map();
    for (const navigation of navigationIndex) {
      for (const sectionID of navigation.sectionIDs || []) {
        navigationBySection.set(String(sectionID), navigation);
      }
    }
    const sourceByID = new Map(sourceChapters.map((chapter) => [String(chapter.id), chapter]));
    cachedDecoratedCatalog = raw.map((section) => decorateSectionForNavigation(
      section,
      navigationBySection.get(String(section.id)),
      sourceByID.get(String(section.chapterID))
    ));
    return cachedDecoratedCatalog;
  })().catch((error) => {
    cachedDecoratedCatalogPromise = null;
    cachedDecoratedCatalog = null;
    throw error;
  });
  try {
    return await cachedDecoratedCatalogPromise;
  } finally {
    cachedDecoratedCatalogPromise = null;
  }
}

export async function enactedSectionSummary(sectionID) {
  const key = String(sectionID || "").trim();
  if (!isEnactedCodeSectionID(key)) return null;
  return (await enactedSectionCatalog()).find((section) => String(section.id) === key) || null;
}

export async function enactedSection(sectionID) {
  const definition = definitionForID(sectionID, "sectionRange");
  if (!definition) return null;
  const key = String(sectionID);
  const cache = cacheFor(definition);
  if (!cache.sections.has(key)) {
    cache.sections.set(
      key,
      await readJSON(join(definition.root, "prepared", "sections", `${key}.json`))
    );
  }
  return cache.sections.get(key);
}

export async function enactedSearchIndex() {
  if (!mergedSearchIndexPromise) {
    mergedSearchIndexPromise = (async () => {
      const merged = new Map();
      for (const definition of packageDefinitions) {
        const index = await packageSearchIndex(definition);
        for (const [token, ids] of index) {
          const existing = merged.get(token);
          merged.set(token, existing ? [...existing, ...ids] : ids);
        }
      }
      for (const [token, ids] of merged) {
        merged.set(token, normalizedSortedPostingList(ids));
      }
      return merged;
    })().catch((error) => {
      mergedSearchIndexPromise = null;
      throw error;
    });
  }
  return mergedSearchIndexPromise;
}
