import { createHash } from "node:crypto";

export const researchDefinitionExcerptVersion = "20261003-operative-definition-context-v5";

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
  const blocks = Array.isArray(section?.body?.blocks)
    ? section.body.blocks
    : (Array.isArray(section?.blocks) ? section.blocks : []);
  return blocks
    .map((block) => String(block?.html || ""))
    .filter(Boolean)
    .join("\n");
}

function zoningHousingDefinitionEntries(section) {
  if (String(section?.codePrefix || "").toUpperCase() !== "ZR" || String(section?.sectionNumber) !== "27-111") return [];
  const blocks = section?.body?.blocks || section?.blocks || [];
  // This chapter uses standalone paragraph labels, unlike 12-10's defined-term
  // articles. Keep every following paragraph/list until the next label.
  const labels = blocks.flatMap((block, index) => {
    const match = String(block.html || "").match(/^<p>(?:\s|<br\s*\/?>)*([A-Z][A-Za-z ’'()-]{1,119})\s*<\/p>$/);
    return match ? [{ label: definitionLabel(match[1]), index }] : [];
  });
  return labels.map((entry, order) => ({
    label: entry.label,
    text: compactText(blocks.slice(entry.index, labels[order + 1]?.index ?? blocks.length)
      .map((block) => block.plainText || "").join("\n\n")),
    order
  }));
}

function zoningDefinitionEntriesFromHTML(section, html) {
  const markers = Array.from(html.matchAll(
    /<article\b[^>]*\bclass=["'][^"']*\bdefined-term\b[^"']*["'][^>]*>/gi
  ));
  const htmlEntries = markers.map((marker, index) => {
    const segment = html.slice(marker.index, markers[index + 1]?.index ?? html.length);
    const labelMatch = segment.match(
      /<h2\b[^>]*\bclass=["'][^"']*\bdefinition__title\b[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i
    );
    return {
      label: definitionLabel(plainTextFromHTML(labelMatch?.[1])),
      text: plainTextFromHTML(segment),
      order: index
    };
  }).filter((entry) => entry.label && entry.text);
  const canonicalText = compactText(
    ((Array.isArray(section?.body?.blocks) ? section.body.blocks : section?.blocks) || [])
      .map((block) => block?.plainText)
      .filter(Boolean)
      .join("\n\n")
  );
  if (!canonicalText || !htmlEntries.length) return htmlEntries;
  const comparableCanonical = comparableText(canonicalText);
  const starts = [];
  let cursor = 0;
  for (const entry of htmlEntries) {
    const label = comparableText(entry.label);
    let start = comparableCanonical.indexOf(label, cursor);
    while (start >= 0) {
      const following = comparableCanonical.slice(start + label.length, start + label.length + 280);
      if (/\b(?:general definition|applicable to|applicable from|last amended)\b/i.test(following)) break;
      start = comparableCanonical.indexOf(label, start + Math.max(1, label.length));
    }
    if (start < 0) return htmlEntries;
    starts.push(start);
    cursor = start + label.length;
  }
  return htmlEntries.map((entry, index) => ({
    ...entry,
    text: canonicalText.slice(starts[index], starts[index + 1] ?? canonicalText.length).trim()
  }));
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
  const entries = labels.map((entry, index) => ({
    label: entry.label,
    text: compactText(segments.slice(
      entry.segmentIndex,
      labels[index + 1]?.segmentIndex ?? segments.length
    ).join("\n")),
    order: index
  })).filter((entry) => entry.text);
  return entries.length ? entries : zoningDefinitionEntriesFromHTML(section, html);
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
  const housingEntries = zoningHousingDefinitionEntries(section);
  if (housingEntries.length) return housingEntries;
  const richEntries = definitionEntriesFromHTML(section);
  return richEntries.length ? richEntries : definitionEntriesFromText(section);
}

// Some canonical catalog records carry the next chapter in the same source
// block. Recognize the enacted heading, not a guessed catalog title/number.
// The registered carrier remains the storage identity throughout extraction.
export function researchEmbeddedDefinitionCarrier(section) {
  if (section?.truncated === true) return null;
  const prefix = compactText(section?.codePrefix).toUpperCase();
  if (!/^[A-Z]+$/.test(prefix)) return null;
  const blocks = section?.body?.blocks || section?.blocks || [];
  for (const [blockIndex, block] of blocks.entries()) {
    const headings = [...String(block?.html || "").matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)];
    for (const [headingIndex, heading] of headings.entries()) {
      const headingText = plainTextFromHTML(heading[1]);
      const match = headingText.match(/^Section\s+([A-Z]+)\s+(\d+(?:\.\d+)*):\s+(?:General\s+)?Definitions?\s*$/i);
      if (!match || match[1].toUpperCase() !== prefix) continue;
      const plain = String(block.plainText || "");
      const location = exactWhitespaceLocation(plain, headingText);
      if (!location) continue;
      const nextSection = headings.slice(headingIndex + 1).map(item => plainTextFromHTML(item[1]))
        .find(text => /^Section\s+[A-Z]+\s+\d+(?:\.\d+)*:/i.test(text));
      const nextLocation = nextSection && exactWhitespaceLocation(plain.slice(location.end), nextSection);
      const rangeEnd = nextLocation ? location.end + nextLocation.start : plain.length;
      const entries = definitionEntries(section).filter(entry =>
        exactWhitespaceLocation(plain.slice(location.end, rangeEnd), entry.text));
      if (new Set(entries.map(entry => entry.label)).size < 2) continue;
      return { codePrefix: prefix, sectionNumber: match[2], heading: headingText,
        carrierSectionID: compactText(section?.sectionID || section?.id),
        carrierSectionNumber: compactText(section?.sectionNumber),
        sourceTextHash: createHash("sha256").update(plain).digest("hex"),
        definitionRange: { start: location.end, end: rangeEnd },
        sourceOffsets: { blockIndex, blockID: String(block.id || ""), ...location } };
    }
  }
  return null;
}

function exactWhitespaceLocation(source, excerpt) {
  const words = compactText(excerpt).split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const pattern = words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
  const match = new RegExp(pattern).exec(source);
  return match ? { start: match.index, end: match.index + match[0].length } : null;
}

function definitionBindings(section, selected, carrier) {
  if (!carrier) return {};
  const blocks = section?.body?.blocks || section?.blocks || [];
  const block = blocks[carrier.sourceOffsets.blockIndex];
  const plain = String(block?.plainText || "");
  const entries = selected.map(entry => {
    const location = exactWhitespaceLocation(plain, entry.text);
    return location && location.start >= carrier.definitionRange.start && location.end <= carrier.definitionRange.end ? { label: entry.label,
      sourceTextHash: carrier.sourceTextHash,
      sourceOffsets: { blockIndex: carrier.sourceOffsets.blockIndex, blockID: String(block.id || ""), ...location }
    } : null;
  });
  return entries.every(Boolean) ? { embeddedDefinitionSection: carrier, canonicalEntryBindings: entries } : null;
}

const publishedCitationVersion = "canonical-published-definition-reference-v1";
const citationAuthorityFields = ["codePrefix", "corpusID", "codeVersion", "codeEdition", "jurisdiction"];
const citationText = value => String(value || "").replace(/\s+/g, " ").trim();
const citationHash = value => createHash("sha256").update(citationText(value)).digest("hex");
const sameOffsets = (left, right) => ["blockIndex", "blockID", "start", "end"]
  .every(field => left?.[field] === right?.[field]);
const sameEntryBinding = (left, right) => left?.label === right?.label &&
  left?.sourceTextHash === right?.sourceTextHash && sameOffsets(left?.sourceOffsets, right?.sourceOffsets);

// Called only with a freshly resolved canonical record. An embedded heading
// cannot relabel the whole carrier: only exact, complete entries wholly inside
// that heading's hash-bound range acquire this published reference.
export function researchBoundDefinitionPublishedReference(section, excerpt, selectedText) {
  if (!excerpt || excerpt.sourceMode !== "canonical_enacted_definition_entries" ||
      section?.truncated === true || section?.body?.truncated === true ||
      citationAuthorityFields.some(field => !citationText(section?.[field])) ||
      citationAuthorityFields.some(field => excerpt[field] !== undefined &&
        citationText(excerpt[field]) !== citationText(section[field])) ||
      citationText(excerpt.sectionID) !== citationText(section.sectionID || section.id) ||
      citationText(excerpt.sectionNumber) !== citationText(section.sectionNumber)) return null;
  const carrier = researchEmbeddedDefinitionCarrier(section);
  const supplied = excerpt.embeddedDefinitionSection;
  if (!carrier || !supplied || ["codePrefix", "sectionNumber", "heading", "carrierSectionID", "carrierSectionNumber", "sourceTextHash"]
      .some(field => carrier[field] !== supplied[field]) || !sameOffsets(carrier.sourceOffsets, supplied.sourceOffsets) ||
      carrier.definitionRange.start !== supplied.definitionRange?.start || carrier.definitionRange.end !== supplied.definitionRange?.end) return null;
  const block = (section.body?.blocks || section.blocks || [])[carrier.sourceOffsets.blockIndex];
  if (block?.researchClaimEligible === false || block?.truncated === true) return null;
  const labels = excerpt.labels, passages = excerpt.passages;
  if (!Array.isArray(labels) || !labels.length || labels.length > researchDefinitionExcerptLimits.maximumDefinitions ||
      new Set(labels).size !== labels.length || !Array.isArray(passages) || passages.length !== labels.length) return null;
  const entries = definitionEntries(section);
  const selected = labels.map((label, index) => {
    const matches = entries.filter(entry => entry.label === label);
    return matches.length === 1 && citationText(matches[0].text) === citationText(passages[index]) ? matches[0] : null;
  });
  if (selected.some(entry => !entry)) return null;
  const bindings = definitionBindings(section, selected, carrier);
  if (!bindings || !Array.isArray(excerpt.canonicalEntryBindings) || excerpt.canonicalEntryBindings.length !== selected.length ||
      bindings.canonicalEntryBindings.some((binding, index) => !sameEntryBinding(binding, excerpt.canonicalEntryBindings[index]))) return null;
  const expectedText = [carrier.heading, ...selected.map(entry => entry.text)].join("\n\n");
  if (citationText(selectedText) !== citationText(expectedText)) return null;
  const title = carrier.heading.slice(carrier.heading.indexOf(":") + 1).trim();
  return {
    version: publishedCitationVersion, basis: "hash_bound_embedded_definition_entries",
    ...Object.fromEntries(citationAuthorityFields.map(field => [field, citationText(section[field])])),
    sectionNumber: carrier.sectionNumber, title, heading: carrier.heading,
    carrierSectionID: carrier.carrierSectionID, carrierSectionNumber: carrier.carrierSectionNumber,
    carrierTitle: citationText(section.title), sourceTextHash: carrier.sourceTextHash,
    sourceOffsets: structuredClone(carrier.sourceOffsets),
    canonicalEntryBindings: structuredClone(bindings.canonicalEntryBindings),
    selectedTextHash: citationHash(selectedText)
  };
}

// Consumers read the server-owned attestation, never model-supplied reference
// numbers. Bind it again to the actual selected passage and authority so a
// copied reference cannot migrate across entries, editions or carriers.
export function researchSourcePublishedCitationReference(source) {
  const reference = source?.publishedCitationReference;
  const excerpt = source?.targetedDefinition;
  if (!reference || reference.version !== publishedCitationVersion ||
      reference.basis !== "hash_bound_embedded_definition_entries" || !source.canonicalContextResolved || source.truncated ||
      !citationText(source.sourceID) ||
      !excerpt || excerpt.sourceMode !== "canonical_enacted_definition_entries" ||
      citationAuthorityFields.some(field => !citationText(source[field]) || reference[field] !== citationText(source[field])) ||
      citationAuthorityFields.some(field => excerpt[field] !== undefined && citationText(excerpt[field]) !== citationText(source[field])) ||
      citationText(excerpt.sectionID) !== citationText(source.sectionID) || citationText(excerpt.sectionNumber) !== citationText(source.sectionNumber) ||
      reference.carrierSectionID !== citationText(source.sectionID) || reference.carrierSectionNumber !== citationText(source.sectionNumber) ||
      reference.carrierTitle !== citationText(source.title) || reference.selectedTextHash !== citationHash(source.text) ||
      !/^[a-f0-9]{64}$/.test(reference.sourceTextHash || "") ||
      reference.sectionNumber !== excerpt.embeddedDefinitionSection?.sectionNumber ||
      reference.heading !== excerpt.embeddedDefinitionSection?.heading ||
      reference.sourceTextHash !== excerpt.embeddedDefinitionSection?.sourceTextHash ||
      !sameOffsets(reference.sourceOffsets, excerpt.embeddedDefinitionSection?.sourceOffsets) ||
      !Array.isArray(reference.canonicalEntryBindings) || !reference.canonicalEntryBindings.length ||
      reference.canonicalEntryBindings.length !== excerpt.canonicalEntryBindings?.length ||
      reference.canonicalEntryBindings.length !== excerpt.labels?.length || reference.canonicalEntryBindings.length !== excerpt.passages?.length ||
      reference.canonicalEntryBindings.some((binding, index) => binding.label !== excerpt.labels[index]) ||
      reference.canonicalEntryBindings.some((binding, index) => !sameEntryBinding(binding, excerpt.canonicalEntryBindings[index])) ||
      citationText(source.text) !== citationText([reference.heading, ...(excerpt.passages || [])].join("\n\n")) ||
      reference.title !== reference.heading.slice(reference.heading.indexOf(":") + 1).trim()) return null;
  return structuredClone(reference);
}

export function researchCommonPublishedCitationReference(sources) {
  if (!Array.isArray(sources) || !sources.length) return null;
  const references = sources.map(researchSourcePublishedCitationReference);
  if (references.some(reference => !reference)) return null;
  const fields = ["version", "basis", ...citationAuthorityFields, "sectionNumber", "title", "heading",
    "carrierSectionID", "carrierSectionNumber", "carrierTitle"];
  if (references.some(reference => fields.some(field => reference[field] !== references[0][field]))) return null;
  return { ...Object.fromEntries(fields.map(field => [field, references[0][field]])),
    sourceBindings: references.map((reference, index) => ({ sourceID: sources[index].sourceID,
      sourceTextHash: reference.sourceTextHash, sourceOffsets: reference.sourceOffsets,
      canonicalEntryBindings: reference.canonicalEntryBindings, selectedTextHash: reference.selectedTextHash })) };
}

function isDefinitionSection(section, text) {
  const sectionNumber = compactText(section?.sectionNumber).toUpperCase();
  const title = compactText(section?.title);
  return sectionNumber === "202" ||
    /\bdefinitions?\b/i.test(title) ||
    /\bthe following (?:terms )?shall.*\bmeanings?\b/i.test(text.slice(0, 2_000)) ||
    Boolean(researchEmbeddedDefinitionCarrier(section));
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

function comparableText(value) {
  return compactText(value).normalize("NFKC").toLocaleLowerCase("en-US");
}

function requiredTermSelection(entries, requiredTextTerms) {
  const requiredTerms = Array.from(new Set((requiredTextTerms || [])
    .map((term) => compactText(term))
    .filter(Boolean)));
  if (!requiredTerms.length) return null;
  const selected = new Map();
  for (const term of requiredTerms) {
    const comparableTerm = comparableText(term);
    const entry = entries.find((candidate) => comparableText(candidate.label) === comparableTerm) ||
      entries.find((candidate) => comparableText(candidate.text).includes(comparableTerm));
    if (!entry) return null;
    const record = selected.get(entry.order) || { ...entry, requiredTextTerms: [] };
    record.requiredTextTerms.push(term);
    selected.set(entry.order, record);
  }
  return Array.from(selected.values()).sort((left, right) => left.order - right.order);
}

function zoningDefinitionDependencies(section, query) {
  if (String(section?.codePrefix || "").toUpperCase() !== "ZR") return [];
  const text = String(query || "");
  if (String(section?.sectionNumber) === "27-111" && /\bqualifying affordable housing\b/i.test(text) && /\b(?:FAR|floor area)\b/i.test(text))
    return ["affordable floor area", "affordable housing regulatory agreement", "MIH development", "UAP development"];
  if (String(section?.sectionNumber) !== "12-10") return [];
  // These are source labels, not conclusions. A below-grade classification
  // needs both sides of the height distinction and the floor-area definition.
  if (/\b(?:below[ -]grade|below ground|cellars?|basements?)\b/i.test(text) && /\bfloor area\b/i.test(text))
    return ["basement", "cellar", "floor area"];
  // Do not substitute the short "lot, zoning: see zoning lot" alias for the
  // definition that contains the ownership/contiguity pathways.
  if (/\bzoning lots?\b/i.test(text) && /\b(?:ownership|owners?|tax lots?|contigu(?:ous|ity))\b/i.test(text))
    return ["zoning lot"];
  return [];
}

function boundedRequiredTermEntry(entry, maximumCharacters) {
  if (entry.text.length <= maximumCharacters) return entry.text;
  const comparableEntry = comparableText(entry.text);
  const ranges = entry.requiredTextTerms.map((term) => {
    const index = comparableEntry.indexOf(comparableText(term));
    const perTermAllowance = Math.max(800, Math.floor((maximumCharacters - entry.label.length - 4) /
      Math.max(1, entry.requiredTextTerms.length)));
    const before = Math.min(1_500, Math.floor(perTermAllowance * 0.3));
    const after = Math.max(400, perTermAllowance - before);
    return {
      start: Math.max(0, index - before),
      end: Math.min(entry.text.length, index + term.length + after)
    };
  }).sort((left, right) => left.start - right.start);
  const merged = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }
  const excerpt = `${entry.label}\n${merged.map((range) => entry.text.slice(range.start, range.end).trim()).join("\n\n")}`
    .slice(0, maximumCharacters)
    .trim();
  return entry.requiredTextTerms.every((term) => comparableText(excerpt).includes(comparableText(term)))
    ? excerpt
    : null;
}

export function targetedDefinitionExcerpt(section, query, options = {}) {
  if (section?.truncated === true) return null;
  const canonicalText = compactText(section?.canonicalText || section?.text ||
    ((Array.isArray(section?.body?.blocks) ? section.body.blocks : section?.blocks) || [])
      .map((block) => compactText(block?.plainText))
      .filter(Boolean)
      .join("\n\n"));
  if (
    (options.allowShortSection !== true && canonicalText.length < researchDefinitionExcerptLimits.minimumSectionCharacters &&
      !(zoningHousingDefinitionEntries(section).length && canonicalText.length > (options.maximumCharacters || researchDefinitionExcerptLimits.maximumCharacters))) ||
    !isDefinitionSection(section, canonicalText)
  ) return null;

  // Match the enacted definition's full label when a zoning question uses
  // its ordinary abbreviation. This adds a retrieval term, never a code rule.
  const definitionQuery = String(section?.codePrefix || "").toUpperCase() === "ZR"
    ? String(query || "").replace(/\bFAR\b/gi, "FAR floor area ratio")
    : query;
  const normalizedQuery = terms(definitionQuery).join(" ");
  const queryTerms = new Set(terms(definitionQuery));
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
  const carrier = researchEmbeddedDefinitionCarrier(section);
  const entries = definitionEntries(section).filter(entry => !carrier || definitionBindings(section, [entry], carrier));
  // A dependency packet requests exact, complete definition entries. Do not
  // fall back to an incidental mention of the term or clip its conditions to
  // fit: the caller must retain an explicit evidence gap when it cannot fit.
  if (Array.isArray(options.completeDefinitionLabels) && options.completeDefinitionLabels.length) {
    const labels = [...new Set(options.completeDefinitionLabels.map(comparableText))];
    const selected = labels.map(label => entries.filter(entry => comparableText(entry.label) === label));
    if (selected.some(matches => matches.length !== 1) || labels.length > maximumDefinitions) return null;
    const complete = selected.map(matches => matches[0]).sort((left, right) => left.order - right.order);
    const text = [carrier?.heading, ...complete.map(entry => entry.text)].filter(Boolean).join("\n\n");
    if (text.length > maximumCharacters) return null;
    const bindings = definitionBindings(section, complete, carrier);
    if (!bindings) return null;
    return {
      schemaVersion: 1, version: researchDefinitionExcerptVersion,
      sourceMode: "canonical_enacted_definition_entries",
      sectionID: compactText(section?.sectionID || section?.id), codePrefix: compactText(section?.codePrefix).toUpperCase(),
      sectionNumber: compactText(section?.sectionNumber), codeEdition: compactText(section?.codeEdition),
      codeVersion: compactText(section?.codeVersion), jurisdiction: compactText(section?.jurisdiction),
      labels: complete.map(entry => entry.label), passages: complete.map(entry => entry.text), text,
      canonicalSectionCharacterCount: canonicalText.length, excerptCharacterCount: text.length,
      canonicalContextComplete: false, completeDefinitionEntries: true, ...bindings
    };
  }
  const dependencies = options.requiredTextTerms?.length ? [] : zoningDefinitionDependencies(section, query);
  const dependencyEntries = dependencies.length ? requiredTermSelection(entries, dependencies) : null;
  // Automatically inferred dependencies must be complete entries. Never cut
  // a measurement exception simply to fit another definition in the package.
  const completeDependenciesFit = dependencyEntries?.length === dependencies.length &&
    dependencyEntries.reduce((sum, entry) => sum + entry.text.length, Math.max(0, dependencies.length - 1) * 2) <= maximumCharacters;
  const requiredEntries = dependencies.length && completeDependenciesFit
    ? dependencyEntries : requiredTermSelection(entries, options.requiredTextTerms);
  const ranked = requiredEntries || entries
    .map((entry) => entryScore(entry, queryTerms, normalizedQuery))
    .filter(Boolean)
    .sort((left, right) =>
      right.score - left.score ||
      (left.phraseIndex < 0 ? Number.MAX_SAFE_INTEGER : left.phraseIndex) -
        (right.phraseIndex < 0 ? Number.MAX_SAFE_INTEGER : right.phraseIndex) ||
      left.order - right.order
    );
  const selected = [];
  let characterCount = carrier ? carrier.heading.length + 2 : 0;
  const candidates = requiredEntries
    ? ranked.slice(0, maximumDefinitions).sort((left, right) => left.text.length - right.text.length)
    : ranked;
  for (const [index, entry] of candidates.entries()) {
    if (selected.length >= maximumDefinitions) break;
    const separatorLength = selected.length ? 2 : 0;
    const remainingCharacters = maximumCharacters - characterCount - separatorLength;
    const remainingEntries = candidates.length - index;
    const entryBudget = requiredEntries
      ? Math.max(800, remainingCharacters - Math.max(0, remainingEntries - 1) * 800)
      : remainingCharacters;
    const selectedText = requiredEntries
      ? boundedRequiredTermEntry(entry, Math.min(remainingCharacters, entryBudget))
      : entry.text;
    if (!selectedText || selectedText.length > remainingCharacters) continue;
    selected.push({ ...entry, text: selectedText });
    characterCount += separatorLength + selectedText.length;
  }
  if (!selected.length) return null;
  if (requiredEntries && selected.length !== candidates.length) return null;
  selected.sort((left, right) => left.order - right.order);
  const text = [carrier?.heading, ...selected.map((entry) => entry.text)].filter(Boolean).join("\n\n");
  const bindings = definitionBindings(section, selected, carrier);
  if (!bindings) return null;
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
    passages: selected.map((entry) => entry.text),
    text,
    canonicalSectionCharacterCount: canonicalText.length,
    excerptCharacterCount: text.length,
    canonicalContextComplete: false,
    ...bindings
  };
}
