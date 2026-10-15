import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import vm from "node:vm";
import { createWorkspaceAccessGate } from "../public/workspace-access-gate.js";
import { syncCodeVersion, defaultSyncCodeVersion, historicalConstructionSyncCodeVersion } from "../public/sync-identity.js";
const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function actual(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  const end = source.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 2);
}
class Node {
  constructor(tag) { this.tagName=tag; this.className=""; this.dataset={}; this.children=[]; this.attrs={}; this.events={}; this.hidden=false; this.disabled=false; this.parentNode=null; this.style={setProperty(){}}; }
  get classList() {
    return { contains:name=>this.className.split(/\s+/).includes(name),
      add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(" ");},
      toggle:(name,value)=>{const list=new Set(this.className.split(/\s+/).filter(Boolean)); if(value)list.add(name);else list.delete(name);this.className=[...list].join(" ");} };
  }
  append(...nodes) { for(const node of nodes) { if(node.parentNode)node.parentNode.children=node.parentNode.children.filter(n=>n!==node);node.parentNode=this;this.children.push(node); } }
  matches(selector) {
    const parts = /^(\.[\w-]+)(?:\[data-([\w-]+)="([^"\]]*)"\])?$/.exec(selector);
    if (!parts || !this.classList.contains(parts[1].slice(1))) return false;
    const key = parts[2]?.replace(/-([a-z])/g, (_all, letter) => letter.toUpperCase());
    return !key || this.dataset[key] === parts[3];
  }
  querySelector(selector) {for(const node of this.children){if(node.matches(selector))return node;const nested=node.querySelector(selector);if(nested)return nested;}return null;}
  querySelectorAll(selector) { return this.children.flatMap(node=>[...(node.matches(selector)?[node]:[]),...node.querySelectorAll(selector)]); }
  closest(selector) {return this.matches(selector)?this:this.parentNode?.closest(selector)||null;}
  setAttribute(name,value){this.attrs[name]=value;}
  addEventListener(name,fn){this.events[name]=fn;}
  async click(){await this.events.click?.();}
  get isConnected(){return Boolean(this.parentNode)||this.connected===true;}
}


let reads = 0, paints = 0, current = true, selected = "p1";
const project = { id: "p1", clientID: "local-p1" };
const matches = Array.from({ length: 80 }, (_, index) => ({ id: String(index % 40), sectionNumber: `100.${index}`, codePrefix: "BC",
  codeVersion: index < 40 ? defaultSyncCodeVersion : historicalConstructionSyncCodeVersion,
  blockID: index % 2 ? "paragraph" : "", title: `Heading ${index}`, excerpt: `Complete result ${index}`, citation: `Citation ${index}` }));
let links = matches.filter((_value, index) => index % 3 === 0).map((item, index) => ({ ...item, sectionID: item.id, folderClientID: index % 2 ? "other-project" : "local-p1" }));
links.push(...Array.from({ length: 1000 }, (_, index) => ({ sectionID: `unrelated-${index}`, codeVersion: defaultSyncCodeVersion, folderClientID: "local-p1" })));
const panel = new Node("article"); panel.className = "search-panel"; panel.connected = true;
const results = new Node("div"); results.className = "search-results"; panel.append(results);
const instance = { expandedResultSources: [], defaultExpandedResultSource: "" };
const c = vm.createContext({
  createWorkspaceAccessGate, workspaceAccessState: null, activeWorkspaceID: "workspace", accountRuntimeGeneration: 1,
  syncedContent: { userID: "a", workspacePresentationAccess: "verified" }, syncLoadPromise: null,
  state: { utilityInstances: [] }, captureAccountRequest: () => "a", isCurrentAccountRequest: () => current,
  activeAccount: () => ({ userID: "a" }), ensureSyncedContentForRender: async () => c.syncedContent,
  loadSyncedContent: async () => c.syncedContent, reconcileProjectWorkspaces() {}, closeDeletedProjectDetails() {}, scopeSavedInstanceToWorkspace() {},
  enforceReaderPlanLimit() {}, renderUtilityWorkspace: async () => {},
  document: { createElement: tag => new Node(tag) }, crypto: { randomUUID }, CSS: { escape: value => value },
  syncCodeVersion, defaultSyncCodeVersion, syncCodeVersionForPrefix: () => defaultSyncCodeVersion,
  currentContentSummary() { reads++; return structuredClone({ projects: [project], projectSections: links }); },
  workspaceProject: projects => projects.find(item => item.id === selected) || null,
  syncImmediateBookmarkButton(button, saved) { paints++; button.classList.toggle("is-saved", saved); },
  codeDisplayLabel: prefix => prefix, codeTheme: prefix => prefix.toLowerCase(),
  researchCodeEdition: item => item.codeVersion === historicalConstructionSyncCodeVersion ? "2014" : "2022",
  normalizeSearchResultSources: value => value || [],
  wireProjectSectionMotion() {}, searchPositionState: () => ({ selectedResult: "" }),
  searchResultPresentation: item => ({ heading: item.title, excerpt: item.excerpt, citation: item.citation }),
  appendHighlighted: (node, text) => { node.textContent = text; }, markResearchSelectable() {},
  searchGroupCountText: count => String(count)
});
const subscriptionLifecycle = source.slice(source.indexOf("const workspaceNodeAccessRecords"), source.indexOf("function readerPrivateContentAllowed"));
vm.runInContext(subscriptionLifecycle + ["workspaceAccessGateForRender", "normalizeAnnotationBlockID", "savedEvidenceKey", "projectSectionBelongsToProject", "workspaceSavedEvidenceKeys", "isSectionSaved",
  "searchResultDetail", "searchResultPositionKey", "createSearchResultSaveButton", "appendSearchResultGroups", "refreshSearchGroupCounts"].map(actual).join("\n"), c);
