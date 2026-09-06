import {
  emptyNotebookDocument as emptyVersionedNotebookDocument,
  notebookBlockTypes,
  notebookDocumentFormat,
  notebookReferenceKinds,
  notebookSchemaName,
  notebookSchemaVersion,
  plainTextToBlockNote,
  tiptapDocumentToBlockNote
} from "./src/notebook-schema.js";
import { createHash } from "node:crypto";

export { notebookSchemaName, notebookSchemaVersion };

export const notebookCardTypes = Object.freeze([
  "question",
  "finding",
  "assumption",
  "missing-information",
  "decision",
  "coordination-item",
  "review-task"
]);

const notebookCardTypeSet = new Set(notebookCardTypes);
const referenceKindSet = new Set(notebookReferenceKinds);
const blockTypeSet = new Set(notebookBlockTypes);
const inlineBlockTypes = new Set([
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem"
]);
const maximumNotebookTextLength = 50_000;
const maximumNotebookJSONLength = 500_000;
const maximumNotebookBlocks = 500;
const maximumNotebookDepth = 8;
const permittedStyleNames = new Set(["bold", "italic"]);
const notebookEvidenceRoles = new Set(["context", "supports", "conflicts", "unresolved"]);
const maximumNotebookEvidenceLinks = 100;
const maximumNotebookEvidencePassages = 24;

function requiredText(value, label, maximum = 500) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maximum) {
    throw new Error(`Invalid ${label}.`);
  }
  return normalized;
}

function optionalText(value, label, maximum = 500) {
  const normalized = String(value || "");
  if (normalized.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(normalized)) {
    throw new Error(`Invalid ${label}.`);
  }
  return normalized;
}

function optionalInteger(value, label) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new Error(`Invalid ${label}.`);
  }
  return normalized;
}

function normalizedEvidenceText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function canonicalNotebookEvidencePassage(passage) {
  const exact = requiredText(
    passage?.exact || passage?.selectedText,
    "Notebook evidence passage",
    50_000
  );
  const normalizedExact = normalizedEvidenceText(exact);
  const start = optionalInteger(passage?.start, "Notebook evidence start offset");
  const end = optionalInteger(passage?.end, "Notebook evidence end offset");
  if ((start === null) !== (end === null) || (start !== null && end < start)) {
    throw new Error("Invalid Notebook evidence passage offsets.");
  }
  return {
    exact,
    normalizedExact,
    prefix: optionalText(passage?.prefix, "Notebook evidence prefix", 500),
    suffix: optionalText(passage?.suffix, "Notebook evidence suffix", 500),
    start,
    end,
    exactHash: createHash("sha256").update(normalizedExact).digest("hex")
  };
}

