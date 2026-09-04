import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { gzipSync } from "node:zlib";
import vm from "node:vm";
import * as syncIdentity from "../public/sync-identity.js";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function between(start, end) { const a = source.indexOf(start); const b = source.indexOf(end, a + start.length); assert.ok(a >= 0 && b > a, `Missing ${start}`); return source.slice(a, b); }
const actualStart = between("async function start() {", "function renderWorkspaceLoadError(");
const catalogHelpers = between("function refreshVisibleReaderTrust()", "async function start() {");
const priorBlockingCatalog = `const [chapterPayload, libraryPayload] = await Promise.all([
  api("/code/chapters?view=startup"), api("/code/libraries")
]); chapters = chapterPayload.chapters || []; codeTrustProfiles = libraryPayload.codeTrustProfiles || [];`;
const priorStart = actualStart.replace("void loadStartupCatalogs();", priorBlockingCatalog);
assert.notEqual(priorStart, actualStart, "The shipped startup must launch optional catalog work without awaiting it.");
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function node() { return { dataset: {}, scrollLeft: 0, scrollWidth: 100, clientWidth: 100, addEventListener() {}, querySelectorAll: () => [] }; }
async function sample(start, { chapterMs = 120, trustMs = 200, failCatalogs = false, quarantined = false } = {}) {
  const events = [];
  const issues = [];
  let firstWorkspaceAt;
  let catalogLoads = 0;
  const started = performance.now();
  const noop = () => {};
  const sandbox = {
    console: { warn: noop }, Promise, Map, Set, Math, Number, JSON,
    detachedWorkboardRoute: false, detachedProjectWindow: false,
    workspaceMigrationError: null, workspaceRestoreError: null, initialPersistedAccount: null,
    state: { readers: [], utilities: {}, trackScrollLeft: 0 }, track: node(),
    document: { addEventListener: noop, querySelectorAll: () => [] },
    window: { addEventListener: noop, matchMedia: () => ({ addEventListener: noop }) },
    localStorage: { getItem: () => null, removeItem: noop },
    api: async (path) => { catalogLoads += 1; await delay(path.includes("libraries") ? trustMs : chapterMs); if (failCatalogs) throw new Error("Synthetic public catalog failure"); return { chapters: [{ id: "chapter", codePrefix: "BC" }], codeTrustProfiles: [{ codePrefix: "BC" }] }; },
    bindImmediateUtilityControls: () => events.push("bind"),
    resumeClerkSignInReturn: async () => { events.push("auth-start"); await delay(20); events.push("auth-complete"); },
    renderWorkspace: async () => { assert.ok(events.includes("auth-complete"), "Clerk account restoration must finish before private rendering."); await delay(20); firstWorkspaceAt = performance.now() - started; events.push("workspace"); },
    codeQuestionWorkspaceEnabled: () => false,
    deepLinkedSectionIDFromLocation: () => "", organizationInvitationTokenFromURL: () => "",
    activeAccount: () => null,
    privateWorkspaceMigrationStatus: () => ({ status: quarantined ? "quarantined" : "complete" }),
    presentWorkspaceIssue: (message) => issues.push(message),
    flushPendingSyncAndRender: async () => {}, flushCodeQuestionOutbox: async () => {},
    refreshNotebookPendingStatus: async () => {}, refreshEntitlementAfterCheckoutReturn: async () => {}, resumePendingResearchIntent: async () => {}
  };
  for (const name of ["updateConnectionStatus", "repositionActiveCustomSelect", "keepFocusedWorkspacePaneVisible", "scheduleVisibleReaderScrollIndicatorUpdates", "bindWorkspaceKeyboardNavigation", "stopForegroundSyncLoop", "startForegroundSyncLoop", "bindHorizontalWheelScroll", "openMobileMoreSheet", "consumeBrowserSectionURL", "renderReaderTrust"]) sandbox[name] = noop;
  for (const name of ["addReaderButton", "toggleArchiveButton", "toggleSettingsButton", "workspaceActionsButton", "mobileMoreButton", "fitColumnsButton", "collapseReadersButton"]) sandbox[name] = node();
  const context = vm.createContext(sandbox);
  vm.runInContext(`let chapters = []; let codeTrustProfiles = []; let codeTrustProfilesStatus = "loading"; let startupCatalogPromise = null; ${catalogHelpers} ${start} globalThis.startTest = start; globalThis.catalogState = () => ({chapters,codeTrustProfiles,codeTrustProfilesStatus,startupCatalogPromise});`, context);
  await context.startTest();
  const stateAtWorkspace = context.catalogState();
  if (stateAtWorkspace.startupCatalogPromise) await stateAtWorkspace.startupCatalogPromise;
  return { firstWorkspaceAt, events, issues, catalogLoads, stateAtWorkspace, finalState: context.catalogState() };
}
const before = await sample(priorStart);
const after = await sample(actualStart);
assert.ok(before.firstWorkspaceAt >= 230, "The recorded blocking startup must wait for the slow secondary catalog.");
assert.ok(after.firstWorkspaceAt < 110, "A secondary catalog must not block the usable shell.");
assert.ok(before.firstWorkspaceAt - after.firstWorkspaceAt > 100);
assert.deepEqual(after.events, ["bind", "auth-start", "auth-complete", "workspace"]);
assert.equal(after.catalogLoads, 2);
assert.equal(after.stateAtWorkspace.codeTrustProfilesStatus, "loading");
assert.equal(after.finalState.codeTrustProfilesStatus, "ready");
const failed = await sample(actualStart, { failCatalogs: true });
assert.ok(failed.firstWorkspaceAt < 110, "Metadata failure must not become a failed private workspace load.");
assert.equal(failed.finalState.codeTrustProfilesStatus, "unavailable");
assert.equal(failed.finalState.startupCatalogPromise, null, "Failed metadata can be explicitly retried.");
const quarantined = await sample(actualStart, { quarantined: true });
assert.deepEqual(quarantined.events, ["bind", "auth-start", "auth-complete", "workspace"]);
assert.equal(quarantined.issues.length, 1);
assert.match(quarantined.issues[0], /ownership could not be verified/);
assert.match(quarantined.issues[0], /current workspace is available/);

