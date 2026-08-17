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
  BasicTextStyleButton,
  BlockTypeSelect,
  CreateLinkButton,
  FormattingToolbar,
  FormattingToolbarController,
  useCreateBlockNote
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

const notebookReferenceCodeNames = {
  BC: "Building Code",
  EBC: "Existing Building Code",
  BC68: "1968 Building Code",
  MC: "Mechanical Code",
  PC: "Plumbing Code",
  FGC: "Fuel Gas Code",
  FC: "Fire Code",
  AC: "Administrative Code",
  ZR: "Zoning Resolution"
};

function normalizedNotebookReferenceLabel(label) {
  return String(label || "Linked item").trim().replace(
    /^([A-Z][A-Z0-9]{0,4})\s+(§\s*)/,
    (match, prefix, sectionMarker) => `${notebookReferenceCodeNames[prefix] || prefix} · ${sectionMarker}`
  );
}

function notebookReferenceParts(referenceKind, label) {
  const normalizedLabel = normalizedNotebookReferenceLabel(label);
  if (referenceKind === "researchAnswer") {
    return {
      meta: "Research",
      title: "Research answer",
      preview: normalizedLabel.replace(/^Research:\s*/i, "")
    };
  }
  if (referenceKind === "notebookCard") {
    return {
      meta: "Notebook",
      title: normalizedLabel.replace(/^Notebook:\s*/i, ""),
      preview: ""
    };
  }
  const parts = normalizedLabel.split(/\s+·\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) {
    return {
      meta: parts.slice(0, -1).join(" · "),
      title: parts.at(-1),
      preview: ""
    };
  }
  return { meta: "Linked evidence", title: normalizedLabel, preview: "" };
}

function notebookReferenceChildren(referenceKind, label) {
  const parts = notebookReferenceParts(referenceKind, label);
  return [
    React.createElement("span", { className: "notebook-reference-meta", key: "meta" }, parts.meta),
    React.createElement("strong", { className: "notebook-reference-title", key: "title" }, parts.title),
    parts.preview
      ? React.createElement("span", { className: "notebook-reference-preview", key: "preview" }, parts.preview)
      : null
  ].filter(Boolean);
}

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
      ...notebookReferenceChildren(inlineContent.props.referenceKind, inlineContent.props.label)
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
      ...notebookReferenceChildren(inlineContent.props.referenceKind, inlineContent.props.label)
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
    bold: defaultStyleSpecs.bold,
    italic: defaultStyleSpecs.italic
  }
});

function PermitextFormattingToolbar() {
  return React.createElement(
    FormattingToolbar,
    null,
    React.createElement(BlockTypeSelect, { key: "block-type" }),
    React.createElement(BasicTextStyleButton, { key: "bold", basicTextStyle: "bold" }),
    React.createElement(BasicTextStyleButton, { key: "italic", basicTextStyle: "italic" }),
    React.createElement(CreateLinkButton, { key: "link" })
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
