#!/usr/bin/env node
/**
 * Read-only visual coverage audit across every live Permitext enacted-code library.
 * Exits nonzero only for missing referenced files, undecodable referenced files,
 * or official Construction chapter-HTML figures that are still unbound.
 */

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import {
  constructionChapterHTMLSource,
  constructionContentRoot,
  constructionHTMLBodyForSection,
  constructionImageAssetNames
} from "../construction-html-content.mjs";
import { resolveCodeAsset } from "../code-asset-store.mjs";
import { enactedSection, enactedSectionCatalog } from "../enacted-code-content.mjs";
import { existingBuildingSection, existingBuildingSectionCatalog } from "../existing-building-content.mjs";
import { zoningSection, zoningSectionCatalog } from "../zoning-content.mjs";
import { handleRequest } from "../app.mjs";

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
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
const outDir = process.argv.includes("--write")
  ? join(serverRoot, "docs", "visual-coverage")
  : null;
const checkHttp = process.argv.includes("--http");

function imageNamesFromHTML(html) {
  return constructionImageAssetNames([{ html }]);
}

function textImplied(value) {
  return [...String(value || "").matchAll(/\b(?:Figure|Fig\.)\s+[A-Z]?\d+(?:\.[0-9A-Za-z]+)*|\bEquation\s+\d+(?:[-–—]\d+)?|\bfire\s+district\s+maps?\b/gi)]
    .map((match) => match[0].replace(/\s+/g, " ").trim());
}

async function chapterFiles(packageDirectory) {
  const root = join(authoredRoot, packageDirectory, "code-sections");
  const files = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) stack.push(path);
      else if (entry.name.endsWith(".html")) files.push(path);
    }
  }
  return files;
}

async function main() {
  const constructionChapters = await readdir(join(constructionContentRoot, "prepared", "chapters"));
  const constructionSections = [];
  for (const file of constructionChapters.filter((name) => name.endsWith(".json"))) {
    const chapter = JSON.parse(await readFile(join(constructionContentRoot, "prepared", "chapters", file), "utf8"));
    for (const group of chapter.groups || []) {
      for (const section of group.sections || []) {
        constructionSections.push({
          ...section,
          id: section.id,
          chapterID: chapter.chapterID,
          chapterNumber: chapter.chapterNumber,
          codePrefix: null
        });
      }
    }
  }

  const prefixByChapter = new Map();
  const bundle = JSON.parse(await readFile(join(constructionContentRoot, "bundle.json"), "utf8"));
  const prefixByCodeSectionID = new Map([[1, "BC"], [3, "AC"], [4, "FGC"], [5, "PC"], [6, "MC"]]);
  for (const chapter of bundle.chapters) {
    prefixByChapter.set(Number(chapter.id), prefixByCodeSectionID.get(Number(chapter.codeSectionID)));
  }

  const boundNames = new Set();
  for (const section of constructionSections) {
    const official = await constructionHTMLBodyForSection({
      ...section,
      codePrefix: prefixByChapter.get(Number(section.chapterID))
    });
    for (const name of constructionImageAssetNames(official?.blocks)) boundNames.add(name);
  }

  const unboundChapterFigures = [];
  const htmlFiles = await chapterFiles("2022-construction-codes");
  for (const file of htmlFiles) {
    if (file.includes("/chapters/") && !file.includes("/code-sections/")) continue;
    const html = await readFile(file, "utf8");
    for (const name of imageNamesFromHTML(html)) {
      if (!boundNames.has(name)) {
        unboundChapterFigures.push({
          fileName: name,
          sourceHTMLPath: file.slice(file.indexOf("code-sections/"))
        });
      }
    }
  }

  const [zoning, ebc, enacted] = await Promise.all([
    zoningSectionCatalog(),
    existingBuildingSectionCatalog(),
    enactedSectionCatalog()
  ]);
  const implied = [];
  for (const [catalog, loader] of [
    [zoning, zoningSection],
    [ebc, existingBuildingSection],
    [enacted, enactedSection]
  ]) {
    for (const section of catalog) {
      const body = await loader(section.id);
      const html = (body?.blocks || []).map((block) => block.html || "").join("\n");
      if (imageNamesFromHTML(html).length) continue;
      for (const label of textImplied(`${html} ${body?.officialText || ""} ${section.title || ""}`)) {
        implied.push({
          packageID: section.codePrefix,
          canonicalSectionID: section.id,
          sectionNumber: section.sectionNumber,
          label
        });
      }
    }
  }

  const missing = [];
  for (const name of boundNames) {
    const resolved = await resolveCodeAsset(name);
    if (!resolved.path) missing.push(name);
    else if ((await stat(resolved.path)).size === 0) missing.push(`${name} (empty)`);
  }

  let httpFailures = [];
  if (checkHttp) {
    const server = createServer(handleRequest);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    for (const name of [...boundNames].sort()) {
      const response = await fetch(`http://127.0.0.1:${port}/code/assets/${encodeURIComponent(name)}`);
      if (response.status !== 200) httpFailures.push({ name, status: response.status });
    }
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    constructionBoundAssets: boundNames.size,
    unboundConstructionChapterFigures: unboundChapterFigures,
    textImpliedOutsideExtractedImages: implied.length,
    missingReferencedFiles: missing,
    httpFailures,
    contentHash: createHash("sha256").update([...boundNames].sort().join("\n")).digest("hex")
  };

  console.log("permitext visual coverage audit", {
    constructionBoundAssets: report.constructionBoundAssets,
    unboundConstructionChapterFigures: unboundChapterFigures.length,
    textImpliedOutsideExtractedImages: implied.length,
    missingReferencedFiles: missing.length,
    httpFailures: httpFailures.length
  });

  if (outDir) {
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, "visual-coverage-audit.json"), `${JSON.stringify({ ...report, implied: implied.slice(0, 200) }, null, 2)}\n`);
  }

  if (missing.length || unboundChapterFigures.length || httpFailures.length) {
    console.error("visual coverage audit failed", { missing, unboundChapterFigures, httpFailures });
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
