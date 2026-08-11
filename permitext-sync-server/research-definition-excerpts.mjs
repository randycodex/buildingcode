export const researchDefinitionExcerptVersion = "20260811-canonical-definition-excerpt-v1";

export const researchDefinitionExcerptLimits = Object.freeze({
  minimumSectionCharacters: 20_000,
  maximumDefinitions: 8,
  maximumCharacters: 12_000
});

const ignoredLabelTerms = new Set([
  "a", "an", "and", "for", "in", "of", "or", "the", "to"
]);

function compactText(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function plainTextFromHTML(value) {
  return compactText(String(value || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#8211;|&#8212;/gi, "-")
    .replace(/&#8216;|&#8217;/gi, "'")
    .replace(/&#8220;|&#8221;/gi, '"')
    .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number(codePoint))));
}

function canonicalTerm(value) {
  let term = String(value || "").normalize("NFKC").toLowerCase();
  if (term.length > 5 && term.endsWith("ies")) term = `${term.slice(0, -3)}y`;
  else if (term.length > 4 && term.endsWith("s") && !term.endsWith("ss")) term = term.slice(0, -1);
  return term;
}

function terms(value) {
  return (String(value || "").normalize("NFKC").toLowerCase().replace(/\s*\+\s*/g, "+")
    .match(/[a-z0-9]+(?:\+[a-z0-9]+)?(?:-[a-z0-9]+)*/g) || [])
    .map(canonicalTerm)
    .filter((term) => term && !ignoredLabelTerms.has(term));
}

function definitionLabel(value) {
  return compactText(value).replace(/\s*\.\s*$/, "").trim();
}

function isDefinitionLabel(value) {
  const label = definitionLabel(value);
  if (!label || label.length < 2 || label.length > 120) return false;
  const letters = label.match(/[A-Za-z]/g) || [];
  if (!letters.length) return false;
  const uppercaseLetters = letters.filter((letter) => letter === letter.toUpperCase()).length;
  return uppercaseLetters / letters.length >= 0.94 && /[A-Z]/.test(label);
}

function richHTML(section) {
  return (Array.isArray(section?.body?.blocks) ? section.body.blocks : [])
    .map((block) => String(block?.html || ""))
    .filter(Boolean)
    .join("\n");
}

function definitionEntriesFromHTML(section) {
  const html = richHTML(section);
  if (!html) return [];
  const markers = Array.from(html.matchAll(
    /<div\b[^>]*\bclass=["'][^"']*\bNormal-Level\b[^"']*["'][^>]*>/gi
  ));
  const segments = markers.map((marker, index) =>
    plainTextFromHTML(html.slice(marker.index, markers[index + 1]?.index ?? html.length))
  );
  const labels = [];
  for (const [index, segment] of segments.entries()) {
    const match = segment.match(/^([A-Z][A-Z0-9 +/&,'()_-]{1,119})\s*\.\s*/);
    const labelText = compactText(match?.[1]);
    if (!isDefinitionLabel(labelText)) continue;
    labels.push({ label: definitionLabel(labelText), segmentIndex: index });
  }
  return labels.map((entry, index) => ({
    label: entry.label,
    text: compactText(segments.slice(
      entry.segmentIndex,
      labels[index + 1]?.segmentIndex ?? segments.length
    ).join("\n")),
    order: index
  })).filter((entry) => entry.text);
}

function definitionEntriesFromText(section) {
  const text = compactText(section?.canonicalText || section?.text);
  if (!text) return [];
  const labels = [];
  const pattern = /(?:^|\s)([A-Z][A-Z0-9 +/&,'()_-]{1,119})\s*\.\s+/g;
  for (const match of text.matchAll(pattern)) {
    const labelText = compactText(match[1]);
    if (!isDefinitionLabel(labelText)) continue;
    labels.push({ label: definitionLabel(labelText), start: match.index + match[0].indexOf(match[1]) });
  }
  return labels.map((entry, index) => ({
    label: entry.label,
    text: text.slice(entry.start, labels[index + 1]?.start ?? text.length).trim(),
    order: index
  })).filter((entry) => entry.text);
}

function definitionEntries(section) {
  const richEntries = definitionEntriesFromHTML(section);
  return richEntries.length ? richEntries : definitionEntriesFromText(section);
}

function isDefinitionSection(section, text) {
  const sectionNumber = compactText(section?.sectionNumber).toUpperCase();
  const title = compactText(section?.title);
  return sectionNumber === "202" ||
    /\bdefinitions?\b/i.test(title) ||
    /\bthe following (?:terms )?shall.*\bmeanings?\b/i.test(text.slice(0, 2_000));
}

function entryScore(entry, queryTerms, normalizedQuery) {
  const labelTerms = terms(entry.label);
  if (!labelTerms.length) return null;
  const uniqueLabelTerms = Array.from(new Set(labelTerms));
  const matchedTerms = uniqueLabelTerms.filter((term) => queryTerms.has(term));
  if (matchedTerms.length !== uniqueLabelTerms.length) return null;
  const phrase = uniqueLabelTerms.join(" ");
  const phraseIndex = normalizedQuery.indexOf(phrase);
  const exactPhrase = phraseIndex >= 0;
  if (uniqueLabelTerms.length === 1 && !exactPhrase) return null;
  return {
    ...entry,
    labelTerms: uniqueLabelTerms,
    phraseIndex,
    score: (exactPhrase ? 100 : 0) + uniqueLabelTerms.length * 8 - Math.min(entry.text.length / 4_000, 5)
  };
}

function positiveBound(value, fallback, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

export function targetedDefinitionExcerpt(section, query, options = {}) {
  const canonicalText = compactText(section?.canonicalText || section?.text ||
    (Array.isArray(section?.body?.blocks) ? section.body.blocks
      .map((block) => compactText(block?.plainText))
      .filter(Boolean)
      .join("\n\n") : ""));
  if (
    canonicalText.length < researchDefinitionExcerptLimits.minimumSectionCharacters ||
    !isDefinitionSection(section, canonicalText)
  ) return null;

  const normalizedQuery = terms(query).join(" ");
  const queryTerms = new Set(terms(query));
  if (!queryTerms.size) return null;
  const maximumDefinitions = positiveBound(
    options.maximumDefinitions,
    researchDefinitionExcerptLimits.maximumDefinitions,
    researchDefinitionExcerptLimits.maximumDefinitions
  );
  const maximumCharacters = positiveBound(
    options.maximumCharacters,
    researchDefinitionExcerptLimits.maximumCharacters,
    researchDefinitionExcerptLimits.maximumCharacters
  );
  const ranked = definitionEntries(section)
    .map((entry) => entryScore(entry, queryTerms, normalizedQuery))
    .filter(Boolean)
    .sort((left, right) =>
      right.score - left.score ||
      (left.phraseIndex < 0 ? Number.MAX_SAFE_INTEGER : left.phraseIndex) -
        (right.phraseIndex < 0 ? Number.MAX_SAFE_INTEGER : right.phraseIndex) ||
      left.order - right.order
    );
  const selected = [];
  let characterCount = 0;
  for (const entry of ranked) {
    if (selected.length >= maximumDefinitions) break;
    const separatorLength = selected.length ? 2 : 0;
    if (characterCount + separatorLength + entry.text.length > maximumCharacters) continue;
    selected.push(entry);
    characterCount += separatorLength + entry.text.length;
  }
  if (!selected.length) return null;
  selected.sort((left, right) => left.order - right.order);
  const text = selected.map((entry) => entry.text).join("\n\n");
  return {
    schemaVersion: 1,
    version: researchDefinitionExcerptVersion,
    sourceMode: "canonical_enacted_definition_entries",
    sectionID: compactText(section?.sectionID || section?.id),
    codePrefix: compactText(section?.codePrefix).toUpperCase(),
    sectionNumber: compactText(section?.sectionNumber),
    codeEdition: compactText(section?.codeEdition),
    codeVersion: compactText(section?.codeVersion),
    jurisdiction: compactText(section?.jurisdiction),
    labels: selected.map((entry) => entry.label),
    text,
    canonicalSectionCharacterCount: canonicalText.length,
    excerptCharacterCount: text.length,
    canonicalContextComplete: false
  };
}
