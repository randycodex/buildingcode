import { mountPermitextNotebookEditor } from "./notebook-editor.js";
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

function snapshot() {
  const styles = editor?.getActiveStyles() || {};
  return { session, revision, document: controller.getDocument(), formatting: {
    bold: !!styles.bold, italic: !!styles.italic, strike: !!styles.strike,
    blockType: editor?.getTextCursorPosition().block.type || "paragraph",
    selectedText: editor?.getSelectedText() || "", linkURL: editor?.getSelectedLinkUrl() || ""
  } };
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
  return stable(left) === stable(right);
}

function layoutDiagnostics() {
  const round = value => Math.round(value * 100) / 100;
  const elements = [...document.querySelectorAll("html, body, #notebook, .bn-container, .bn-editor, .bn-block-content, .bn-inline-content, .notebook-reference-chip")].slice(0, 18);
  return {
    innerWidth: window.innerWidth, devicePixelRatio: window.devicePixelRatio,
    viewportWidth: window.visualViewport?.width ?? null, viewportScale: window.visualViewport?.scale ?? null,
    nativeWidthCSS: getComputedStyle(document.documentElement).getPropertyValue("--native-note-width"),
    bodyFontCSS: getComputedStyle(document.documentElement).getPropertyValue("--native-note-body-size"),
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
    if (shouldRevealCaret && editor?.isFocused()) {
      const range = window.getSelection()?.rangeCount ? window.getSelection().getRangeAt(0) : null;
      const rect = range?.getBoundingClientRect();
      if (rect && rect.height > 0) post("caret", { x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    }
  });
}

function requestNative(type, payload) {
  const requestID = String(++nextRequest);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
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
  document.documentElement.dataset.readOnly = String(readOnly);
  ready = new Promise((resolve) => {
    controller = mountPermitextNotebookEditor(mount, {
      document: command.document,
      editable: !readOnly,
      ariaLabel: "Note body",
      toolbar: false,
      sideMenu: false,
      slashMenu: false,
      insertItems: ["evidence", "research", "image"],
      onInsert: (kind) => chooseInsert(kind === "image" ? "image" : "reference"),
      onReady(instance) {
        editor = instance;
        previousTransactionText = fixtureDocumentText(controller.getDocument());
        traceInput("mounted");
        editor.onSelectionChange(() => {
          if (!replacing) insertionPosition = controller.getEditingPosition();
          post("formatting", { formatting: snapshot().formatting });
          measure(true);
        });
        measure();
        resolve();
      },
      onChange() {
        if (!controller || !editor) return;
        if (replacing) { traceInput("replacement-transaction-suppressed"); return; }
        revision += 1;
        traceInput("transaction", { beforeText: previousTransactionText });
        previousTransactionText = fixtureDocumentText(controller.getDocument());
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
      clearTimeout(pending.timeout);
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
          if (insertionPosition) controller.restoreEditingPosition(insertionPosition);
          controller.focus();
        }
        return snapshot();
      case "captureSelection":
        traceInput("capture-selection");
        insertionPosition = controller.getEditingPosition();
        return snapshot();
      case "blur": return finalizeEditing();
      case "format":
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
          if (!["bold", "italic", "strike"].includes(command.style)) throw new Error("Unsupported text style.");
          editor.toggleStyles({ [command.style]: true });
        } else if (command.type === "blockType") {
          if (!["paragraph", "heading", "bulletListItem", "numberedListItem"].includes(command.blockType)) throw new Error("Unsupported paragraph style.");
          const blocks = editor.getSelection()?.blocks || [editor.getTextCursorPosition().block];
          editor.transact(() => {
            for (const block of blocks) {
              if (block.type === "image") continue;
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
        post("formatting", { formatting: snapshot().formatting });
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
  mount.addEventListener(eventName, event => traceInput(eventName, {
    data: event.data ?? null, inputType: event.inputType || "", trusted: event.isTrusted === true,
    eventComposing: event.isComposing === true, prevented: event.defaultPrevented === true
  }), true);
}
mount.addEventListener("compositionstart", event => {
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
mount.addEventListener("pointerdown", (event) => {
  if (event.target.closest("[data-permitext-reference]")) {
    insertionPosition = controller.getEditingPosition();
    // Opening a source is navigation, not moving the text caret to that chip.
    event.preventDefault();
  }
});
mount.addEventListener("click", (event) => {
  const reference = event.target.closest("[data-permitext-reference]");
  if (reference) {
    event.preventDefault();
    post("reference", { reference: {
      referenceKind: reference.dataset.referenceKind,
      referenceID: reference.dataset.referenceId,
      label: reference.dataset.referenceLabel
    } });
  }
});
new ResizeObserver(() => measure()).observe(mount);
document.addEventListener("selectionchange", () => measure(true));
window.addEventListener("error", (event) => post("error", { message: event.message || "The note editor could not load." }));
window.addEventListener("unhandledrejection", (event) => post("error", { message: event.reason?.message || "The note editor could not complete this action." }));
post("loaded");
