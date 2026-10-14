import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Execute the production bridge with a controlled editor adapter. The separate
// continuous-editor test covers BlockNote schema round trips; this verifies the
// native command/message boundary and selection/identity ownership.
const source = (await readFile(new URL("../src/native-notebook.js", import.meta.url), "utf8"))
  .replace(/^import .*;\n/gm, "");
const messages = [];
const events = new Map();
const cssVariables = new Map();
let options;
let note;
let selectionListener;
let selection = { from: 3, to: 12, document: "rich-note" };
let restored;
let restoreSucceeds = true;
let activeStyles = { bold: true };
let focused = false;
let replacementCount = 0;
let transactionCount = 0;
let selectedBlocks;
let onBlur;
let selectedText = "mixed text";
const createdLinks = [];
const instance = {
  isEditable: true,
  onSelectionChange(callback) { selectionListener = callback; },
  getActiveStyles: () => activeStyles,
  getTextCursorPosition: () => ({ block: note.document[0] }),
  getSelectedText: () => selectedText,
  getSelectedLinkUrl: () => "https://example.com/source",
  getSelection: () => selectedBlocks ? { blocks: selectedBlocks } : undefined,
  isFocused: () => focused,
  focus() { focused = true; },
  blur() { focused = false; onBlur?.(); },
  toggleStyles(styles) { activeStyles = { ...activeStyles, ...styles }; },
  transact(operation) { transactionCount += 1; operation(); },
  updateBlock(block, changes) { Object.assign(block, changes); options.onChange(); },
  createLink(url, text) {
    createdLinks.push({ url, text });
    // BlockNote's text argument inserts replacement text; undefined only marks.
    if (text !== undefined) note.document[0].content.push({ type: "link", href: url, content: [{ type: "text", text }] });
    options.onChange();
  },
  insertBlocks(blocks) { note.document.push(...blocks); options.onChange(); return blocks; },
  setTextCursorPosition() {}
};
const controller = {
  getDocument: () => structuredClone(note),
  setDocument(document) { replacementCount += 1; note = structuredClone(document); options.onChange(); },
  getEditingPosition: () => structuredClone(selection),
  restoreEditingPosition(position) { if (!restoreSucceeds) return false; restored = position; return true; },
  setEditable(editable) { instance.isEditable = editable; },
  insertReference(reference) { note.document[0].content.push({ type: "permitextReference", props: reference }); options.onChange(); },
  focus: () => instance.focus(),
  undo() {}, redo() {}
};
const environment = {
  window: {
    webkit: { messageHandlers: { permitextNotebook: { postMessage: (message) => messages.push(structuredClone(message)) } } },
    addEventListener: (name, callback) => events.set(name, callback),
    getSelection: () => ({ rangeCount: 0 })
  },
  document: {
    documentElement: { dataset: {}, style: { setProperty: (name, value) => cssVariables.set(name, value) } },
    getElementById: () => ({ getBoundingClientRect: () => ({ height: 300 }), addEventListener: (name, callback) => events.set(name, callback) }),
    addEventListener: (name, callback) => events.set(name, callback)
  },
  ResizeObserver: class { observe() {} },
  requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  setTimeout, clearTimeout, URL,
  mountPermitextNotebookEditor(_element, configuration) {
    options = configuration;
    note = structuredClone(configuration.document);
    queueMicrotask(() => options.onReady(instance));
    return controller;
  }
};
const context = vm.createContext(environment);
vm.runInContext(source, context, { filename: "native-notebook.js" });
const dispatch = (command) => context.window.PermitextNativeNotebook.dispatch({ session: "account/project/draft", ...command });
const document = {
  schema: "permitext-notebook-card", schemaVersion: 2, format: "blocknote-json",
  document: [{ id: "p1", type: "paragraph", props: {}, content: [
    { type: "text", text: "Text ", styles: { bold: true, italic: true, strike: true } },
    { type: "link", href: "https://example.com", content: [{ type: "text", text: "source", styles: {} }] },
    { type: "permitextReference", props: { referenceKind: "researchAnswer", referenceID: "a1", label: "Answer" } }
  ], children: [{ id: "child", type: "bulletListItem", props: {}, content: [{ type: "text", text: "Nested" }], children: [] }] },
  { id: "i1", type: "image", props: { url: "permitext-notebook-asset:asset1", caption: "Caption" }, children: [] }]
};
assert.equal(messages[0].type, "loaded");
const configured = await dispatch({ type: "configure", readOnly: false, bodyFontSize: 17, availableWidth: 366, document });
assert.deepEqual(structuredClone(configured.document), document, "mount must retain rich runs, nesting, references and images");
assert.equal(cssVariables.get("--native-note-body-size"), "17px");
assert.equal(cssVariables.get("--native-note-width"), "366px");
await dispatch({ type: "layout", availableWidth: 320 });
assert.equal(cssVariables.get("--native-note-width"), "320px");
await dispatch({ type: "layout", availableWidth: 0 });
assert.equal(cssVariables.get("--native-note-width"), "320px", "transient zero native bounds cannot collapse the page");
await dispatch({ type: "typography", bodyFontSize: 14.6666666667 });
assert.equal(cssVariables.get("--native-note-body-size"), "16px", "small Dynamic Type cannot trigger iOS input focus auto-zoom");
await dispatch({ type: "typography", bodyFontSize: 17 });
assert.equal(cssVariables.get("--native-note-body-size"), "17px");
await dispatch({ type: "typography", bodyFontSize: 35 });
assert.equal(cssVariables.get("--native-note-body-size"), "35px");
assert.equal(replacementCount, 0, "Dynamic Type updates must not replace text, selection or undo history");
assert.deepEqual(note, document);
assert.equal(options.toolbar, false);
assert.equal(options.sideMenu, false);
assert.equal(options.slashMenu, false);
assert.equal(configured.formatting.selectedText, "mixed text");

