import { createHash } from "node:crypto";
import { parse, parseFragment, serializeOuter } from "parse5";

export const zoningResolutionContract = Object.freeze({
  schemaVersion: 1,
  libraryID: "nyc-zoning-resolution",
  codePrefix: "ZR",
  codeVersion: "NYC Zoning Resolution — text through 2026-07-16",
  syncCodeVersion: "CodeContent/authored/new-york-city/2026-zoning-resolution/bundle.json#1",
  sourceBaseURL: "https://zr.planning.nyc.gov",
  sourceHomepageURL: "https://zr.planning.nyc.gov/",
  sourceDownloadsURL: "https://zr.planning.nyc.gov/zr-downloads",
  textChangesThrough: "2026-07-16",
  requiredCompleteSections: Object.freeze([Object.freeze({
    sourcePath: "/article-i/chapter-2/12-10",
    sourceNodeID: 18_523,
    sectionNumber: "12-10",
    minimumPlainTextLength: 100_000,
    requiredText: Object.freeze([
      "cellar",
      "floor area",
      "zoning lot"
    ])
  })]),
  researchEligibility: false,
  researchBlockedReason:
    "Zoning is excluded from AI Research until zoning-specific citation, table, map, amendment, and evaluation gates pass.",
  minimums: Object.freeze({
    articles: 14,
    chapters: 100,
    sections: 4_000,
    appendices: 11,
    tables: 300
  })
});

const articleRomanOrder = Object.freeze([
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "XIV"
]);

function attribute(node, name) {
  return node?.attrs?.find((item) => item.name === name)?.value || "";
}

function setAttribute(node, name, value) {
  node.attrs ||= [];
  const existing = node.attrs.find((item) => item.name === name);
  if (existing) {
    existing.value = String(value);
  } else {
    node.attrs.push({ name, value: String(value) });
  }
}

function classes(node) {
  return new Set(attribute(node, "class").split(/\s+/).filter(Boolean));
}

function hasClasses(node, ...names) {
  const values = classes(node);
  return names.every((name) => values.has(name));
}

function descendants(node, predicate, output = []) {
  if (predicate(node)) output.push(node);
  for (const child of node?.childNodes || []) {
    descendants(child, predicate, output);
  }
  return output;
}

function firstDescendant(node, predicate) {
  if (predicate(node)) return node;
  for (const child of node?.childNodes || []) {
    const match = firstDescendant(child, predicate);
    if (match) return match;
  }
  return null;
}

function textContent(node) {
  if (node?.nodeName === "#text") return node.value || "";
  return (node?.childNodes || []).map(textContent).join("");
}

