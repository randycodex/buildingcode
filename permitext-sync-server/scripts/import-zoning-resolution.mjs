import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  rename,
  writeFile
} from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseZoningAmendmentHistoryJSON,
  parseZoningAppendixHTML,
  parseZoningArticleHTML,
  parseZoningChapterHTML,
  parseZoningHomepageHTML,
  rewriteZoningAssetReferences,
  validateZoningSnapshot,
  zoningResolutionContract,
  zoningSearchTokens
} from "../zoning-resolution.mjs";

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const workspaceRoot = dirname(serverRoot);
const defaultOutput = join(
  workspaceRoot,
  "NYC CC APP",
  "permitext",
  "Resources",
  "CodeContent",
  "authored",
  "new-york-city",
  "2026-zoning-resolution"
);

function parsedArguments(argv) {
  const result = {
    concurrency: 10,
    output: defaultOutput,
    skipAmendments: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--output") {
      result.output = argv[index + 1];
      index += 1;
    } else if (argument === "--concurrency") {
      result.concurrency = Number.parseInt(argv[index + 1], 10);
      index += 1;
    } else if (argument === "--skip-amendments") {
      result.skipAmendments = true;
    } else {
      throw new Error(`Unknown zoning import argument: ${argument}`);
    }
  }
  if (!Number.isSafeInteger(result.concurrency) || result.concurrency < 1 || result.concurrency > 24) {
    throw new Error("--concurrency must be an integer from 1 through 24.");
  }
  result.output = resolve(process.cwd(), result.output);
  return result;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
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

async function writeJSON(path, value, options = {}) {
  await mkdir(dirname(path), { recursive: true });
  const spacing = options.compact ? 0 : 2;
  await writeFile(path, `${JSON.stringify(value, null, spacing)}\n`);
}

async function fetchResponse(url, options = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch(url, {
        headers: {
          accept: options.accept || "text/html,application/xhtml+xml",
          "user-agent": "Permitext zoning content importer/1.0 (official-source snapshot)",
          referer: zoningResolutionContract.sourceHomepageURL
        },
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 750));
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`Unable to retrieve ${url}: ${lastError?.message || "unknown error"}`);
}

async function fetchText(url, accept) {
  return (await fetchResponse(url, { accept })).text();
}

async function concurrentMap(values, concurrency, worker, label) {
  const results = new Array(values.length);
  let cursor = 0;
  let completed = 0;
  const startedAt = Date.now();
  async function run() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(values[index], index);
      completed += 1;
      if (
        completed === values.length ||
        completed === 1 ||
        completed % Math.max(10, Math.ceil(values.length / 10)) === 0
      ) {
        console.info(JSON.stringify({
          event: "zoning_import_progress",
          stage: label,
          completed,
          total: values.length,
          elapsedSeconds: Math.round((Date.now() - startedAt) / 1000)
        }));
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length || 1) }, run));
  return results;
}

function sanitizedAssetName(sourceURL, contentType, contentHash) {
  let baseName = "asset";
  try {
    baseName = decodeURIComponent(new URL(sourceURL).pathname.split("/").at(-1) || "asset");
  } catch {
    baseName = "asset";
  }
  baseName = baseName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-90) || "asset";
  if (!extname(baseName)) {
    const extensionByContentType = new Map([
      ["image/jpeg", ".jpg"],
      ["image/png", ".png"],
      ["image/gif", ".gif"],
      ["image/svg+xml", ".svg"],
      ["image/webp", ".webp"],
      ["application/pdf", ".pdf"]
    ]);
    baseName += extensionByContentType.get(String(contentType || "").split(";")[0].trim()) || ".bin";
  }
  return `zr-${contentHash.slice(0, 16)}-${baseName}`;
}

