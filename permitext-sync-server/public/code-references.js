const inlineReferenceNumberSource = String.raw`[A-Z]?\d{2,}(?:-\d+)?(?:\.[0-9A-Za-z-]+)*(?:\([^)]+\))*`;
const inlineReferencePhrasePattern = new RegExp(
  String.raw`\b(?:(BC|PC|MC|FGC|AC|ZR)\s+)?(?:Sections?|§{1,2})\s+(${inlineReferenceNumberSource})((?:\s*(?:,\s*(?:(?:and|or)\s+)?|(?:and|or|through|to)\s+)${inlineReferenceNumberSource})*)`,
  "gi"
);
const inlineDirectReferencePhrasePattern = new RegExp(
  String.raw`\b(BC|PC|MC|FGC|AC|ZR)\s+(?:(Table)\s+)?(${inlineReferenceNumberSource})((?:\s*(?:,\s*(?:(?:and|or)\s+)?|(?:and|or|through|to)\s+)${inlineReferenceNumberSource})*)`,
  "gi"
);
// Research also reads enacted Fire Code text. Keep that grammar opt-in so
// browser links retain their existing supported destinations.
const fireReferencePhrasePattern = new RegExp(
  inlineReferencePhrasePattern.source.replace("BC|PC|MC|FGC|AC|ZR", "BC|PC|MC|FGC|AC|ZR|FC"),
  inlineReferencePhrasePattern.flags
);
const fireDirectReferencePhrasePattern = new RegExp(
  inlineDirectReferencePhrasePattern.source.replace("BC|PC|MC|FGC|AC|ZR", "BC|PC|MC|FGC|AC|ZR|FC"),
  inlineDirectReferencePhrasePattern.flags
);
const inlineReferenceNumberPattern = new RegExp(inlineReferenceNumberSource, "gi");

function normalizedAnchor(value) {
  return String(value || "").trim().replace(/^#?JD_/i, "");
}

function normalizedSectionNumber(value) {
  return String(value || "").replace(/\([^)]+\)/g, "").replace(/\.$/, "").toUpperCase();
}

function sectionTarget(codePrefix, sectionNumber, anchor, targetKind = "section") {
  return {
    kind: "section",
    codePrefix,
    sectionNumber: normalizedSectionNumber(sectionNumber),
    referenceNumber: String(sectionNumber).toUpperCase(),
    anchorID: `JD_${anchor}`,
    targetKind
  };
}

export function parseCodeJumpAnchor(value) {
  const anchor = normalizedAnchor(value);
  if (!anchor) return null;

  let match = anchor.match(/^(BC|PC|MC|FGC)(?:Table|Figure)([A-Z]?\d+(?:\.\d+)*(?:\([^)]+\))?)/i);
  if (match) {
    const targetKind = /table/i.test(anchor) ? "table" : "figure";
    return sectionTarget(match[1].toUpperCase(), match[2], anchor, targetKind);
  }

  match = anchor.match(/^Table(28-\d+(?:\.\d+)*(?:\([^)]+\))?)/i);
  if (match) return sectionTarget("AC", match[1], anchor, "table");

  match = anchor.match(/^(BC|PC|MC|FGC)(?:Ch\.|Chapter)([A-Z0-9]+)/i);
  if (match) {
    return {
      kind: "chapter",
      codePrefix: match[1].toUpperCase(),
      chapterNumber: match[2].toUpperCase(),
      anchorID: `JD_${anchor}`,
      targetKind: "chapter"
    };
  }

  match = anchor.match(/^T28C(\d+)/i);
  if (match) {
    return {
      kind: "chapter",
      codePrefix: "AC",
      chapterNumber: String(Number.parseInt(match[1], 10)),
      anchorID: `JD_${anchor}`,
      targetKind: "chapter"
    };
  }

  if (/^T28$/i.test(anchor)) {
    return {
      kind: "chapter",
      codePrefix: "AC",
      chapterNumber: "1",
      anchorID: `JD_${anchor}`,
      targetKind: "chapter"
    };
  }

  match = anchor.match(/^T28(PC|MC|FGC|BC)App([A-Z0-9]+)/i);
  if (match) {
    return {
      kind: "chapter",
      codePrefix: match[1].toUpperCase(),
      chapterNumber: match[2].toUpperCase(),
      anchorID: `JD_${anchor}`,
      targetKind: "appendix"
    };
  }

  match = anchor.match(/^(BC|PC|MC|FGC)_?App(?:endix)?([A-Z])(?:\.(\d+(?:\.\d+)*))?/i);
  if (match) {
    if (match[3]) {
      return sectionTarget(match[1].toUpperCase(), `${match[2]}.${match[3]}`, anchor, "appendix-section");
    }
    return {
      kind: "chapter",
      codePrefix: match[1].toUpperCase(),
      chapterNumber: match[2].toUpperCase(),
      anchorID: `JD_${anchor}`,
      targetKind: "appendix"
    };
  }

  // Appendix parts (K1, K2) are chapter destinations; K101 is a section.
  match = anchor.match(/^(BC|PC|MC|FGC)([A-Z]\d{1,2})$/i);
  if (match) return {kind: "chapter", codePrefix: match[1].toUpperCase(),
    chapterNumber: match[2].toUpperCase(), anchorID: `JD_${anchor}`, targetKind: "appendix"};

  match = anchor.match(/^(BC|PC|MC|FGC)([A-Z]?\d+(?:\.\d+)*(?:\([^)]+\))?)/i);
  if (match) return sectionTarget(match[1].toUpperCase(), match[2], anchor);

  match = anchor.match(/^(28-\d+(?:\.\d+)*(?:\([^)]+\))?)/i);
  if (match) return sectionTarget("AC", match[1], anchor, "article-or-section");

  return null;
}