const gate = c.workspaceAccessGateForRender();
await gate.ready;
panel.__workspaceAccessGate = gate;
const expected = item => links.some(link => c.savedEvidenceKey(link) === c.savedEvidenceKey(c.searchResultDetail(item)) && c.projectSectionBelongsToProject(link, selected === "p1" ? project : null));
const assertRows = (items, resultNode = results) => {
  const buttons = resultNode.querySelectorAll(".search-result-save");
  const byKey = new Map(buttons.map(button => [button.dataset.savedEvidenceKey, button]));
  assert.equal(buttons.length, items.length);
  for (const item of items) assert.equal(byKey.get(c.savedEvidenceKey(c.searchResultDetail(item))).classList.contains("is-saved"), expected(item));
  const mainButtons = resultNode.querySelectorAll(".result-row-main");
  assert.deepEqual(new Set(mainButtons.map(button => button.dataset.searchResultKey)), new Set(items.map(item => c.searchResultPositionKey(item))));
  assert.deepEqual(new Set(mainButtons.map(button => button.querySelector(".result-title").textContent)), new Set(items.map(item => item.title)));
  assert.deepEqual(new Set(resultNode.querySelectorAll(".result-chapter").map(node => node.textContent)), new Set(items.map(item => item.citation)));
};
const start = performance.now();
c.appendSearchResultGroups(results, matches, "means of egress", instance);
const duration = performance.now() - start;
assertRows(matches);
assert.equal(reads, 1, "80 results across current/historical editions share one summary with a real eagerly notifying settled gate");
assert.equal(paints, 80, "The eager callback and explicit initialization do not paint each button twice");
const next = matches.slice(0, 5).map((item, index) => ({ ...item, id: `next-${index}`, title: `Next ${index}`, citation: `Next citation ${index}` }));
links.push({ ...next[0], sectionID: next[0].id, folderID: "p1" });
reads = 0;
c.appendSearchResultGroups(results, [...matches, ...next], "means of egress", instance);
assertRows([...matches, ...next]);
assert.equal(reads, 1, "Each new page uses fresh state and skips already-rendered rows");
assert.equal(paints, 85);
links = []; reads = 0; assert.equal(gate.retry(), true); await gate.ready;
assertRows([...matches, ...next]);
assert.equal(reads, 1, "85 access callbacks share one fresh notification snapshot after writes");
selected = "other-project";
const otherResults = new Node("div"); panel.append(otherResults); reads = 0;
c.appendSearchResultGroups(otherResults, matches.slice(0, 5), "means of egress", instance);
assertRows(matches.slice(0, 5), otherResults); assert.equal(reads, 1);
current = false; reads = 0;
const revokedResults = new Node("div"); panel.append(revokedResults);
c.appendSearchResultGroups(revokedResults, matches, "means of egress", instance);
assert.equal(reads, 0, "Invalid account/workspace authority never reads private saved state");
assert.ok(revokedResults.querySelectorAll(".search-result-save").every(button => button.hidden && button.disabled));
current = true; selected = "p1";
let release;
c.workspaceAccessState = null;
c.ensureSyncedContentForRender = () => new Promise(resolve => { release = () => resolve(c.syncedContent); });
const pendingGate = c.workspaceAccessGateForRender();
const pendingPanel = new Node("article"); pendingPanel.className = "search-panel"; pendingPanel.__workspaceAccessGate = pendingGate;
const pendingResults = new Node("div"); pendingPanel.append(pendingResults); reads = 0;
c.appendSearchResultGroups(pendingResults, matches, "means of egress", instance);
assert.equal(reads, 0); assert.ok(pendingResults.querySelectorAll(".search-result-save").every(button => button.hidden));
links.push({ ...matches[0], sectionID: matches[0].id, folderID: "p1" });
await Promise.resolve(); release(); await pendingGate.ready;
assertRows(matches, pendingResults);
assert.ok(pendingResults.querySelectorAll(".search-result-save").every(button => !button.hidden));
assert.equal(reads, 1, "80 pending controls share current private state, including writes after public rendering");
console.log(JSON.stringify({ results: 80, initialSummaryReads: 1, initialBookmarkPaints: 80, revalidationSummaryReads: 1, pendingUpgradeSummaryReads: 1, renderMS: +duration.toFixed(2) }));
console.log("Search bookmark render passed: real eager and pending gates, one summary per append, fresh later pages/access updates, exact edition/block/Project identity, duplicate suppression, unchanged citation/title/target output, and revoked account/workspace privacy.");