export function normalizeNotebookEvidenceLinks(input) {
  const links = Array.isArray(input) ? input : [];
  if (links.length > maximumNotebookEvidenceLinks) {
    throw new Error(`Notebook cards are limited to ${maximumNotebookEvidenceLinks} evidence links.`);
  }
  const seen = new Set();
  return links.map((link) => {
    const id = requiredText(link?.id, "Notebook evidence link ID", 256);
    if (seen.has(id)) throw new Error("Notebook evidence link IDs must be unique.");
    seen.add(id);
    const relationshipRole = String(link?.relationshipRole || "context").trim();
    if (!notebookEvidenceRoles.has(relationshipRole)) {
      throw new Error("Unsupported Notebook evidence relationship.");
    }
    const source = link?.source || {};
    const passages = (Array.isArray(link?.passages) ? link.passages : [])
      .map(canonicalNotebookEvidencePassage);
    if (!passages.length || passages.length > maximumNotebookEvidencePassages) {
      throw new Error("Notebook evidence links require 1 to 24 passages.");
    }
    return {
      id,
      label: optionalText(link?.label, "Notebook evidence label", 1_000),
      relationshipRole,
      projectID: optionalText(link?.projectID, "Notebook evidence Project ID", 256),
      notebookCardID: optionalText(link?.notebookCardID, "Notebook evidence Note ID", 256),
      source: {
        jurisdiction: optionalText(source.jurisdiction || "New York City", "Notebook evidence jurisdiction", 256),
        codePrefix: requiredText(source.codePrefix, "Notebook evidence code", 64),
        codeEdition: optionalText(source.codeEdition || "2022", "Notebook evidence edition", 256),
        codeVersion: optionalText(source.codeVersion, "Notebook evidence code version", 1_024),
        sourceID: requiredText(source.sourceID || source.sectionID, "Notebook evidence source ID", 256),
        sectionID: requiredText(source.sectionID, "Notebook evidence section ID", 256),
        sectionNumber: requiredText(source.sectionNumber, "Notebook evidence section number", 256),
        sectionTitle: requiredText(source.sectionTitle || source.title || "Section", "Notebook evidence section title", 1_000),
        sourceLibraryVersion: optionalText(source.sourceLibraryVersion || source.codeVersion, "Notebook evidence source-library version", 1_024)
      },
      passages,
      createdAt: requiredText(link?.createdAt, "Notebook evidence creation date", 64),
      noteTarget: link?.noteTarget && typeof link.noteTarget === "object" && !Array.isArray(link.noteTarget)
        ? {
            scope: optionalText(link.noteTarget.scope || "card", "Notebook evidence Note scope", 64),
            blockID: optionalText(link.noteTarget.blockID, "Notebook evidence Note block", 256),
            exact: optionalText(link.noteTarget.exact, "Notebook evidence Note text", 5_000)
          }
        : { scope: "card", blockID: "", exact: "" }
    };
  });
}

