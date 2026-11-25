import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
  createStyleSpec
} from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { Menu } from "@mantine/core";
import "@blocknote/mantine/style.css";
import "./notebook.css";
import { notebookReferenceBlocks } from "../public/notebook-passage-blocks.js";
import { normalizeNotebookDocumentStyles, notebookFontSize, notebookFontSizes, notebookLineSpacings, notebookTextColor, notebookTextColors } from "../public/notebook-styles.js";
import { TableHandlesExtension } from '@blocknote/core/extensions';
import { TextSelection } from "@tiptap/pm/state";
import { addColumnAfter, addRowAfter, deleteColumn, deleteRow, selectedRect } from "@tiptap/pm/tables";
import { notebookTablePasteHTML } from "../public/notebook-html-paste.js";
export { createReportFormatting } from "./report-text-editor.js";
import { en } from "@blocknote/core/locales";
import {
  createReactInlineContentSpec,
  BlockNoteViewEditor,
  useEditorState,
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
  ZR: "Zoning Resolution",
  ECC: "Energy Conservation Code",
  EC: "Electrical Code",
  HMC: "Housing Maintenance Code",
  T24: "Administrative Code Title 24",
  T25: "Administrative Code Title 25",
  T26: "Administrative Code Title 26",
  T28: "Administrative Code Title 28",
  LL: "Construction-Related Local Laws"
};

function notebookReferenceAppearance(kind, label) {
  if (!["selectedPassage", "canonicalSection"].includes(kind)) return;
  const code = String(label || "").split(/\s*[·§]\s*/, 1)[0].trim().replace(/\s+\(?\d{4}\)?$/, "");
  // Prefer the most specific name so 1968 and specialty books keep their own colors.
  const prefix = Object.keys(notebookReferenceCodeNames).find(key => key === code.toUpperCase() ||
    notebookReferenceCodeNames[key].toLowerCase() === code.toLowerCase());
  if (prefix) return {"--notebook-reference-color": `var(--notebook-reference-${prefix.toLowerCase()}, LinkText)`};
}

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
      label: { default: "Linked per codes item" }
    },
    content: "none"
  },
  {
    render: ({ inlineContent }) => {
      if (inlineContent.props.referenceKind === "selectedPassage") {
        const { referenceKind, referenceID, label } = inlineContent.props;
        return React.createElement("span", {
          className: "notebook-reference-chip",
          style: notebookReferenceAppearance(referenceKind, label),
          "data-permitext-reference": "true",
          "data-reference-kind": referenceKind,
          "data-reference-id": referenceID,
          "data-reference-label": label
        },
        React.createElement("button", {
          type: "button",
          className: "notebook-passage-source",
          "aria-label": `Open ${label}`,
          title: "Open source in Reader"
        }, ...notebookReferenceChildren(referenceKind, label)),
        React.createElement("button", {
          type: "button",
          className: "notebook-passage-toggle",
          "data-notebook-passage-toggle": "true",
          hidden: true
        }));
      }
      return React.createElement(
      "button",
      {
        type: "button",
        className: "notebook-reference-chip",
        style: notebookReferenceAppearance(inlineContent.props.referenceKind, inlineContent.props.label),
        "data-permitext-reference": "true",
        "data-reference-kind": inlineContent.props.referenceKind,
        "data-reference-id": inlineContent.props.referenceID,
        "data-reference-label": inlineContent.props.label,
        "aria-label": `Open ${inlineContent.props.label}`
      },
      ...notebookReferenceChildren(inlineContent.props.referenceKind, inlineContent.props.label)
      );
    },
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
  Object.entries(defaultBlockSpecs).filter(([type]) => allowedBlockTypeSet.has(type)).map(([type,spec]) => {
    if (!['paragraph','heading','bulletListItem','numberedListItem'].includes(type)) return [type,spec];
    const renderSpacing=render=>function(block,...args){
      const result=render.call(this,block,...args);
      if (notebookLineSpacings.includes(block.props.lineSpacing) && block.props.lineSpacing!=='normal')
        result.dom.style.setProperty('line-height',block.props.lineSpacing,'important');
      return result;
    };
    return [type,{...spec,config:{...spec.config,propSchema:{...spec.config.propSchema,lineSpacing:{default:'normal',values:[...notebookLineSpacings]}}},
      implementation:{...spec.implementation,render:renderSpacing(spec.implementation.render),
        toExternalHTML:renderSpacing(spec.implementation.toExternalHTML || spec.implementation.render),
        parse:element=>{const props=spec.implementation.parse?.(element);if(props===undefined)return undefined;
          const spacing=element.getAttribute('data-line-spacing') || element.style.lineHeight;
          return {...props,...(notebookLineSpacings.includes(spacing)?{lineSpacing:spacing}:{})};}}}];
  })
);