function escapeAttribute(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function rewriteStructuredCodeLinks(html) {
  return String(html || "").replace(
    /<\s*Link\b([^>]*)>([\s\S]*?)<\s*\/\s*Link\s*>/gi,
    (_match, attributes, content) => {
      const anchor = String(attributes || "").match(/hash\s*:\s*['"]#JD_([^'"}\s]+)['"]/i)?.[1] || "";
      const target = parseCodeJumpAnchor(anchor);
      if (!target) return content;
      const label = String(content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return `<button type="button" class="inline-code-reference" data-code-jump-anchor="${escapeAttribute(anchor)}" aria-label="Open ${escapeAttribute(label)}">${content}</button>`;
    }
  );
}

export function inlineCodeReferencePhrases(text, { includeFireCode = false } = {}) {
  const source = String(text || "");
  const phrases = [];
  const addMatches = (pattern, { direct = false } = {}) => {
    for (const match of source.matchAll(new RegExp(pattern.source, pattern.flags))) {
      const phraseText = match[0];
      const codePrefix = String(match[1] || "").toUpperCase();
      const kind = direct && match[2] ? "table" : "section";
      const firstNumber = direct ? match[3] : match[2];
      const phraseStart = match.index;
      const firstNumberOffset = phraseText.indexOf(firstNumber);
      if (firstNumberOffset < 0) continue;
      const numberPattern = new RegExp(inlineReferenceNumberPattern.source, inlineReferenceNumberPattern.flags);
      const numberMatches = [...phraseText.slice(firstNumberOffset).matchAll(numberPattern)];
      if (!numberMatches.length) continue;
      const references = numberMatches.map((numberMatch, index) => {
        const numberStart = phraseStart + firstNumberOffset + numberMatch.index;
        return {
          start: index === 0 ? phraseStart : numberStart,
          end: numberStart + numberMatch[0].length,
          sectionNumber: normalizedSectionNumber(numberMatch[0]),
          referenceNumber: numberMatch[0],
          kind
        };
      });
      phrases.push({
        start: phraseStart,
        end: phraseStart + phraseText.length,
        codePrefix,
        kind,
        references
      });
    }
  };
  addMatches(includeFireCode === true ? fireReferencePhrasePattern : inlineReferencePhrasePattern);
  addMatches(includeFireCode === true ? fireDirectReferencePhrasePattern : inlineDirectReferencePhrasePattern,
    { direct: true });

  const seen = new Set();
  return phrases
    .sort((left, right) => left.start - right.start || right.end - left.end)
    .filter((phrase) => {
      const identity = `${phrase.start}:${phrase.end}:${phrase.codePrefix}:${phrase.kind}`;
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
}

// Locate the authored destination, including numbered tables such as (1)/(2).
// Looking across the loaded chapter also handles tables stored in a subsection
// whose number differs from the table number.
export function readerCodeReferenceTarget(content, detail) {
  const target = detail.referenceTarget;
  if (!content || !target) return null;
  const compact = value => String(value || "").replace(/\s+/g, " ").replace(/\s+\(/g, "(").trim().toUpperCase();
  const number = compact(target.number);
  const anchor = target.anchorID || `JD_${detail.codePrefix}${target.kind === "table" ? "Table" : target.kind === "figure" ? "Figure" : ""}${number}`;
  const escaped = anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const anchorPattern = new RegExp(`(?:id|name)=["']${escaped}["']`, "i");
  for (const section of content.querySelectorAll(".chapter-section")) {
    section._readerBlockWindow?.ensureMatching(block => anchorPattern.test(block.html || ""));
  }
  const authored = [...content.querySelectorAll("[id],a[name]")].find(node =>
    compact(node.id || node.getAttribute("name")) === compact(anchor));
  if (authored) return authored.closest("caption,h2,h3,h4,h5,h6,p") || authored.parentElement;
  const label = `${["table", "figure"].includes(target.kind) ? target.kind + " " : ""}${number}`;
  const pattern = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|\\s|[.:](?![0-9]))`, "i");
  for (const section of content.querySelectorAll(".chapter-section")) {
    section._readerBlockWindow?.ensureMatching(block => pattern.test(compact(block.plainText)));
  }
  const matches = [...content.querySelectorAll("caption,h2,h3,h4,h5,h6,p,strong,b,span,.section-block")]
    .filter(node => !node.closest("button,a,.reader-section-title") && pattern.test(compact(node.textContent)));
  const leaves = matches.filter(node => !matches.some(other => other !== node && node.contains(other)));
  return leaves.length === 1 ? leaves[0] : null;
}
