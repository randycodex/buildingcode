import { createHash } from "node:crypto";

export const researchPassageIndexVersion = "20261007-published-text-context-v7";

// This is a retrieval index, not an applicability classifier. Every hit keeps
// its canonical section identity; a subsection inside a monolithic source is
// only an exact-text locator within that section.
const stopWords = new Set([
  "a", "about", "above", "after", "all", "also", "an", "and", "any", "are", "as", "at",
  "be", "been", "before", "being", "below", "between", "both", "but", "by", "can", "could",
  "do", "does", "each", "for", "from", "has", "have", "how", "if", "in", "into", "is", "it",
  "its", "may", "more", "must", "no", "not", "of", "on", "or", "our", "shall", "should", "so",
  "than", "that", "the", "their", "then", "there", "these", "this", "those", "to", "under",
  "was", "we", "what", "when", "where", "whether", "which", "while", "with", "without", "would"
]);

const comparableID = value => String(value ?? "");
const compact = value => String(value ?? "").replace(/\s+/g, " ").trim();
const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function normalizedSectionNumber(section) {
  return compact(section?.sectionNumber).replace(/^(?:[A-Z]+\s+)?(?:§\s*)?/i, "").replace(/\.$/, "");
}

function tokens(value) {
  return (String(value ?? "").toLowerCase().normalize("NFKC").match(/[\p{L}\p{N}]+(?:[.-][\p{L}\p{N}]+)*/gu) || [])
    .filter(token => !stopWords.has(token) && token.length > 1);
}

// Conservative morphology supplies extra search keys, never rewrites sources.
// Index and query use the same keys. Exact numbers and section references stay
// intact rather than being stemmed or numerically interpreted.
function tokenKeys(token) {
  const keys = new Set([token]);
  if (!/^[a-z]{4,}$/.test(token)) return keys;
  if (/ies$/.test(token)) keys.add(`${token.slice(0, -3)}y`);
  else if (/(?:s|x|z|ch|sh)es$/.test(token)) keys.add(token.slice(0, -2));
  else if (/s$/.test(token) && !/(?:ss|us|is)$/.test(token)) keys.add(token.slice(0, -1));
  if (/(?:ing|ed)$/.test(token)) {
    const stem = token.replace(/(?:ing|ed)$/, "");
    if (stem.length >= 3) {
      keys.add(stem);
      keys.add(`${stem}e`);
      if (/([b-df-hj-np-tv-z])\1$/.test(stem)) keys.add(stem.slice(0, -1));
    }
  }
  return keys;
}

