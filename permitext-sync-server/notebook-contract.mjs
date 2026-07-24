import { generateHTML } from "@tiptap/html";
import {
  notebookContentExtensions,
  notebookReferenceKinds
} from "./src/notebook-schema.js";

export const notebookSchemaName = "permitext-notebook-card";
export const notebookSchemaVersion = 1;
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
const markTypeSet = new Set(["bold", "italic"]);
const maximumNotebookTextLength = 20_000;
const maximumNotebookJSONLength = 100_000;

function requiredText(value, label, maximum = 500) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maximum) {
    throw new Error(`Invalid ${label}.`);
  }
  return normalized;
}

function canonicalTextNode(node, state) {
  if (typeof node?.text !== "string" || !node.text) {
    throw new Error("Notebook text nodes require text.");
  }
  const marks = Array.isArray(node.marks) ? node.marks : [];
  const seenMarks = new Set();
  const canonicalMarks = marks.map((mark) => {
    if (!mark || !markTypeSet.has(mark.type) || seenMarks.has(mark.type)) {
      throw new Error("Notebook text uses an unsupported mark.");
    }
    if (mark.attrs && Object.keys(mark.attrs).length) {
      throw new Error("Notebook marks cannot store arbitrary attributes.");
    }
    seenMarks.add(mark.type);
    return { type: mark.type };
  });
  state.textLength += node.text.length;
  if (state.textLength > maximumNotebookTextLength) {
    throw new Error("Notebook card text is too long.");
  }
  return {
    type: "text",
    text: node.text,
    ...(canonicalMarks.length ? { marks: canonicalMarks } : {})
  };
}

function canonicalReferenceNode(node, state) {
  const referenceKind = requiredText(node?.attrs?.referenceKind, "Notebook reference kind", 64);
  if (!referenceKindSet.has(referenceKind)) {
    throw new Error("Notebook reference kind is unsupported.");
  }
  const referenceID = requiredText(node?.attrs?.referenceID, "Notebook reference ID", 256);
  const label = requiredText(node?.attrs?.label, "Notebook reference label", 500);
  state.references.push({ referenceKind, referenceID, label });
  return {
    type: "permitextReference",
    attrs: { referenceKind, referenceID, label }
  };
}

function canonicalParagraphNode(node, state) {
  if (!node || node.type !== "paragraph") {
    throw new Error("Notebook documents may contain paragraphs only.");
  }
  if (node.attrs && Object.keys(node.attrs).length) {
    throw new Error("Notebook paragraphs cannot store arbitrary attributes.");
  }
  const content = Array.isArray(node.content) ? node.content : [];
  return {
    type: "paragraph",
    ...(content.length ? {
      content: content.map((child) => {
        if (child?.type === "text") return canonicalTextNode(child, state);
        if (child?.type === "permitextReference") return canonicalReferenceNode(child, state);
        throw new Error("Notebook paragraphs contain an unsupported node.");
      })
    } : {})
  };
}

function documentFromPlainText(value) {
  const paragraphs = String(value || "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .map((paragraph) => ({
      type: "paragraph",
      content: [{ type: "text", text: paragraph }]
    }));
  return {
    type: "doc",
    content: paragraphs.length ? paragraphs : [{ type: "paragraph" }]
  };
}

export function emptyNotebookDocument() {
  return {
    schema: notebookSchemaName,
    schemaVersion: notebookSchemaVersion,
    format: "tiptap-json",
    document: { type: "doc", content: [{ type: "paragraph" }] }
  };
}

export function migrateNotebookDocument(input) {
  if (typeof input === "string") {
    return {
      schema: notebookSchemaName,
      schemaVersion: notebookSchemaVersion,
      format: "tiptap-json",
      document: documentFromPlainText(input),
      migratedFromSchemaVersion: 0
    };
  }
  if (input?.schemaVersion === 0 && typeof input.plainText === "string") {
    return {
      schema: notebookSchemaName,
      schemaVersion: notebookSchemaVersion,
      format: "tiptap-json",
      document: documentFromPlainText(input.plainText),
      migratedFromSchemaVersion: 0
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
    migrated.format !== "tiptap-json" ||
    migrated.document?.type !== "doc"
  ) {
    throw new Error("Notebook document schema is unsupported.");
  }
  if (JSON.stringify(migrated).length > maximumNotebookJSONLength) {
    throw new Error("Notebook card document is too large.");
  }
  const content = Array.isArray(migrated.document.content)
    ? migrated.document.content
    : [];
  if (!content.length) throw new Error("Notebook documents require a paragraph.");
  const state = { textLength: 0, references: [] };
  const canonical = {
    schema: notebookSchemaName,
    schemaVersion: notebookSchemaVersion,
    format: "tiptap-json",
    document: {
      type: "doc",
      content: content.map((node) => canonicalParagraphNode(node, state))
    },
    ...(migrated.migratedFromSchemaVersion === 0
      ? { migratedFromSchemaVersion: 0 }
      : {})
  };
  return { document: canonical, references: state.references };
}

export function notebookPlainText(input) {
  const { document, references } = validateNotebookDocument(input);
  const referenceLabels = new Map(
    references.map((reference) => [
      `${reference.referenceKind}:${reference.referenceID}`,
      reference.label
    ])
  );
  return document.document.content.map((paragraph) =>
    (paragraph.content || []).map((node) =>
      node.type === "text"
        ? node.text
        : referenceLabels.get(`${node.attrs.referenceKind}:${node.attrs.referenceID}`) || node.attrs.label
    ).join("")
  ).join("\n\n").trim();
}

export function renderNotebookDocumentHTML(input) {
  const { document } = validateNotebookDocument(input);
  return generateHTML(document.document, [...notebookContentExtensions]);
}

export function notebookManifestItem({
  cardID,
  cardType,
  title,
  document
}) {
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
          : ["attachment", "workboard"].includes(reference.referenceKind)
            ? "project-material"
            : "user-authored"
    }))
  };
}

export function normalizeNotebookCardPayload({
  cardType,
  title,
  document,
  createdBy,
  updatedBy
}) {
  const normalizedCardType = requiredText(cardType, "Notebook card type", 64);
  if (!notebookCardTypeSet.has(normalizedCardType)) {
    throw new Error("Notebook card type is unsupported.");
  }
  const validated = validateNotebookDocument(document);
  const plainText = notebookPlainText(validated.document);
  return {
    schemaVersion: notebookSchemaVersion,
    cardType: normalizedCardType,
    title: requiredText(title, "Notebook card title", 300),
    document: validated.document,
    references: validated.references,
    plainText,
    renderedHTML: renderNotebookDocumentHTML(validated.document),
    sourceClassification: "user-authored",
    createdBy: requiredText(createdBy, "Notebook card creator", 256),
    updatedBy: requiredText(updatedBy, "Notebook card editor", 256)
  };
}
