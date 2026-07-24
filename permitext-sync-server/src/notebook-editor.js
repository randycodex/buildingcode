import { Editor } from "@tiptap/core";
import { notebookEditorExtensions } from "./notebook-schema.js";

function normalizedReference(reference) {
  const referenceKind = String(reference?.referenceKind || "").trim();
  const referenceID = String(reference?.referenceID || "").trim();
  const label = String(reference?.label || "").trim();
  if (!referenceKind || !referenceID || !label) {
    throw new Error("A Notebook reference requires a kind, ID, and label.");
  }
  return { referenceKind, referenceID, label };
}

export function mountPermitextNotebookEditor(element, options = {}) {
  if (!(element instanceof HTMLElement)) {
    throw new Error("A Notebook editor mount element is required.");
  }

  function activateReference(target) {
    const referenceElement = target.closest?.("[data-permitext-reference]");
    if (!referenceElement || !element.contains(referenceElement)) return false;
    options.onOpenReference?.({
      referenceKind: referenceElement.dataset.referenceKind,
      referenceID: referenceElement.dataset.referenceId,
      label: referenceElement.dataset.referenceLabel || referenceElement.textContent || "Linked item"
    });
    return true;
  }

  const editor = new Editor({
    element,
    extensions: [...notebookEditorExtensions],
    content: options.document?.document || options.document || {
      type: "doc",
      content: [{ type: "paragraph" }]
    },
    autofocus: options.autofocus ? "end" : false,
    editable: options.editable !== false,
    editorProps: {
      attributes: {
        class: "notebook-tiptap-editor",
        role: "textbox",
        "aria-label": options.ariaLabel || "Notebook card text",
        "aria-multiline": "true"
      },
      handleDOMEvents: {
        click(_view, event) {
          return activateReference(event.target);
        },
        keydown(_view, event) {
          if (event.key !== "Enter" && event.key !== " ") return false;
          if (!activateReference(event.target)) return false;
          event.preventDefault();
          return true;
        }
      }
    },
    onCreate: ({ editor: activeEditor }) => {
      options.onReady?.(activeEditor);
    },
    onUpdate: ({ editor: activeEditor }) => {
      options.onChange?.({
        schema: "permitext-notebook-card",
        schemaVersion: 1,
        format: "tiptap-json",
        document: activeEditor.getJSON()
      });
    },
    onSelectionUpdate: ({ editor: activeEditor }) => {
      options.onSelectionChange?.({
        bold: activeEditor.isActive("bold"),
        italic: activeEditor.isActive("italic")
      });
    }
  });

  return {
    getDocument() {
      return {
        schema: "permitext-notebook-card",
        schemaVersion: 1,
        format: "tiptap-json",
        document: editor.getJSON()
      };
    },
    setDocument(document, emitUpdate = false) {
      editor.commands.setContent(document?.document || document, { emitUpdate });
    },
    insertReference(reference) {
      editor.chain().focus().insertContent({
        type: "permitextReference",
        attrs: normalizedReference(reference)
      }).insertContent(" ").run();
    },
    toggleBold() {
      editor.chain().focus().toggleBold().run();
    },
    toggleItalic() {
      editor.chain().focus().toggleItalic().run();
    },
    undo() {
      editor.chain().focus().undo().run();
    },
    redo() {
      editor.chain().focus().redo().run();
    },
    isActive(mark) {
      return editor.isActive(mark);
    },
    focus() {
      editor.commands.focus("end");
    },
    destroy() {
      editor.destroy();
    }
  };
}
