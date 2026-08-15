import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  defaultStyleSpecs
} from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "./notebook.css";
import {
  createReactInlineContentSpec,
  createReactStyleSpec,
  FormattingToolbar,
  FormattingToolbarController,
  getFormattingToolbarItems,
  useBlockNoteEditor,
  useComponentsContext,
  useCreateBlockNote,
  useEditorState
} from "@blocknote/react";
import {
  blockNoteBlocksFromNotebookDocument,
  emptyNotebookDocument,
  notebookBlockTypes,
  notebookDocumentFormat,
  notebookReferenceKinds,
  notebookSchemaName,
  notebookSchemaVersion
} from "./notebook-schema.js";

const allowedBlockTypeSet = new Set(notebookBlockTypes);

const notebookNumericSizes = Object.freeze([
  { label: "12", value: "12px" },
  { label: "14", value: "" },
  { label: "16", value: "16px" },
  { label: "18", value: "18px" },
  { label: "24", value: "24px" },
  { label: "32", value: "32px" }
]);

const PermitextFontSize = createReactStyleSpec(
  {
    type: "fontSize",
    propSchema: "string"
  },
  {
    render: ({ value, contentRef }) => React.createElement("span", {
      ref: contentRef,
      style: { lineHeight: value },
      "data-line-spacing": value
    }),
    toExternalHTML: ({ value, contentRef }) => React.createElement("span", {
      ref: contentRef,
      style: { lineHeight: value },
      "data-line-spacing": value
    }),
    parse: (element) => element.dataset.lineSpacing || element.style.lineHeight || undefined
  }
);

const PermitextTextSize = createReactStyleSpec(
  {
    type: "textSize",
    propSchema: "string"
  },
  {
    render: ({ value, contentRef }) => React.createElement("span", {
      ref: contentRef,
      style: { fontSize: value },
      "data-text-size": value
    }),
    toExternalHTML: ({ value, contentRef }) => React.createElement("span", {
      ref: contentRef,
      style: { fontSize: value },
      "data-text-size": value
    }),
    parse: (element) => element.dataset.textSize || element.style.fontSize || undefined
  }
);

const PermitextReference = createReactInlineContentSpec(
  {
    type: "permitextReference",
    propSchema: {
      referenceKind: {
        default: "canonicalSection",
        values: [...notebookReferenceKinds]
      },
      referenceID: { default: "" },
      label: { default: "Linked Permitext item" }
    },
    content: "none"
  },
  {
    render: ({ inlineContent }) => React.createElement(
      "button",
      {
        type: "button",
        className: "notebook-reference-chip",
        "data-permitext-reference": "true",
        "data-reference-kind": inlineContent.props.referenceKind,
        "data-reference-id": inlineContent.props.referenceID,
        "data-reference-label": inlineContent.props.label,
        "aria-label": `Open ${inlineContent.props.label}`
      },
      inlineContent.props.label
    ),
    toExternalHTML: ({ inlineContent }) => React.createElement(
      "span",
      {
        className: "notebook-reference-chip",
        "data-permitext-reference": "true",
        "data-reference-kind": inlineContent.props.referenceKind,
        "data-reference-id": inlineContent.props.referenceID,
        "data-reference-label": inlineContent.props.label
      },
      inlineContent.props.label
    )
  }
);

const notebookBlockSpecs = Object.fromEntries(
  Object.entries(defaultBlockSpecs).filter(([type]) => allowedBlockTypeSet.has(type))
);

export const permitextNotebookSchema = BlockNoteSchema.create({
  blockSpecs: notebookBlockSpecs,
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    permitextReference: PermitextReference
  },
  styleSpecs: {
    ...defaultStyleSpecs,
    fontSize: PermitextFontSize,
    textSize: PermitextTextSize
  }
});

function FontSizeSelect() {
  const editor = useBlockNoteEditor(permitextNotebookSchema);
  const components = useComponentsContext();
  const activeFontSize = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => currentEditor.getActiveStyles().fontSize || ""
  });
  if (!components) return null;
  return React.createElement(components.FormattingToolbar.Select, {
    className: "notebook-line-spacing-select",
    items: notebookNumericSizes.map(({ label, value }) => ({
      text: label,
      icon: React.createElement("span", {
        "aria-hidden": "true",
        className: "notebook-line-spacing-icon"
      }, "↕"),
      isSelected: activeFontSize === value,
      onClick: () => {
        if (value) {
          editor.addStyles({ fontSize: value });
        } else if (activeFontSize) {
          editor.removeStyles({ fontSize: activeFontSize });
        }
      }
    }))
  });
}

function TextSizeSelect() {
  const editor = useBlockNoteEditor(permitextNotebookSchema);
  const components = useComponentsContext();
  const activeTextSize = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => currentEditor.getActiveStyles().textSize || ""
  });
  if (!components) return null;
  return React.createElement(components.FormattingToolbar.Select, {
    className: "notebook-text-size-select",
    items: notebookNumericSizes.map(({ label, value }) => ({
      text: label,
      icon: React.createElement("span", {
        "aria-hidden": "true",
        className: "notebook-text-size-icon"
      }, "A"),
      isSelected: activeTextSize === value,
      onClick: () => {
        if (value) {
          editor.addStyles({ textSize: value });
        } else if (activeTextSize) {
          editor.removeStyles({ textSize: activeTextSize });
        }
      }
    }))
  });
}

