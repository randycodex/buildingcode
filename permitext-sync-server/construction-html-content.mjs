import { readFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = dirname(fileURLToPath(import.meta.url));
export const constructionContentRoot = join(
  serverRoot,
  "..",
  "NYC CC APP",
  "permitext",
  "Resources",
  "CodeContent",
  "authored",
  "new-york-city",
  "2022-construction-codes"
);
const flatChaptersRoot = join(constructionContentRoot, "chapters");
const sectionedContentRoot = join(constructionContentRoot, "code-sections");

const codeSectionSlugByPrefix = Object.freeze({
  AC: "general-administrative-provisions",
  BC: "building-code",
  FGC: "fuel-gas-code",
  MC: "mechanical-code",
  PC: "plumbing-code"
});

const cachedChapterHTML = new Map();
const cachedChapterHeadings = new Map();
const missingChapterHTML = new Set();

function chapterFileNames(chapterNumber) {
  const trimmed = String(chapterNumber || "").trim();
  if (!trimmed) return [];
  const values = [
    `${trimmed}.html`,
    `${trimmed.toUpperCase()}.html`,
    `Chapter ${trimmed}.html`,
    `Chapter ${trimmed.toUpperCase()}.html`
  ];
  const groupedAppendixMatch = trimmed.toUpperCase().match(/^([A-Z]+)\d+$/);
  if (groupedAppendixMatch) {
    values.push(`${groupedAppendixMatch[1]}.html`);
  }
  if (/appendix/i.test(trimmed)) {
    values.push("Appendices.html");
  } else if (/[a-z]/i.test(trimmed)) {
    values.push(`Appendix ${trimmed.toUpperCase()}.html`, `Appendix ${trimmed}.html`, "Appendices.html");
  }
  return [...new Set(values)];
}

async function readFirstExisting(paths) {
  for (const path of paths) {
    try {
      return { path, html: await readFile(path, "utf8") };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return null;
}

export async function constructionChapterHTMLSource(codePrefix, chapterNumber) {
  const prefix = String(codePrefix || "").trim().toUpperCase();
  const cacheKey = `${prefix}:${String(chapterNumber || "").trim().toUpperCase()}`;
  if (cachedChapterHTML.has(cacheKey)) return cachedChapterHTML.get(cacheKey);
  if (missingChapterHTML.has(cacheKey)) return null;
  const names = chapterFileNames(chapterNumber);
  const slug = codeSectionSlugByPrefix[prefix];
  const paths = [
    ...(slug ? names.map((name) => join(sectionedContentRoot, slug, "chapters", name)) : []),
    ...names.map((name) => join(flatChaptersRoot, name))
  ];
  const source = await readFirstExisting(paths);
  if (!source) {
    missingChapterHTML.add(cacheKey);
    return null;
  }
  const payload = { ...source, cacheKey };
  cachedChapterHTML.set(cacheKey, payload);
  return payload;
}

function normalizedSectionNumber(value) {
  return String(value || "")
    .replace(/&#167;|§/gi, "")
    .replace(/\s+/g, "")
    .replace(/\.$/, "")
    .toUpperCase();
}

function normalizedHeadingTitle(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function headingWrapperStart(html, headingStart) {
  const preceding = html.slice(0, headingStart);
  const wrapperStart = preceding.toLowerCase().lastIndexOf("<div><span depth=");
  return wrapperStart >= 0 ? wrapperStart : headingStart;
}

function decodedPlainText(html) {
  return String(html || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#160;|&nbsp;/gi, " ")
    .replace(/&#167;|&sect;/gi, "§")
    .replace(/&#176;|&deg;/gi, "°")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/gi, "\"")
    .replace(/&#8216;|&#8217;|&lsquo;|&rsquo;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#x([a-f0-9]+);/gi, (_match, value) => String.fromCodePoint(Number.parseInt(value, 16)))
    .replace(/&#(\d+);/g, (_match, value) => String.fromCodePoint(Number.parseInt(value, 10)))
    .replace(/\s+/g, " ")
    .trim();
}

function parsedHeading(source, match, sectionNumber = "") {
  const headingText = decodedPlainText(match[1]);
  const headingStart = match.index;
  const headingEnd = headingStart + match[0].length;
  return {
    sectionNumber: String(sectionNumber || "").replace(/\s+/g, ""),
    normalizedSectionNumber: normalizedSectionNumber(sectionNumber),
    headingText,
    normalizedHeadingTitle: normalizedHeadingTitle(headingText),
    headingStart,
    contentStart: headingEnd,
    wrapperStart: headingWrapperStart(source.html, headingStart)
  };
}

function allChapterHeadings(source) {
  const headings = [];
  const expression = /<h6\b[^>]*>([\s\S]*?)<\/h6>/gi;
  for (const match of source.html.matchAll(expression)) {
    headings.push(parsedHeading(source, match));
  }
  return headings;
}

function chapterHeadings(source) {
  if (cachedChapterHeadings.has(source.cacheKey)) return cachedChapterHeadings.get(source.cacheKey);
  const headings = [];
  const expression = /<h6\b[^>]*>([\s\S]*?)<\/h6>/gi;
  for (const match of source.html.matchAll(expression)) {
    const headingText = decodedPlainText(match[1]);
    const sectionMatch = headingText.match(
      /^(?:SECTION\s+BC\s+(202)\.?(?=\s|:|$)|(?:§\s*)?([A-Za-z]*\d+(?:[-.]\s*\d+)*(?:\([A-Za-z0-9]+\))?)\.?(?=\s|$))/i
    );
    if (!sectionMatch) continue;
    headings.push(parsedHeading(source, match, sectionMatch[1] || sectionMatch[2]));
  }
  cachedChapterHeadings.set(source.cacheKey, headings);
  return headings;
}

export function constructionImageAssetNames(blocks) {
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

export function officialBodyHasUnboundImages(preparedBody, officialBody) {
  if (!officialBody) return false;
  const prepared = new Set(constructionImageAssetNames(preparedBody?.blocks));
  return constructionImageAssetNames(officialBody.blocks).some((name) => !prepared.has(name));
}

function bodyFromHeadingSlice(section, source, headings, selectedIndex) {
  const start = headings[selectedIndex].contentStart;
  const end = selectedIndex + 1 < headings.length ? headings[selectedIndex + 1].wrapperStart : source.html.length;
  if (start >= end) {
    return {
      body: null,
      reason: "empty-official-heading",
      sourceHTMLPath: relative(constructionContentRoot, source.path)
    };
  }
  const html = source.html.slice(start, end).trim();
  const plainText = decodedPlainText(html);
  if (!html || !plainText) {
    return {
      body: null,
      reason: "empty-official-heading",
      sourceHTMLPath: relative(constructionContentRoot, source.path)
    };
  }
  return {
    reason: null,
    body: {
      schemaVersion: 2,
      sectionID: Number(section.id),
      chapterID: Number(section.chapterID),
      chapterNumber: section.chapterNumber,
      sectionNumber: section.sectionNumber,
      title: section.title,
      sourceHTMLPath: relative(constructionContentRoot, source.path),
      blocks: [{
        id: `${section.id}-html-1`,
        kind: "html",
        html,
        plainText
      }]
    }
  };
}

export async function constructionChapterHeadingNumbers(codePrefix, chapterNumber) {
  const source = await constructionChapterHTMLSource(codePrefix, chapterNumber);
  if (!source) return [];
  return chapterHeadings(source).map((heading) => heading.sectionNumber);
}

export async function constructionChapterHeadingDetails(codePrefix, chapterNumber) {
  const source = await constructionChapterHTMLSource(codePrefix, chapterNumber);
  if (!source) return [];
  return chapterHeadings(source).map(({ sectionNumber, headingText }) => ({
    sectionNumber,
    headingText
  }));
}

export async function constructionHTMLBodyStatusForSection(section) {
  if (!section?.id || !section?.chapterNumber || !section?.sectionNumber) {
    return { body: null, reason: "missing-section-identity" };
  }
  const source = await constructionChapterHTMLSource(section.codePrefix, section.chapterNumber);
  if (!source) return { body: null, reason: "missing-chapter-html" };
  const headings = chapterHeadings(source);
  const target = normalizedSectionNumber(section.sectionNumber);
  const candidates = headings
    .map((heading, index) => ({ heading, index }))
    .filter(({ heading }) => heading.normalizedSectionNumber === target);
  const expectedTitle = normalizedHeadingTitle(section.title);
  const titleCandidates = candidates.filter(
    ({ heading }) => expectedTitle && heading.normalizedHeadingTitle === expectedTitle
  );
  // A repeated display number can refer to distinct provisions.  Never use the
  // first matching heading unless the number itself is unique; a title match
  // must also be unique before we can associate its body with this catalog row.
  const selected = titleCandidates.length === 1
    ? titleCandidates[0]
    : candidates.length === 1
      ? candidates[0]
      : null;
  if (selected) {
    return bodyFromHeadingSlice(section, source, headings, selected.index);
  }

  // Numbered headings miss lettered appendix titles such as "Appendix A: ...".
  // Only fall back when a catalog title uniquely matches one official h6.
  if (expectedTitle) {
    const titledHeadings = allChapterHeadings(source);
    const uniqueTitle = titledHeadings
      .map((heading, index) => ({ heading, index }))
      .filter(({ heading }) => heading.normalizedHeadingTitle === expectedTitle);
    if (uniqueTitle.length === 1) {
      return bodyFromHeadingSlice(section, source, titledHeadings, uniqueTitle[0].index);
    }
  }

  return {
    body: null,
    reason: candidates.length ? "ambiguous-official-heading" : "no-official-heading",
    sourceHTMLPath: relative(constructionContentRoot, source.path),
    headingCount: candidates.length
  };
}

export async function constructionHTMLBodyForSection(section) {
  return (await constructionHTMLBodyStatusForSection(section)).body;
}

export async function constructionHTMLCoverage(sections) {
  const results = [];
  for (const section of sections || []) {
    results.push({
      section,
      covered: Boolean(await constructionHTMLBodyForSection(section))
    });
  }
  return {
    covered: results.filter((result) => result.covered),
    missing: results.filter((result) => !result.covered)
  };
}
