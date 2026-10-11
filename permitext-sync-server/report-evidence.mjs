import { reportCommentKey } from "./public/project-workflow.js";
import { createHash } from "node:crypto";
import { parseFragment } from "parse5";

function text(value, label, maximum = 1024, required = false) {
  const result = String(value ?? "").trim();
  if ((required && !result) || result.length > maximum) throw new Error(`Invalid ${label}.`);
  return result;
}

export function normalizeSavedExportSelections(items) {
  if (!Array.isArray(items) || !items.length || items.length > 50) {
    throw new Error("Select between 1 and 50 saved items to export.");
  }
  return items.map(item => {
    const notes = item?.notes ?? [];
    if (!Array.isArray(notes) || notes.length > 100) throw new Error("Select fewer notes for this export.");
    return {
      sectionID: text(item?.sectionID, "section ID", 256, true),
      codeVersion: text(item?.codeVersion, "code edition", 1024, true),
      blockID: text(item?.blockID, "paragraph ID", 256),
      notes: notes.map(note => ({
        blockID: text(note.blockID, "note paragraph ID", 256),
        label: text(note.label, "note label", 500),
        body: text(note.body, "note text", 20_000, true)
      }))
    };
  });
}

const attributes = node => Object.fromEntries((node.attrs || []).map(attr => [attr.name, attr.value]));
function findNode(node, id) {
  if (attributes(node).id === id) return node;
  for (const child of node.childNodes || []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function tableGrid(table) {
  const rows = [];
  const collect = node => {
    if (node !== table && node.tagName === "table") throw new Error("Nested tables are not supported by this text export.");
    if (node.tagName === "tr") rows.push(node);
    else (node.childNodes || []).forEach(collect);
  };
  collect(table);
  const grid = [];
  rows.forEach((row, rowIndex) => {
    grid[rowIndex] ||= [];
    let column = 0;
    for (const cell of row.childNodes || []) {
      if (!["td", "th"].includes(cell.tagName)) continue;
      while (grid[rowIndex][column] !== undefined) column++;
      const attrs = attributes(cell);
      const columnSpan = Number(attrs.colspan || 1);
      const rowSpan = Number(attrs.rowspan || 1);
      if (![columnSpan, rowSpan].every(value => Number.isInteger(value) && value >= 1 && value <= 100)) {
        throw new Error("This table layout is not supported by this text export.");
      }
      const value = (cell.childNodes || []).map(nodeText).join("").replace(/\s+/g, " ").trim();
      for (let r = rowIndex; r < rowIndex + rowSpan; r++) {
        grid[r] ||= [];
        for (let c = column; c < column + columnSpan; c++) grid[r][c] = value;
      }
      column += columnSpan;
    }
  });
  // Repeat spanning headers/cells so each text row retains its column basis.
  return grid.map(row => row.map(value => value || "")).filter(row => row.some(Boolean));
}

// Reader HTML may contain a separate sticky header copy. Omit it only when
// the actual body table repeats exactly the same opening rows.
function isRepeatedTableHeader(node) {
  if (!String(attributes(node).class || "").split(/\s+/).includes("xsl-table--header")) return false;
  const findTable = root => root?.tagName === "table" ? root : (root?.childNodes || []).map(findTable).find(Boolean);
  const header = findTable(node);
  const body = (node.parentNode?.childNodes || []).find(sibling => String(attributes(sibling).class || "").split(/\s+/).includes("xsl-table--body"));
  const actual = findTable(body);
  if (!header || !actual) return false;
  const rows = tableGrid(header), actualRows = tableGrid(actual);
  return rows.length > 0 && JSON.stringify(rows) === JSON.stringify(actualRows.slice(0, rows.length));
}

function tableText(table) { return tableGrid(table).map(row => row.join(" | ")).join("\n"); }
function selectedTables(body, blockID) {
  const tables = [];
  const visit = node => {
    if (isRepeatedTableHeader(node)) return;
    if (node.tagName === "table") {
      const rows = tableGrid(node);
      tables.push({ text: rows.map(row => row.join(" | ")).join("\n"), rows });
      return;
    }
    (node.childNodes || []).forEach(visit);
  };
  for (const block of body.blocks || []) {
    if (!block.html) continue;
    const root = parseFragment(block.html);
    const node = blockID && String(block.id || block.tableID || "") !== blockID ? findNode(root, blockID) : root;
    if (node) visit(node);
  }
  return tables;
}

// Retain row/cell boundaries in a text export instead of concatenating table
// values into an ambiguous single sentence. Never use a Saved preview here.
function nodeText(node) {
  if (isRepeatedTableHeader(node)) return "";
  if (node.nodeName === "#text") return node.value;
  if (["script", "style"].includes(node.tagName)) return "";
  if (node.tagName === "img") {
    throw new Error("This selection contains a figure. Export its text separately; figures are not supported by this PDF export yet.");
  }
  if (node.tagName === "table") return `\n${tableText(node)}\n`;
  const content = (node.childNodes || []).map(nodeText).join("");
  if (["td", "th"].includes(node.tagName)) return `${content.trim()} | `;
  if (["p", "div", "tr", "li", "table", "h1", "h2", "h3", "h4"].includes(node.tagName)) return `${content}\n`;
  if (node.tagName === "br") return "\n";
  if (node.tagName === "sup") return ` ${content}`;
  return content;
}

function selectedSourceHasTables(body, blockID) {
  const containsTable = node => node.tagName === "table" || (node.childNodes || []).some(containsTable);
  return (body.blocks || []).some(block => {
    if (!block.html) return false;
    const root = parseFragment(block.html);
    const node = blockID && String(block.id || block.tableID || "") !== blockID ? findNode(root, blockID) : root;
    return Boolean(node && containsTable(node));
  });
}

function exportBlockText(block, blockID = "") {
  if (blockID && !block.html && String(block.id || block.tableID || block.imageID || "") !== blockID) return null;
  if (block.kind === "image") {
    throw new Error("This selection contains a figure. Export its text separately; figures are not supported by this PDF export yet.");
  }
  if (block.html) {
    const root = parseFragment(block.html);
    const node = blockID && String(block.id || block.tableID || "") !== blockID
      ? findNode(root, blockID) : root;
    if (!node) return null;
    return nodeText(node).replace(/[ \t]+/g, " ").replace(/ *\| *\n/g, "\n")
      .replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  return String(block.plainText || block.text || "").trim();
}

export function savedExportSourceText(body, blockID = "") {
  const blocks = Array.isArray(body?.blocks) ? body.blocks : [];
  if (blockID) {
    for (const block of blocks) {
      const result = exportBlockText(block, blockID);
      if (result !== null && result) return result;
    }
    throw new Error("The selected paragraph is no longer available. Reopen the source and select it again.");
  }
  const result = blocks.map(block => exportBlockText(block)).filter(Boolean).join("\n\n");
  if (!result) throw new Error("The complete source text is unavailable. Reopen the source and try again.");
  return result;
}

function fullTextChunks(value, maximum = 45_000) {
  const chunks = [];
  let remaining = value;
  while (remaining.length > maximum) {
    const boundary = Math.max(remaining.lastIndexOf("\n", maximum), remaining.lastIndexOf(" ", maximum));
    if (boundary < 1) throw new Error("The source contains an unsupported oversized text block.");
    chunks.push(remaining.slice(0, boundary));
    remaining = remaining.slice(boundary).trimStart();
  }
  chunks.push(remaining);
  return chunks;
}

export async function prepareSavedEvidenceItems({ selections, resolveSource }) {
  const items = [];
  const sources = [];
  let characterCount = 0;
  for (const selection of normalizeSavedExportSelections(selections)) {
    const { section, body, source } = await resolveSource(selection);
    if (!section || !source || source.canonicalEdition !== selection.codeVersion) {
      throw new Error("The selected source does not match its saved code edition. Reopen the source and try again.");
    }
    const passageText = savedExportSourceText(body, selection.blockID);
    characterCount += passageText.length + selection.notes.reduce((total, note) => total + note.body.length, 0);
    if (characterCount > 1_000_000) throw new Error("This export is too large. Select fewer items and try again.");
    const sourceIndex = sources.length;
    sources.push({
      sectionID: String(section.id), blockID: selection.blockID,
      codeVersion: selection.codeVersion, codePrefix: section.codePrefix,
      codeEdition: source.editionLabel, categoryLabel: source.categoryLabel,
      sectionNumber: section.sectionNumber, title: section.title,
      hasTables: selectedSourceHasTables(body, selection.blockID),
      passageTextHash: createHash("sha256").update(passageText).digest("hex")
    });
    const chunks = fullTextChunks(passageText);
    const tables = selectedTables(body, selection.blockID);
    const sectionTitle = String(section.title || "Section");
    const titlePrefix = `${section.sectionNumber} `;
    const title = sectionTitle.startsWith(titlePrefix) ? sectionTitle.slice(titlePrefix.length) : sectionTitle;
    chunks.forEach((chunk, index) => items.push({
      id: `evidence-${sourceIndex}-${index}`, kind: "evidence",
      sectionID: String(section.id), sectionNumber: section.sectionNumber,
      codeBook: section.codePrefix, codeEdition: source.editionLabel,
      chapter: String(section.chapterNumber || "unknown"),
      title: `${title}${selection.blockID ? " · Selected paragraph" : ""}${chunks.length > 1 ? ` · Part ${index + 1} of ${chunks.length}` : ""}`,
      passageText: chunk, tables: tables.filter(table => chunk.includes(table.text)), passageTextHash: createHash("sha256").update(chunk).digest("hex"),
      sourceLibraryVersion: selection.codeVersion
    }));
    const notes = new Set();
    selection.notes.forEach((note, index) => {
      const key = JSON.stringify([note.blockID, note.body]);
      if (notes.has(key)) return;
      notes.add(key);
      items.push({ id: `note-label-${sourceIndex}-${index}`, kind: "heading",
        reportCommentKey: reportCommentKey(note), presentationRole: "comment", text: `Your comment · ${section.codePrefix} § ${section.sectionNumber}${note.label ? ` · ${note.label}` : ""}` });
      items.push({ id: `note-${sourceIndex}-${index}`, kind: "paragraph", reportCommentKey: reportCommentKey(note), text: note.body });
    });
  }
  return { items, sources };
}

// Stable source identities preserve existing whole-section draft references.
// A saved paragraph has its own identity and never expands into its section.
export function reportSavedSourceID(record) {
  const blockID = record.scope === "section" ? "" : String(record.blockID || "").trim();
  return blockID ? `${record.sectionID}-passage-${createHash("sha256").update(blockID).digest("hex").slice(0, 16)}` : String(record.sectionID);
}

export function reportSavedSelection(record, annotations = [], savedItems = []) {
  const blockID = record.scope === "section" ? "" : String(record.blockID || "").trim();
  const sameSource = candidate => !candidate.deletedAt &&
    String(candidate.sectionID) === String(record.sectionID) && candidate.codeVersion === record.codeVersion;
  const matching = annotations.filter(note => sameSource(note) &&
    (!blockID || String(note.blockID || "").trim() === blockID));
  const notes = matching.filter(note => String(note.noteBody || "").trim()).map(note => ({
    blockID: String(note.blockID || "").trim(), label: note.blockID ? "Passage comment" : "Section comment", body: note.noteBody
  }));
  // A current empty/deleted annotation is authoritative over legacy Saved text.
  const annotationTargets = new Set(annotations.filter(note =>
    String(note.sectionID) === String(record.sectionID) && note.codeVersion === record.codeVersion && note.noteBody !== undefined
  ).map(note => String(note.blockID || "").trim()));
  savedItems.filter(item => sameSource(item) && (!blockID || String(item.blockID || "").trim() === blockID)).forEach(item => {
    const noteBlockID = String(item.blockID || "").trim();
    if (!annotationTargets.has(noteBlockID) && String(item.noteBody || "").trim()) notes.push({
      blockID: noteBlockID, label: noteBlockID ? "Passage comment" : "Section comment", body: item.noteBody
    });
  });
  return { sectionID: String(record.sectionID), codeVersion: record.codeVersion, blockID, notes };
}
