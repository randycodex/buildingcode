import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { randomUUID } from "node:crypto";
import * as syncIdentity from "../public/sync-identity.js";
const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function between(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Missing production source: ${start}`);
  return source.slice(a, b);
}
const registration = between('  addReaderButton.addEventListener("click", async () => {', '  toggleArchiveButton?.addEventListener');
const factory = between("function newReaderState(", "function sectionRouteIDFromLocation(");
// Execute the production callback with unresolved catalog/render work. Previously
// concurrent clicks passed the limit against a stale count before catalog completion.
async function check(pro) {
  let click, resolveCatalog, resolveRender;
  let requests = 0, renders = 0, limits = 0;
  const catalog = new Promise(resolve => { resolveCatalog = resolve; });
  const rendering = new Promise(resolve => { resolveRender = resolve; });
  const state = { readers: [] }, scrolled = [];
  const context = vm.createContext({
    ...syncIdentity, crypto: { randomUUID }, state,
    addReaderButton: { addEventListener(type, callback) { assert.equal(type, "click"); click = callback; } },
    isProAccount: () => pro,
    enforceReaderPlanLimit: () => { limits++; assert.ok(state.readers.length <= 2); },
    firstChapterIDForCode: () => { requests++; return catalog; },
    saveWorkspaceState() {},
    transitionWorkspace: () => { renders++; return rendering; },
    paneIDForReader: reader => reader.id,
    scrollPaneIntoView: id => scrolled.push(id)
  });
  vm.runInContext(`${factory}\n${registration}`, context);
  const pending = [click(), click(), click()];
  assert.equal(requests, 0, "Adding a Reader must mount before catalog completion.");
  assert.equal(state.readers.length, pro ? 3 : 2, "Concurrent clicks reserve slots synchronously.");
  assert.equal(renders, 3, "Accepted actions and limit responses reach rendering with catalog unresolved.");
  assert.equal(limits, pro ? 0 : 1);
  assert.equal(new Set(state.readers.map(reader => reader.id)).size, state.readers.length);
  for (const reader of state.readers) {
    assert.equal(reader.codePrefix, "BC");
    assert.equal(reader.codeVersion, syncIdentity.defaultSyncCodeVersion);
    assert.equal(reader.chapterID, "", "Cancellable Reader navigation selects the first chapter.");
  }
  resolveRender();
  await Promise.all(pending);
  assert.equal(scrolled.length, state.readers.length);
  resolveCatalog("unused-late-chapter");
  await Promise.resolve();
  assert.ok(state.readers.every(reader => reader.chapterID === ""));
}
await check(false);
await check(true);
console.log("Reader add: immediate insertion, default edition and concurrent plan limits passed.");
