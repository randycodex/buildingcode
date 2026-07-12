import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const workspaceRoot = dirname(serverRoot);
const canonicalRoot = join(
  workspaceRoot,
  "NYC CC APP",
  "permitext",
  "Resources",
  "CodeContent",
  "authored",
  "new-york-city",
  "2022-construction-codes"
);
const canonicalPreparedRoot = join(canonicalRoot, "prepared");
const chapterRoot = join(canonicalPreparedRoot, "chapters");
const canonicalSectionRoot = join(canonicalPreparedRoot, "sections");
const legacySectionRoot = join(
  workspaceRoot,
  "NYC CC APP",
  "NYCCCApp",
  "Resources",
  "CodeContent",
  "authored",
  "new-york-city",
  "2022-construction-codes",
  "prepared",
  "sections"
);
const canonicalMapPath = join(serverRoot, "config", "canonical-section-ids.json");
const prefixByCodeSectionID = new Map([
  [1, "BC"],
  [3, "AC"],
  [4, "FGC"],
  [5, "PC"],
  [6, "MC"]
]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJSON(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function canonicalKey(prefix, chapterNumber, sectionNumber) {
  return `${prefix}:${String(chapterNumber).trim()}:${String(sectionNumber).trim()}`;
}

function resolveCanonicalID(row, canonicalMap) {
  if (Number.isSafeInteger(row.webSectionID) && row.webSectionID > 0) return row.webSectionID;
  return canonicalMap.byCodeChapterSection?.[row.canonicalKey] ?? null;
}

async function main() {
  const [bundle, manifest, canonicalMap, searchIndex, chapterFiles, canonicalSectionFiles] = await Promise.all([
    readJSON(join(canonicalRoot, "bundle.json")),
    readJSON(join(canonicalPreparedRoot, "manifest.json")),
    readJSON(canonicalMapPath),
    readJSON(join(canonicalPreparedRoot, "searchIndex.json")),
    readdir(chapterRoot),
    readdir(canonicalSectionRoot)
  ]);

  assert(bundle.chapterStructureSchemaVersion === 2, "Canonical bundle must use external chapter structure schema 2.");
  assert(bundle.sectionContentSchemaVersion === 2, "Canonical bundle must use external section content schema 2.");
  assert(manifest.schemaVersion === 1, "Unsupported canonical content manifest schema.");
  assert(canonicalMap.schemaVersion === 2, "Unsupported canonical section-ID map schema.");
  assert(
    canonicalMap.generatedFrom ===
      "NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2022-construction-codes/prepared/manifest.json",
    "Canonical section-ID map points at a different content source."
  );

  const manifestByChapterID = new Map(manifest.chapters.map((chapter) => [String(chapter.chapterID), chapter]));
  const jsonChapterFiles = chapterFiles.filter((name) => name.endsWith(".json"));
  assert(jsonChapterFiles.length === manifestByChapterID.size, "Chapter file count does not match the canonical manifest.");

  const rows = [];
  for (const file of jsonChapterFiles) {
    const chapter = await readJSON(join(chapterRoot, file));
    const manifestChapter = manifestByChapterID.get(String(chapter.chapterID));
    assert(manifestChapter, `Chapter ${chapter.chapterID} is missing from the canonical manifest.`);
    const prefix = prefixByCodeSectionID.get(Number(manifestChapter.codeSectionID));
    assert(prefix, `Chapter ${chapter.chapterID} has an unsupported code section ID.`);
    for (const group of chapter.groups || []) {
      for (const section of group.sections || []) {
        const row = {
          chapterID: chapter.chapterID,
          chapterNumber: manifestChapter.chapterNumber || chapter.chapterNumber,
          codePrefix: prefix,
          sectionNumber: section.sectionNumber,
          webSectionID: section.id
        };
        row.canonicalKey = canonicalKey(row.codePrefix, row.chapterNumber, row.sectionNumber);
        row.canonicalSectionID = resolveCanonicalID(row, canonicalMap);
        assert(Number.isSafeInteger(row.canonicalSectionID), `Section ${row.webSectionID} has no canonical ID.`);
        rows.push(row);
      }
    }
  }

  const expectedSectionCount = manifest.chapters.reduce((count, chapter) => count + (chapter.sectionCount || 0), 0);
  assert(rows.length === expectedSectionCount, "Chapter section count does not match the canonical manifest.");
  assert(new Set(rows.map((row) => row.webSectionID)).size === rows.length, "Legacy web section IDs are not unique.");
  assert(new Set(rows.map((row) => row.canonicalSectionID)).size === rows.length, "Canonical section IDs are not unique.");

  const rowsByCanonicalKey = new Map();
  for (const row of rows) {
    rowsByCanonicalKey.set(row.canonicalKey, [...(rowsByCanonicalKey.get(row.canonicalKey) || []), row]);
  }
  for (const [key, keyedID] of Object.entries(canonicalMap.byCodeChapterSection || {})) {
    const matchingRows = rowsByCanonicalKey.get(key) || [];
    assert(matchingRows.length > 0, `Canonical key ${key} does not exist in chapter content.`);
    assert(
      matchingRows.some((row) => row.canonicalSectionID === keyedID),
      `Canonical key ${key} points at an unrelated section ID.`
    );
  }

  const indexedSectionIDs = new Set(Object.values(searchIndex.tokens || {}).flat());
  const canonicalSectionIDs = new Set(rows.map((row) => row.canonicalSectionID));
  const missingFromSearch = [...canonicalSectionIDs].filter((id) => !indexedSectionIDs.has(id));
  const unknownSearchIDs = [...indexedSectionIDs].filter((id) => !canonicalSectionIDs.has(id));
  assert(missingFromSearch.length === 0, `Search index is missing ${missingFromSearch.length} canonical sections.`);
  assert(unknownSearchIDs.length === 0, `Search index contains ${unknownSearchIDs.length} unknown section IDs.`);

  const canonicalOverrideNames = canonicalSectionFiles.filter((name) => /^\d+\.json$/.test(name));
  const canonicalOverrideIDs = new Set(canonicalOverrideNames.map((name) => Number.parseInt(name, 10)));
  for (const file of canonicalOverrideNames) {
    const expectedID = Number.parseInt(file, 10);
    const payload = await readJSON(join(canonicalSectionRoot, file));
    assert(payload.sectionID === expectedID, `Canonical section file ${file} declares the wrong section ID.`);
    assert(canonicalSectionIDs.has(expectedID), `Canonical section file ${file} is not referenced by chapter content.`);
  }

  let availableBodyCount = 0;
  for (const row of rows) {
    if (
      canonicalOverrideIDs.has(row.canonicalSectionID) ||
      await exists(join(legacySectionRoot, `${row.webSectionID}.json`))
    ) {
      availableBodyCount += 1;
    }
  }
  const expectedPreparedCount = manifest.chapters.reduce(
    (count, chapter) => count + (chapter.preparedSectionCount || 0),
    0
  );
  assert(
    availableBodyCount >= expectedPreparedCount,
    `Only ${availableBodyCount} section bodies are available; the manifest promises ${expectedPreparedCount}.`
  );

  const duplicateDisplayKeys = [...rowsByCanonicalKey.values()].filter((matchingRows) => matchingRows.length > 1);
  console.log("permitext content integrity passed", {
    chapters: jsonChapterFiles.length,
    sections: rows.length,
    indexedSections: indexedSectionIDs.size,
    canonicalOverrides: canonicalOverrideIDs.size,
    availableBodies: availableBodyCount,
    duplicateDisplayKeys: duplicateDisplayKeys.length
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
