import { applyNotebookTableAction, mountPermitextNotebookEditor, notebookTableActions } from "./notebook-editor.js";
import { nativeNotebookDocumentSnapshot } from "./native-notebook-state.js";
import { notebookFontSizes, notebookLineSpacings, notebookTextColor } from "../public/notebook-styles.js";
import { appendFindingTemplate } from "../public/project-workflow.js";
import "./native-notebook.css";

// The editor is shipped in the app. Networking, identity and persistence remain
// native; this bridge receives document data, never account tokens.
let session = "";
let revision = 0;
let controller;
let editor;
let ready;
let replacing = false;
let readOnly = false;
let insertionPosition;
let referencePosition;
let nextRequest = 0;
let lastHeight = 0;
let measureFrame = 0;
let revealPending = false;
let diagnosticsEnabled = false;
let inputTracingEnabled = false;
let traceTimer;
let traceSequence = 0;
let previousTransactionText = "";
const inputTrace = [];
let composing = false;
let settlingInput = 0;
const compositionWaiters = new Set();
const pendingRequests = new Map();
const mount = document.getElementById("notebook");
const addColumnButton = document.getElementById("notebook-add-column");

function post(type, payload = {}) {
  window.webkit?.messageHandlers?.permitextNotebook?.postMessage({
    version: 1, session, type, ...payload
  });
}

function fixtureDocumentText(note) {
  const inlineText = value => Array.isArray(value)
    ? value.map(inlineText).join("")
    : typeof value === "string" ? value
    : value && typeof value === "object" ? value.text || inlineText(value.content) : "";
  return inlineText(note?.document?.[0]?.content).slice(0, 500);
}

function traceInput(event, details = {}) {
  if (!inputTracingEnabled) return;
  const position = controller?.getEditingPosition();
  inputTrace.push({ sequence: ++traceSequence, milliseconds: Date.now(), event, revision,
    composing, replacing, settlingInput, focused: editor?.isFocused() || false,
    selection: position ? { from: position.from, to: position.to } : null,
    modelText: controller ? fixtureDocumentText(controller.getDocument()) : "",
    domText: (mount.querySelector?.(".bn-inline-content")?.textContent || "").slice(0, 500),
    ...details });
  if (inputTrace.length > 100) inputTrace.shift();
  clearTimeout(traceTimer);
  traceTimer = setTimeout(() => post("inputDiagnostics", { trace: inputTrace }), 150);
}

function formattingSnapshot() {
  const styles = editor?.getActiveStyles() || {};
  const history = editor?.getExtension("yUndo") || editor?.getExtension("history");
  return {
    bold: !!styles.bold, italic: !!styles.italic, underline: !!styles.underline, strike: !!styles.strike,
    highlight: styles.backgroundColor === "yellow", textColor: styles.textColor || "default",
    canUndo: Boolean(history && editor.canExec(history.undoCommand)),
    canRedo: Boolean(history && editor.canExec(history.redoCommand)),
    tableActions: notebookTableActions(editor).map(choice => ({ ...choice, disabled: Boolean(choice.disabled) })),
    blockType: editor?.getTextCursorPosition().block.type || "paragraph",
    selectedText: editor?.getSelectedText() || "", linkURL: editor?.getSelectedLinkUrl() || ""
  };
}

function snapshot() {
  return { session, revision, document: nativeNotebookDocumentSnapshot(controller.getDocument()), formatting: formattingSnapshot() };
}