// Verify actual neutral Reader trust rendering, including the retry affordance.
const trustFunction = between("function renderReaderTrust(", "function codeFilterLabel(");
const pieces = new Map();
const trust = { dataset: {}, hidden: true, append(element) { pieces.set(`.${element.className}`, element); }, querySelector(selector) { if (selector === ".reader-trust-retry") return pieces.get(selector) || null; if (!pieces.has(selector)) pieces.set(selector, { textContent: "", hidden: false }); return pieces.get(selector); } };
const trustContext = vm.createContext({
  document: { createElement: () => ({ addEventListener() {} }) },
  codeTrustProfile: () => null, codeDisplayLabel: () => "2022 Building Code",
  codeTrustProfilesStatus: "loading", loadStartupCatalogs() {},
  panel: { querySelector: () => trust }
});
vm.runInContext(`${trustFunction}; renderReaderTrust(panel, {codePrefix:"BC"});`, trustContext);
assert.equal(trust.hidden, false);
assert.equal(pieces.get(".reader-trust-status").textContent, "Source metadata loading");
assert.equal(pieces.get(".reader-trust-source").hidden, true);
trustContext.codeTrustProfilesStatus = "unavailable";
vm.runInContext(`renderReaderTrust(panel, {codePrefix:"BC"});`, trustContext);
assert.equal(pieces.get(".reader-trust-status").textContent, "Source metadata unavailable");
assert.equal(pieces.get(".reader-trust-retry").disabled, false);
trustContext.codeTrustProfilesStatus = "ready";
vm.runInContext(`renderReaderTrust(panel, {codePrefix:"UNAVAILABLE"});`, trustContext);
assert.equal(pieces.get(".reader-trust-status").textContent, "Source metadata unavailable", "An omitted library profile must not claim to be loading forever.");

// The existing visible Reader selector carries edition identity without adding
// a second heading or deriving dates for unrelated administrative/Zoning books.
const codeOptionsSource = between("const codeOptions = [", "function researchCodeEdition(");
const optionHelpers = between("function codeOptionVersion(", "function codeTrustProfile(");
const selector = between("function populateCodeSelect(", "function readerCodeSelectionKey(");
function selectNode() { return { children: [], append(child) { this.children.push(child); }, setAttribute() {} }; }
const codeSelect = selectNode();
const selectorContext = vm.createContext({ ...syncIdentity, Map,
  document: { createElement: selectNode }, panel: { querySelector: () => codeSelect },
  clear: (element) => { element.children = []; }, resizeCodeSelect() {} });
vm.runInContext(`${codeOptionsSource} ${optionHelpers} ${selector}
  globalThis.showCode = (prefix, version) => { populateCodeSelect(panel, {codePrefix:prefix, codeVersion:version}); return panel.querySelector().title; };`, selectorContext);
assert.equal(selectorContext.showCode("BC", syncIdentity.defaultSyncCodeVersion), "Building Code (2022)");
assert.equal(selectorContext.showCode("BC", syncIdentity.historicalConstructionSyncCodeVersion), "Building Code (2014)");
assert.equal(selectorContext.showCode("AC", syncIdentity.defaultSyncCodeVersion), "General Administrative Code (2022 edition)");
assert.equal(selectorContext.showCode("FC", ""), "Fire Code (2022)");
assert.equal(selectorContext.showCode("EBC", ""), "Existing Building Code (effective July 17, 2027)");
assert.equal(selectorContext.showCode("ZR", ""), "Zoning Resolution");
console.log(JSON.stringify({ check: "actual-start-controlled-catalog-critical-path", chapterDelayMs: 120, trustDelayMs: 200, authenticationDelayMs: 20, workspaceRenderDelayMs: 20, beforeUsableMs: +before.firstWorkspaceAt.toFixed(1), afterUsableMs: +after.firstWorkspaceAt.toFixed(1), improvementMs: +(before.firstWorkspaceAt - after.firstWorkspaceAt).toFixed(1), clientBytes: Buffer.byteLength(source), clientGzipBytes: gzipSync(source).byteLength, boundary: "Controlled request latency and stubbed UI render; not a device paint benchmark." }));

if (process.argv.includes("--profile-catalogs")) {
  const { createServer } = await import("node:http");
  process.env.NODE_ENV = "test"; process.env.VERCEL = ""; process.env.VERCEL_ENV = "";
  for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL"]) delete process.env[key];
  const { handleRequest } = await import("../app.mjs");
  const server = createServer(handleRequest);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    for (const round of ["cold", "warm"]) {
      const entries = await Promise.all(["/code/chapters?view=startup", "/code/libraries"].map(async (path) => {
        const started = performance.now(); const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`); const text = await response.text(); assert.equal(response.status, 200);
        return { round, path, bytes: Buffer.byteLength(text), milliseconds: +(performance.now() - started).toFixed(1) };
      }));
      console.log(JSON.stringify({ publicCatalogProfile: entries, privateOrProviderRequests: 0 }));
    }
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
}
