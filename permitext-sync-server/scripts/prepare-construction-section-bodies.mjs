import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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
const canonicalSectionRoot = join(canonicalRoot, "prepared", "sections");
const chapterRoot = join(canonicalRoot, "prepared", "chapters");
const structuralCatalogPath = join(canonicalRoot, "prepared", "structural-sections.json");
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
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");

const prefixByCodeSectionID = new Map([
  [1, "BC"],
  [3, "AC"],
  [4, "FGC"],
  [5, "PC"],
  [6, "MC"]
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

function canonicalIDFor(section, chapter, codePrefix, canonicalMap) {
  if (Number.isSafeInteger(Number(section.id)) && Number(section.id) > 0) return Number(section.id);
  return canonicalMap.byCodeChapterSection?.[
    canonicalKey(codePrefix, chapter.chapterNumber, section.sectionNumber)
  ] ?? null;
}

function structuralClassification(reason) {
  if (reason === "empty-official-heading") return "title-only-official-heading";
  if (reason === "no-official-heading") return "nested-or-title-only-catalog-entry";
  return "unavailable-authoritative-body";
}

function structuralCatalog(entries, totalSections) {
  const classificationCounts = Object.fromEntries(
    entries.reduce((counts, entry) => {
      counts.set(entry.classification, (counts.get(entry.classification) || 0) + 1);
      return counts;
    }, new Map())
  );
  return {
    schemaVersion: 1,
    source: "authoritative bundled chapter HTML only",
    totalSections,
    availablePreparedBodies: totalSections - entries.length,
    classifiedStructuralEntries: entries.length,
    classificationCounts,
    entries
  };
}

async function bodyAlreadyAvailable(canonicalID, webSectionID) {
  const candidates = [
    join(canonicalSectionRoot, `${canonicalID}.json`),
    join(canonicalSectionRoot, `${webSectionID}.json`),
    join(legacySectionRoot, `${webSectionID}.json`)
  ];
  for (const path of candidates) {
    if (await exists(path)) return true;
  }
  return false;
}

async function main() {
  assert(!(write && check), "Use either --write or --check, not both.");
  const [manifest, canonicalMap, chapterFiles] = await Promise.all([
    readJSON(join(canonicalRoot, "prepared", "manifest.json")),
    readJSON(canonicalMapPath),
    readdir(chapterRoot)
  ]);
  const manifestByChapterID = new Map(manifest.chapters.map((chapter) => [Number(chapter.chapterID), chapter]));
  const sections = [];
  for (const file of chapterFiles.filter((name) => name.endsWith(".json")).sort()) {
    const chapter = await readJSON(join(chapterRoot, file));
    const manifestChapter = manifestByChapterID.get(Number(chapter.chapterID));
    const codePrefix = prefixByCodeSectionID.get(Number(manifestChapter?.codeSectionID));
    assert(manifestChapter && codePrefix, `Unknown prepared chapter ${chapter.chapterID}.`);
    for (const section of (chapter.groups || []).flatMap((group) => group.sections || [])) {
      const canonicalID = canonicalIDFor(section, manifestChapter, codePrefix, canonicalMap);
      assert(Number.isSafeInteger(canonicalID), `Section ${section.id} has no canonical ID.`);
      sections.push({
        ...section,
        id: canonicalID,
        webSectionID: Number(section.id),
        chapterID: Number(chapter.chapterID),
        chapterNumber: String(manifestChapter.chapterNumber),
        codePrefix
      });
    }
  }

  const structuralEntries = [];
  const extracted = [];
  let existingBodies = 0;
  for (const section of sections) {
    if (await bodyAlreadyAvailable(section.id, section.webSectionID)) {
      existingBodies += 1;
      continue;
    }
    const status = await constructionHTMLBodyStatusForSection(section);
    if (status.body) {
      extracted.push({ section, body: status.body });
      continue;
    }
    structuralEntries.push({
      sectionID: section.id,
      webSectionID: section.webSectionID,
      codePrefix: section.codePrefix,
      chapterID: section.chapterID,
      chapterNumber: section.chapterNumber,
      sectionNumber: section.sectionNumber,
      title: section.title,
      classification: structuralClassification(status.reason),
      reason: status.reason,
      sourceHTMLPath: status.sourceHTMLPath || null
    });
  }
  structuralEntries.sort((left, right) => left.sectionID - right.sectionID);
  const catalog = structuralCatalog(structuralEntries, sections.length);

  if (write) {
    await mkdir(canonicalSectionRoot, { recursive: true });
    for (const { section, body } of extracted) {
      const path = join(canonicalSectionRoot, `${section.id}.json`);
      assert(!(await exists(path)), `Refusing to replace existing prepared body ${path}.`);
      await writeFile(path, `${JSON.stringify(body)}\n`);
    }
    await writeFile(structuralCatalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  }

  if (check) {
    assert(await exists(structuralCatalogPath), "Structural section catalog is missing; run with --write.");
    const savedCatalog = await readJSON(structuralCatalogPath);
    assert(
      JSON.stringify(savedCatalog) === JSON.stringify(catalog),
      "Prepared HTML bodies or structural classification are stale; run scripts/prepare-construction-section-bodies.mjs --write."
    );
    for (const { section } of extracted) {
      assert(
        await exists(join(canonicalSectionRoot, `${section.id}.json`)),
        `Prepared HTML body for section ${section.id} is missing; run with --write.`
      );
    }
  }

  console.log("prepared construction section bodies", {
    mode: write ? "write" : check ? "check" : "audit",
    sections: sections.length,
    existingPreparedBodies: existingBodies,
    deterministicHTMLBodies: extracted.length,
    preparedBodiesAfterWrite: existingBodies + extracted.length,
    classifiedStructuralEntries: structuralEntries.length,
    classificationCounts: catalog.classificationCounts
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