function frequencies(value) {
  const values = tokens(value);
  const counts = new Map();
  for (const token of values) {
    for (const key of tokenKeys(token)) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return { counts, length: values.length };
}

function cleanHTML(value) {
  return compact(String(value || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'"));
}

function numberedHeadings(text, rootNumber) {
  if (!rootNumber || !/[0-9]/.test(rootNumber)) return [];
  const pattern = new RegExp(
    `^(${escapeRegex(rootNumber)}(?:\\.[0-9A-Za-z-]+)*)(?:\\.)?[ \\t]+([^\\r\\n]{1,600})$`, "gm"
  );
  const headings = [];
  for (const match of text.matchAll(pattern)) {
    // A PDF line break after "Section" or "Table" does not turn the
    // continued reference into a new published heading.
    if (/\b(?:Sections?|Tables?)\s*$/i.test(text.slice(Math.max(0, match.index - 80), match.index).trimEnd())) continue;
    const line = match[2].trim();
    // PDF text can join a published short heading and its first sentence on
    // one line. Recognize only a short, punctuated heading before that prose;
    // a cross-reference sentence containing "shall" is still not a heading.
    const inline = line.match(/^(.{1,120}?\.)[ \t]+[A-Z(“"]/);
    const title = inline ? inline[1] : line;
    if (!inline && title.length > 180) continue;
    // Numbered list items, measurements, and cross-reference sentences are
    // not subsection headings. Published headings are short standalone lines.
    if (!/[A-Za-z]/.test(title) || /\b(?:shall|must|may|means|provided|requires?)\b/i.test(title)) continue;
    headings.push({ number: match[1].replace(/\.$/, ""), title, start: match.index, end: match.index + match[0].length });
  }
  return headings;
}

function textRanges(text, maximumCharacters) {
  if (text.length <= maximumCharacters) return [{ start: 0, end: text.length }];
  const ranges = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + maximumCharacters);
    if (end < text.length) {
      const minimumEnd = start + Math.floor(maximumCharacters * 0.5);
      const paragraph = text.lastIndexOf("\n\n", end);
      const sentence = Math.max(text.lastIndexOf(". ", end), text.lastIndexOf("; ", end));
      const boundary = paragraph >= minimumEnd ? paragraph : sentence >= minimumEnd ? sentence + 1 : text.lastIndexOf(" ", end);
      if (boundary > minimumEnd) end = boundary;
    }
    // Keep every character, including whitespace, in the exact slice sequence.
    ranges.push({ start, end });
    start = end;
  }
  return ranges;
}

function sameOrAncestorNumber(parent, child) {
  return parent === child || child.startsWith(`${parent}.`);
}

function numberedListUnits(text, startOffset, { subsectionNumber, contextTexts, blockID, sourceTextHash }) {
  const markers = [...text.matchAll(/^([1-9]\d{0,2}(?:\.\d{1,3})*)(?:\.|\))[ \t]*([A-Za-z(][^\r\n]*)$/gm)]
    .filter(match => match[1] !== subsectionNumber && !sameOrAncestorNumber(subsectionNumber, match[1]))
    .map(match => ({ number: match[1], start: match.index }));
  if (!markers.length) return [];
  const minimumDepth = Math.min(...markers.map(marker => marker.number.split(".").length));
  const topItems = markers.filter(marker => marker.number.split(".").length === minimumDepth);
  const leadIn = text.slice(0, topItems[0].start);
  return topItems.map((item, position) => {
    const end = topItems[position + 1]?.start ?? text.length;
    return {
      id: `${blockID}:${startOffset + item.start}-${startOffset + end}:item-${item.number}`,
      kind: "numbered_list_item", subsectionNumber, itemNumber: item.number,
      text: text.slice(item.start, end),
      contextTexts: [...new Set([...contextTexts, leadIn].filter(value => value?.trim()))],
      sourceOffsets: { blockID, start: startOffset + item.start, end: startOffset + end },
      sourceTextHash, completeUnit: true,
      // The complete list item (including its nested items/local exceptions)
      // is not the whole enclosing rule. Don't turn selective rule retrieval
      // into a statement that all subsection conditions have been reviewed.
      scopeComplete: false, enclosingSubsectionComplete: false
    };
  });
}

function referencedDescriptorNumbers(text, metadata, descriptors) {
  const result = new Set();
  const number = "([A-Z]?\\d+(?:-\\d+)?(?:\\.[0-9A-Za-z-]+)*)";
  const prefix = `(?:\\b${escapeRegex(metadata.codePrefix)}\\s+(?:Sections?\\s+)?|\\bSections?\\s+|§{1,2}\\s*)`;
  const pattern = new RegExp(`${prefix}${number}(?:\\s+(?:through|to)\\s+${number})?`, "gi");
  for (const match of text.matchAll(pattern)) {
    const before = text.slice(Math.max(0, match.index - 70), match.index);
    const precedingCode = before.match(/\b(AC|BC|BC68|EBC|ECC|EC|FC|FGC|MC|PC|ZR)\s*$/i)?.[1]?.toUpperCase();
    if (precedingCode && precedingCode !== metadata.codePrefix) continue;
    const labels = { building: "BC", mechanical: "MC", plumbing: "PC", "fuel gas": "FGC", fire: "FC", administrative: "AC" };
    const precedingLabel = before.match(/\b(Building|Mechanical|Plumbing|Fuel\s+Gas|Fire|Administrative)\s+Code\s*$/i)?.[1];
    const followingLabel = text.slice(match.index + match[0].length, match.index + match[0].length + 70)
      .match(/^\s+(?:of|in)\s+(?:the\s+)?(Building|Mechanical|Plumbing|Fuel\s+Gas|Fire|Administrative)\s+Code\b/i)?.[1];
    if ([precedingLabel, followingLabel].filter(Boolean).some(label => labels[compact(label).toLowerCase()] !== metadata.codePrefix)) continue;
    const first = match[1].replace(/\.$/, "");
    const last = match[2]?.replace(/\.$/, "");
    const start = descriptors.findIndex(descriptor => descriptor.number === first);
    const end = last ? descriptors.findIndex(descriptor => descriptor.number === last) : start;
    if (start < 0) continue;
    result.add(first);
    if (last && end >= start) {
      for (const descriptor of descriptors.slice(start, end + 1)) result.add(descriptor.number);
    }
  }
  return result;
}

function sourceMetadata(section) {
  return {
    sectionID: comparableID(section?.id ?? section?.sectionID),
    codePrefix: compact(section?.codePrefix).toUpperCase(),
    sectionNumber: normalizedSectionNumber(section),
    title: compact(section?.title),
    headerLine: section?.headerLine ?? null,
    headingLine: section?.headingLine ?? null,
    chapterNumber: section?.chapterNumber ?? null,
    chapterTitle: section?.chapterTitle ?? null,
    codeVersion: section?.codeVersion ?? null,
    codeEdition: section?.codeEdition ?? null,
    corpusID: section?.corpusID ?? null,
    applicabilityStatus: section?.applicabilityStatus ?? null
  };
}

// Each term has one sorted (ordinal, frequency) pair per matching passage.
// Growing typed buffers avoid retaining an Array object for every pair while
// indexing. Final lists contain exactly the used pairs, with no spare capacity.
class PostingBuilder {
  constructor() {
    this.values = new Uint32Array(8);
    this.length = 0;
  }

  append(ordinal, frequency) {
    if (ordinal > 0xffffffff || frequency > 0xffffffff) {
      throw new RangeError("Passage ordinal or term frequency exceeds Uint32 storage.");
    }
    if (this.length + 2 > this.values.length) {
      const expanded = new Uint32Array(this.values.length * 2);
      expanded.set(this.values);
      this.values = expanded;
    }
    this.values[this.length++] = ordinal;
    this.values[this.length++] = frequency;
  }

  finish() {
    return this.length === this.values.length ? this.values : this.values.slice(0, this.length);
  }
}

function appendPosting(postings, term, ordinal, frequency) {
  let builder = postings.get(term);
  if (!builder) postings.set(term, builder = new PostingBuilder());
  builder.append(ordinal, frequency);
}

function finishPostings(postings) {
  for (const [term, builder] of postings) postings.set(term, builder.finish());
  return postings;
}

function passageFingerprint(passages) {
  const hash = createHash("sha256").update("[");
  for (const [position, passage] of passages.entries()) {
    if (position) hash.update(",");
    // Keep the pre-existing serialization and property order byte-for-byte.
    // Streaming one record avoids a second array and a corpus-sized JSON string
    // containing all the complete source/context text at the same time.
    hash.update(JSON.stringify({
      id: passage.id, sectionID: passage.sectionID,
      codePrefix: passage.codePrefix, codeVersion: passage.codeVersion, codeEdition: passage.codeEdition,
      corpusID: passage.corpusID, parentTitle: passage.parentTitle, passageTitle: passage.passageTitle,
      sourceTextHash: passage.sourceTextHash, sourceOffsets: passage.sourceOffsets,
      searchText: passage.searchText, contextTexts: passage.contextTexts, kind: passage.kind
    }));
  }
  return hash.update("]").digest("hex");
}

function postingDocumentFrequency(body, title) {
  let bodyOffset = 0;
  let titleOffset = 0;
  let count = 0;
  // Both lists are strictly increasing by ordinal. Merge their ordinals to
  // count the union without allocating pair arrays or a Set for every query.
  while (bodyOffset < body.length || titleOffset < title.length) {
    const bodyOrdinal = bodyOffset < body.length ? body[bodyOffset] : Infinity;
    const titleOrdinal = titleOffset < title.length ? title[titleOffset] : Infinity;
    if (bodyOrdinal <= titleOrdinal) bodyOffset += 2;
    if (titleOrdinal <= bodyOrdinal) titleOffset += 2;
    count += 1;
  }
  return count;
}

/** Build exact-text passage records for one canonical enacted section. */
export function researchPassagesForSection(section, body, { maximumCharacters = 2400 } = {}) {
  const maximum = Math.max(400, Math.min(12000, Number(maximumCharacters) || 2400));
  const metadata = sourceMetadata(section);
  if (!metadata.sectionID) throw new TypeError("A canonical section ID is required for passage indexing.");
  const passages = [];
  const blocks = (Array.isArray(body?.blocks) ? body.blocks : [])
    .filter(block => block?.researchClaimEligible !== false && String(block?.plainText || "").trim());
  const tableBlocks = blocks.filter(block => /<table\b/i.test(String(block.html || "")));
  const blockContexts = blockIndex => {
    const contexts = [];
    const first = blocks[0];
    if (blockIndex > 0 && first && String(first.plainText).length <= maximum && !/<table\b/i.test(String(first.html || ""))) {
      contexts.push(String(first.plainText));
    }
    // Some imports put exceptions or table notes in separate rendered blocks.
    // Retain those adjacent source blocks together; don't create a detached
    // list item that looks like an independently applicable rule.
    let exceptionRun = false;
    for (let position = blockIndex + 1; position < blocks.length; position += 1) {
      const candidate = String(blocks[position].plainText);
      const exception = /^\s*Exceptions?\s*:/i.test(candidate);
      const footnote = /^\s*(?:Footnotes?|For SI|Notes?)\s*:/i.test(candidate);
      const listItem = /^\s*(?:\d+[.)]|[a-z][.)])\s*/i.test(candidate);
      if (!(exception || footnote || (exceptionRun && listItem))) break;
      exceptionRun ||= exception;
      contexts.push(candidate);
    }
    return contexts;
  };
  const push = ({ block, blockIndex, start, end, subsectionNumber, passageTitle, kind = "text", completeText, scopeComplete, parentDescriptors = [], searchText = null, sourceHTML = null, atomicUnits = [], sameSectionReferences = [] }) => {
    const original = String(block.plainText);
    const text = original.slice(start, end);
    if (!text.trim()) return;
    const id = `${metadata.sectionID}:b${blockIndex}:${start}-${end}${kind === "table_row" ? `:r${passages.length}` : kind === "plain_text_table" ? ":table" : ""}`;
    const contexts = [...blockContexts(blockIndex), ...parentDescriptors.map(descriptor => descriptor.text)]
      .filter(value => value?.trim() && value !== text);
    // Tables are resolved in full, with their section's prose and footnotes.
    // Table-row hits use an exact whole-block text as the source to prevent a
    // lone rendered cell from becoming independent numerical authority.
    for (const other of tableBlocks) {
      if (other === block) continue;
      const tableReferences = String(other.html || "").match(/\bTable\s+[A-Z]?\d+(?:\.[0-9A-Za-z-]+)*/gi) || [];
      if (tableReferences.some(reference => text.includes(reference))) contexts.push(String(other.plainText));
    }
    passages.push({
      id, ...metadata,
      blockID: comparableID(block.id), blockIndex,
      subsectionNumber: subsectionNumber || metadata.sectionNumber,
      passageTitle: compact(passageTitle || metadata.title),
      parentTitle: metadata.title,
      kind, text,
      contextTexts: [...new Set(contexts)],
      parentSubsectionNumbers: parentDescriptors.map(descriptor => descriptor.number).filter(Boolean),
      scopeComplete: scopeComplete === true,
      completeSubsectionText: completeText || text,
      sourceOffsets: { blockID: comparableID(block.id), start, end },
      sourceTextHash: createHash("sha256").update(original).digest("hex"),
      sourceHTML,
      searchText: searchText ?? text,
      tableBlockIDs: tableBlocks.map(table => comparableID(table.id)),
      atomicUnits, sameSectionReferences
    });
  };

  for (const [blockIndex, block] of blocks.entries()) {
    const text = String(block.plainText);
    const headings = numberedHeadings(text, metadata.sectionNumber);
    const isTable = /<table\b/i.test(String(block.html || ""));
    if (headings.length > 0) {
      const descriptors = headings.map((heading, index) => {
        const next = headings[index + 1];
        const ownEnd = next?.start ?? text.length;
        const subtreeEnd = headings.slice(index + 1).find(candidate => !sameOrAncestorNumber(heading.number, candidate.number))?.start ?? text.length;
        return { ...heading, ownEnd, subtreeEnd, text: text.slice(heading.start, ownEnd) };
      });
      const intro = headings[0].start > 0 ? { text: text.slice(0, headings[0].start), number: metadata.sectionNumber } : null;
      const general = descriptors.find(descriptor => descriptor.number === `${metadata.sectionNumber}.1` && /^general\b/i.test(descriptor.title));
      const descriptorContexts = descriptor => [intro, general && general !== descriptor ? general : null,
        ...descriptors.filter(candidate => candidate !== descriptor && sameOrAncestorNumber(candidate.number, descriptor.number))]
        .filter(Boolean).filter((value, index, values) => values.findIndex(other => other.text === value.text) === index);
      const blockID = comparableID(block.id);
      const sourceTextHash = createHash("sha256").update(text).digest("hex");
      const dependencyRecords = new Map(descriptors.map(descriptor => [descriptor.number, {
        id: `${metadata.sectionID}:b${blockIndex}:${descriptor.start}-${descriptor.subtreeEnd}:reference`,
        ...metadata, blockID, blockIndex,
        kind: "same_section_reference", subsectionNumber: descriptor.number, passageTitle: descriptor.title,
        text: text.slice(descriptor.start, descriptor.subtreeEnd),
        completeSubsectionText: text.slice(descriptor.start, descriptor.subtreeEnd),
        contextTexts: descriptorContexts(descriptor).map(parent => parent.text),
        sourceOffsets: { blockID, start: descriptor.start, end: descriptor.subtreeEnd },
        sourceTextHash, scopeComplete: true, applicabilityUnresolved: true
      }]));
      if (intro?.text.trim()) {
        for (const range of textRanges(intro.text, maximum)) push({ block, blockIndex, ...range, scopeComplete: false, completeText: intro.text });
      }
      for (const descriptor of descriptors) {
        const contexts = descriptorContexts(descriptor);
        const completeText = text.slice(descriptor.start, descriptor.subtreeEnd);
        const atomicUnits = numberedListUnits(descriptor.text, descriptor.start, {
          subsectionNumber: descriptor.number, contextTexts: contexts.map(parent => parent.text), blockID, sourceTextHash
        });
        // Internal numbered references are available as candidates, not forced
        // into the parent's source packet. Branch alternatives can otherwise
        // consume the entire evidence budget and displace the decisive rule.
        const sameSectionReferences = [...referencedDescriptorNumbers(descriptor.text, metadata, descriptors)]
          .filter(number => number !== descriptor.number && !sameOrAncestorNumber(number, descriptor.number))
          .map(number => dependencyRecords.get(number));
        const ownRanges = textRanges(descriptor.text, maximum);
        for (const range of ownRanges) {
          push({
            block, blockIndex,
            start: descriptor.start + range.start, end: descriptor.start + range.end,
            subsectionNumber: descriptor.number, passageTitle: descriptor.title,
            kind: "numbered_subsection", completeText,
            scopeComplete: ownRanges.length === 1 && descriptor.ownEnd === descriptor.subtreeEnd,
            parentDescriptors: contexts, atomicUnits, sameSectionReferences
          });
        }
      }
    } else {
      const ranges = textRanges(text, maximum);
      for (const range of ranges) {
        push({ block, blockIndex, ...range, kind: isTable ? "table_context" : "text",
          completeText: text, scopeComplete: ranges.length === 1 });
      }
    }

    // PDF imports can retain complete published tables inside a monolithic
    // plain-text block. Index the whole table, including its caption, units
    // and notes; never fabricate cell associations from the flattened text.
    // Exact source offsets and the governing lead-in survive evidence assembly.
    if (!isTable && metadata.sectionNumber) {
      const markers = [...text.matchAll(/^TABLE ([A-Z]?\d+(?:\.[0-9A-Za-z-]+)*)[^\r\n]*$/gm)];
      const rules = headings.map(heading => ({index:heading.start}));
      for (const [position, marker] of markers.entries()) {
        const nextRule = rules.find(rule => rule.index > marker.index);
        const end = Math.min(nextRule?.index ?? text.length, markers[position + 1]?.index ?? text.length);
        // An unbounded/ambiguous extraction remains ordinary text rather than
        // masquerading as a complete table source.
        if (end - marker.index > 16000) continue;
        const precedingRule = rules.filter(rule => rule.index < marker.index).at(-1);
        const leadIn = precedingRule ? text.slice(precedingRule.index, marker.index) : "";
        const general = headings.find(heading => heading.number === `${metadata.sectionNumber}.1` && /^general\b/i.test(heading.title));
        const generalEnd = general ? headings.find(heading => heading.start > general.start)?.start ?? text.length : 0;
        const contexts = [leadIn, general ? text.slice(general.start, generalEnd) : ""]
          .filter(value => value.trim() && value.length <= 12000);
        push({ block, blockIndex, start: marker.index, end, kind: "plain_text_table",
          subsectionNumber: marker[1], passageTitle: `Table ${marker[1]} ${text.slice(marker.index + marker[0].length, end).trim().split("\n")[0]}`,
          completeText: text.slice(marker.index, end), scopeComplete: false,
          parentDescriptors: contexts.map(text => ({ text })) });
      }
    }

    if (isTable) {
      for (const tableMatch of String(block.html).matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)) {
        const rows = [...tableMatch[0].matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)];
        if (rows.length < 2) continue;
        const headerText = cleanHTML(rows[0][0]);
        for (const row of rows.slice(1)) {
          push({ block, blockIndex, start: 0, end: text.length,
            kind: "table_row", passageTitle: `${metadata.title} ${headerText}`,
            completeText: text, scopeComplete: true,
            searchText: `${headerText}\n${cleanHTML(row[0])}`, sourceHTML: row[0] });
        }
      }
    }
  }
  const publishedTables = passages.filter(passage => passage.kind === 'plain_text_table');
  for (const passage of passages) {
    if (passage.kind === 'plain_text_table') continue;
    for (const table of publishedTables) {
      const reference = new RegExp(`\\b(?:Table|Section)\\s+${escapeRegex(table.subsectionNumber)}(?![\\w-]|\\.[\\w-])`, 'i');
      if (!reference.test(passage.text) || passage.text.includes(table.text)) continue;
      // A source that delegates a numerical requirement to its published
      // table must retain that table's full scope, units and footnotes.
      passage.contextTexts = [...new Set([...passage.contextTexts, ...table.contextTexts, table.text])];
    }
  }
  return passages;
}