// Keep the normal color parser and renderer, and recognize semantic highlights
// from copied HTML as the same supported yellow highlight used by the toolbar.
const backgroundColorSpec = defaultStyleSpecs.backgroundColor;
const notebookBackgroundColor = {...backgroundColorSpec, implementation: {
  ...backgroundColorSpec.implementation,
  mark: backgroundColorSpec.implementation.mark.extend({
    parseHTML() {
      return [{tag: "mark", getAttrs: () => ({stringValue: "yellow"})}, ...(this.parent?.() || [])];
    }
  })
}};
const notebookSuperscript = createStyleSpec({type: "superscript", propSchema: "boolean"}, {
  render: () => {
    const dom = document.createElement("sup");
    return {dom, contentDOM: dom};
  },
  parse: element => element.tagName === "SUP" || element.style.verticalAlign === "super" ? true : undefined
});
const notebookFontSizeStyle = createStyleSpec({type:'fontSize',propSchema:'string'},{
  render:value=>{const dom=document.createElement('span'),size=notebookFontSize(value);if(size)dom.style.fontSize=`${size}pt`;return {dom,contentDOM:dom};},
  parse:element=>notebookFontSize(element.style.fontSize)
});

function notebookTextColorProperties(color) {
  return color && {
    "--notebook-text-color-light": color.light,
    "--notebook-text-color-dark": color.dark
  };
}

const notebookTextColorStyle = createStyleSpec({type: "textColor", propSchema: "string"}, {
  render: value => {
    const dom = document.createElement("span");
    for (const [property, color] of Object.entries(notebookTextColorProperties(notebookTextColor(value)) || {})) {
      dom.style.setProperty(property, color);
    }
    return {dom, contentDOM: dom};
  },
  toExternalHTML: value => {
    const dom = document.createElement("span");
    const color = notebookTextColor(value);
    if (color) {
      dom.style.color = color.light;
      dom.dataset.notebookTextColor = value;
    }
    return {dom, contentDOM: dom};
  },
  parse: element => {
    const value = element.getAttribute("data-notebook-text-color");
    if (notebookTextColor(value)) return value;
  }
});

export const permitextNotebookSchema = BlockNoteSchema.create({
  blockSpecs: notebookBlockSpecs,
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    permitextReference: PermitextReference
  },
  styleSpecs: {
    bold: defaultStyleSpecs.bold,
    italic: defaultStyleSpecs.italic,
    strike: defaultStyleSpecs.strike,
    underline: defaultStyleSpecs.underline,
    backgroundColor: notebookBackgroundColor,
    textColor: notebookTextColorStyle,
    superscript: notebookSuperscript,
    fontSize: notebookFontSizeStyle
  }
});

export function notebookTableActions(editor) {
  const actions = [2, 3, 4].map(size => ({value: `insert-${size}`, label: `Insert ${size} × ${size} table`}));
  const table = editor.getTextCursorPosition().block;
  if (table.type !== "table") return actions;

  const hasCell = Boolean(editor.getExtension(TableHandlesExtension)?.getCellSelection());
  const rowCount = table.content.rows.length;
  const columnCount = table.content.rows[0].cells.length;
  actions.push(
    {value: "row", label: "Add row below", disabled: !hasCell || rowCount >= 500},
    {value: "column", label: "Add column right", disabled: !hasCell || columnCount >= 100},
    {value: "header", label: table.content.headerRows ? "Remove header row" : "Use first row as header"},
    {value: "remove-row", label: "Delete row", disabled: !hasCell || rowCount <= 1},
    {value: "remove-column", label: "Delete column", disabled: !hasCell || columnCount <= 1},
    {value: "remove-table", label: "Delete table"}
  );
  return actions;
}