function normalizedText(node) {
  return textContent(node)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedDate(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function absoluteSourceURL(value, baseURL = zoningResolutionContract.sourceBaseURL) {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("data:")) return trimmed;
  try {
    return new URL(trimmed, baseURL).toString();
  } catch {
    return trimmed;
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function removeUnsafeNodes(node) {
  if (!node?.childNodes) return;
  node.childNodes = node.childNodes.filter((child) => {
    const tag = String(child.tagName || child.nodeName || "").toLowerCase();
    return tag !== "script" && tag !== "style" && tag !== "noscript";
  });
  for (const child of node.childNodes) {
    if (child.attrs) {
      child.attrs = child.attrs.filter((item) => !item.name.toLowerCase().startsWith("on"));
    }
    removeUnsafeNodes(child);
  }
}

function normalizeOfficialMarkup(node) {
  removeUnsafeNodes(node);
  for (const element of descendants(node, (candidate) => Boolean(candidate?.attrs))) {
    const href = attribute(element, "href");
    const source = attribute(element, "src");
    if (href) {
      const absolute = absoluteSourceURL(href);
      setAttribute(element, "href", absolute);
      if (/^https:\/\/zr\.planning\.nyc\.gov\/article-/i.test(absolute)) {
        setAttribute(element, "data-permitext-zr-source", absolute);
      }
    }
    if (source) setAttribute(element, "src", absoluteSourceURL(source));
  }
}

function bodyBlocks(bodyNode, sourceNodeID) {
  const childNodes = (bodyNode?.childNodes || []).filter((node) => normalizedText(node) || node.tagName);
  return childNodes.map((node, index) => {
    const html = serializeOuter(node).trim();
    const plainText = normalizedText(node);
    const kind = node.tagName === "table" ? "table" : "html";
    return {
      id: `zr-${sourceNodeID}-block-${String(index + 1).padStart(3, "0")}`,
      kind,
      html,
      plainText
    };
  }).filter((block) => block.html || block.plainText);
}

function subsectionIdentity(sourceNodeID, label, text, ordinal) {
  return `zr-${sourceNodeID}-sub-${sha256(`${label}\n${text}\n${ordinal}`).slice(0, 16)}`;
}

function subsectionRecords(bodyNode, sourceNodeID) {
  const records = [];
  const seen = new Set();
  const candidates = descendants(bodyNode, (node) =>
    ["h1", "h2", "h3", "h4", "h5", "h6", "p", "li"].includes(node?.tagName)
  );
  for (const node of candidates) {
    const text = normalizedText(node);
    if (!text) continue;
    const sourceAnchor = attribute(node, "id") || null;
    const marker =
      text.match(/^\(([a-z0-9ivxlcdm]+)\)(?=\s|$)/i)?.[0] ||
      text.match(/^(\d+(?:\.\d+){1,}|[A-Z]\.)(?=\s|$)/)?.[0] ||
      (node.tagName?.startsWith("h") ? text.slice(0, 120) : "");
    const label = String(marker || "").trim();
    if (!label && !sourceAnchor) continue;
    const dedupeKey = `${sourceAnchor || ""}:${label}:${text}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    records.push({
      id: subsectionIdentity(sourceNodeID, label, text, records.length),
      label: label || null,
      sourceAnchor,
      plainText: text,
      ordinal: records.length
    });
  }
  return records;
}

function tableRecords(bodyNode, sourceNodeID) {
  return descendants(bodyNode, (node) => node?.tagName === "table").map((table, index) => {
    const caption = firstDescendant(table, (node) => node?.tagName === "caption");
    const html = serializeOuter(table);
    return {
      id: `zr-${sourceNodeID}-table-${String(index + 1).padStart(3, "0")}`,
      ordinal: index,
      sourceAnchor: attribute(table, "id") || null,
      caption: caption ? normalizedText(caption) : null,
      plainText: normalizedText(table),
      contentHash: sha256(html)
    };
  });
}

function referenceRecords(bodyNode, pattern, kind) {
  const records = [];
  const seen = new Set();
  for (const node of descendants(bodyNode, (candidate) =>
    candidate?.tagName === "a" || candidate?.tagName === "img"
  )) {
    const text = normalizedText(node) || attribute(node, "alt") || attribute(node, "title");
    const href = attribute(node, "href") || attribute(node, "src");
    const comparable = `${text} ${href}`;
    if (!pattern.test(comparable)) continue;
    pattern.lastIndex = 0;
    const sourceURL = absoluteSourceURL(href);
    const key = `${text}:${sourceURL}`;
    if (seen.has(key)) continue;
    seen.add(key);
    records.push({
      kind,
      label: text || null,
      sourceURL: sourceURL || null
    });
  }
  return records;
}

function sourceAssets(bodyNode) {
  const assets = [];
  const seen = new Set();
  for (const node of descendants(bodyNode, (candidate) =>
    ["img", "source", "video"].includes(candidate?.tagName)
  )) {
    for (const name of ["src", "poster"]) {
      const value = absoluteSourceURL(attribute(node, name));
      if (!value || !/^https?:/i.test(value) || seen.has(value)) continue;
      seen.add(value);
      assets.push(value);
    }
  }
  return assets;
}

function specialDistrictRecord(chapterTitle) {
  const title = String(chapterTitle || "").trim();
  if (!/^Special\b/i.test(title)) return null;
  const abbreviation = title.match(/\(([^()]{1,12})\)\s*$/)?.[1]?.trim() || null;
  return { name: title, abbreviation };
}

function sectionRecord(sectionNode, context) {
  const sourceNodeID = Number.parseInt(attribute(sectionNode, "data-node-id"), 10);
  if (!Number.isSafeInteger(sourceNodeID) || sourceNodeID <= 0) {
    throw new Error(`Zoning section at ${attribute(sectionNode, "about") || context.sourcePath} has no stable Drupal node ID.`);
  }
  const titleNode = firstDescendant(sectionNode, (node) => node?.tagName === "h3");
  const numberNode = firstDescendant(sectionNode, (node) => hasClasses(node, "field--name-title"));
  const sectionNumber = attribute(sectionNode, "data-section") || normalizedText(numberNode);
  const title = normalizedText(titleNode);
  const sectionBody = firstDescendant(sectionNode, (node) => hasClasses(node, "sec-body"));
  const fieldBody = firstDescendant(sectionNode, (node) => hasClasses(node, "field--name-body", "field__item"));
  const containsDefinedTerms = Boolean(firstDescendant(sectionBody, (node) =>
    classes(node).has("node--type-defined-term")
  ));
  const bodyNode = containsDefinedTerms ? sectionBody : (fieldBody || sectionBody);
  if (!bodyNode) {
    throw new Error(`Zoning section node ${sourceNodeID} has no official body.`);
  }
  normalizeOfficialMarkup(bodyNode);
  const timeNode = firstDescendant(sectionNode, (node) =>
    node?.tagName === "time" && Boolean(attribute(node, "datetime"))
  );
  const sourcePath = attribute(sectionNode, "about") || `${context.sourcePath}/${sectionNumber}`;
  const sourceURL = absoluteSourceURL(sourcePath);
  const blocks = bodyBlocks(bodyNode, sourceNodeID);
  let plainText = blocks.map((block) => block.plainText).filter(Boolean).join("\n\n");
  if (!plainText) {
    blocks.unshift({
      id: `zr-${sourceNodeID}-title`,
      kind: "html",
      html: `<p>${title || sectionNumber}</p>`,
      plainText: title || sectionNumber
    });
    plainText = title || sectionNumber;
  }
  const tables = tableRecords(bodyNode, sourceNodeID);
  const mapReferences = referenceRecords(
    bodyNode,
    /\b(?:zoning\s+maps?|map\s+(?:no\.?\s*)?[a-z0-9-]+)/gi,
    "zoning-map"
  );
  const appendixReferences = referenceRecords(bodyNode, /\bappendix\b/gi, "appendix");
  return {
    id: stableZoningSectionID(sourceNodeID),
    sourceNodeID,
    sourcePath,
    sourceURL,
    sourceContentHash: sha256(serializeOuter(bodyNode)),
    article: {
      roman: context.articleRoman,
      title: context.articleTitle
    },
    chapter: {
      number: context.chapterNumber,
      title: context.chapterTitle,
      canonicalNumber: context.canonicalChapterNumber
    },
    sectionNumber,
    title,
    specialDistrict: specialDistrictRecord(context.chapterTitle),
    lastAmended: normalizedDate(attribute(timeNode, "datetime") || normalizedText(timeNode)),
    effectiveDate: normalizedDate(attribute(timeNode, "datetime") || normalizedText(timeNode)),
    version: zoningResolutionContract.codeVersion,
    blocks,
    previewText: plainText.slice(0, 420),
    plainText,
    subsections: subsectionRecords(bodyNode, sourceNodeID),
    tables,
    mapReferences,
    appendixReferences,
    sourceAssets: sourceAssets(bodyNode),
    amendmentHistorySourceURL: absoluteSourceURL(`/ajax/get/amendment/section/${sourceNodeID}`),
    amendmentHistory: []
  };
}

function appendixCode(title) {
  const match = String(title || "").match(/\bAPPENDIX\s+([A-Z])\b/i);
  return match?.[1]?.toUpperCase() || "APP";
}

export function stableZoningSectionID(sourceNodeID) {
  const parsed = Number.parseInt(sourceNodeID, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("A positive Drupal node ID is required for a stable zoning section ID.");
  }
  return 20_000_000 + parsed;
}

export function stableZoningChapterID(articleRoman, chapterNumber) {
  const articleIndex = articleRomanOrder.indexOf(String(articleRoman || "").trim().toUpperCase());
  const parsedChapter = Number.parseInt(String(chapterNumber || "").replace(/\D/g, ""), 10);
  if (articleIndex === -1 || !Number.isSafeInteger(parsedChapter) || parsedChapter <= 0) {
    throw new Error(`Invalid zoning Article/Chapter identity: ${articleRoman}/${chapterNumber}.`);
  }
  return 15_000_000 + ((articleIndex + 1) * 100) + parsedChapter;
}

export function stableZoningAppendixChapterID(sourceNodeID) {
  const parsed = Number.parseInt(sourceNodeID, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("A positive Drupal node ID is required for a stable zoning appendix chapter ID.");
  }
  return 16_000_000 + parsed;
}

export function parseZoningHomepageHTML(html) {
  const document = parse(String(html || ""));
  const pageText = normalizedText(document);
  const textChangesMatch = pageText.match(
    /All text changes approved by the city council as of\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/i
  );
  const articles = descendants(document, (node) =>
    hasClasses(node, "node--type-article", "node--view-mode-leftnav")
  ).map((node) => {
    const titleNode = firstDescendant(node, (candidate) => hasClasses(candidate, "article-number"));
    const detailNode = firstDescendant(node, (candidate) => hasClasses(candidate, "article-title"));
    const link = firstDescendant(node, (candidate) => candidate?.tagName === "a");
    const numberTitle = normalizedText(titleNode);
    return {
      roman: numberTitle.replace(/^Article\s+/i, "").trim().toUpperCase(),
      title: normalizedText(detailNode),
      sourcePath: attribute(link, "href") || attribute(node, "about")
    };
  });
  const appendixNodes = descendants(document, (node) =>
    hasClasses(node, "node--view-mode-leftnav") &&
    (classes(node).has("node--type-appendix") || classes(node).has("node--type-child-appendix"))
  );
  const appendices = appendixNodes.map((node) => {
    const titleNode = firstDescendant(node, (candidate) => hasClasses(candidate, "article-number"));
    const link = firstDescendant(node, (candidate) => candidate?.tagName === "a");
    return {
      title: normalizedText(titleNode),
      sourcePath: attribute(link, "href") || attribute(node, "about")
    };
  }).filter((appendix) => appendix.sourcePath);
  const statedCounts = pageText.match(
    /consists of\s+(\d+)\s+Articles and\s+(\d+)\s+Appendices,\s+plus\s+(\d+)\s+Zoning Maps/i
  );
  return {
    articles,
    appendices,
    textChangesThrough: normalizedDate(textChangesMatch?.[1]),
    statedCounts: {
      articles: Number.parseInt(statedCounts?.[1] || "", 10) || null,
      appendices: Number.parseInt(statedCounts?.[2] || "", 10) || null,
      zoningMaps: Number.parseInt(statedCounts?.[3] || "", 10) || null
    }
  };
}

export function parseZoningArticleHTML(html, articleContext = {}) {
  const document = parse(String(html || ""));
  const mainArticle = firstDescendant(document, (node) =>
    hasClasses(node, "node--type-article", "node--view-mode-main")
  );
  const numberNode = firstDescendant(mainArticle, (node) => hasClasses(node, "article-number"));
  const titleNode = firstDescendant(mainArticle, (node) => hasClasses(node, "article-title"));
  const articleRoman = (
    articleContext.roman ||
    normalizedText(numberNode).replace(/^Article\s+/i, "")
  ).trim().toUpperCase();
  const articleTitle = articleContext.title || normalizedText(titleNode);
  const chapters = descendants(document, (node) =>
    hasClasses(node, "node--type-chapter", "node--view-mode-main")
  ).map((node) => {
    const chapterNumberNode = firstDescendant(node, (candidate) => hasClasses(candidate, "chapter-number"));
    const chapterTitleNode = firstDescendant(node, (candidate) => hasClasses(candidate, "chapter-title"));
    const chapterLabel = normalizedText(chapterNumberNode);
    const chapterNumber = chapterLabel.replace(/^Chapter\s+/i, "").trim();
    return {
      id: stableZoningChapterID(articleRoman, chapterNumber),
      articleRoman,
      articleTitle,
      chapterNumber,
      canonicalChapterNumber: `${articleRoman}-${chapterNumber}`,
      title: normalizedText(chapterTitleNode),
      sourcePath: attribute(node, "about")
    };
  });
  return { articleRoman, articleTitle, chapters };
}

export function parseZoningChapterHTML(html, chapterContext) {
  const document = parse(String(html || ""));
  const sectionNodes = descendants(document, (node) =>
    hasClasses(node, "node--type-section", "node--view-mode-default") &&
    Boolean(attribute(node, "data-node-id"))
  );
  const sections = sectionNodes.map((node) => sectionRecord(node, chapterContext));
  if (!sections.length) {
    throw new Error(`No zoning sections were found at ${chapterContext.sourcePath}.`);
  }
  return {
    ...chapterContext,
    sectionCount: sections.length,
    sections
  };
}

export function parseZoningAppendixHTML(html, appendixContext = {}) {
  const document = parse(String(html || ""));
  const appendixNode = firstDescendant(document, (node) =>
    hasClasses(node, "node--view-mode-full") &&
    (classes(node).has("node--type-appendix") || classes(node).has("node--type-child-appendix"))
  );
  if (!appendixNode) {
    throw new Error(`No canonical appendix body was found at ${appendixContext.sourcePath || "the supplied page"}.`);
  }
  const historyLink = firstDescendant(appendixNode, (node) =>
    node?.tagName === "a" && Boolean(attribute(node, "data-content-nid"))
  );
  const shortLink = firstDescendant(document, (node) =>
    node?.tagName === "link" && attribute(node, "rel") === "shortlink"
  );
  const sourceNodeID = Number.parseInt(
    attribute(appendixNode, "data-node-id") ||
    attribute(historyLink, "data-content-nid") ||
    attribute(shortLink, "href").match(/\/node\/(\d+)/)?.[1],
    10
  );
  if (!Number.isSafeInteger(sourceNodeID) || sourceNodeID <= 0) {
    throw new Error(`Zoning appendix at ${appendixContext.sourcePath} has no stable Drupal node ID.`);
  }
  const titleNode =
    firstDescendant(appendixNode, (node) => hasClasses(node, "field--name-title")) ||
    firstDescendant(document, (node) => node?.tagName === "h1");
  const bodyNode = firstDescendant(appendixNode, (node) =>
    hasClasses(node, "field--name-body", "field__item")
  );
  if (!bodyNode) throw new Error(`Zoning appendix node ${sourceNodeID} has no official body.`);
  normalizeOfficialMarkup(bodyNode);
  const timeNode = firstDescendant(appendixNode, (node) =>
    node?.tagName === "time" && Boolean(attribute(node, "datetime"))
  );
  const title = appendixContext.title || normalizedText(titleNode);
  const sourcePath = attribute(appendixNode, "about") || appendixContext.sourcePath;
  const blocks = bodyBlocks(bodyNode, sourceNodeID);
  const plainText = blocks.map((block) => block.plainText).filter(Boolean).join("\n\n");
  const code = appendixCode(title);
  return {
    id: stableZoningSectionID(sourceNodeID),
    chapterID: stableZoningAppendixChapterID(sourceNodeID),
    sourceNodeID,
    sourcePath,
    sourceURL: absoluteSourceURL(sourcePath),
    sourceContentHash: sha256(serializeOuter(bodyNode)),
    article: null,
    chapter: {
      number: code,
      title,
      canonicalNumber: `APP-${code}-${sourceNodeID}`
    },
    sectionNumber: title.match(/^APPENDIX\s+[^—–-]+/i)?.[0]?.trim() || title,
    title,
    appendix: {
      code,
      isChild: classes(appendixNode).has("node--type-child-appendix")
    },
    specialDistrict: null,
    lastAmended: normalizedDate(attribute(timeNode, "datetime") || normalizedText(timeNode)),
    effectiveDate: normalizedDate(attribute(timeNode, "datetime") || normalizedText(timeNode)),
    version: zoningResolutionContract.codeVersion,
    blocks,
    previewText: plainText.slice(0, 420),
    plainText,
    subsections: subsectionRecords(bodyNode, sourceNodeID),
    tables: tableRecords(bodyNode, sourceNodeID),
    mapReferences: referenceRecords(
      bodyNode,
      /\b(?:zoning\s+maps?|map\s+(?:no\.?\s*)?[a-z0-9-]+)/gi,
      "zoning-map"
    ),
    appendixReferences: referenceRecords(bodyNode, /\bappendix\b/gi, "appendix"),
    sourceAssets: sourceAssets(bodyNode),
    amendmentHistorySourceURL: absoluteSourceURL(
      attribute(historyLink, "href").replace(/^\/nojs\//, "/ajax/") ||
      `/ajax/get/amendment/appendix/${sourceNodeID}`
    ),
    amendmentHistory: []
  };
}

export function parseZoningAmendmentHistoryJSON(payload) {
  const commands = typeof payload === "string" ? JSON.parse(payload) : payload;
  const html = Array.isArray(commands)
    ? commands.find((command) => command?.command === "insert" && typeof command?.data === "string")?.data
    : "";
  if (!html) return [];
  const fragment = parseFragment(html);
  return descendants(fragment, (node) => node?.tagName === "tr")
    .filter((row) => descendants(row, (node) => node?.tagName === "td").length > 0)
    .map((row) => {
      const cells = descendants(row, (node) => node?.tagName === "td");
      const cellByClass = (name) => cells.find((cell) => classes(cell).has(name));
      const dateCell = cellByClass("views-field-field-effective-date");
      const reportCell = cellByClass("views-field-field-ulurp-number");
      const projectCell = cellByClass("views-field-field-project-name");
      const actionCell = cellByClass("views-field-field-amendment-action");
      const notesCell = cellByClass("views-field-field-amendment-notes");
      const descriptionCell = cellByClass("views-field-field-description");
      const time = firstDescendant(dateCell, (node) => node?.tagName === "time");
      const reportLink = firstDescendant(reportCell, (node) => node?.tagName === "a");
      return {
        effectiveDate: normalizedDate(attribute(time, "datetime") || normalizedText(time)),
        reportNumber: normalizedText(reportCell) || null,
        reportURL: absoluteSourceURL(attribute(reportLink, "href")) || null,
        projectName: normalizedText(projectCell) || null,
        action: normalizedText(actionCell) || null,
        notes: normalizedText(notesCell) || null,
        description: normalizedText(descriptionCell) || null
      };
    });
}

export function rewriteZoningAssetReferences(blocks, assetNamesByURL, relativePrefix = "../../../assets/") {
  return (blocks || []).map((block) => {
    let html = String(block.html || "");
    for (const [sourceURL, fileName] of assetNamesByURL) {
      html = html.split(sourceURL).join(`${relativePrefix}${fileName}`);
    }
    return { ...block, html };
  });
}

export function zoningSearchTokens(value) {
  return Array.from(new Set(
    String(value || "")
      .normalize("NFKC")
      .toLowerCase()
      .split(/[^\p{L}\p{N}.-]+/u)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2 && token.length <= 80)
  ));
}

export function validateZoningSnapshot(snapshot, options = {}) {
  const minimums = { ...zoningResolutionContract.minimums, ...(options.minimums || {}) };
  const articles = snapshot.articles || [];
  const chapters = snapshot.chapters || [];
  const appendices = snapshot.appendices || [];
  const sections = snapshot.sections || [];
  const failures = [];
  const assert = (condition, message) => {
    if (!condition) failures.push(message);
  };
  assert(snapshot.textChangesThrough === zoningResolutionContract.textChangesThrough,
    `Text changes must be current through ${zoningResolutionContract.textChangesThrough}.`);
  assert(articles.length >= minimums.articles, `Expected at least ${minimums.articles} Articles.`);
  assert(chapters.length >= minimums.chapters, `Expected at least ${minimums.chapters} Chapters.`);
  assert(sections.length >= minimums.sections, `Expected at least ${minimums.sections} Sections.`);
  assert(
    Number(snapshot.statedCounts?.appendices || 0) >= minimums.appendices,
    `The official source must state at least ${minimums.appendices} Appendices.`
  );
  assert(appendices.length > 0, "Appendix pages must be represented.");
  assert(
    sections.reduce((count, section) => count + (section.tables?.length || 0), 0) >= minimums.tables,
    `Expected at least ${minimums.tables} preserved tables.`
  );
  assert(new Set(chapters.map((chapter) => chapter.id)).size === chapters.length, "Chapter IDs must be unique.");
  assert(new Set(sections.map((section) => section.id)).size === sections.length, "Section IDs must be unique.");
  assert(new Set(sections.map((section) => section.sourceNodeID)).size === sections.length,
    "Drupal node IDs must be unique.");
  for (const section of sections) {
    assert(Number.isSafeInteger(section.id), `Section ${section.sectionNumber || "unknown"} has no stable ID.`);
    assert(Boolean(section.sourceURL), `Section ${section.id} has no source URL.`);
    assert(Boolean(section.sourceContentHash), `Section ${section.id} has no source content hash.`);
    assert(Boolean(section.version), `Section ${section.id} has no version.`);
    assert(Boolean(section.blocks?.length), `Section ${section.id} has no readable blocks.`);
    assert(Boolean(section.plainText), `Section ${section.id} has no searchable text.`);
    assert(Array.isArray(section.amendmentHistory), `Section ${section.id} has no amendment-history representation.`);
    for (const table of section.tables || []) {
      assert(Boolean(table.id && table.contentHash), `Section ${section.id} contains an unidentified table.`);
    }
  }
  assert(snapshot.researchEligibility === false, "Zoning Research must remain disabled at the content-foundation gate.");
  if (failures.length) {
    const error = new Error(`Zoning snapshot validation failed:\n- ${failures.slice(0, 50).join("\n- ")}`);
    error.failures = failures;
    throw error;
  }
  return {
    articles: articles.length,
    chapters: chapters.length,
    appendixPages: appendices.length,
    sections: sections.length,
    subsections: sections.reduce((count, section) => count + (section.subsections?.length || 0), 0),
    tables: sections.reduce((count, section) => count + (section.tables?.length || 0), 0),
    mapReferences: sections.reduce((count, section) => count + (section.mapReferences?.length || 0), 0),
    amendmentEvents: sections.reduce((count, section) => count + (section.amendmentHistory?.length || 0), 0),
    assets: new Set(sections.flatMap((section) => section.sourceAssets || [])).size
  };
}
