import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const start = source.indexOf("async function openSectionDetail(");
const end = source.indexOf("\nfunction annotationForSection", start);
function fixture() {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const details = {}, anchors = {}, mutations = [];
  let account = 1, current = true;
  const c = vm.createContext({ sectionDetailOpeningAttempts: new Map(), activeWorkspaceID: "a", state: { searchResultReader: "original" },
    captureAccountRequest: () => account, isCurrentAccountRequest: value => value === account,
    isCurrentActiveCodeSourceContext: () => current, resolveReaderSource: () => pending,
    sectionDetailsBySearch: () => { mutations.push("details"); return details; }, sectionDetailAnchorsBySearch: () => anchors,
    syncCodeVersion: value => value, syncCodeVersionForPrefix: () => "2022", normalizeAnnotationBlockID: value => value || "",
    updateBrowserSectionURL: () => mutations.push("url"), scheduleContinuitySync() {}, newReaderState: value => value,
    readerFieldsForSectionDetail: value => value, placeSectionDetailAfterPane() {}, paneIDForUtilityInstance: () => "search",
    updateLinkedReaderForSearch: () => null, saveWorkspaceState: () => mutations.push("save"), transitionWorkspace: async () => {},
    paneIDForSectionDetail: id => id,
    track: { querySelector: () => null }
  });
  vm.runInContext(source.slice(start, end) + "\nthis.open = openSectionDetail;", c);
  return { c, release, details, mutations, switchAccount() { account++; }, revoke() { current = false; } };
}
for (const mode of ["cancel", "account", "scope", "allow"]) {
  const f = fixture();
  const opening = f.c.open("saved", { sectionID: "5", codeVersion: "2022" });
  assert.deepEqual(f.mutations, []);
  assert.equal(f.c.state.searchResultReader, "original");
  if (mode === "account") f.switchAccount();
  if (mode === "scope") f.revoke();
  const codeSource = { canonicalEdition: "2022", categoryID: 1 };
  f.release(mode === "cancel" ? null : { sectionID: "5", codeVersion: "2022", codePrefix: "BC", chapterID: "2", codeSource, __activeCodeSourceContext: {} });
  await opening;
  if (mode === "allow") {
    assert.equal(f.details.saved.codeSource, codeSource);
    assert.equal(f.details.saved.sectionID, "5");
    assert.ok(f.mutations.includes("save"));
  } else { assert.deepEqual(f.mutations, []); assert.equal(f.c.state.searchResultReader, "original"); }
}
console.log("Detail preflight passed: no mutation before resolution, cancellation/account/scope rejection, exact codeSource preserved.");

const savedStart = source.indexOf("async function openSavedItemInReader(");
const savedEnd = source.indexOf("\nasync function startFocusedResearchFromSavedItem", savedStart);
for (const outcome of [null, "reject"]) {
  const original = { utilityInstances: [{ id: "existing", key: "sdc" }] };
  let created = 0;
  const c = vm.createContext({ savedItemOpeningAttempts: new Map(), state: original, activeWorkspaceID: "a", captureAccountRequest: () => 1,
    isCurrentAccountRequest: () => true, isCurrentActiveCodeSourceContext: () => true,
    resolveReaderSource: async () => { if (outcome === "reject") throw new Error("unavailable"); return null; },
    newUtilityInstance: () => { created++; return {}; }, showWebNotice: async () => {} });
  vm.runInContext(source.slice(savedStart, savedEnd) + "\nthis.openSaved = openSavedItemInReader;", c);
  await c.openSaved({ sectionID: "5" }, "saved");
  assert.equal(created, 0);
  assert.equal(original.utilityInstances.length, 1);
  assert.equal(original.utilityInstances[0].id, "existing");
}
// A late first click must not overwrite a later click's detail.
{
  const f = fixture();
  const gates = [];
  f.c.resolveReaderSource = () => new Promise(resolve => gates.push(resolve));
  const first = f.c.open("saved", { sectionID: "5" });
  const second = f.c.open("saved", { sectionID: "6" });
  const target = id => ({ sectionID: id, codeVersion: "2022", codePrefix: "BC", chapterID: "2", codeSource: {}, __activeCodeSourceContext: {} });
  gates[1](target("6")); await second;
  gates[0](target("5")); await first;
  assert.equal(f.details.saved.sectionID, "6");
  assert.equal(f.c.sectionDetailOpeningAttempts.size, 0);
}
// An obsolete Saved attempt cannot remove a newer detail after transition failure.
{
  let rejectOld;
  const details = {}, anchors = { existing: "saved" };
  let removed = 0;
  const c = vm.createContext({ savedItemOpeningAttempts: new Map(), activeWorkspaceID: "a",
    state: { utilityInstances: [{ id: "existing", key: "sdc" }] },
    captureAccountRequest: () => 1, isCurrentAccountRequest: () => true, isCurrentActiveCodeSourceContext: () => true,
    resolveReaderSource: async item => ({ ...item, __activeCodeSourceContext: {} }),
    sectionDetailsBySearch: () => details, sectionDetailAnchorsBySearch: () => anchors,
    newUtilityInstance: () => ({ id: "existing", key: "sdc" }),
    openSectionDetail(id, item) {
      details[id] = { sectionID: item.sectionID };
      if (item.sectionID === "5") return new Promise((resolve, reject) => { rejectOld = reject; });
      return Promise.resolve();
    }, removeSectionDetail() { removed++; }, saveWorkspaceState() {}, showWebNotice: async () => {},
    scrollPaneIntoView() {}, paneIDForSectionDetail: id => id
  });
  vm.runInContext(source.slice(savedStart, savedEnd) + "\nthis.openSaved = openSavedItemInReader;", c);
  const first = c.openSaved({ sectionID: "5" }, "saved");
  await new Promise(resolve => setImmediate(resolve));
  await c.openSaved({ sectionID: "6" }, "saved");
  rejectOld(new Error("Old transition failed")); await first;
  assert.equal(details.existing.sectionID, "6");
  assert.equal(removed, 0);
  assert.equal(c.savedItemOpeningAttempts.size, 0);
}
console.log("Delayed detail ownership passed: late preflight cannot replace newer selection; obsolete transition cannot delete newer detail; attempt maps retire.");