export function applyNotebookTableAction(editor, action) {
  if (action === "append-column") {
    const choice = notebookTableActions(editor).find(item => item.value === "column");
    if (!choice || choice.disabled) return false;
    return editor.exec((state, dispatch, view) => {
      const { map, tableStart, top } = selectedRect(state);
      const lastCell = tableStart + map.map[top * map.width + map.width - 1];
      const lastCellState = state.apply(state.tr.setSelection(TextSelection.create(state.doc, lastCell + 2)));
      return addColumnAfter(lastCellState, dispatch && (transaction => {
        transaction.setSelection(state.selection.map(transaction.doc, transaction.mapping));
        dispatch(transaction);
      }), view);
    });
  }
  const custom = /^insert-([1-9][0-9]?)x([1-9][0-9]?)$/.exec(action);
  if (custom && (Number(custom[1]) > 50 || Number(custom[2]) > 20)) return false;
  const choice = notebookTableActions(editor).find(item => item.value === action);
  if (!custom && (!choice || choice.disabled)) return false;
  const block = editor.getTextCursorPosition().block;
  if (action.startsWith("insert-")) {
    const rows = Number(custom?.[1] ?? action.slice(7));
    const columns = Number(custom?.[2] ?? action.slice(7));
    const content = {
      type: "tableContent",
      headerRows: 1,
      rows: Array.from({length: rows}, () => ({cells: Array.from({length: columns}, () => [])}))
    };
    let inserted;
    editor.transact(() => {
      if (block.type === "paragraph" && !block.content?.length && !block.children?.length) {
        inserted = editor.updateBlock(block, {type: "table", content});
      } else {
        [inserted] = editor.insertBlocks([{type: "table", content}], block, "after");
      }
      editor.insertBlocks([{type: "paragraph", content: []}], inserted, "after");
    });
    editor.setTextCursorPosition(inserted, "start");
    return true;
  }

  // Table handles track hover. Toolbar operations follow the selected cell
  // and affect one row or column even if the selection spans several cells.
  const command = { row: addRowAfter, column: addColumnAfter, "remove-row": deleteRow, "remove-column": deleteColumn }[action];
  if (command) {
    const cellSelection = editor.getExtension(TableHandlesExtension).getCellSelection();
    if (cellSelection.cells.length === 1) return editor.exec(command);
    return editor.exec((state, dispatch, view) => {
      const { map, tableStart, left, top } = selectedRect(state);
      const firstCell = tableStart + map.map[top * map.width + left];
      const firstCellState = state.apply(state.tr.setSelection(TextSelection.create(state.doc, firstCell + 2)));
      return command(firstCellState, dispatch, view);
    });
  }
  switch (action) {
    case "header":
      editor.updateBlock(block, {content: {...block.content, headerRows: block.content.headerRows ? 0 : 1}});
      break;
    case "remove-table":
      editor.removeBlocks([block]);
      break;
  }
  return true;
}

