export const notebookSchemaName = "permitext-notebook-card";
export const notebookSchemaVersion = 2;
export const notebookDocumentFormat = "blocknote-json";

export const notebookReferenceKinds = Object.freeze([
  "canonicalSection",
  "selectedPassage",
  "researchAnswer",
  "notebookCard",
  "attachment",
  "workboard",
  "reportDraft"
]);

export const notebookBlockTypes = Object.freeze([
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
  "quote",
  "codeBlock",
  "divider",
  "table",
  "image"
]);

export function emptyBlockNoteContent() {
  return [{ type: "paragraph", content: [] }];
}

export function emptyNotebookDocument() {
  return {
    schema: notebookSchemaName,
    schemaVersion: notebookSchemaVersion,
    format: notebookDocumentFormat,
    document: emptyBlockNoteContent()
  };
}

function tiptapMarksToBlockNoteStyles(marks) {
  const styles = {};
  (Array.isArray(marks) ? marks : []).forEach((mark) => {
    if (mark?.type === "bold" || mark?.type === "italic") {
      styles[mark.type] = true;
    }
  });
  return styles;
}

function tiptapInlineToBlockNote(node) {
  if (node?.type === "text" && typeof node.text === "string") {
    return {
      type: "text",
      text: node.text,
      styles: tiptapMarksToBlockNoteStyles(node.marks)
    };
  }
  if (node?.type === "permitextReference") {
    return {
      type: "permitextReference",
      props: {
        referenceKind: String(node.attrs?.referenceKind || ""),
        referenceID: String(node.attrs?.referenceID || ""),
        label: String(node.attrs?.label || "Linked Permitext item")
      }
    };
  }
  return null;
}

export function tiptapDocumentToBlockNote(document) {
  const content = Array.isArray(document?.content) ? document.content : [];
  const blocks = content
    .filter((node) => node?.type === "paragraph")
    .map((paragraph) => ({
      type: "paragraph",
      content: (Array.isArray(paragraph.content) ? paragraph.content : [])
        .map(tiptapInlineToBlockNote)
        .filter(Boolean)
    }));
  return blocks.length ? blocks : emptyBlockNoteContent();
}

export function plainTextToBlockNote(value) {
  const blocks = String(value || "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .map((paragraph) => ({
      type: "paragraph",
      content: [{ type: "text", text: paragraph, styles: {} }]
    }));
  return blocks.length ? blocks : emptyBlockNoteContent();
}
