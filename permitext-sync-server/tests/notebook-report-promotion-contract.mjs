import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const start = source.indexOf("async function promoteNotebookCardToReport(");
const end = source.indexOf("\nfunction reportSourceClassificationLabel(", start);
const refreshStart = source.indexOf("  refreshReportArtifacts = async");
const refreshEnd = source.indexOf("\n\n  try {", refreshStart);
const listenerStart = source.indexOf('      reportButton.addEventListener("click",');
const listenerEnd = source.indexOf('      const coordinateButton =', listenerStart);
assert.ok(start >= 0 && end > start && refreshStart >= 0 && refreshEnd > refreshStart);
const old = { id: "report-a", version: 2, title: "Synthetic", blocks: [{ id: "block-a", text: "Old text", derivedFrom: { kind: "notebookCard", id: "card-a" } }] };
const other = { id: "report-b", version: 1, blocks: [] };
const card = { id: "card-a", title: "Synthetic note", version: 3, plainText: "Only the cellar is sprinklered. PHONE checkpoint.", evidenceLinks: [] };
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

function fixture(options = {}) {
  let generation = 1, unsaved = Boolean(options.dirty), server = structuredClone(old);
  const calls = [], rendered = [], notices = [], pending = new Map();
  let mounted, click;
  const c = {
    structuredClone, crypto: { randomUUID: () => "new-block" }, Date,
    captureAccountRequest: () => generation,
    requireCurrentAccountRequest: g => { if (g !== generation) throw Object.assign(new Error("Account changed"), { name: "AbortError" }); },
    isCurrentAccountRequest: g => g === generation,
    projectIdentity: p => p, projectDetailKey: p => p.id,
    reportDraftMounts: new Map(), notebookMounts: new Map(), pendingReportDraftByProject: pending,
    emptyProjectReportDraft: () => ({ id: "", version: 0, blocks: [] }),
    async postResearch(path, body) {
      calls.push(path);
      if (path.endsWith("drafts/list")) { if (options.listGate) await options.listGate.promise; return { drafts: [structuredClone(server), other] }; }
      if (path.endsWith("drafts/save")) {
        assert.equal(body.expectedVersion, server.version);
        if (options.saveGate) await options.saveGate.promise;
        server = { ...structuredClone(body), id: "report-a", version: 3 }; return { draft: structuredClone(server) };
      }
      if (path.endsWith("sources/list")) return { sources: [] };
      if (path.endsWith("history/list")) return { reports: [] };
      throw new Error(path);
    },
    async openProjectReportDraft() { calls.push("open-existing-pane"); },
    async showWebNotice(...args) { notices.push(args); },
    disposed: false, requestIdentity: 1, projectID: "project-a", identity: { id: "project-a" },
    activeCard: structuredClone(card), notebookReadOnly: false,
    flushNotebookAutosave: async () => true, reportStatus: {}, existingReportBlock: old.blocks[0],
    reportButton: { classList: { add() {} }, addEventListener(_event, fn) { click = fn; } },
    drafts: [], sources: [], sourceWarnings: [], history: [], activeDraft: structuredClone(options.otherSelected ? other : old),
    panel: { querySelector: () => ({ replaceChildren() {} }) },
    renderSourcePalette() {}, renderHistory() {},
    renderWorkspaceContent() { rendered.push(structuredClone(c.activeDraft)); }
  };
  Object.defineProperty(c, "dirty", { get: () => unsaved });
  c.reportRequest = async (...args) => { c.requireCurrentAccountRequest(c.requestIdentity); return c.postResearch(...args); };
  vm.createContext(c);
  vm.runInContext(source.slice(start, end) + "\n" + source.slice(refreshStart, refreshEnd) + "\n" + source.slice(listenerStart, listenerEnd), c);
  mounted = { hasUnsavedChanges: () => unsaved, refreshArtifacts: options => c.refreshReportArtifacts(options) };
  c.reportDraftMounts.set("project-a", mounted);
  return { c, calls, rendered, notices, pending, click: () => click(), run: () => c.promoteNotebookCardToReport({ id: "project-a" }, card),
    setDirty: () => { unsaved = true; }, switchAccount: () => { generation += 1; }, server: () => server };
}

for (const otherSelected of [false, true]) {
  const h = fixture({ otherSelected }); await h.run();
  assert.equal(h.rendered.at(-1).id, "report-a");
  assert.equal(h.rendered.at(-1).version, 3);
  assert.equal(h.rendered.at(-1).blocks[0].text, card.plainText, "An open Report must display the committed snapshot");
  assert.equal(h.rendered.at(-1).blocks[0].id, "block-a");
  assert.equal(h.pending.size, 0);
}
const dirty = fixture({ dirty: true });
await assert.rejects(dirty.run(), /Save your open Report edits/); assert.deepEqual(dirty.calls, []);
for (const action of ["setDirty", "switchAccount"]) {
  const gate = defer(), h = fixture({ listGate: gate }); const run = h.run(); h[action](); gate.resolve();
  await assert.rejects(run); assert.equal(h.calls.includes("/reports/drafts/save"), false);
}
const gate = defer(), duringSave = fixture({ saveGate: gate });
const saving = duringSave.run();
for (let i = 0; i < 20 && !duringSave.calls.includes("/reports/drafts/save"); i++) await Promise.resolve();
duringSave.setDirty(); gate.resolve(); await saving;
assert.equal(duringSave.server().blocks[0].text, card.plainText);
assert.equal(duringSave.rendered.length, 0, "In-flight local edits must not be replaced by refresh");
assert.equal(duringSave.notices.length, 1, "The preserved unsaved view must be disclosed");
const accountGate = defer(), changed = fixture({ saveGate: accountGate }); const changing = changed.run();
for (let i = 0; i < 20 && !changed.calls.includes("/reports/drafts/save"); i++) await Promise.resolve();
changed.switchAccount(); accountGate.resolve(); await assert.rejects(changing, { name: "AbortError" });
assert.equal(changed.rendered.length, 0); assert.equal(changed.pending.size, 0);
const clickGate = defer(), clicked = fixture({ saveGate: clickGate }); const clicking = clicked.click();
for (let i = 0; i < 30 && !clicked.calls.includes("/reports/drafts/save"); i++) await Promise.resolve();
assert.ok(clicked.calls.includes("/reports/drafts/save"));
clicked.switchAccount(); clickGate.resolve(); await clicking;
assert.equal(clicked.notices.length, 0, "An obsolete click handler must not show a notice in another account");
console.log("Notebook Report promotion passed: visible exact draft/revision, stable provenance, unsaved edits and account isolation.");