function PermitextFormattingToolbar({ editor, options }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkURL, setLinkURL] = useState("");
  const [linkText, setLinkText] = useState("");
  const [linkError, setLinkError] = useState("");
  const linkSelection = useRef(null);
  const textStyleButton = useRef(null);
  const formatSelection = useRef(null);
  const captureSelection = () => {
    const state = editor._tiptapEditor.state;
    return {from: state.selection.from, to: state.selection.to, document: state.doc, text: editor.getSelectedText()};
  };
  const restoreSelection = selection => {
    if (!selection || selection.document !== editor._tiptapEditor.state.doc) return false;
    const current = editor._tiptapEditor.state.selection;
    if (current.from !== selection.from || current.to !== selection.to) {
      editor._tiptapEditor.commands.setTextSelection({from: selection.from, to: selection.to});
    }
    return true;
  };
  const state = useEditorState({
    editor,
    selector: ({ editor }) => {
      const history = editor.getExtension('yUndo') || editor.getExtension('history');
      const styles = editor.getActiveStyles();
      let fontSize = styles.fontSize;
      if (!fontSize && typeof getComputedStyle === 'function') {
        // Read inherited body, heading and table-cell sizes at the caret too.
        const tiptap = editor._tiptapEditor;
        const view = editor.domElement?.isConnected ? editor.prosemirrorView : null;
        if (view?.dom?.isConnected) {
          const node = view.domAtPos(tiptap.state.selection.from).node;
          const element = node.nodeType === 1 ? node : node.parentElement;
          const pixels = element && parseFloat(getComputedStyle(element).fontSize);
          if (pixels) fontSize = notebookFontSize(String(Math.round(pixels * 1.5) / 2));
        }
      }
      return {
        editable: editor.isEditable,
        canUndo: Boolean(history && editor.canExec(history.undoCommand)),
        canRedo: Boolean(history && editor.canExec(history.redoCommand)),
        styles,
        fontSize,
        blocks: editor.getSelection()?.blocks || [editor.getTextCursorPosition().block]
      };
    }
  });
  const textBlocks = state.blocks.filter(block => ["paragraph", "heading", "bulletListItem", "numberedListItem"].includes(block.type));
  const inlineSelection = state.blocks.some(block => ["paragraph", "heading", "bulletListItem", "numberedListItem", "table"].includes(block.type));
  const first = textBlocks[0];
  const type = first?.type === "heading" ? `heading-${first.props.level}` : "paragraph";
  const setBlockType = (type, props = {}) => {
    editor.focus();
    editor.transact(() => textBlocks.forEach(block => editor.updateBlock(block, {type, props})));
  };
  const styleButton = (style, label, glyph) => React.createElement("button", {
    key: style, type: "button", className: `notebook-format-button notebook-format-${style}`,
    title: label, "aria-label": label, "aria-pressed": !!state.styles[style],
    disabled: !state.editable || !inlineSelection,
    onMouseDown: event => event.preventDefault(),
    onClick: () => { editor.focus(); editor.toggleStyles({[style]: true}); }
  }, glyph);
  const icon = paths => React.createElement("svg", {viewBox:"0 0 20 20", width:18, height:18, fill:"none", stroke:"currentColor", strokeWidth:1.4, "aria-hidden":"true"},
    ...paths.map((d,index)=>React.createElement("path", {key:index,d})));
  const openLink = () => {
    linkSelection.current = captureSelection();
    setLinkURL(editor.getSelectedLinkUrl() || "");
    setLinkText(editor.getSelectedText());
    setLinkError("");
    setLinkOpen(true);
  };
  const submitLink = event => {
    event.preventDefault();
    let parsed;
    try { parsed = new URL(linkURL.trim()); } catch { setLinkError("Enter a valid HTTP, HTTPS, or mailto URL."); return; }
    if (!["https:", "http:", "mailto:"].includes(parsed.protocol)) { setLinkError("Use an HTTP, HTTPS, or mailto URL."); return; }
    if (!restoreSelection(linkSelection.current)) { setLinkError("The Note changed. Close this form and select the link location again."); return; }
    const selected = linkSelection.current;
    const text = linkText.trim();
    editor.focus();
    // Mark existing selected text without replacing its mixed formatting.
    // At an empty caret a label is required or createLink would mark no text.
    editor.createLink(parsed.href, selected.from === selected.to ? text || parsed.href : text && text !== selected.text ? text : undefined);
    setLinkOpen(false);
  };
  const listButton = (type, label, glyph) => React.createElement("button", {
    key: type, type: "button", className: "notebook-format-button",
    title: label, "aria-label": label, "aria-pressed": first?.type === type,
    disabled: !state.editable || !textBlocks.length,
    onMouseDown: event => event.preventDefault(),
    onClick: () => setBlockType(first?.type === type ? "paragraph" : type)
  }, glyph);
  const insertActions = [["evidence", "Evidence"], ["research", "Assistant answer"], ["image", "Image"], ["template", "Finding template"]]
    .filter(([kind]) => !options.insertItems || options.insertItems.includes(kind));
  const formatMenu = (label,caption,choices,apply,disabled=false) => React.createElement(Menu,
    {position:'bottom-start',offset:8,withinPortal:false,width:190,loop:true,returnFocus:false},
    React.createElement(Menu.Target,null,React.createElement('button',{type:'button',className:'notebook-format-style','aria-label':label,title:label,
      disabled:!state.editable || disabled,onMouseDown:event=>event.preventDefault(),onClick:()=>{formatSelection.current=captureSelection();}},caption)),
    React.createElement(Menu.Dropdown,{className:'notebook-format-style-menu','aria-label':label},...choices.map(choice=>React.createElement(Menu.Item,
      {key:choice.value,className:'notebook-format-style-option',disabled:choice.disabled,
        'aria-current':choice.selected?'true':undefined,onClick:()=>{if(!restoreSelection(formatSelection.current))return;editor.focus();apply(choice.value);}},choice.label))));
  const sizeMenu = formatMenu('Font size',state.fontSize ? `${state.fontSize} pt` : 'Size',
    [{value:'default',label:'Default',selected:!state.styles.fontSize},...notebookFontSizes.map(value=>({value,label:`${value} pt`,selected:state.styles.fontSize===value}))],
    value=>value==='default'?editor.removeStyles({fontSize:state.styles.fontSize || ''}):editor.addStyles({fontSize:value}),!inlineSelection);
  const textColorChoices = [["default", {label: "Default"}], ...Object.entries(notebookTextColors)]
    .map(([value, color]) => ({
      value,
      selected: (state.styles.textColor || "default") === value,
      label: React.createElement("span", {className: "notebook-format-color-option"},
        React.createElement("span", {className: "notebook-format-color-swatch", "aria-hidden": "true",
          style: color.light ? notebookTextColorProperties(color) : undefined}),
        color.label)
    }));
  const textColorMenu = formatMenu("Text color",
    React.createElement("span", {className: "notebook-format-color-icon", "aria-hidden": "true",
      style: notebookTextColorProperties(notebookTextColor(state.styles.textColor))}, "A"),
    textColorChoices,
    value => value === "default" ? editor.removeStyles({textColor: ""}) : editor.addStyles({textColor: value}),
    !inlineSelection);
  const spacing = first?.props?.lineSpacing || 'normal';
  const spacingMenu = formatMenu('Line spacing',spacing==='normal'?'Spacing':`${spacing}×`,
    notebookLineSpacings.map(value=>({value,label:value==='normal'?'Default':value==='1'?'1 · Single':value==='2'?'2 · Double':value,selected:spacing===value})),
    value=>editor.transact(()=>textBlocks.forEach(block=>editor.updateBlock(block,{props:{lineSpacing:value}}))),!textBlocks.length);
  const tableMenu = formatMenu("Table", "Table", notebookTableActions(editor),
    value => applyNotebookTableAction(editor, value));
  const textStyleMenu = React.createElement(Menu, {position: "bottom-start", offset: 8, withinPortal: false, width: 180, loop: true, returnFocus: false},
    React.createElement(Menu.Target, null,
      React.createElement("button", {
        ref: textStyleButton, type: "button", className: "notebook-format-style notebook-format-text-style", "aria-label": "Text style",
        disabled: !state.editable || !textBlocks.length,
        onMouseDown: event => event.preventDefault()
      }, type.startsWith("heading-") ? `Heading ${type.slice(-1)}` : "Body")),
    React.createElement(Menu.Dropdown, {
      className: "notebook-format-style-menu", "aria-label": "Text style",
      onKeyDown: event => { if (event.key === "Escape") textStyleButton.current?.focus(); }
    },
      ...[["paragraph", "Body"], ["heading-1", "Heading 1"], ["heading-2", "Heading 2"], ["heading-3", "Heading 3"]]
        .map(([value, label]) => React.createElement(Menu.Item, {
          key: value, className: "notebook-format-style-option", "aria-current": type === value ? "true" : undefined,
          onClick: () => value.startsWith("heading-")
            ? setBlockType("heading", {level: Number(value.slice(-1))}) : setBlockType("paragraph")
        }, label))));
  const group = (label, ...children) => React.createElement('div',
    {className:'format-toolbar-group',role:'group','aria-label':label}, ...children);
  return React.createElement("div", {className: "notebook-format-toolbar", role: "toolbar", "aria-label": "Note formatting"},
    group('History',
    React.createElement("button", {
      type: "button", className: "notebook-format-button notebook-format-undo",
      title: "Undo (⌘Z / Ctrl+Z)", "aria-label": "Undo", disabled: !state.editable || !state.canUndo,
      onMouseDown: event => event.preventDefault(),
      onClick: () => {editor.focus(); editor.undo();}
    }, icon(["M7 4 3 8l4 4", "M3 8h8a5 5 0 0 1 0 10H8"])),
    React.createElement("button", {
      type: "button", className: "notebook-format-button notebook-format-redo",
      title: "Redo (⌘⇧Z / Ctrl+Shift+Z)", "aria-label": "Redo", disabled: !state.editable || !state.canRedo,
      onMouseDown: event => event.preventDefault(),
      onClick: () => {editor.focus(); editor.redo();}
    }, icon(["M13 4l4 4-4 4", "M17 8H9a5 5 0 0 0 0 10h3"]))),
    group('Text style and size', textStyleMenu, sizeMenu),
    group('Emphasis',
    styleButton("bold", "Bold", React.createElement("strong", null, "B")),
    styleButton("italic", "Italic", React.createElement("em", null, "I")),
    styleButton("underline", "Underline", React.createElement("u", null, "U")),
    styleButton("strike", "Strikethrough", React.createElement("s", null, "S")),
    textColorMenu,
    React.createElement("button", {
      type: "button", className: "notebook-format-button notebook-format-highlight",
      title: "Highlight", "aria-label": "Highlight", "aria-pressed": state.styles.backgroundColor === "yellow",
      disabled: !state.editable || !inlineSelection,
      onMouseDown: event => event.preventDefault(),
      onClick: () => {
        editor.focus();
        if (state.styles.backgroundColor === "yellow") editor.removeStyles({backgroundColor: "yellow"});
        else editor.addStyles({backgroundColor: "yellow"});
      }
    }, icon(["M5 12l6-8 5 4-6 8-5-4Z", "M5 12l-2 5h6", "M2 19h15"]))),
    group('Paragraph',
    listButton("bulletListItem", "Bulleted list", icon(["M7 5h10M7 10h10M7 15h10", "M3 4.5h.5v.5H3zM3 9.5h.5v.5H3zM3 14.5h.5v.5H3z"])),
    listButton("numberedListItem", "Numbered list", icon(["M8 5h9M8 10h9M8 15h9", "M2 3h1v4M2 9c3-2 3 1 0 3h3M2 15h2l-1 1c3 0 2 3-1 2"])),
    spacingMenu),
    group('Insert',
    React.createElement("span", {className:"notebook-format-link"},
      React.createElement("button", {type:"button", className:"notebook-format-button", title:"Link", "aria-label":"Link", "aria-expanded":linkOpen,
        disabled:!state.editable || !inlineSelection, onMouseDown:event=>event.preventDefault(), onClick:openLink},
        icon(["M8 6l2-2a4 4 0 0 1 6 6l-2 2M12 14l-2 2a4 4 0 0 1-6-6l2-2M7 13l6-6"])),
      linkOpen && React.createElement("form", {className:"notebook-format-link-form", onSubmit:submitLink,
        onKeyDown:event=>{if(event.key==="Escape"){event.preventDefault();setLinkOpen(false);if(restoreSelection(linkSelection.current)) editor.focus();}}},
        React.createElement("label", null, "URL", React.createElement("input", {autoFocus:true, type:"text", value:linkURL, "aria-label":"Link URL", placeholder:"https://", onChange:event=>setLinkURL(event.target.value)})),
        React.createElement("label", null, "Text", React.createElement("input", {type:"text", value:linkText, "aria-label":"Link text", onChange:event=>setLinkText(event.target.value)})),
        linkError && React.createElement("p", {role:"alert"}, linkError),
        React.createElement("div", null,
          React.createElement("button", {type:"submit"}, "Apply link"),
          React.createElement("button", {type:"button", onClick:()=>{setLinkOpen(false);if(restoreSelection(linkSelection.current)) editor.focus();}}, "Cancel")))) ,
    tableMenu,
    options.toolbarInsertElement ? React.createElement("span", {className: "notebook-format-insert-slot",
      ref: element => { if (element && options.toolbarInsertElement.parentElement !== element) element.append(options.toolbarInsertElement); }})
      : options.onInsert && React.createElement("details", {className: "notebook-format-insert"},
        React.createElement("summary", null, "Insert"),
        React.createElement("div", {className: "notebook-format-insert-menu"}, ...insertActions.map(([kind, label]) =>
          React.createElement("button", {type:"button", key:kind, disabled: !state.editable,
            onMouseDown:event=>event.preventDefault(), onClick:event=>{
              event.currentTarget.closest("details").open = false;
              options.onInsert(kind);
            }}, label))))),
    React.createElement("span", {className:"notebook-format-save-status", role:"status",
      ref:element=>{
        if (element && options.toolbarStatusElement && options.toolbarStatusElement.parentElement !== element) element.append(options.toolbarStatusElement);
        options.onStatusMount?.(element);
      }}, options.toolbarStatusElement ? null : options.status || "")
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
  return normalizeNotebookDocumentStyles({
    schema: notebookSchemaName,
    schemaVersion: notebookSchemaVersion,
    format: notebookDocumentFormat,
    document: blocks
  });
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
    dictionary: { ...en, placeholders: { ...en.placeholders, default: "", emptyDocument: "" } },
    domAttributes: {
      editor: { "aria-label": options.ariaLabel || "Note body", "aria-multiline": "true" }
    },
    initialContent,
    pasteHandler: ({event,editor,defaultPasteHandler}) => {
      if (!event.clipboardData?.types.includes('blocknote/html')) {
        const html=event.clipboardData?.getData('text/html');
        if (html) {
          const normalized=notebookTablePasteHTML(html);
          if (normalized!==html) {editor.pasteHTML(normalized);return true;}
        }
      }
      return defaultPasteHandler();
    },
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
      sideMenu: false,
      slashMenu: false,
      tableHandles: options.tableHandles !== false,
      renderEditor: false,
      onChange: () => options.onChange?.(options.native ? undefined : wrappedDocument(editor.document)),
      "aria-label": options.ariaLabel || "Notebook card"
    },
    options.toolbar !== false && options.editable !== false && React.createElement(PermitextFormattingToolbar, {editor, options}),
    React.createElement(BlockNoteViewEditor)
  );
}

