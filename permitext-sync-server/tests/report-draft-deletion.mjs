import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const start = source.indexOf("  const deleteReport = async (trigger) => {");
assert.ok(start > 0);
const implementation = source.slice(start, source.indexOf("\n  function renderBlockEditor", start));

function harness({ confirmed = true, requestError = null, dirty = true } = {}) {
  const currentDraft = { id: "draft-a", version: 3, title: "Delete me", introduction: "Unsaved", blocks: [] };
  const otherDraft = { id: "draft-b", version: 1, title: "Keep me", blocks: [] };
  const c = vm.createContext({
    structuredClone, activeDraft: currentDraft, drafts: [currentDraft, otherDraft], dirty,
    history: [{ id: "export-a", draftID: "draft-a" }], identity: {}, projectID: "project-a",
    requestIdentity: "account-a", requestWorkspaceID: "workspace-a", activeWorkspaceID: "workspace-a",
    current: true, disposed: false, pendingDraftSave: null, generatingReport: false, deletingReport: false,
    shell: { inert: false }, trigger: { disabled: false }, calls: [], confirmations: [], renders: 0,
    message: "", refreshes: 0, notebookMounts: new Map(),
    refreshProjectReportMembership: async () => {},
    isCurrentAccountRequest: () => c.current,
    confirmWebWarning: async (...args) => { c.confirmations.push(args); return confirmed; },
    reportRequest: async (path, body) => {
      c.calls.push({ path, body: structuredClone(body) });
      if (requestError) throw requestError;
      return { draftID: body.draftID };
    },
    emptyProjectReportDraft: () => ({ id: "", version: 0, title: "New Report", blocks: [] }),
    clearStatus: () => { c.message = ""; }, showStatusError: message => { c.message = message; },
    renderWorkspaceContent: () => { c.renders++; }, refreshReportArtifacts: async () => { c.refreshes++; }
  });
  vm.runInContext(implementation + "\nglobalThis.removeReport = deleteReport;", c);
  return c;
}

{
  const c = harness({ confirmed: false });
  const before = structuredClone(c.activeDraft);
  assert.equal(await c.removeReport(c.trigger), false);
  assert.equal(c.calls.length, 0);
  assert.deepEqual(c.activeDraft, before);
  assert.equal(c.dirty, true);
  assert.equal(c.trigger.disabled, false);
  assert.equal(c.shell.inert, false);
}
{
  const c = harness();
  assert.equal(await c.removeReport(c.trigger), true);
  assert.equal(c.calls.length, 1);
  assert.equal(c.calls[0].path, "/reports/drafts/delete");
  assert.deepEqual(c.calls[0].body, { projectID: "project-a", draftID: "draft-a", expectedVersion: 3 });
  assert.match(c.confirmations[0][1], /Unsaved edits/);
  assert.equal(c.activeDraft.id, "draft-b");
  assert.equal(c.drafts.length, 1);
  assert.equal(c.history[0].id, "export-a");
  assert.equal(c.dirty, false);
  assert.equal(c.renders, 1);
}
{
  const c = harness();
  c.drafts = [c.activeDraft];
  await c.removeReport(c.trigger);
  assert.equal(c.activeDraft.id, "");
  assert.equal(c.drafts.length, 0);
  assert.equal(c.history.length, 1);
}
for (const reason of ["unsaved", "saving", "exporting", "disposed", "account", "workspace"]) {
  const c = harness();
  if (reason === "unsaved") c.activeDraft.id = "";
  if (reason === "saving") c.pendingDraftSave = Promise.resolve(true);
  if (reason === "exporting") c.generatingReport = true;
  if (reason === "disposed") c.disposed = true;
  if (reason === "account") c.current = false;
  if (reason === "workspace") c.activeWorkspaceID = "workspace-b";
  assert.equal(await c.removeReport(c.trigger), false, reason);
  assert.equal(c.calls.length, 0, reason);
  assert.equal(c.confirmations.length, 0, reason);
}
for (const change of ["account", "workspace", "draft", "disposed"]) {
  const c = harness();
  c.confirmWebWarning = async () => {
    if (change === "account") c.current = false;
    if (change === "workspace") c.activeWorkspaceID = "workspace-b";
    if (change === "draft") c.activeDraft = { id: "different" };
    if (change === "disposed") c.disposed = true;
    return true;
  };
  assert.equal(await c.removeReport(c.trigger), false, change);
  assert.equal(c.calls.length, 0, change);
}
{
  const c = harness({ requestError: new Error("Offline") });
  const before = structuredClone(c.activeDraft);
  assert.equal(await c.removeReport(c.trigger), false);
  assert.deepEqual(c.activeDraft, before);
  assert.equal(c.drafts.length, 2);
  assert.equal(c.dirty, true);
  assert.equal(c.message, "Offline");
  assert.equal(c.shell.inert, false);
  assert.equal(c.deletingReport, false);
}
for (const dirty of [true, false]) {
  const conflict = Object.assign(new Error("Review the current Report version before deleting."), {
    payload: { code: "REPORT_DRAFT_VERSION_CONFLICT" }
  });
  const c = harness({ requestError: conflict, dirty });
  assert.equal(await c.removeReport(c.trigger), false);
  assert.equal(c.refreshes, dirty ? 0 : 1);
  assert.equal(c.dirty, dirty);
  assert.equal(c.drafts.length, 2);
  assert.match(c.message, /current Report version/);
}
{
  const c = harness();
  let confirm;
  c.confirmWebWarning = () => new Promise(resolve => { confirm = resolve; });
  const first = c.removeReport(c.trigger);
  assert.equal(c.shell.inert, true);
  assert.equal(c.trigger.disabled, true);
  assert.equal(await c.removeReport(c.trigger), false);
  confirm(true);
  assert.equal(await first, true);
  assert.equal(c.calls.length, 1);
}
console.log("Report deletion passed: cancellation, saved revision, remaining/last draft, retained exports, in-flight guards, account/workspace changes, conflict and failure.");