function canonicalColor(value, label) {
  const normalized = optionalText(value || "default", label, 64);
  if (!/^[#(),.%\sa-zA-Z0-9_-]+$/.test(normalized)) {
    throw new Error(`Invalid ${label}.`);
  }
  return normalized;
}

function canonicalStyles(styles) {
  if (!styles) return {};
  if (typeof styles !== "object" || Array.isArray(styles)) {
    throw new Error("Notebook text styles are invalid.");
  }
  const canonical = {};
  for (const [name, value] of Object.entries(styles)) {
    if (!permittedStyleNames.has(name)) {
      throw new Error("Notebook text uses an unsupported style.");
    }
    if (value === true) {
      canonical[name] = true;
    } else if (value !== false) {
      throw new Error("Notebook text styles are invalid.");
    }
  }
  return canonical;
}

function addTextLength(state, text) {
  state.textLength += text.length;
  if (state.textLength > maximumNotebookTextLength) {
    throw new Error("Notebook card text is too long.");
  }
}

function canonicalTextInline(node, state) {
  const text = optionalText(node?.text, "Notebook text", maximumNotebookTextLength);
  addTextLength(state, text);
  return { type: "text", text, styles: canonicalStyles(node?.styles) };
}

function canonicalReferenceInline(node, state) {
  const referenceKind = requiredText(node?.props?.referenceKind, "Notebook reference kind", 64);
  if (!referenceKindSet.has(referenceKind)) {
    throw new Error("Notebook reference kind is unsupported.");
  }
  const referenceID = requiredText(node?.props?.referenceID, "Notebook reference ID", 256);
  const label = requiredText(node?.props?.label, "Notebook reference label", 500);
  state.references.push({ referenceKind, referenceID, label });
  addTextLength(state, label);
  return {
    type: "permitextReference",
    props: { referenceKind, referenceID, label }
  };
}

function canonicalLinkInline(node, state) {
  const href = optionalText(node?.href, "Notebook link", 2_000).trim();
  let parsed;
  try {
    parsed = new URL(href);
  } catch {
    throw new Error("Notebook links require a valid URL.");
  }
  if (!["https:", "http:", "mailto:"].includes(parsed.protocol)) {
    throw new Error("Notebook links use an unsupported protocol.");
  }
  const content = Array.isArray(node?.content) ? node.content : [];
  return {
    type: "link",
    href,
    content: content.map((child) => {
      if (child?.type !== "text") throw new Error("Notebook links may contain text only.");
      return canonicalTextInline(child, state);
    })
  };
}

function canonicalInlineContent(content, state) {
  if (!Array.isArray(content)) return [];
  return content.map((node) => {
    if (node?.type === "text") return canonicalTextInline(node, state);
    if (node?.type === "link") return canonicalLinkInline(node, state);
    if (node?.type === "permitextReference") return canonicalReferenceInline(node, state);
    throw new Error("Notebook blocks contain unsupported inline content.");
  });
}

function canonicalBlockProps(type, props = {}) {
  if (!props || typeof props !== "object" || Array.isArray(props)) {
    throw new Error("Notebook block properties are invalid.");
  }
  const common = () => ({
    backgroundColor: "default",
    textColor: "default",
    textAlignment: "left"
  });
  if (type === "paragraph" || type === "bulletListItem") return common();
  if (type === "numberedListItem") {
    const canonical = common();
    if (props.start !== undefined) {
      if (!Number.isInteger(props.start) || props.start < 1 || props.start > 100_000) {
        throw new Error("Notebook numbered-list start is invalid.");
      }
      canonical.start = props.start;
    }
    return canonical;
  }
  if (type === "heading") {
    const level = Number(props.level || 1);
    if (!Number.isInteger(level) || level < 1 || level > 6) {
      throw new Error("Notebook heading level is unsupported.");
    }
    return { ...common(), level, isToggleable: false };
  }
  if (type === "image") {
    const url = optionalText(props.url, "Notebook image URL", 2_500).trim();
    if (url && !url.startsWith("permitext-notebook-asset:") && !/^https:\/\//i.test(url)) {
      throw new Error("Notebook images require a Permitext asset or HTTPS URL.");
    }
    const canonical = {
      textAlignment: "left",
      backgroundColor: "default",
      name: optionalText(props.name, "Notebook image name", 300),
      url,
      caption: optionalText(props.caption, "Notebook image caption", 1_000),
      showPreview: props.showPreview !== false
    };
    if (props.previewWidth !== undefined) {
      const previewWidth = Number(props.previewWidth);
      if (!Number.isFinite(previewWidth) || previewWidth < 32 || previewWidth > 4_000) {
        throw new Error("Notebook image width is invalid.");
      }
      canonical.previewWidth = Math.round(previewWidth);
    }
    return canonical;
  }
  throw new Error("Notebook block properties are unsupported.");
}

function canonicalBlock(node, state, depth = 0) {
  if (depth > maximumNotebookDepth) throw new Error("Notebook blocks are nested too deeply.");
  if (!node || !blockTypeSet.has(node.type)) {
    throw new Error("Notebook document contains an unsupported block.");
  }
  state.blockCount += 1;
  if (state.blockCount > maximumNotebookBlocks) throw new Error("Notebook document has too many blocks.");
  const block = {
    ...(node.id ? { id: requiredText(node.id, "Notebook block ID", 128) } : {}),
    type: node.type,
    props: canonicalBlockProps(node.type, node.props),
    children: (Array.isArray(node.children) ? node.children : [])
      .map((child) => canonicalBlock(child, state, depth + 1))
  };
  if (node.type === "image" && block.props.url?.startsWith("permitext-notebook-asset:")) {
    state.imageAssets.push(block.props.url.slice("permitext-notebook-asset:".length));
  }
  if (inlineBlockTypes.has(node.type)) block.content = canonicalInlineContent(node.content, state);
  return block;
}

export function emptyNotebookDocument() {
  return emptyVersionedNotebookDocument();
}

export function migrateNotebookDocument(input) {
  if (typeof input === "string") {
    return {
      ...emptyVersionedNotebookDocument(),
      document: plainTextToBlockNote(input),
      migratedFromSchemaVersion: 0
    };
  }
  if (input?.schemaVersion === 0 && typeof input.plainText === "string") {
    return {
      ...emptyVersionedNotebookDocument(),
      document: plainTextToBlockNote(input.plainText),
      migratedFromSchemaVersion: 0
    };
  }
  if (
    input?.schema === notebookSchemaName &&
    input?.schemaVersion === 1 &&
    input?.format === "tiptap-json"
  ) {
    return {
      ...emptyVersionedNotebookDocument(),
      document: tiptapDocumentToBlockNote(input.document),
      migratedFromSchemaVersion: 1
    };
  }
  return input;
}

export function validateNotebookDocument(input) {
  const migrated = migrateNotebookDocument(input);
  if (
    !migrated ||
    migrated.schema !== notebookSchemaName ||
    migrated.schemaVersion !== notebookSchemaVersion ||
    migrated.format !== notebookDocumentFormat ||
    !Array.isArray(migrated.document)
  ) {
    throw new Error("Notebook document schema is unsupported.");
  }
  if (JSON.stringify(migrated).length > maximumNotebookJSONLength) {
    throw new Error("Notebook card document is too large.");
  }
  if (!migrated.document.length) throw new Error("Notebook documents require a block.");
  const state = { textLength: 0, blockCount: 0, references: [], imageAssets: [] };
  const canonical = {
    schema: notebookSchemaName,
    schemaVersion: notebookSchemaVersion,
    format: notebookDocumentFormat,
    document: migrated.document.map((block) => canonicalBlock(block, state)),
    ...([0, 1].includes(migrated.migratedFromSchemaVersion)
      ? { migratedFromSchemaVersion: migrated.migratedFromSchemaVersion }
      : {})
  };
  return {
    document: canonical,
    references: state.references,
    imageAssets: Array.from(new Set(state.imageAssets))
  };
}

function inlinePlainText(content) {
  const nodes = Array.isArray(content) ? content : [];
  return nodes.reduce((result, node, index) => {
    const value = node.type === "text" ? node.text
      : node.type === "link" ? inlinePlainText(node.content)
      : node.type === "permitextReference" ? node.props.label : "";
    if (!value) return result;
    // Reference chips have visual boundaries that concatenated plain text loses.
    // Preserve authored text exactly, adding a separator only at chip edges.
    const touchesReference = node.type === "permitextReference" ||
      nodes[index - 1]?.type === "permitextReference";
    const separator = touchesReference && /\S$/.test(result) && /^\S/.test(value) &&
      !/^[,.;:!?)]/.test(value) ? " " : "";
    return result + separator + value;
  }, "");
}

