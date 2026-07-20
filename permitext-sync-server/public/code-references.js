const inlineReferenceNumberSource = String.raw`[A-Z]?\d{2,}(?:-\d+)?(?:\.[0-9A-Za-z-]+)*(?:\([^)]+\))*`;
const inlineReferencePhrasePattern = new RegExp(
  String.raw`\b(?:(BC|PC|MC|FGC|AC)\s+)?(?:Sections?|§{1,2})\s+(${inlineReferenceNumberSource})((?:\s*(?:,\s*(?:(?:and|or)\s+)?|(?:and|or|through|to)\s+)${inlineReferenceNumberSource})*)`,
  "gi"
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

export function inlineCodeReferencePhrases(text) {
  const source = String(text || "");
  const pattern = new RegExp(inlineReferencePhrasePattern.source, inlineReferencePhrasePattern.flags);
  const phrases = [];

  for (const match of source.matchAll(pattern)) {
    const phraseText = match[0];
    const numberPattern = new RegExp(inlineReferenceNumberPattern.source, inlineReferenceNumberPattern.flags);
    const numberMatches = [...phraseText.matchAll(numberPattern)];
    if (!numberMatches.length) continue;
    const phraseStart = match.index;
    const references = numberMatches.map((numberMatch, index) => {
      const numberStart = phraseStart + numberMatch.index;
      return {
        start: index === 0 ? phraseStart : numberStart,
        end: numberStart + numberMatch[0].length,
        sectionNumber: normalizedSectionNumber(numberMatch[0])
      };
    });
    phrases.push({
      start: phraseStart,
      end: phraseStart + phraseText.length,
      codePrefix: String(match[1] || "").toUpperCase(),
      references
    });
  }

  return phrases;
}
