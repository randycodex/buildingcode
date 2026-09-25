import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const helpersStart = source.indexOf("const notebookReturnScrollPositions = new Map();");
const helpersEnd = source.indexOf("\nconst notebookCardMenuOpenByProject", helpersStart);
assert.ok(helpersStart >= 0 && helpersEnd > helpersStart);
const helpers = source.slice(helpersStart, helpersEnd);
const c = vm.createContext({ accountRuntimeGeneration: 1 });
vm.runInContext(helpers + "\nglobalThis.positions = notebookReturnScrollPositions;", c);
const context = { generation: 1, workspaceID: "workspace-a", projectID: "project-a" };
c.rememberNotebookReturnScroll(context, "card-a", {
  scrollTop: 120, shellScrollTop: 30, selection: { private: "selection" }, document: "private document"
});
assert.equal(JSON.stringify(c.readNotebookReturnScroll(context, "card-a")), '{"scrollTop":120,"shellScrollTop":30}');
for (const alternative of [
  { ...context, workspaceID: "workspace-b" },
  { ...context, projectID: "project-b" },
  { ...context, generation: 2 }
]) assert.equal(c.readNotebookReturnScroll(alternative, "card-a"), null);
assert.equal(c.readNotebookReturnScroll(context, "card-b"), null);
c.rememberNotebookReturnScroll(context, "invalid", { scrollTop: Infinity, shellScrollTop: -4 });
assert.equal(JSON.stringify(c.readNotebookReturnScroll(context, "invalid")), '{"scrollTop":0,"shellScrollTop":0}');
c.rememberNotebookReturnScroll(context, "string", { scrollTop: "120", shellScrollTop: NaN });
assert.equal(JSON.stringify(c.readNotebookReturnScroll(context, "string")), '{"scrollTop":0,"shellScrollTop":0}');
for (let index = 0; index < 101; index++) c.rememberNotebookReturnScroll(context, `bounded-${index}`, { scrollTop: index, shellScrollTop: 0 });
assert.equal(c.positions.size, 100);
assert.equal(c.readNotebookReturnScroll(context, "bounded-0"), null);
c.accountRuntimeGeneration = 2;
const size = c.positions.size;
c.rememberNotebookReturnScroll(context, "stale", { scrollTop: 999, shellScrollTop: 999 });
assert.equal(c.positions.size, size);
assert.equal(c.readNotebookReturnScroll(context, "bounded-100"), null);

const captureStart = source.indexOf("      let scrollCaptureReady = false;");
const captureEnd = source.indexOf("\n      if (!notebookReadOnly && !activeCard.id)", captureStart);
assert.ok(captureStart >= 0 && captureEnd > captureStart);
const mounting = source.slice(captureStart, captureEnd);
function element() {
  return { isConnected: true, scrollTop: 0, listeners: new Map(),
    addEventListener(name, listener) { this.listeners.set(name, listener); },
    removeEventListener(name, listener) { if (this.listeners.get(name) === listener) this.listeners.delete(name); }
  };
}
function fixture() {
  const frames = [], writes = [], focusRestores = [];
  const panel = element(), editorElement = element(), shell = element(), mountState = {};
  const context = vm.createContext({
    panel, editorElement, shell, mountState, projectID: "project-a", disposed: false,
    requestIdentity: 1, isCurrentAccountRequest: identity => identity === 1,
    renderSequence: 1, editorRenderSequence: 1, activeCard: { id: "card-a" }, focusedCardID: "card-a",
    notebookMounts: new Map([["project-a", mountState]]), returnScrollContext: {},
    rememberNotebookReturnScroll: (...args) => writes.push(args),
    releaseNotebookReturnScroll() {}, captureNotebookReturnScroll: null,
    draftDocument: {}, notebookReadOnly: false, notebookObjectURLs: new Set(), notebookEditingPositions: new Map(),
    readNotebookReturnScroll: () => ({ scrollTop: 321, shellScrollTop: 45 }),
    window: { requestAnimationFrame: callback => frames.push(callback) }, editorMount: null,
    module: { mountPermitextNotebookEditor(_element, options) {
      context.options = options;
      return { restoreEditingPosition: position => focusRestores.push(position) };
    } }
  });
  vm.runInContext(mounting, context);
  return { context, frames, writes, focusRestores, panel, editorElement, shell };
}
{
  const f = fixture();
  assert.equal(f.context.options.autofocus, false);
  f.context.captureNotebookReturnScroll();
  assert.equal(f.writes.length, 0, "Initial zero coordinates cannot overwrite retained position before ready");
  f.context.options.onReady();
  f.frames.shift()();
  assert.equal(f.editorElement.scrollTop, 321);
  assert.equal(f.shell.scrollTop, 45);
  assert.equal(f.focusRestores.length, 0, "Cross-mount numeric restoration must not restore selection/focus");
  f.editorElement.scrollTop = 400;
  f.context.captureNotebookReturnScroll();
  assert.equal(f.writes.length, 1);
  f.context.notebookMounts.set("project-a", {});
  f.context.captureNotebookReturnScroll();
  assert.equal(f.writes.length, 1, "Replaced mount cannot capture scroll");
  f.context.releaseNotebookReturnScroll();
  assert.equal(f.editorElement.listeners.size, 0);
  assert.equal(f.shell.listeners.size, 0);
}
for (const invalidate of [
  f => { f.context.disposed = true; },
  f => { f.context.editorRenderSequence++; },
  f => { f.context.activeCard = { id: "another-card" }; },
  f => { f.context.isCurrentAccountRequest = () => false; },
  f => { f.panel.isConnected = false; },
  f => { f.context.notebookMounts.set("project-a", {}); }
]) {
  const f = fixture();
  f.context.options.onReady();
  invalidate(f);
  f.frames.shift()();
  assert.equal(f.editorElement.scrollTop, 0, "Stale readiness callback cannot restore coordinates");
  f.context.captureNotebookReturnScroll();
  assert.equal(f.writes.length, 0);
}
console.log("Notebook return scroll passed: numeric-only bounded retention, identity/generation isolation, ready capture, detached/replaced mount suppression and no cross-mount focus.");