/**
 * Build once per authorized corpus/version combination, then cache it. Reading
 * is bounded and deterministic; a source-read error rejects the build rather
 * than quietly shipping an incomplete library. No model/provider calls occur.
 */
export async function buildResearchPassageIndex(catalog, readSectionBody, options = {}) {
  if (!Array.isArray(catalog) || typeof readSectionBody !== "function") throw new TypeError("Catalog and section-body reader are required.");
  const concurrency = Math.max(1, Math.min(32, Number(options.concurrency) || 8));
  const sections = new Map();
  for (const section of catalog) {
    const id = comparableID(section?.id ?? section?.sectionID);
    if (!id || sections.has(id)) throw new TypeError(`Missing or duplicate canonical section ID: ${id}`);
    sections.set(id, section);
  }
  const grouped = new Array(catalog.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, catalog.length) }, async () => {
    for (;;) {
      const position = cursor++;
      if (position >= catalog.length) return;
      const section = catalog[position];
      grouped[position] = researchPassagesForSection(section, await readSectionBody(section), options);
    }
  }));
  const passages = grouped.flat();
  const postings = new Map();
  const titlePostings = new Map();
  const records = passages.map((passage, ordinal) => {
    const body = frequencies(passage.searchText);
    const title = frequencies(`${passage.parentTitle} ${passage.passageTitle}`);
    for (const [term, count] of body.counts) {
      appendPosting(postings, term, ordinal, count);
    }
    for (const [term, count] of title.counts) {
      appendPosting(titlePostings, term, ordinal, count);
    }
    return { passage, bodyLength: body.length, titleLength: title.length };
  });
  return {
    version: researchPassageIndexVersion, records, passages,
    passagesByID: new Map(passages.map(passage => [passage.id, passage])),
    // Public posting lists are interleaved Uint32Arrays: [ordinal, frequency,
    // ordinal, frequency, ...]. Ordinals retain catalog/passage source order.
    postings: finishPostings(postings), titlePostings: finishPostings(titlePostings), sections,
    averageLength: records.reduce((sum, record) => sum + record.bodyLength, 0) / Math.max(1, records.length),
    sectionCount: sections.size, passageCount: records.length,
    fingerprint: passageFingerprint(passages)
  };
}