function blockPlainText(block, depth = 0) {
  let text = "";
  if (block.type === "image") {
    text = block.props.caption || block.props.name || "Image";
  } else {
    text = inlinePlainText(block.content);
  }
  const children = block.children.map((child) => blockPlainText(child, depth + 1)).filter(Boolean);
  return [text, ...children.map((child) => `${"  ".repeat(depth + 1)}${child}`)]
    .filter(Boolean)
    .join("\n");
}

export function notebookPlainText(input) {
  const { document } = validateNotebookDocument(input);
  return document.document.map((block) => blockPlainText(block)).filter(Boolean).join("\n\n").trim();
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInlineHTML(content) {
  return (Array.isArray(content) ? content : []).map((node) => {
    if (node.type === "permitextReference") {
      return `<span class="notebook-reference-chip" data-permitext-reference="true" data-reference-kind="${escapeHTML(node.props.referenceKind)}" data-reference-id="${escapeHTML(node.props.referenceID)}" data-reference-label="${escapeHTML(node.props.label)}">${escapeHTML(node.props.label)}</span>`;
    }
    if (node.type === "link") {
      return `<a href="${escapeHTML(node.href)}">${renderInlineHTML(node.content)}</a>`;
    }
    let html = escapeHTML(node.text);
    if (node.styles.bold) html = `<strong>${html}</strong>`;
    if (node.styles.italic) html = `<em>${html}</em>`;
    return html;
  }).join("");
}

function renderBlockHTML(block) {
  const children = block.children.map(renderBlockHTML).join("");
  const content = renderInlineHTML(block.content);
  if (block.type === "heading") return `<h${block.props.level}>${content}</h${block.props.level}>${children}`;
  if (block.type === "bulletListItem") return `<ul><li>${content}${children}</li></ul>`;
  if (block.type === "numberedListItem") return `<ol${block.props.start ? ` start="${block.props.start}"` : ""}><li>${content}${children}</li></ol>`;
  if (block.type === "image") {
    if (!block.props.url) return children;
    const caption = block.props.caption ? `<figcaption>${escapeHTML(block.props.caption)}</figcaption>` : "";
    const image = block.props.url.startsWith("https://")
      ? `<img src="${escapeHTML(block.props.url)}" alt="${escapeHTML(block.props.caption || block.props.name || "Notebook image")}">`
      : `<span data-notebook-image-asset="${escapeHTML(block.props.url)}">${escapeHTML(block.props.name || "Notebook image")}</span>`;
    return `<figure>${image}${caption}</figure>${children}`;
  }
  return `<p>${content}</p>${children}`;
}

export function renderNotebookDocumentHTML(input) {
  const { document } = validateNotebookDocument(input);
  return document.document.map(renderBlockHTML).join("");
}

export function notebookManifestItem({ cardID, cardType, title, document }) {
  const normalizedCardType = requiredText(cardType, "Notebook card type", 64);
  if (!notebookCardTypeSet.has(normalizedCardType)) {
    throw new Error("Notebook card type is unsupported.");
  }
  const validated = validateNotebookDocument(document);
  return {
    kind: "notebookCard",
    cardID: requiredText(cardID, "Notebook card ID", 256),
    cardType: normalizedCardType,
    title: requiredText(title, "Notebook card title", 300),
    sourceClassification: "user-authored",
    plainText: notebookPlainText(validated.document),
    references: validated.references.map((reference) => ({
      ...reference,
      sourceClassification: ["canonicalSection", "selectedPassage"].includes(reference.referenceKind)
        ? "published-code"
        : reference.referenceKind === "researchAnswer"
          ? "ai-assisted"
          : reference.referenceKind === "attachment"
            ? "project-material"
            : "user-authored"
    }))
  };
}

export function normalizeNotebookCardPayload({
  cardType,
  title,
  document,
  evidenceLinks = [],
  createdBy,
  updatedBy
}) {
  const normalizedCardType = requiredText(cardType, "Notebook card type", 64);
  if (!notebookCardTypeSet.has(normalizedCardType)) {
    throw new Error("Notebook card type is unsupported.");
  }
  const validated = validateNotebookDocument(document);
  const normalizedEvidenceLinks = normalizeNotebookEvidenceLinks(evidenceLinks);
  const passageReferenceIDs = new Set(
    validated.references
      .filter((reference) => reference.referenceKind === "selectedPassage")
      .map((reference) => reference.referenceID)
  );
  const evidenceLinkIDs = new Set(normalizedEvidenceLinks.map((link) => link.id));
  if ([...passageReferenceIDs].some((id) => !evidenceLinkIDs.has(id))) {
    throw new Error("A Notebook passage reference is missing its evidence locator.");
  }
  const plainText = notebookPlainText(validated.document);
  return {
    schemaVersion: notebookSchemaVersion,
    cardType: normalizedCardType,
    title: requiredText(title, "Notebook card title", 300),
    document: validated.document,
    references: validated.references,
    evidenceLinks: normalizedEvidenceLinks,
    imageAssets: validated.imageAssets,
    plainText,
    renderedHTML: renderNotebookDocumentHTML(validated.document),
    sourceClassification: "user-authored",
    createdBy: requiredText(createdBy, "Notebook card creator", 256),
    updatedBy: requiredText(updatedBy, "Notebook card editor", 256)
  };
}