function PermitextFormattingToolbar() {
  const defaultItems = getFormattingToolbarItems();
  return React.createElement(
    FormattingToolbar,
    null,
    defaultItems[0],
    React.createElement(TextSizeSelect, { key: "text-size-select" }),
    React.createElement(FontSizeSelect, { key: "line-spacing-select" }),
    ...defaultItems.slice(1)
  );
}

function normalizedReference(reference) {
  const referenceKind = String(reference?.referenceKind || "").trim();
  const referenceID = String(reference?.referenceID || "").trim();
  const label = String(reference?.label || "").trim();
  if (!notebookReferenceKinds.includes(referenceKind) || !referenceID || !label) {
    throw new Error("A Notebook reference requires a supported kind, ID, and label.");
  }
  return { referenceKind, referenceID, label };
}

function wrappedDocument(blocks) {
  return {
    schema: notebookSchemaName,
    schemaVersion: notebookSchemaVersion,
    format: notebookDocumentFormat,
    document: blocks
  };
}

function preferredNotebookTheme() {
  const explicitTheme = document.documentElement.dataset.theme;
  if (explicitTheme === "dark" || explicitTheme === "light") return explicitTheme;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function PermitextNotebookEditor({ options, controllerRef }) {
  const [theme, setTheme] = useState(preferredNotebookTheme);
  const initialContent = useMemo(
    () => blockNoteBlocksFromNotebookDocument(options.document),
    []
  );
  const editor = useCreateBlockNote({
    schema: permitextNotebookSchema,
    initialContent,
    uploadFile: options.uploadFile,
    resolveFileUrl: options.resolveFileUrl
  });
  const lastDocumentRef = useRef(options.document);

  useEffect(() => {
    const updateTheme = () => setTheme(preferredNotebookTheme());
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"]
    });
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", updateTheme);
    return () => {
      observer.disconnect();
      media?.removeEventListener?.("change", updateTheme);
    };
  }, []);

  useEffect(() => {
    controllerRef.current = editor;
    options.onReady?.(editor);
    if (options.autofocus) window.requestAnimationFrame(() => editor.focus());
    return () => {
      if (controllerRef.current === editor) controllerRef.current = null;
    };
  }, [editor]);

  useEffect(() => {
    const incoming = options.document;
    if (!incoming || incoming === lastDocumentRef.current) return;
    lastDocumentRef.current = incoming;
    editor.replaceBlocks(editor.document, blockNoteBlocksFromNotebookDocument(incoming));
  }, [editor, options.document]);

  return React.createElement(
    BlockNoteView,
    {
      editor,
      className: "permitext-notebook-editor",
      editable: options.editable !== false,
      theme,
      formattingToolbar: false,
      portalElements: { slashMenu: null },
      onChange: () => options.onChange?.(wrappedDocument(editor.document)),
      "aria-label": options.ariaLabel || "Notebook card"
    },
    React.createElement(FormattingToolbarController, {
      formattingToolbar: PermitextFormattingToolbar
    })
  );
}

export function mountPermitextNotebookEditor(element, options = {}) {
  if (!(element instanceof HTMLElement)) {
    throw new Error("A Notebook editor mount element is required.");
  }
  const controllerRef = { current: null };
  const root = createRoot(element);
  root.render(React.createElement(PermitextNotebookEditor, { options, controllerRef }));

  return {
    getDocument() {
      return wrappedDocument(controllerRef.current?.document || options.document?.document || []);
    },
    setDocument(document) {
      const editor = controllerRef.current;
      if (!editor) return;
      editor.replaceBlocks(editor.document, blockNoteBlocksFromNotebookDocument(document));
    },
    insertReference(reference) {
      const editor = controllerRef.current;
      if (!editor) return;
      editor.focus();
      editor.insertInlineContent([
        { type: "permitextReference", props: normalizedReference(reference) },
        " "
      ]);
    },
    replaceAssetURL(fromURL, toURL) {
      const editor = controllerRef.current;
      if (!editor || !fromURL || !toURL || fromURL === toURL) return false;
      let changed = false;
      const replaceBlock = (block) => ({
        ...block,
        ...(block.type === "image" && block.props?.url === fromURL
          ? { props: { ...block.props, url: toURL } }
          : {}),
        children: (block.children || []).map(replaceBlock)
      });
      const next = editor.document.map((block) => {
        if (block.type === "image" && block.props?.url === fromURL) changed = true;
        const mapped = replaceBlock(block);
        if (JSON.stringify(mapped) !== JSON.stringify(block)) changed = true;
        return mapped;
      });
      if (changed) editor.replaceBlocks(editor.document, next);
      return changed;
    },
    undo() {
      controllerRef.current?.undo();
    },
    redo() {
      controllerRef.current?.redo();
    },
    focus() {
      controllerRef.current?.focus();
    },
    destroy() {
      root.unmount();
    }
  };
}