// DOM blur can commit IME/autocorrect text after the native button tap. In
// ProseMirror, blur also schedules pending DOM records for a 20ms flush. Keep
// the WKWebView alive until those public DOM events and that queue have settled;
// an immediate model snapshot is not a final editing boundary.
async function finalizeEditing() {
  settlingInput += 1;
  traceInput("finalize-start");
  insertionPosition = controller.getEditingPosition();
  try {
    editor.blur();
    if (composing) {
      await new Promise((resolve, reject) => {
        const ended = () => { clearTimeout(timeout); compositionWaiters.delete(ended); resolve(); };
        const timeout = setTimeout(() => {
          compositionWaiters.delete(ended);
          reject(new Error("Finish the current text composition, then try again. Your note remains open."));
        }, 1000);
        compositionWaiters.add(ended);
      });
    }
    await new Promise(resolve => setTimeout(resolve, 25));
    if (composing) throw new Error("Finish the current text composition, then try again. Your note remains open.");
    // The committed text can advance the caret and change its fingerprint.
    // Capture that position, rather than restoring the pre-composition state.
    insertionPosition = controller.getEditingPosition();
    traceInput("finalize-snapshot");
    return snapshot();
  } finally {
    settlingInput -= 1;
  }
}

function applyLayout(availableWidth) {
  if (typeof availableWidth !== "number" || !Number.isFinite(availableWidth) || availableWidth <= 0) return;
  // WK's initial device viewport can exceed its final inset native frame.
  // Use actual UIView bounds so the document wraps inside the visible canvas.
  document.documentElement.style.setProperty("--native-note-width", `${availableWidth}px`);
  measure();
}

function applyTypography(bodyFontSize) {
  if (typeof bodyFontSize !== "number" || !Number.isFinite(bodyFontSize) || bodyFontSize <= 0) return;
  // iOS zooms focused editable content below 16px. That changes the visual
  // viewport after typing and clips an inset native canvas. Keep the minimum
  // editing size readable while preserving larger Dynamic Type settings.
  document.documentElement.style.setProperty("--native-note-body-size", `${Math.max(16, bodyFontSize)}px`);
  measure();
}

function equivalentDocuments(left, right) {
  const stable = (value) => JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
  return stable(nativeNotebookDocumentSnapshot(left)) === stable(nativeNotebookDocumentSnapshot(right));
}

function layoutDiagnostics() {
  const round = value => Math.round(value * 100) / 100;
  const elements = [...document.querySelectorAll("html, body, #notebook, .bn-container, .bn-editor, .bn-block-content, .bn-inline-content, .notebook-reference-chip")].slice(0, 18);
  const firstTableCell = mount.querySelector("table tr > :is(th, td)")?.getBoundingClientRect();
  return {
    innerWidth: window.innerWidth, devicePixelRatio: window.devicePixelRatio,
    viewportWidth: window.visualViewport?.width ?? null, viewportScale: window.visualViewport?.scale ?? null,
    nativeWidthCSS: getComputedStyle(document.documentElement).getPropertyValue("--native-note-width"),
    bodyFontCSS: getComputedStyle(document.documentElement).getPropertyValue("--native-note-body-size"),
    tables: [...mount.querySelectorAll("table")].map(table => ({
      rows: table.rows.length, columns: table.rows[0]?.cells.length ?? 0
    })),
    firstTableCell: firstTableCell ? { width: round(firstTableCell.width), height: round(firstTableCell.height) } : null,
    elements: elements.map(element => {
      const rect = element.getBoundingClientRect();
      const css = getComputedStyle(element);
      return { tag: element.tagName, class: element.className, type: element.dataset.contentType || "",
        x: round(rect.x), width: round(rect.width), height: round(rect.height),
        clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
        fontSize: css.fontSize, lineHeight: css.lineHeight, textSizeAdjust: css.getPropertyValue("-webkit-text-size-adjust"),
        cssWidth: css.width, minWidth: css.minWidth, maxWidth: css.maxWidth,
        padding: css.padding, margin: css.margin, boxSizing: css.boxSizing,
        whiteSpace: css.whiteSpace, overflowWrap: css.overflowWrap, flex: css.flex };
    })
  };
}

function restoreInsertionPosition() {
  if (insertionPosition && !controller.restoreEditingPosition(insertionPosition)) {
    throw new Error("The Note changed. Close this tool and select the insertion point again.");
  }
}