function mergedOffsetPostings(indexes, field) {
  const lengths = new Map();
  for (const index of indexes) {
    for (const [term, values] of index[field]) {
      if (!(values instanceof Uint32Array) || values.length % 2) {
        throw new TypeError("A compact passage posting list is required for merging.");
      }
      lengths.set(term, (lengths.get(term) || 0) + values.length);
    }
  }
  const merged = new Map([...lengths].map(([term, length]) => [term, new Uint32Array(length)]));
  const cursors = new Map();
  let ordinalOffset = 0;
  for (const index of indexes) {
    for (const [term, values] of index[field]) {
      const destination = merged.get(term);
      const start = cursors.get(term) || 0;
      let previous = -1;
      for (let position = 0; position < values.length; position += 2) {
        const ordinal = values[position];
        if (ordinal <= previous || ordinal >= index.records.length || values[position + 1] === 0) {
          throw new TypeError("Posting ordinals and frequencies must match their canonical passage index.");
        }
        destination[start + position] = ordinal + ordinalOffset;
        destination[start + position + 1] = values[position + 1];
        previous = ordinal;
      }
      cursors.set(term, start + values.length);
    }
    ordinalOffset += index.records.length;
  }
  return merged;
}

/**
 * Combine only the supplied authorized corpus partitions in their catalog
 * order. Passage/source records are shared; only cheap ordinal collections
 * and compact postings are new. This preserves a fresh combined index's BM25
 * statistics, ordering and fingerprint, unlike independently ranking corpora.
 * The caller determines authorization; this helper never loads another corpus.
 */