await dispatch({ type: "captureSelection" });
await dispatch({ type: "blur" });
assert.equal(focused, false);
await dispatch({ type: "reference", reference: { referenceKind: "notebookCard", referenceID: "n2", label: "Another note" } });
assert.deepEqual(structuredClone(restored), selection, "native picker return restores document selection");
assert.equal(messages.findLast(item => item.type === "change").revision, 1);
assert.equal((await dispatch({ type: "snapshot" })).document.document[0].content.at(-1).props.referenceID, "n2");
assert.equal(note.document[0].children[0].content[0].text, "Nested");

selectionListener();
assert.equal(messages.at(-1).type, "formatting");
await dispatch({ type: "format", style: "strike" });
assert.equal((await dispatch({ type: "snapshot" })).formatting.strike, true);
await assert.rejects(dispatch({ type: "format", style: "arbitrary" }), /Unsupported text style/);
await assert.rejects(dispatch({ type: "link", url: "javascript:alert(1)" }), /Links must/);
const validSelection = structuredClone(restored);
const beforeInvalidLink = structuredClone(note);
await assert.rejects(dispatch({ type: "link", url: "https://" }), /valid HTTPS/);
assert.deepEqual(note, beforeInvalidLink, "an incomplete link must not mutate the note");
assert.deepEqual(structuredClone(restored), validSelection, "invalid link must not move the selection");
await dispatch({ type: "readOnly", readOnly: true });
assert.equal(instance.isEditable, false);
await assert.rejects(dispatch({ type: "reference", reference: {} }), /read-only/);
await assert.rejects(dispatch({ type: "snapshot", session: "another-account" }), /another note/);
await dispatch({ type: "readOnly", readOnly: false });

const asset = options.resolveFileUrl("permitext-notebook-asset:asset1");
const assetRequest = messages.at(-1);
assert.equal(assetRequest.type, "asset");
await dispatch({ type: "assetReply", requestID: assetRequest.requestID, value: "data:image/png;base64,eA==" });
assert.equal(await asset, "data:image/png;base64,eA==");
const beforeReplace = messages.filter(message => message.type === "change").length;
const revisionBeforeRefresh = (await dispatch({ type: "snapshot" })).revision;
const queuedRefresh = dispatch({ type: "replace", document, expectedRevision: revisionBeforeRefresh });
// This keystroke arrives after native captured its refresh baseline but before
// the async bridge replacement runs. The production code must keep it.
note.document[0].content[0].text = "Typed while refresh was queued";
options.onChange();
const retained = await queuedRefresh;
assert.equal(retained.replacementRejected, true);
assert.equal(retained.document.document[0].content[0].text, "Typed while refresh was queued");
assert.equal(replacementCount, 0, "a stale queued refresh must never call setDocument");
const repeated = await dispatch({ type: "replace", document, expectedRevision: revisionBeforeRefresh });
assert.equal(repeated.replacementRejected, true);
assert.equal(replacementCount, 0, "retrying the stale replacement must still preserve typed content");
const sameDocumentWithReorderedKeys = Object.fromEntries(Object.entries(structuredClone(note)).reverse());
const acknowledgement = await dispatch({ type: "replace", document: sameDocumentWithReorderedKeys, expectedRevision: revisionBeforeRefresh });
assert.equal(acknowledgement.replacementRejected, undefined,
  "an identical save acknowledgement must not falsely require conflict review");
