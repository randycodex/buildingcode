import { Node } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import { UndoRedo } from "@tiptap/extensions/undo-redo";

export const notebookReferenceKinds = Object.freeze([
  "canonicalSection",
  "selectedPassage",
  "researchAnswer",
  "notebookCard",
  "attachment",
  "workboard",
  "reportDraft"
]);

export const NotebookDocument = Document.extend({
  content: "paragraph+"
});

export const PermitextReference = Node.create({
  name: "permitextReference",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      referenceKind: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-reference-kind"),
        renderHTML: () => ({})
      },
      referenceID: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-reference-id"),
        renderHTML: () => ({})
      },
      label: {
        default: "Linked Permitext item",
        parseHTML: (element) => element.getAttribute("data-reference-label") || element.textContent,
        renderHTML: () => ({})
      }
    };
  },

  parseHTML() {
    return [{ tag: "span[data-permitext-reference]" }];
  },

  renderHTML({ node }) {
    return [
      "button",
      {
        type: "button",
        class: "notebook-reference-chip",
        "data-permitext-reference": "true",
        "data-reference-kind": node.attrs.referenceKind,
        "data-reference-id": node.attrs.referenceID,
        "data-reference-label": node.attrs.label,
        "aria-label": `Open ${node.attrs.label}`
      },
      node.attrs.label
    ];
  }
});

export const notebookContentExtensions = Object.freeze([
  NotebookDocument,
  Paragraph,
  Text,
  Bold,
  Italic,
  PermitextReference
]);

export const notebookEditorExtensions = Object.freeze([
  ...notebookContentExtensions,
  UndoRedo.configure({ depth: 50 })
]);