export function mergeResearchPassageIndexes(indexes) {
  if (!Array.isArray(indexes)) throw new TypeError("An ordered array of passage indexes is required.");
  const sections = new Map();
  const records = [];
  const passages = [];
  for (const index of indexes) {
    if (index?.version !== researchPassageIndexVersion || !Array.isArray(index.records) ||
        !Array.isArray(index.passages) || index.records.length !== index.passages.length ||
        !(index.sections instanceof Map) || !(index.postings instanceof Map) || !(index.titlePostings instanceof Map)) {
      throw new TypeError("Compatible canonical passage indexes are required for merging.");
    }
    for (const [id, section] of index.sections) {
      if (!id || comparableID(section?.id ?? section?.sectionID) !== id || sections.has(id)) {
        throw new TypeError(`Missing or duplicate canonical section ID: ${id}`);
      }
      sections.set(id, section);
    }
    for (const [position, record] of index.records.entries()) {
      const passage = record?.passage;
      const section = index.sections.get(passage?.sectionID);
      if (passage !== index.passages[position] || !section ||
          passage.corpusID !== (section.corpusID ?? null) ||
          passage.codeVersion !== (section.codeVersion ?? null) ||
          passage.codeEdition !== (section.codeEdition ?? null) ||
          !Number.isSafeInteger(record.bodyLength) || record.bodyLength < 0 ||
          !Number.isSafeInteger(record.titleLength) || record.titleLength < 0) {
        throw new TypeError("Passage records must retain their canonical source and corpus identity.");
      }
      records.push(record);
      passages.push(passage);
    }
  }
  if (records.length > 0xffffffff) throw new RangeError("Merged passage count exceeds Uint32 storage.");
  // Reusing a single partition also preserves semantic alignment caches keyed
  // by live-index identity; no duplicate source arrays/postings are necessary.
  if (indexes.length === 1) return indexes[0];
  const passagesByID = new Map(passages.map(passage => [passage.id, passage]));
  if (passagesByID.size !== passages.length) throw new TypeError("Duplicate canonical passage ID while merging.");
  return {
    version: researchPassageIndexVersion, records, passages, passagesByID, sections,
    postings: mergedOffsetPostings(indexes, "postings"),
    titlePostings: mergedOffsetPostings(indexes, "titlePostings"),
    averageLength: records.reduce((sum, record) => sum + record.bodyLength, 0) / Math.max(1, records.length),
    sectionCount: sections.size, passageCount: records.length,
    fingerprint: passageFingerprint(passages)
  };
}