assert.equal(replacementCount, 0, "an identical acknowledgement must keep undo and selection without remounting");
const changesAfterRace = messages.filter(message => message.type === "change").length;
const accepted = await dispatch({ type: "replace", document, expectedRevision: retained.revision });
assert.equal(accepted.replacementRejected, undefined);
assert.deepEqual(structuredClone(accepted.document), document, "a deliberate replacement at the fresh revision remains supported");
assert.equal(changesAfterRace, beforeReplace + 1, "the intervening keystroke is the only user edit during the race");
assert.equal(messages.filter(message => message.type === "change").length, changesAfterRace,
  "applying a server/draft document must not echo a user edit back to autosave");
selectedBlocks = [note.document[0], note.document[1]];
await dispatch({ type: "blockType", blockType: "bulletListItem" });
assert.equal(transactionCount, 1, "formatting several selected blocks must create one undo transaction");
assert.equal(note.document[0].type, "bulletListItem");
assert.equal(note.document[1].type, "image", "paragraph formatting must not convert images");
selectedBlocks = undefined;
note.document[0].content[0].text = "Final keystroke before Back";
options.onChange();
const flushed = await dispatch({ type: "snapshot" });
assert.equal(flushed.document.document[0].content[0].text, "Final keystroke before Back");
assert.equal(flushed.revision, messages.findLast(item => item.type === "change").revision);
// The composition transaction is still pending when native requests departure;
// ProseMirror processes the pending blur queue 20ms after composition ends.
events.get("compositionstart")();
const compositionBaseRevision = flushed.revision;
const duringComposition = await dispatch({ type: "replace", document, expectedRevision: compositionBaseRevision });
assert.equal(duringComposition.replacementRejected, true,
  "matching model revision cannot authorize replacing uncommitted DOM composition");
onBlur = () => {
  setTimeout(() => {
    events.get("compositionend")();
    setTimeout(() => {
      note.document[0].content[0].text = "Complete composition before Back";
      selection = { from: 37, to: 37, document: "committed-composition" };
      options.onChange();
    }, 20);
  }, 0);
};
const committed = await dispatch({ type: "snapshot", finalizeEditing: true });
assert.equal(committed.document.document[0].content[0].text, "Complete composition before Back",
  "finalizing snapshot must include the transaction committed after blur");
assert.equal(committed.revision, compositionBaseRevision + 1);
await dispatch({ type: "focus" });
assert.deepEqual(structuredClone(restored), selection,
  "returning from a source restores the committed composition caret");
assert.equal(focused, true);
onBlur = undefined;
await dispatch({ type: "snapshot" });
assert.equal(focused, true, "ordinary autosave snapshots must retain keyboard focus");
events.get("compositionstart")();
await assert.rejects(dispatch({ type: "snapshot", finalizeEditing: true }), /Finish the current text composition/,
  "a composition that has not ended must block departure instead of reporting a stale successful save");
