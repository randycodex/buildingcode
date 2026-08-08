import { access, open, readFile, readdir, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { constructionHTMLBodyStatusForSection } from "../construction-html-content.mjs";

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
const authoredRoot = dirname(canonicalRoot);
const canonicalPreparedRoot = join(canonicalRoot, "prepared");
const chapterRoot = join(canonicalPreparedRoot, "chapters");
const canonicalSectionRoot = join(canonicalPreparedRoot, "sections");
const structuralCatalogPath = join(canonicalPreparedRoot, "structural-sections.json");
const canonicalAssetRoot = join(canonicalRoot, "assets");
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
const xcodeProjectPath = join(workspaceRoot, "NYC CC APP", "NYC CC APP.xcodeproj", "project.pbxproj");
const minimumAvailableBodyCount = 11_610;
const minimumAvailableBodyCoverage = 0.90;
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

function imageAssetNames(blocks) {
  const names = new Set();
  for (const block of blocks || []) {
    if (block.imageID) names.add(basename(String(block.imageID)));
    for (const match of String(block.html || "").matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
      const source = match[1].split(/[?#]/, 1)[0];
      if (!source || source.startsWith("data:")) continue;
      try {
        names.add(basename(decodeURIComponent(source)));
      } catch {
        names.add(basename(source));
      }
    }
  }
  return [...names].filter(Boolean);
}

async function pngDimensions(path) {
  const handle = await open(path, "r");
  try {
    const header = Buffer.alloc(24);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const pngSignature = "89504e470d0a1a0a";
    if (bytesRead < header.length || header.subarray(0, 8).toString("hex") !== pngSignature) return null;
    return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
  } finally {
    await handle.close();
  }
}

async function main() {
  const authoredBundleDirectories = await readdir(authoredRoot, { withFileTypes: true });
  for (const directory of authoredBundleDirectories.filter((entry) => entry.isDirectory())) {
    const bundleRoot = join(authoredRoot, directory.name);
    const chapterCatalogPath = join(bundleRoot, "prepared", "chapterCatalog.json");
    if (!await exists(chapterCatalogPath)) continue;
    const authoredBundle = await readJSON(join(bundleRoot, "bundle.json"));
    const chapterCatalog = await readJSON(chapterCatalogPath);
    assert(
      authoredBundle.chapterStructureSchemaVersion === 2,
      `${directory.name} ships an external chapter catalog but does not enable chapter structure schema 2.`
    );
    const catalogMatchesBundle = chapterCatalog.chapters.length === authoredBundle.chapters.length;
    const hasPerChapterFallback = (await Promise.all(authoredBundle.chapters.map((chapter) =>
      exists(join(bundleRoot, "prepared", "chapters", `${chapter.id}.json`))
    ))).every(Boolean);
    assert(
      catalogMatchesBundle || hasPerChapterFallback,
      `${directory.name} has neither a matching chapter catalog nor complete per-chapter structures.`
    );
  }

  const [bundle, manifest, canonicalMap, searchIndex, chapterFiles, canonicalSectionFiles, structuralCatalog, xcodeProject] = await Promise.all([
    readJSON(join(canonicalRoot, "bundle.json")),
    readJSON(join(canonicalPreparedRoot, "manifest.json")),
    readJSON(canonicalMapPath),
    readJSON(join(canonicalPreparedRoot, "searchIndex.json")),
    readdir(chapterRoot),
    readdir(canonicalSectionRoot),
    readJSON(structuralCatalogPath),
    readFile(xcodeProjectPath, "utf8")
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
          title: section.title,
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
  const rowsByCanonicalSectionID = new Map(rows.map((row) => [row.canonicalSectionID, row]));
  const missingFromSearch = [...canonicalSectionIDs].filter((id) => !indexedSectionIDs.has(id));
  const unknownSearchIDs = [...indexedSectionIDs].filter((id) => !canonicalSectionIDs.has(id));
  assert(missingFromSearch.length === 0, `Search index is missing ${missingFromSearch.length} canonical sections.`);
  assert(unknownSearchIDs.length === 0, `Search index contains ${unknownSearchIDs.length} unknown section IDs.`);

  const canonicalOverrideNames = canonicalSectionFiles.filter((name) => /^\d+\.json$/.test(name));
  const canonicalOverrideIDs = new Set(canonicalOverrideNames.map((name) => Number.parseInt(name, 10)));
  let deterministicHTMLOverrideCount = 0;
  for (const file of canonicalOverrideNames) {
    const expectedID = Number.parseInt(file, 10);
    const payload = await readJSON(join(canonicalSectionRoot, file));
    assert(payload.sectionID === expectedID, `Canonical section file ${file} declares the wrong section ID.`);
    assert(canonicalSectionIDs.has(expectedID), `Canonical section file ${file} is not referenced by chapter content.`);
    if (payload.sourceHTMLPath) {
      deterministicHTMLOverrideCount += 1;
      const row = rowsByCanonicalSectionID.get(expectedID);
      const status = await constructionHTMLBodyStatusForSection({
        id: expectedID,
        webSectionID: row.webSectionID,
        chapterID: row.chapterID,
        chapterNumber: row.chapterNumber,
        codePrefix: row.codePrefix,
        sectionNumber: row.sectionNumber,
        title: row.title
      });
      assert(status.body, `Prepared HTML body ${expectedID} no longer resolves from its bundled chapter source.`);
      assert(
        JSON.stringify(payload) === JSON.stringify(status.body),
        `Prepared HTML body ${expectedID} no longer exactly matches its authoritative bundled chapter extraction.`
      );
    }
  }
  assert(
    deterministicHTMLOverrideCount >= 1_239,
    `Deterministic bundled-HTML body coverage regressed to ${deterministicHTMLOverrideCount}; expected at least 1239.`
  );

  const fuelGasTerms = await readJSON(join(canonicalSectionRoot, "8021.json"));
  const fuelGasTermsText = fuelGasTerms.blocks.map((block) => block.plainText || "").join("\n");
  assert(
    fuelGasTerms.chapterNumber === "2" &&
      fuelGasTermsText.includes("ordinarily accepted meanings") &&
      !fuelGasTermsText.includes("air infiltration rate"),
    "FGC 201.4 is not using its canonical Terms not defined body."
  );

  const fuelGasInfiltration = await readJSON(join(canonicalSectionRoot, "8090.json"));
  const fuelGasInfiltrationText = fuelGasInfiltration.blocks.map((block) => block.plainText || "").join("\n");
  const fuelGasEquationAssets = fuelGasInfiltration.blocks
    .map((block) => block.imageID)
    .filter(Boolean);
  assert(
    fuelGasInfiltration.chapterNumber === "3" &&
      fuelGasInfiltrationText.includes("air infiltration rate") &&
      fuelGasInfiltrationText.includes("Equation 3-1") &&
      fuelGasInfiltrationText.includes("Equation 3-2"),
    "FGC 304.5.2 is not using its canonical known-air-infiltration body."
  );
  assert(fuelGasEquationAssets.length === 2, "FGC 304.5.2 must reference both equation images.");
  for (const asset of fuelGasEquationAssets) {
    assert(await exists(join(canonicalRoot, "assets", asset)), `FGC 304.5.2 equation asset ${asset} is missing.`);
  }

  let availableBodyCount = 0;
  const unavailableBodyRows = [];
  let referencedImageCount = 0;
  const missingImageAssets = [];
  const emptyImageAssets = [];
  const placeholderImageAssets = [];
  for (const row of rows) {
    const candidates = [
      join(canonicalSectionRoot, `${row.canonicalSectionID}.json`),
      join(canonicalSectionRoot, `${row.webSectionID}.json`),
      join(legacySectionRoot, `${row.webSectionID}.json`)
    ];
    const bodyPath = (await Promise.all(candidates.map(async (path) => ((await exists(path)) ? path : null))))
      .find(Boolean);
    if (!bodyPath) {
      unavailableBodyRows.push(row);
      continue;
    }

    availableBodyCount += 1;
    const body = await readJSON(bodyPath);
    for (const assetName of imageAssetNames(body.blocks)) {
      referencedImageCount += 1;
      const assetPath = join(canonicalAssetRoot, assetName);
      if (!(await exists(assetPath))) {
        missingImageAssets.push(`${assetName} (section ${row.canonicalSectionID})`);
        continue;
      }
      const assetStats = await stat(assetPath);
      if (assetStats.size === 0) {
        emptyImageAssets.push(`${assetName} (section ${row.canonicalSectionID})`);
        continue;
      }
      const dimensions = await pngDimensions(assetPath);
      if (assetStats.size <= 100 || (dimensions?.width === 1 && dimensions?.height === 1)) {
        placeholderImageAssets.push(`${assetName} (section ${row.canonicalSectionID})`);
      }
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
  const availableBodyCoverage = rows.length ? availableBodyCount / rows.length : 0;
  assert(
    availableBodyCount >= minimumAvailableBodyCount,
    `Section body coverage regressed to ${availableBodyCount}; expected at least ${minimumAvailableBodyCount}.`
  );
  assert(
    availableBodyCoverage >= minimumAvailableBodyCoverage,
    `Section body coverage regressed to ${(availableBodyCoverage * 100).toFixed(2)}%; expected at least ${(minimumAvailableBodyCoverage * 100).toFixed(0)}%.`
  );
  assert(structuralCatalog.schemaVersion === 1, "Unsupported structural section catalog schema.");
  assert(
    structuralCatalog.source === "authoritative bundled chapter HTML only",
    "Structural section catalog must be derived only from bundled chapter HTML."
  );
  assert(structuralCatalog.totalSections === rows.length, "Structural section catalog has the wrong total section count.");
  assert(
    structuralCatalog.availablePreparedBodies === availableBodyCount,
    "Structural section catalog body coverage does not match published bodies."
  );
  assert(
    structuralCatalog.classifiedStructuralEntries === unavailableBodyRows.length,
    "Structural section catalog does not classify every unavailable body."
  );
  const structuralEntriesByID = new Map(
    (structuralCatalog.entries || []).map((entry) => [Number(entry.sectionID), entry])
  );
  assert(
    structuralEntriesByID.size === unavailableBodyRows.length,
    "Structural section catalog contains duplicate or unreferenced section IDs."
  );
  for (const row of unavailableBodyRows) {
    const status = await constructionHTMLBodyStatusForSection({
      id: row.canonicalSectionID,
      webSectionID: row.webSectionID,
      chapterID: row.chapterID,
      chapterNumber: row.chapterNumber,
      codePrefix: row.codePrefix,
      sectionNumber: row.sectionNumber,
      title: row.title
    });
    assert(!status.body, `Structural section ${row.canonicalSectionID} unexpectedly has an HTML body.`);
    const entry = structuralEntriesByID.get(row.canonicalSectionID);
    assert(entry, `Unavailable section ${row.canonicalSectionID} is absent from the structural catalog.`);
    assert(
      entry.reason === status.reason && entry.sourceHTMLPath === (status.sourceHTMLPath || null),
      `Structural section ${row.canonicalSectionID} no longer matches the bundled HTML classification.`
    );
    const expectedClassification = status.reason === "empty-official-heading"
      ? "title-only-official-heading"
      : status.reason === "no-official-heading"
        ? "nested-or-title-only-catalog-entry"
        : "unavailable-authoritative-body";
    assert(
      entry.classification === expectedClassification,
      `Structural section ${row.canonicalSectionID} has the wrong explicit classification.`
    );
  }
  assert(
    missingImageAssets.length === 0,
    `Published section bodies reference ${missingImageAssets.length} missing image assets:\n${missingImageAssets.join("\n")}`
  );
  assert(
    emptyImageAssets.length === 0,
    `Published section bodies reference ${emptyImageAssets.length} empty image assets:\n${emptyImageAssets.join("\n")}`
  );
  assert(
    placeholderImageAssets.length === 0,
    `Published section bodies reference ${placeholderImageAssets.length} placeholder image assets:\n${placeholderImageAssets.join("\n")}`
  );
  const resourcesBuildPhase = xcodeProject.match(
    /\/\* Begin PBXResourcesBuildPhase section \*\/([\s\S]*?)\/\* End PBXResourcesBuildPhase section \*\//
  )?.[1] || "";
  assert(resourcesBuildPhase.includes("CodeContent in Resources"), "The iOS target no longer packages CodeContent.");
  assert(
    !resourcesBuildPhase.includes(".sqlite in Resources"),
    "The iOS target packages a legacy SQLite database in addition to authored CodeContent."
  );

  const duplicateDisplayKeys = [...rowsByCanonicalKey.values()].filter((matchingRows) => matchingRows.length > 1);
  console.log("permitext content integrity passed", {
    chapters: jsonChapterFiles.length,
    sections: rows.length,
    indexedSections: indexedSectionIDs.size,
    canonicalOverrides: canonicalOverrideIDs.size,
    deterministicHTMLOverrides: deterministicHTMLOverrideCount,
    availableBodies: availableBodyCount,
    missingBodies: rows.length - availableBodyCount,
    availableBodyCoverage: `${(availableBodyCoverage * 100).toFixed(2)}%`,
    referencedImages: referencedImageCount,
    duplicateDisplayKeys: duplicateDisplayKeys.length
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