function escapedHTML(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function chapterHTML(chapter, sections) {
  const sectionMarkup = sections.map((section) => {
    const body = section.blocks
      .map((block) => String(block.html || "").replaceAll("../../../assets/", "../assets/"))
      .join("\n");
    const amended = section.lastAmended
      ? `<p class="zr-amended">Last amended ${escapedHTML(section.lastAmended)}</p>`
      : "";
    return [
      `<div id="zr-${section.sourceNodeID}" class="Section zr-section" data-section-id="${section.id}">`,
      `<h6>${escapedHTML(section.sectionNumber)} ${escapedHTML(section.title)}</h6>`,
      amended,
      body,
      `<p class="zr-source"><a href="${escapedHTML(section.sourceURL)}">Official NYC Planning source</a></p>`,
      "</div>"
    ].join("\n");
  }).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapedHTML(chapter.displayTitle)}</title>
<style>
:root { color-scheme: light dark; }
body { font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0 auto; max-width: 900px; padding: 24px; }
h1 { font-size: 1.55rem; margin: 0 0 6px; }
h2 { font-size: 1.05rem; font-weight: 600; margin: 0 0 28px; opacity: .72; }
.zr-section { border-radius: 16px; margin: 0 0 18px; padding: 18px; background: color-mix(in srgb, currentColor 6%, transparent); }
.zr-section h6 { font-size: 1.08rem; line-height: 1.35; margin: 0 0 14px; }
.zr-amended, .zr-source { font-size: .82rem; opacity: .68; }
table { border-collapse: collapse; display: block; max-width: 100%; overflow-x: auto; }
th, td { border: 1px solid color-mix(in srgb, currentColor 25%, transparent); padding: 6px; vertical-align: top; }
img { height: auto; max-width: 100%; }
a { color: #087f8c; }
</style>
</head>
<body>
<h1>${escapedHTML(chapter.displayTitle)}</h1>
<h2>${escapedHTML(zoningResolutionContract.codeVersion)}</h2>
${sectionMarkup}
</body>
</html>
`.replace(/[ \t]+$/gm, "");
}

function preparedChapter(chapter, sections) {
  return {
    schemaVersion: 1,
    chapterID: chapter.id,
    chapterNumber: chapter.canonicalChapterNumber,
    article: chapter.articleRoman
      ? { roman: chapter.articleRoman, title: chapter.articleTitle }
      : null,
    sourcePath: chapter.sourcePath,
    sourceURL: chapter.sourceURL,
    specialDistrict: chapter.specialDistrict || null,
    groups: [{
      id: `zr-group-${chapter.id}`,
      headerLine: chapter.articleRoman
        ? `ARTICLE ${chapter.articleRoman} — ${chapter.articleTitle}`
        : "APPENDICES",
      headingLine: chapter.displayTitle,
      sections: sections.map((section) => ({
        id: section.id,
        sectionNumber: section.sectionNumber,
        title: section.title,
        officialText: "",
        kind: "title",
        contentBlocks: []
      }))
    }]
  };
}

function sectionPayload(section) {
  return {
    schemaVersion: 2,
    sectionID: section.id,
    chapterID: section.chapterID,
    chapterNumber: section.chapter.canonicalNumber,
    sectionNumber: section.sectionNumber,
    title: section.title,
    officialText: "",
    previewText: section.previewText,
    blocks: section.blocks,
    zoning: {
      schemaVersion: 1,
      sourceNodeID: section.sourceNodeID,
      sourcePath: section.sourcePath,
      sourceURL: section.sourceURL,
      sourceContentHash: section.sourceContentHash,
      article: section.article,
      chapter: section.chapter,
      appendix: section.appendix || null,
      subsections: section.subsections,
      tables: section.tables,
      mapReferences: section.mapReferences,
      appendixReferences: section.appendixReferences,
      specialDistrict: section.specialDistrict,
      amendmentHistory: section.amendmentHistory,
      amendmentHistorySourceURL: section.amendmentHistorySourceURL,
      effectiveDate: section.effectiveDate,
      lastAmended: section.lastAmended,
      version: section.version,
      researchEligibility: false
    }
  };
}

function buildSearchIndex(sections) {
  const tokens = new Map();
  for (const section of sections) {
    const searchable = [
      "ZR",
      "Zoning Resolution",
      section.article?.roman ? `Article ${section.article.roman}` : "",
      section.article?.title,
      section.chapter?.number ? `Chapter ${section.chapter.number}` : "",
      section.chapter?.title,
      section.sectionNumber,
      section.title,
      section.specialDistrict?.name,
      section.specialDistrict?.abbreviation,
      section.plainText
    ].filter(Boolean).join("\n");
    for (const token of zoningSearchTokens(searchable)) {
      const ids = tokens.get(token) || [];
      ids.push(section.id);
      tokens.set(token, ids);
    }
  }
  return {
    schemaVersion: 1,
    libraryID: zoningResolutionContract.libraryID,
    codeVersion: zoningResolutionContract.codeVersion,
    tokens: Object.fromEntries([...tokens].sort(([left], [right]) => left.localeCompare(right)))
  };
}

function sourceNotes(summary, generatedAt) {
  return `# NYC Zoning Resolution source snapshot

This package was generated from the official NYC Department of City Planning Online Zoning Resolution.

- Official source: ${zoningResolutionContract.sourceHomepageURL}
- Text changes represented through: ${zoningResolutionContract.textChangesThrough}
- Generated: ${generatedAt}
- Articles: ${summary.articles}
- Chapters: ${summary.chapters}
- Section and appendix records: ${summary.sections}
- Preserved tables: ${summary.tables}
- Preserved amendment events: ${summary.amendmentEvents}
- Downloaded local assets: ${summary.assets}

The official live HTML is canonical for this snapshot. The downloadable complete PDF is retained as a secondary validation source because its current published archive predates the live text-change date.

AI Research eligibility is intentionally disabled. Reader, Search, Saved sections, Notes, Projects, and direct links may use this package after their client-specific validation gates pass.
`;
}

async function main() {
  const options = parsedArguments(process.argv.slice(2));
  const stagingOutput = `${options.output}.staging-${process.pid}`;
  if (await exists(options.output)) {
    throw new Error(`Refusing to overwrite the existing zoning package at ${options.output}.`);
  }
  if (await exists(stagingOutput)) {
    throw new Error(`Refusing to reuse the existing staging directory at ${stagingOutput}.`);
  }
  await mkdir(stagingOutput, { recursive: true });

  const generatedAt = new Date().toISOString();
  console.info(JSON.stringify({ event: "zoning_import_start", output: options.output, generatedAt }));

  const homepageHTML = await fetchText(zoningResolutionContract.sourceHomepageURL);
  const homepage = parseZoningHomepageHTML(homepageHTML);
  if (homepage.textChangesThrough !== zoningResolutionContract.textChangesThrough) {
    throw new Error(
      `The official site reports text through ${homepage.textChangesThrough}; importer contract expects ${zoningResolutionContract.textChangesThrough}.`
    );
  }

  const sourceDocuments = [{
    kind: "homepage",
    sourceURL: zoningResolutionContract.sourceHomepageURL,
    contentHash: sha256(homepageHTML)
  }];
  const articleResults = await concurrentMap(
    homepage.articles,
    options.concurrency,
    async (article) => {
      const sourceURL = new URL(article.sourcePath, zoningResolutionContract.sourceBaseURL).toString();
      const html = await fetchText(sourceURL);
      sourceDocuments.push({ kind: "article", sourceURL, contentHash: sha256(html) });
      return parseZoningArticleHTML(html, article);
    },
    "articles"
  );
  const chapters = articleResults.flatMap((article) => article.chapters).map((chapter) => ({
    ...chapter,
    chapterTitle: chapter.title,
    sourceURL: new URL(chapter.sourcePath, zoningResolutionContract.sourceBaseURL).toString(),
    displayTitle: `Article ${chapter.articleRoman}, Chapter ${chapter.chapterNumber} — ${chapter.title}`,
    specialDistrict: /^Special\b/i.test(chapter.title)
      ? {
          name: chapter.title,
          abbreviation: chapter.title.match(/\(([^()]{1,12})\)\s*$/)?.[1]?.trim() || null
        }
      : null
  }));

  const importedChapters = await concurrentMap(
    chapters,
    Math.min(options.concurrency, 8),
    async (chapter) => {
      const html = await fetchText(chapter.sourceURL);
      sourceDocuments.push({ kind: "chapter", sourceURL: chapter.sourceURL, contentHash: sha256(html) });
      return parseZoningChapterHTML(html, chapter);
    },
    "chapters"
  );

  for (const completenessContract of zoningResolutionContract.requiredCompleteSections) {
    const section = importedChapters
      .flatMap((chapter) => chapter.sections)
      .find((candidate) => candidate.sourcePath === completenessContract.sourcePath);
    if (!section) {
      throw new Error(`Required complete zoning section ${completenessContract.sourcePath} was not found.`);
    }
    if (
      section.sourceNodeID !== completenessContract.sourceNodeID ||
      section.sectionNumber !== completenessContract.sectionNumber
    ) {
      throw new Error(`Required complete zoning section identity changed at ${completenessContract.sourcePath}.`);
    }
    if (section.plainText.length < completenessContract.minimumPlainTextLength) {
      throw new Error(
        `Required complete zoning section ${completenessContract.sectionNumber} is incomplete: ` +
        `${section.plainText.length} characters found.`
      );
    }
    for (const requiredText of completenessContract.requiredText) {
      if (!section.plainText.toLowerCase().includes(requiredText.toLowerCase())) {
        throw new Error(
          `Required complete zoning section ${completenessContract.sectionNumber} is missing required text: ` +
          `${requiredText}.`
        );
      }
    }
  }

  const appendixSections = await concurrentMap(
    homepage.appendices,
    Math.min(options.concurrency, 8),
    async (appendix) => {
      const sourceURL = new URL(appendix.sourcePath, zoningResolutionContract.sourceBaseURL).toString();
      const html = await fetchText(sourceURL);
      sourceDocuments.push({ kind: "appendix", sourceURL, contentHash: sha256(html) });
      return parseZoningAppendixHTML(html, appendix);
    },
    "appendices"
  );

  const sectionBySourceNodeID = new Map();
  for (const section of [
    ...importedChapters.flatMap((chapter) => chapter.sections.map((item) => ({
      ...item,
      chapterID: chapter.id
    }))),
    ...appendixSections
  ]) {
    if (sectionBySourceNodeID.has(section.sourceNodeID)) {
      throw new Error(`Duplicate Drupal node ${section.sourceNodeID} appeared in the zoning snapshot.`);
    }
    sectionBySourceNodeID.set(section.sourceNodeID, section);
  }
  const sections = [...sectionBySourceNodeID.values()];

  if (!options.skipAmendments) {
    await concurrentMap(
      sections,
      options.concurrency,
      async (section) => {
        const payload = await fetchText(section.amendmentHistorySourceURL, "application/json");
        section.amendmentHistory = parseZoningAmendmentHistoryJSON(payload);
        section.amendmentHistoryContentHash = sha256(payload);
      },
      "amendment-histories"
    );
  }

  const uniqueAssetURLs = [...new Set(sections.flatMap((section) => section.sourceAssets || []))];
  const assetRecords = await concurrentMap(
    uniqueAssetURLs,
    Math.min(options.concurrency, 8),
    async (sourceURL) => {
      const response = await fetchResponse(sourceURL, { accept: "image/*,application/pdf;q=0.8,*/*;q=0.2" });
      const bytes = Buffer.from(await response.arrayBuffer());
      const contentHash = sha256(bytes);
      const contentType = response.headers.get("content-type") || "application/octet-stream";
      const fileName = sanitizedAssetName(sourceURL, contentType, contentHash);
      await mkdir(join(stagingOutput, "assets"), { recursive: true });
      await writeFile(join(stagingOutput, "assets", fileName), bytes);
      return {
        sourceURL,
        fileName,
        contentType,
        byteCount: bytes.length,
        contentHash
      };
    },
    "assets"
  );
  const assetNamesByURL = new Map(assetRecords.map((asset) => [asset.sourceURL, asset.fileName]));
  for (const section of sections) {
    section.blocks = rewriteZoningAssetReferences(section.blocks, assetNamesByURL);
  }

  const appendixChapters = appendixSections.map((section) => ({
    id: section.chapterID,
    articleRoman: null,
    articleTitle: null,
    chapterNumber: section.chapter.number,
    canonicalChapterNumber: section.chapter.canonicalNumber,
    title: section.title,
    displayTitle: section.title,
    sourcePath: section.sourcePath,
    sourceURL: section.sourceURL,
    specialDistrict: null
  }));
  const allChapters = [...chapters, ...appendixChapters];
  const sectionsByChapterID = new Map();
  for (const section of sections) {
    const entries = sectionsByChapterID.get(section.chapterID) || [];
    entries.push(section);
    sectionsByChapterID.set(section.chapterID, entries);
  }

  const snapshot = {
    schemaVersion: 1,
    libraryID: zoningResolutionContract.libraryID,
    codeVersion: zoningResolutionContract.codeVersion,
    syncCodeVersion: zoningResolutionContract.syncCodeVersion,
    textChangesThrough: homepage.textChangesThrough,
    statedCounts: homepage.statedCounts,
    articles: homepage.articles,
    chapters,
    appendices: appendixSections,
    sections,
    researchEligibility: false,
    researchBlockedReason: zoningResolutionContract.researchBlockedReason
  };
  const validationSummary = validateZoningSnapshot(snapshot);

  const bundleChapters = allChapters.map((chapter) => ({
    id: chapter.id,
    codeID: 1,
    codeSectionID: 1,
    chapterNumber: chapter.canonicalChapterNumber,
    title: chapter.displayTitle
  }));
  const bundle = {
    schemaVersion: 5,
    chapterStructureSchemaVersion: 2,
    sectionContentSchemaVersion: 2,
    jurisdictions: [{ id: 1, name: "New York City" }],
    codes: [{ id: 1, jurisdictionID: 1, name: zoningResolutionContract.codeVersion }],
    codeSections: [{ id: 1, codeID: 1, name: "ZONING RESOLUTION" }],
    chapters: bundleChapters,
    tables: [],
    lastStructuredImportPaths: [],
    nextJurisdictionID: 2,
    nextCodeID: 2,
    nextCodeSectionID: 2,
    nextChapterID: Math.max(...bundleChapters.map((chapter) => chapter.id)) + 1,
    nextSectionID: Math.max(...sections.map((section) => section.id)) + 1,
    zoningContract: {
      schemaVersion: 1,
      libraryID: zoningResolutionContract.libraryID,
      sourceURL: zoningResolutionContract.sourceHomepageURL,
      textChangesThrough: homepage.textChangesThrough,
      researchEligibility: false
    }
  };
  await writeJSON(join(stagingOutput, "bundle.json"), bundle);

  const manifestChapters = [];
  const chapterCatalog = [];
  for (const chapter of allChapters) {
    const chapterSections = (sectionsByChapterID.get(chapter.id) || []).sort((left, right) =>
      String(left.sectionNumber).localeCompare(String(right.sectionNumber), undefined, {
        numeric: true,
        sensitivity: "base"
      })
    );
    const prepared = preparedChapter(chapter, chapterSections);
    await writeJSON(join(stagingOutput, "prepared", "chapters", `${chapter.id}.json`), prepared, { compact: true });
    chapterCatalog.push([
      chapter.id,
      prepared.groups.map((group) => [
        group.id,
        group.headerLine,
        group.headingLine,
        null,
        null,
        group.sections.map((section) => [
          section.id,
          section.sectionNumber,
          section.title,
          section.kind
        ])
      ])
    ]);
    await mkdir(join(stagingOutput, "chapters"), { recursive: true });
    await writeFile(
      join(stagingOutput, "chapters", `${chapter.canonicalChapterNumber}.html`),
      chapterHTML(chapter, chapterSections)
    );
    manifestChapters.push({
      chapterID: chapter.id,
      chapterNumber: chapter.canonicalChapterNumber,
      codeSectionID: 1,
      sectionCount: chapterSections.length,
      preparedSectionCount: chapterSections.length,
      blockCount: chapterSections.reduce((count, section) => count + section.blocks.length, 0)
    });
  }
  for (const section of sections) {
    await writeJSON(
      join(stagingOutput, "prepared", "sections", `${section.id}.json`),
      sectionPayload(section),
      { compact: true }
    );
  }
  await writeJSON(join(stagingOutput, "prepared", "manifest.json"), {
    schemaVersion: 1,
    libraryID: zoningResolutionContract.libraryID,
    codeVersion: zoningResolutionContract.codeVersion,
    textChangesThrough: homepage.textChangesThrough,
    chapters: manifestChapters
  });
  await writeJSON(join(stagingOutput, "prepared", "chapterCatalog.json"), {
    schemaVersion: 1,
    chapters: chapterCatalog
  }, { compact: true });
  await writeJSON(join(stagingOutput, "prepared", "searchIndex.json"), buildSearchIndex(sections), { compact: true });
  await writeJSON(join(stagingOutput, "prepared", "images.json"), {
    schemaVersion: 1,
    items: Object.fromEntries(assetRecords.flatMap((asset) => {
      const withoutExtension = asset.fileName.slice(0, -extname(asset.fileName).length);
      return [
        [asset.fileName, `assets/${asset.fileName}`],
        [withoutExtension, `assets/${asset.fileName}`]
      ];
    }))
  });
  await writeJSON(join(stagingOutput, "prepared", "section-map.json"), {
    schemaVersion: 1,
    bySourceNodeID: Object.fromEntries(sections.map((section) => [section.sourceNodeID, section.id])),
    bySourcePath: Object.fromEntries(sections.map((section) => [section.sourcePath, section.id])),
    bySectionNumber: Object.fromEntries(
      [...new Set(sections.map((section) => section.sectionNumber))].map((sectionNumber) => [
        sectionNumber,
        sections.filter((section) => section.sectionNumber === sectionNumber).map((section) => section.id)
      ])
    )
  });
  await writeJSON(join(stagingOutput, "source-manifest.json"), {
    schemaVersion: 1,
    generatedAt,
    libraryID: zoningResolutionContract.libraryID,
    sourceAuthority: "New York City Department of City Planning",
    sourceHomepageURL: zoningResolutionContract.sourceHomepageURL,
    sourceDownloadsURL: zoningResolutionContract.sourceDownloadsURL,
    textChangesThrough: homepage.textChangesThrough,
    statedCounts: homepage.statedCounts,
    documents: sourceDocuments.sort((left, right) => left.sourceURL.localeCompare(right.sourceURL)),
    assets: assetRecords.sort((left, right) => left.sourceURL.localeCompare(right.sourceURL)),
    validationSummary,
    sectionCompletenessRepairs: zoningResolutionContract.requiredCompleteSections.map((contract) => ({
      sectionID: sections.find((section) => section.sourcePath === contract.sourcePath).id,
      sectionNumber: contract.sectionNumber,
      sourceURL: new URL(contract.sourcePath, zoningResolutionContract.sourceBaseURL).toString(),
      capturedAt: generatedAt,
      reason: "Preserve defined-term records stored outside the nested body field."
    })),
    researchEligibility: false,
    researchBlockedReason: zoningResolutionContract.researchBlockedReason
  });
  await writeJSON(join(stagingOutput, "research-policy.json"), {
    schemaVersion: 1,
    eligible: false,
    selectedEvidenceResearch: false,
    evidenceDiscovery: false,
    reason: zoningResolutionContract.researchBlockedReason,
    requiredBeforeEnablement: [
      "Reliable zoning section resolution",
      "Stable passage identity",
      "Zoning citation validation",
      "Table and map handling validation",
      "Amendment and effective-date validation",
      "Approved zoning-specific evaluation cases"
    ]
  });
  await writeFile(join(stagingOutput, "SOURCE.md"), sourceNotes(validationSummary, generatedAt));

  await rename(stagingOutput, options.output);
  console.info(JSON.stringify({
    event: "zoning_import_complete",
    output: options.output,
    generatedAt,
    ...validationSummary
  }));
}

main().catch(async (error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
