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
    updateBrowserSectionURL: () => mutations.push("url"), scheduleContinuitySync: () => mutations.push("continuity"), newReaderState: value => value,
    readerFieldsForSectionDetail: value => value, placeSectionDetailAfterPane() {}, paneIDForUtilityInstance: () => "search",
    updateLinkedReaderForSearch: () => { mutations.push("reader"); return null; }, saveWorkspaceState: () => mutations.push("save"), transitionWorkspace: async () => {},
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
// Saved evidence now shares the direct Reader path, tested with real navigation fences.
await import('./search-evidence-detail-contract.mjs');