function measure(revealCaret = false) {
  revealPending ||= revealCaret;
  cancelAnimationFrame(measureFrame);
  measureFrame = requestAnimationFrame(() => {
    if (diagnosticsEnabled) post("diagnostics", { diagnostics: layoutDiagnostics() });
    const shouldRevealCaret = revealPending;
    revealPending = false;
    const height = Math.ceil(Math.max(mount.getBoundingClientRect().height, 260));
    if (height !== lastHeight) {
      lastHeight = height;
      post("height", { height });
    }
    positionAddColumnButton();
    if (shouldRevealCaret && editor?.isFocused()) {
      const range = window.getSelection()?.rangeCount ? window.getSelection().getRangeAt(0) : null;
      const rect = range?.getBoundingClientRect();
      if (rect && rect.height > 0) post("caret", { x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    }
  });
}

function positionAddColumnButton() {
  if (!addColumnButton) return;
  const focus = window.getSelection()?.focusNode;
  const cell = (focus?.nodeType === 1 ? focus : focus?.parentElement)?.closest("td, th");
  const wrapper = cell?.closest(".tableWrapper");
  addColumnButton.hidden = readOnly || !wrapper || !mount.contains(wrapper);
  if (addColumnButton.hidden) return;
  const edge = wrapper.getBoundingClientRect();
  const row = cell.parentElement.getBoundingClientRect();
  addColumnButton.style.left = `${edge.right + window.scrollX}px`;
  addColumnButton.style.top = `${Math.max(edge.top, Math.min(row.top, edge.bottom - 44)) + window.scrollY}px`;
}

addColumnButton?.addEventListener("pointerdown", event => event.preventDefault());
addColumnButton?.addEventListener("click", () => {
  if (!readOnly && !composing && editor) {
    try {
      if (applyNotebookTableAction(editor, "append-column")) {
        editor.prosemirrorView.focus();
        measure(true);
      }
    } catch (error) {
      post("error", { message: error.message });
    }
  }
});

function requestNative(type, payload) {
  const requestID = String(++nextRequest);
  return new Promise((resolve, reject) => {
    // A read can wait for iOS to reconnect. Swift cancels it when the editor closes.
    const timeout = type === "asset" ? undefined : setTimeout(() => {
      pendingRequests.delete(requestID);
      reject(new Error("The image could not be loaded. Try again when connected."));
    }, 60000);
    pendingRequests.set(requestID, { resolve, reject, timeout });
    post(type, { requestID, ...payload });
  });
}

function chooseInsert(kind) {
  insertionPosition = controller.getEditingPosition();
  post("insert", { kind });
}

async function configure(command) {
  if (controller) throw new Error("The note editor is already initialized.");
  session = command.session;
  diagnosticsEnabled = command.diagnostics === true;
  inputTracingEnabled = command.inputDiagnostics === true && command.syntheticFixture === true;
  applyTypography(command.bodyFontSize);
  applyLayout(command.availableWidth);
  readOnly = command.readOnly;
  for (const [prefix, { light, dark }] of Object.entries(command.referenceColors || {})) {
    if (/^[a-z0-9]+$/.test(prefix) && /^#[a-f\d]{6}$/i.test(light) && /^#[a-f\d]{6}$/i.test(dark)) {
      mount.style.setProperty(`--notebook-reference-${prefix}`, `light-dark(${light}, ${dark})`);
    }
  }
  document.documentElement.dataset.readOnly = String(readOnly);
  ready = new Promise((resolve) => {
    controller = mountPermitextNotebookEditor(mount, {
      document: command.document,
      editable: !readOnly,
      ariaLabel: "Note body",
      toolbar: false,
      native: true,
      tableHandles: false,
      sideMenu: false,
      slashMenu: false,
      insertItems: ["evidence", "research", "image"],
      onInsert: (kind) => chooseInsert(kind === "image" ? "image" : "reference"),
      onReady(instance) {
        editor = instance;
        if (inputTracingEnabled) previousTransactionText = fixtureDocumentText(controller.getDocument());
        traceInput("mounted");
        editor.onSelectionChange(() => {
          if (!replacing) insertionPosition = controller.getEditingPosition();
          post("formatting", { formatting: formattingSnapshot() });
          measure(true);
        });
        measure();
        resolve();
      },
      onChange() {
        if (!controller || !editor) return;
        if (replacing) { traceInput("replacement-transaction-suppressed"); return; }
        revision += 1;
        if (inputTracingEnabled) {
          traceInput("transaction", { beforeText: previousTransactionText });
          previousTransactionText = fixtureDocumentText(controller.getDocument());
        }
        post("change", snapshot());
        measure(true);
      },
      resolveFileUrl: (url) => requestNative("asset", { url }),
      uploadFile: async (file) => {
        if (file.size > 8 * 1024 * 1024) throw new Error("Choose an image smaller than 8 MB.");
        const dataURL = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = reject;
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
        return requestNative("upload", { name: file.name, mimeType: file.type, base64: String(dataURL).split(",")[1] });
      }
    });
  });
  await ready;
  return snapshot();
}

window.PermitextNativeNotebook = {
  async dispatch(command) {
    if (command.type === "configure") return configure(command);
    if (!session || command.session !== session) throw new Error("This editor belongs to another note.");
    // Asset replies must run while React mounts, before the editor is ready.
    if (command.type === "assetReply") {
      const pending = pendingRequests.get(command.requestID);
      if (!pending) return null;
      if (pending.timeout !== undefined) clearTimeout(pending.timeout);
      pendingRequests.delete(command.requestID);
      command.error ? pending.reject(new Error(command.error)) : pending.resolve(command.value);
      return null;
    }
    await ready;
    switch (command.type) {
      case "snapshot":
        traceInput("snapshot-request", { finalize: command.finalizeEditing === true });
        return command.finalizeEditing ? finalizeEditing() : snapshot();
      case "inputDiagnostics": return inputTracingEnabled ? inputTrace : null;
      case "diagnostics": return diagnosticsEnabled ? layoutDiagnostics() : null;
      case "layout":
        applyLayout(command.availableWidth);
        return snapshot();
      case "typography":
        applyTypography(command.bodyFontSize);
        return snapshot();
      case "readOnly":
        readOnly = !!command.readOnly;
        controller.setEditable(!readOnly);
        document.documentElement.dataset.readOnly = String(readOnly);
        return snapshot();
      case "replace":
        traceInput("replace-request", { expectedRevision: command.expectedRevision ?? null,
          proposedText: fixtureDocumentText(command.document) });
        // A save acknowledgement with the same rich content is an echo, even
        // if its object keys were serialized in a different order. Keep undo
        // and selection and do not manufacture a conflict for that echo.
        if (equivalentDocuments(command.document, controller.getDocument())) {
          traceInput("replace-echo");
          return snapshot();
        }
        // Native may have scheduled a refresh just before another keystroke
        // reached this process. That refresh is no longer a safe replacement.
        // Return the live document for conflict handling; never retry or erase
        // the user's edits merely because the native binding is older.
        if (composing || settlingInput > 0 || !Number.isInteger(command.expectedRevision) || command.expectedRevision !== revision) {
          traceInput("replace-rejected");
          return { ...snapshot(), replacementRejected: true };
        }
        replacing = true;
        try { controller.setDocument(command.document); } finally { replacing = false; }
        revision += 1;
        traceInput("replace-accepted", { beforeText: previousTransactionText });
        previousTransactionText = fixtureDocumentText(controller.getDocument());
        measure();
        return snapshot();
      case "focus":
        traceInput("focus-request");
        if (!readOnly) {
          controller.focus();
          controller.restoreEditingPosition(command.position ?? insertionPosition);
        }
        return snapshot();
      case "captureSelection":
        traceInput("capture-selection");
        insertionPosition = controller.getEditingPosition();
        return snapshot();
      case "blur": return finalizeEditing();
      case "format":
      case "fontSize":
      case "textColor":
      case "lineSpacing":
      case "table":
      case "findingTemplate":
      case "blockType":
      case "link":
      case "undo":
      case "redo": {
        if (readOnly) throw new Error("This note is read-only.");
        let linkURL;
        if (command.type === "link") {
          linkURL = String(command.url || "").trim();
          let parsed;
          try { parsed = new URL(linkURL); } catch { throw new Error("Enter a valid HTTPS, HTTP, or mailto link."); }
          if (linkURL.length > 2000 || !["https:", "http:", "mailto:"].includes(parsed.protocol)) {
            throw new Error("Links must use HTTPS, HTTP, or mailto.");
          }
        }
        if (!["undo", "redo"].includes(command.type)) restoreInsertionPosition();
        if (command.type === "format") {
          if (command.style === "highlight") {
            if (editor.getActiveStyles().backgroundColor === "yellow") editor.removeStyles({backgroundColor: "yellow"});
            else editor.addStyles({backgroundColor: "yellow"});
          } else {
            if (!["bold", "italic", "strike", "underline"].includes(command.style)) throw new Error("Unsupported text style.");
            editor.toggleStyles({ [command.style]: true });
          }
        } else if (command.type === "fontSize") {
          if (command.value === "default") editor.removeStyles({fontSize: editor.getActiveStyles().fontSize || ""});
          else {
            if (!notebookFontSizes.includes(command.value)) throw new Error("Unsupported font size.");
            editor.addStyles({fontSize: command.value});
          }
        } else if (command.type === "textColor") {
          if (command.value === "default") editor.removeStyles({textColor: ""});
          else {
            if (!notebookTextColor(command.value)) throw new Error("Unsupported text color.");
            editor.addStyles({textColor: command.value});
          }
        } else if (command.type === "lineSpacing") {
          if (!notebookLineSpacings.includes(command.value)) throw new Error("Unsupported line spacing.");
          const blocks = editor.getSelection()?.blocks || [editor.getTextCursorPosition().block];
          editor.transact(() => {
            for (const block of blocks) {
              if (["paragraph", "heading", "bulletListItem", "numberedListItem"].includes(block.type)) {
                editor.updateBlock(block, {props: {lineSpacing: command.value}});
              }
            }
          });
        } else if (command.type === "table") {
          if (!applyNotebookTableAction(editor, command.value)) throw new Error("Select a table cell to use this action.");
        } else if (command.type === "findingTemplate") {
          const template = appendFindingTemplate(undefined, () => undefined).document;
          const inserted = editor.insertBlocks(template, editor.document.at(-1), "after");
          editor.setTextCursorPosition(inserted[1], "start");
        } else if (command.type === "blockType") {
          if (!["paragraph", "heading", "bulletListItem", "numberedListItem"].includes(command.blockType)) throw new Error("Unsupported paragraph style.");
          const blocks = editor.getSelection()?.blocks || [editor.getTextCursorPosition().block];
          editor.transact(() => {
            for (const block of blocks) {
              if (!["paragraph", "heading", "bulletListItem", "numberedListItem"].includes(block.type)) continue;
              editor.updateBlock(block, { type: command.blockType,
                ...(command.blockType === "heading" ? { props: { level: command.level || 2 } } : {}) });
            }
          });
        } else if (command.type === "link") {
          const selected = controller.getEditingPosition();
          const label = String(command.text || "").trim();
          const selectedText = editor.getSelectedText();
          // Supplying even unchanged text makes BlockNote replace the range,
          // flattening mixed styles and inline source atoms. Mark it in place.
          // At an empty caret, insert a visible label (falling back to the URL).
          editor.createLink(linkURL, selected?.from === selected?.to
            ? label || linkURL
            : label && label !== selectedText ? label : undefined);
        } else if (command.type === "undo") controller.undo();
        else controller.redo();
        controller.focus();
        insertionPosition = controller.getEditingPosition();
        post("formatting", { formatting: formattingSnapshot() });
        measure(true);
        return snapshot();
      }
      case "reference":
      case "image": {
        if (readOnly) throw new Error("This note is read-only.");
        restoreInsertionPosition();
        insertionPosition = null;
        if (command.type === "reference") controller.insertReference(command.reference);
        else {
          editor.focus();
          const inserted = editor.insertBlocks([command.block, { type: "paragraph", content: [] }], editor.getTextCursorPosition().block, "after");
          editor.setTextCursorPosition(inserted[1], "start");
        }
        measure(true);
        return snapshot();
      }
      default: throw new Error("Unknown editor command.");
    }
  }
};

for (const eventName of ["beforeinput", "input"]) {
  mount.addEventListener(eventName, event => {
    if (eventName === "beforeinput") clearFirstCellFocus();
    traceInput(eventName, {
      data: event.data ?? null, inputType: event.inputType || "", trusted: event.isTrusted === true,
      eventComposing: event.isComposing === true, prevented: event.defaultPrevented === true
    });
  }, true);
}
mount.addEventListener("compositionstart", event => {
  clearFirstCellFocus();
  composing = true;
  traceInput("compositionstart", { data: event?.data ?? null, trusted: event?.isTrusted === true });
});
mount.addEventListener("compositionupdate", event => {
  traceInput("compositionupdate", { data: event.data ?? null, trusted: event.isTrusted === true });
});
mount.addEventListener("compositionend", event => {
  composing = false;
  traceInput("compositionend", { data: event?.data ?? null, trusted: event?.isTrusted === true });
  for (const resolve of [...compositionWaiters]) resolve();
});
const interactiveContent = "a, button, [data-permitext-reference]";
let firstCellTap = null;
let firstCellCaret = null;
let cellSelectionTap = null;
function clearFirstCellFocus() {
  firstCellTap = null;
  firstCellCaret = null;
  cellSelectionTap = null;
}
mount.addEventListener("pointerdown", (event) => {
  clearFirstCellFocus();
  const target = event.target;
  const cell = target.closest("td, th");
  if (cell && event.isPrimary && event.button === 0 && !event.shiftKey && !readOnly && editor &&
      !target.closest(interactiveContent)) {
    const tap = { cell, x: event.clientX, y: event.clientY, time: event.timeStamp };
    if (!editor.isFocused()) firstCellTap = tap;
    else cellSelectionTap = tap;
  }
  if (target.closest("[data-permitext-reference]")) {
    referencePosition = controller.getEditingPosition();
    // Opening a source is navigation, not moving the text caret to that chip.
    event.preventDefault();
  }
}, true);
mount.addEventListener("pointercancel", clearFirstCellFocus, true);
mount.addEventListener("keydown", clearFirstCellFocus, true);
mount.addEventListener("focusout", clearFirstCellFocus, true);
mount.addEventListener("focusin", event => {
  const tap = firstCellTap;
  firstCellTap = null;
  if (!tap || readOnly || composing || event.timeStamp - tap.time > 1000) return;
  const view = editor.prosemirrorView;
  if (event.target !== view.dom || !view.dom.contains(tap.cell)) return;

  // On the first tap in a cell WebKit can focus the editor without sending
  // a click. Adopt the tapped character during focus, before the initial
  // document selection can overwrite the caret.
  const hit = document.caretRangeFromPoint(tap.x, tap.y);
  const selection = window.getSelection();
  const hitCell = hit && tap.cell.contains(hit.startContainer);
  const node = hitCell ? hit.startContainer : selection?.focusNode;
  const offset = hitCell ? hit.startOffset : selection?.focusOffset;
  if (!node || !tap.cell.contains(node)) return;
  const position = view.posAtDOM(node, offset);
  if (view.state.doc.resolve(position).parent.type.name !== "tableParagraph") return;
  firstCellCaret = { doc: view.state.doc, position, node, offset, until: event.timeStamp + 300 };
  editor._tiptapEditor.commands.setTextSelection(position);
}, true);
// On first focus WebKit can reuse the initial model selection. Resolve a
// single tap against the rendered text before opening the keyboard.
let firstTouch = null;
let firstTap = null;
mount.addEventListener("touchstart", event => {
  firstTap = null;
  const touch = event.touches[0];
  firstTouch = event.touches.length === 1 && !readOnly && editor && !editor.isFocused()
    && event.target.closest(".ProseMirror") && !event.target.closest(interactiveContent + ", td, th")
    ? { x: touch.clientX, y: touch.clientY, time: event.timeStamp } : null;
}, { passive: true });
mount.addEventListener("touchcancel", () => { firstTouch = null; firstTap = null; });
mount.addEventListener("touchend", event => {
  const start = firstTouch;
  firstTouch = null;
  if (!start || event.touches.length || event.timeStamp - start.time > 400) return;
  const touch = event.changedTouches[0];
  if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 8) return;
  const view = editor.prosemirrorView;
  const hit = view.posAtCoords({ left: touch.clientX, top: touch.clientY });
  if (!hit || !view.state.doc.resolve(hit.pos).parent.inlineContent) return;
  firstTap = { position: hit.pos, doc: view.state.doc, time: event.timeStamp };
}, { capture: true, passive: true });
mount.addEventListener("click", event => {
  const tap = firstTap;
  firstTap = null;
  if (!tap || readOnly || composing || event.defaultPrevented || event.timeStamp - tap.time > 400 ||
      event.target.closest(interactiveContent + ", td, th")) return;
  const view = editor.prosemirrorView;
  if (view.state.doc !== tap.doc) return;
  // Restore selection during the trusted click, when WebKit can activate typing.
  view.dom.blur();
  view.dom.focus({ preventScroll: true });
  editor._tiptapEditor.commands.setTextSelection(tap.position);
});
function activateReference(event) {
  const reference = event.target.closest("[data-permitext-reference]");
  if (reference) {
    event.preventDefault();
    post("reference", { position: referencePosition ?? controller.getEditingPosition(), reference: {
      referenceKind: reference.dataset.referenceKind,
      referenceID: reference.dataset.referenceId,
      label: reference.dataset.referenceLabel
    } });
    referencePosition = null;
  }
}
mount.addEventListener("touchend", activateReference, { capture: true, passive: false });
mount.addEventListener("click", activateReference, true);
new ResizeObserver(() => measure()).observe(mount);
document.addEventListener("selectionchange", event => {
  const selection = window.getSelection();
  const caret = firstCellCaret;
  if (caret) {
    const view = editor.prosemirrorView;
    if (event.timeStamp > caret.until || readOnly || composing || !view.hasFocus() ||
        view.state.doc !== caret.doc || !view.dom.contains(caret.node) || !selection?.isCollapsed) {
      firstCellCaret = null;
    } else if (selection.focusNode !== caret.node || selection.focusOffset !== caret.offset) {
      // WebKit can reset the DOM caret after the first focus has painted.
      // Correct it before ProseMirror reads that transient selection.
      firstCellCaret = null;
      selection.collapse(caret.node, caret.offset);
      if (view.state.selection.head !== caret.position) {
        editor._tiptapEditor.commands.setTextSelection(caret.position);
      }
      measure(true);
      return;
    }
  }
  const node = selection?.focusNode;
  const tap = cellSelectionTap;
  if (tap && event.timeStamp - tap.time > 300) cellSelectionTap = null;
  if (cellSelectionTap && !readOnly && !composing && editor?.isFocused() && selection?.isCollapsed && tap.cell.contains(node)) {
    // WebKit can draw the caret in an empty cell before ProseMirror has
    // moved its model selection there. Keep the native table menu and typing
    // on the cell the user actually selected.
    const view = editor.prosemirrorView;
    const position = view.posAtDOM(node, selection.focusOffset);
    if (view.state.selection.head !== position && view.state.doc.resolve(position).parent.type.name === "tableParagraph") {
      cellSelectionTap = null;
      editor._tiptapEditor.commands.setTextSelection(position);
    }
  }
  measure(true);
}, true);
window.addEventListener("error", (event) => post("error", { message: event.message || "The note editor could not load." }));
window.addEventListener("unhandledrejection", (event) => post("error", { message: event.reason?.message || "The note editor could not complete this action." }));
post("loaded");