function queryWeights(query, suppliedWeights) {
  const weights = new Map();
  const original = suppliedWeights instanceof Map ? suppliedWeights : suppliedWeights && typeof suppliedWeights === "object" ? Object.entries(suppliedWeights) : tokens(query).map(token => [token, 1]);
  for (const [value, weight] of original) {
    const numeric = Number(weight);
    if (!Number.isFinite(numeric) || numeric <= 0) continue;
    for (const token of tokens(value)) for (const key of tokenKeys(token)) weights.set(key, Math.max(weights.get(key) || 0, numeric));
  }
  return weights;
}

function explicitReferences(query) {
  return [...String(query || "").matchAll(/\b(AC|BC|BC68|EBC|ECC|EC|FC|FGC|MC|PC|ZR)\s*(?:§\s*)?([A-Z]?\d+(?:-\d+)?(?:\.[0-9A-Za-z-]+)*)/gi)]
    .map(match => ({ codePrefix: match[1].toUpperCase(), number: match[2].replace(/\.$/, "") }));
}

/** Return distinct canonical-section hits, retaining their best exact passages. */
export function searchResearchPassages(index, query, options = {}) {
  if (!index?.records || !index?.postings) throw new TypeError("A research passage index is required.");
  const limit = Math.max(1, Math.min(200, Number(options.limit) || 60));
  const perSection = Math.max(1, Math.min(8, Number(options.passagesPerSection) || 3));
  // Family probes share the authorized index and global BM25 statistics.
  // Filter before the shortlist cap; the ordinary cross-code search is intact.
  const prefixes = options.codePrefixes == null ? null : new Set(
    [...options.codePrefixes].map(prefix => String(prefix).toUpperCase())
  );
  const eligible = ordinal => !prefixes || prefixes.has(index.records[ordinal].passage.codePrefix);
  const weights = queryWeights(query, options.queryWeights);
  // Inherited citations can supply lexical context without acquiring the
  // current user's explicit-reference priority. Existing callers retain the
  // original query behavior unless they supply a separate current question.
  const references = explicitReferences(options.explicitReferenceQuery ?? query);
  const scores = new Map();
  const matches = new Map();
  const count = index.records.length;
  const averageLength = Math.max(1, index.averageLength);
  const recordMatch = (ordinal, term) => {
    if (!matches.has(ordinal)) matches.set(ordinal, new Set());
    matches.get(ordinal).add(term);
  };
  for (const [term, weight] of weights) {
    const bodyPosting = index.postings.get(term) || [];
    const titlePosting = index.titlePostings.get(term) || [];
    const documentFrequency = postingDocumentFrequency(bodyPosting, titlePosting);
    if (!documentFrequency) continue;
    const inverseFrequency = Math.log(1 + (count - documentFrequency + 0.5) / (documentFrequency + 0.5));
    for (let offset = 0; offset < bodyPosting.length; offset += 2) {
      const ordinal = bodyPosting[offset];
      if (!eligible(ordinal)) continue;
      const frequency = bodyPosting[offset + 1];
      const length = index.records[ordinal].bodyLength;
      const bm25 = frequency * 2.2 / (frequency + 1.2 * (0.25 + 0.75 * length / averageLength));
      scores.set(ordinal, (scores.get(ordinal) || 0) + weight * inverseFrequency * bm25);
      recordMatch(ordinal, term);
    }
    for (let offset = 0; offset < titlePosting.length; offset += 2) {
      const ordinal = titlePosting[offset];
      if (!eligible(ordinal)) continue;
      const frequency = titlePosting[offset + 1];
      scores.set(ordinal, (scores.get(ordinal) || 0) + weight * inverseFrequency * (1.25 * frequency / (frequency + 1)));
      recordMatch(ordinal, term);
    }
  }
  const exact = new Set();
  for (const [ordinal, record] of index.records.entries()) {
    if (!eligible(ordinal)) continue;
    if (references.some(reference => reference.codePrefix === record.passage.codePrefix && reference.number === record.passage.subsectionNumber)) {
      exact.add(ordinal);
      scores.set(ordinal, (scores.get(ordinal) || 0) + 100);
    }
  }
  const grouped = new Map();
  for (const [ordinal, score] of scores) {
    if (score <= 0) continue;
    const record = index.records[ordinal];
    const passage = record.passage;
    const hit = { ...passage, score, exactReference: exact.has(ordinal), matchedTerms: [...(matches.get(ordinal) || [])], ordinal };
    if (!grouped.has(passage.sectionID)) grouped.set(passage.sectionID, []);
    grouped.get(passage.sectionID).push(hit);
  }
  const hitOrder = (left, right) => Number(right.exactReference) - Number(left.exactReference) || right.score - left.score || left.ordinal - right.ordinal;
  return [...grouped.values()].map(hits => {
    hits.sort(hitOrder);
    const best = hits[0];
    // Duplicated table rows or many loosely relevant subsections must not
    // inflate a chapter's score merely because it is a much larger source.
    const selected = [];
    const seen = new Set();
    for (const hit of hits) {
      const key = `${hit.blockID}:${hit.sourceOffsets.start}:${hit.sourceOffsets.end}`;
      if (seen.has(key)) continue;
      seen.add(key);
      selected.push(hit);
      if (selected.length >= perSection) break;
    }
    return { ...best, passages: selected };
  }).sort(hitOrder).slice(0, limit);
}