export function mountPermitextNotebookEditor(element, options = {}) {
  if (!(element instanceof HTMLElement)) {
    throw new Error("A Notebook editor mount element is required.");
  }
  // Generated block IDs may change when a legacy document is mounted again;
  // they do not affect positions. Bind offsets to all actual content/structure.
  const positionDocument = (editor) => JSON.stringify(editor.state.doc.toJSON(),
    (key, value) => key === "id" ? undefined : value);
  const controllerRef = { current: null };
  const root = createRoot(element);
  let statusElement = null;
  const mountedOptions = {...options, onStatusMount: element => { statusElement = element; }};
  const render = () => root.render(React.createElement(PermitextNotebookEditor, { options: mountedOptions, controllerRef }));
  // Note navigation commits title and document in one browser task. Finish the
  // initial React tree before returning so the old editor never paints blank.
  if (options.synchronousMount) flushSync(render);
  else render();

  return {
    setStatus(text) {
      mountedOptions.status = String(text || "");
      if (statusElement && !options.toolbarStatusElement) statusElement.textContent = mountedOptions.status;
    },
    setEditable(editable) {
      mountedOptions.editable = Boolean(editable);
      if (controllerRef.current) controllerRef.current.isEditable = mountedOptions.editable;
      root.render(React.createElement(PermitextNotebookEditor, {options: {...mountedOptions}, controllerRef}));
    },
    getDocument() {
      return wrappedDocument(controllerRef.current?.document || options.document?.document || []);
    },
    getEditingPosition() {
      const editor = controllerRef.current?._tiptapEditor;
      const selection = editor?.state.selection;
      return selection ? { from: selection.from, to: selection.to, document: positionDocument(editor) } : null;
    },
    restoreEditingPosition(position) {
      const editor = controllerRef.current?._tiptapEditor;
      if (!editor || !position || !Number.isInteger(position.from) || !Number.isInteger(position.to)) return false;
      if (position.document !== positionDocument(editor)) return false;
      const limit = editor.state.doc.content.size;
      if (position.from < 0 || position.to > limit || position.from > position.to) return false;
      const current = editor.state.selection;
      if (current.from !== position.from || current.to !== position.to) {
        editor.commands.setTextSelection({ from: position.from, to: position.to });
      }
      editor.commands.focus(undefined, { scrollIntoView: false });
      return true;
    },
    setDocument(document) {
      const editor = controllerRef.current;
      if (!editor) return;
      editor.replaceBlocks(editor.document, blockNoteBlocksFromNotebookDocument(document));
    },
    insertImage() {
      const editor = controllerRef.current;
      if (!editor) return false;
      editor.focus();
      editor.insertBlocks([{ type: "image" }], editor.getTextCursorPosition().block, "after");
      return true;
    },
    insertReference(reference) {
      const editor = controllerRef.current;
      if (!editor) return false;
      editor.focus();
      editor.insertInlineContent([
        { type: "permitextReference", props: normalizedReference(reference) },
        " "
      ]);
      return true;
    },
    appendReference(reference, passages = [], comments = [], sourceBlocks = null) {
      const editor = controllerRef.current;
      const lastBlock = editor?.document.at(-1);
      if (!editor || !lastBlock) return false;
      const added = editor.insertBlocks(notebookReferenceBlocks(normalizedReference(reference), passages, comments, sourceBlocks), lastBlock, "after");
      editor.setTextCursorPosition(added.at(-1), "end");
      editor.focus();
      return true;
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