events.get("compositionend")();
assert.equal(note.document[0].content[0].text, "Complete composition before Back");
// Native Link must use the same mark-vs-replacement semantics as the web
// toolbar, preserving mixed styles and embedded source chips when unchanged.
selection = { from: 3, to: 12, document: "rich-link-selection" };
selectedText = "mixed text";
await dispatch({ type: "captureSelection" });
const richSelectionBefore = structuredClone(note);
await dispatch({ type: "link", url: "https://example.com/marked", text: selectedText });
assert.deepEqual(createdLinks.at(-1), { url: "https://example.com/marked", text: undefined });
assert.deepEqual(note, richSelectionBefore, "marking selected rich content must not supply replacement text that flattens styles or source atoms");
await dispatch({ type: "link", url: "https://example.com/marked", text: "Renamed label" });
assert.equal(createdLinks.at(-1).text, "Renamed label", "explicitly changed link labels still replace selected text");
selection = { from: 12, to: 12, document: "empty-caret" };
selectedText = "";
await dispatch({ type: "captureSelection" });
await dispatch({ type: "link", url: "https://example.com/visible", text: "" });
assert.equal(createdLinks.at(-1).text, "https://example.com/visible", "an empty caret and label must insert a visible link");
restoreSucceeds = false;
const staleSelectionDocument = structuredClone(note);
const staleLinkCount = createdLinks.length;
for (const command of [
  { type: "link", url: "https://example.com/stale", text: "Do not insert" },
  { type: "reference", reference: { referenceKind: "notebookCard", referenceID: "stale", label: "Stale target" } },
  { type: "image", block: { type: "image", props: { url: "permitext-notebook-asset:stale" } } },
  { type: "format", style: "bold" }, { type: "blockType", blockType: "heading", level: 2 }
]) await assert.rejects(dispatch(command), /The Note changed/);
assert.deepEqual(note, staleSelectionDocument, "stale picker/form selection cannot edit a fallback caret");
assert.equal(createdLinks.length, staleLinkCount);
await dispatch({ type: "undo" });
await dispatch({ type: "redo" });
restoreSucceeds = true;
assert.equal(await dispatch({ type: "diagnostics" }), null, "layout diagnostics stay disabled in ordinary sessions");
assert.equal(await dispatch({ type: "inputDiagnostics" }), null);
assert.equal(messages.some(message => message.type === "inputDiagnostics"), false,
  "ordinary sessions must never publish input text diagnostics");

async function traceSession(syntheticFixture) {
  const fixtureContext = vm.createContext({ ...environment, window: { ...environment.window } });
  vm.runInContext(source, fixtureContext, { filename: "native-notebook.js" });
  const send = command => fixtureContext.window.PermitextNativeNotebook.dispatch({ session: "synthetic-input-fixture", ...command });
  await send({ type: "configure", document, readOnly: false, inputDiagnostics: true, syntheticFixture });
  return send;
}
const nonFixture = await traceSession(false);
assert.equal(await nonFixture({ type: "inputDiagnostics" }), null,
  "diagnostic request alone cannot enable text tracing without a synthetic fixture");
const fixture = await traceSession(true);
const originalFixtureText = "Text source";
events.get("beforeinput")({ data: "F", inputType: "insertText", isTrusted: true, isComposing: false, defaultPrevented: false });
note.document[0].content[0].text = "BEF";
options.onChange();
events.get("input")({ data: "F", inputType: "insertText", isTrusted: true, isComposing: false, defaultPrevented: false });
await fixture({ type: "snapshot" });
await fixture({ type: "replace", document, expectedRevision: 0 });
const trace = await fixture({ type: "inputDiagnostics" });
assert.ok(trace.some(item => item.event === "beforeinput" && item.data === "F" && item.trusted && item.inputType === "insertText"));
assert.ok(trace.some(item => item.event === "input" && item.data === "F" && item.revision === 1));
assert.ok(trace.some(item => item.event === "transaction" && item.beforeText === originalFixtureText && item.modelText === "BEFsource"));
assert.ok(trace.some(item => item.event === "replace-rejected"));
assert.ok(trace.some(item => item.event === "snapshot-request"));
for (let index = 0; index < 120; index++) events.get("input")({ data: "x", inputType: "insertText" });
assert.equal((await fixture({ type: "inputDiagnostics" })).length, 100, "fixture trace must remain bounded");
await new Promise(resolve => setTimeout(resolve, 180));
assert.equal(messages.at(-1).type, "inputDiagnostics", "fixture trace is published after its debounce for XCTest AX retrieval");
console.log("PASS: native note bridge preserves rich links, queued-refresh keystrokes, composed text and stale-selection safety; bounded input tracing requires the synthetic fixture.");
