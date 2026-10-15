import assert from "node:assert/strict";
import { renderReaderBlockBatches } from "../public/reader-render-batches.js";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import vm from "node:vm";
import { createWorkspaceAccessGate } from "../public/workspace-access-gate.js";
import { syncCodeVersion, defaultSyncCodeVersion } from "../public/sync-identity.js";
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
  matches(selector) {return selector.startsWith(".") && this.classList.contains(selector.slice(1));}
  querySelector(selector) {for(const node of this.children){if(node.matches(selector))return node;const nested=node.querySelector(selector);if(nested)return nested;}return null;}
  querySelectorAll(selector) { return this.children.flatMap(node=>[...(node.matches(selector)?[node]:[]),...node.querySelectorAll(selector)]); }
  closest(selector) {return this.matches(selector)?this:this.parentNode?.closest(selector)||null;}
  setAttribute(name,value){this.attrs[name]=value;}
  addEventListener(name,fn){this.events[name]=fn;}
  async click(){await this.events.click?.();}
  get isConnected(){return Boolean(this.parentNode)||this.connected===true;}
}

let reads = 0, permitted = true, selected = "p1";
const project = { id: "p1", clientID: "local-p1" };
const section = { id: "section", sectionNumber: "101", title: "Complete enacted text", readerAliasSectionIDs: [],
  blocks: Array.from({ length: 500 }, (_, index) => ({ id: `paragraph-${index}`, plainText: `Authoritative paragraph ${index}` })) };
const reader = { codePrefix: "BC", codeVersion: defaultSyncCodeVersion };
let links = Array.from({ length: 1000 }, (_, index) => ({ sectionID: index < 500 ? "section" : `other-${index}`, codeVersion: defaultSyncCodeVersion,
  blockID: `paragraph-${index}`, folderClientID: index % 3 === 0 ? "local-p1" : "other-project" }));
links.push({ sectionID: "section", codeVersion: "NYC2014", blockID: "paragraph-1", folderID: "p1" });
links.push({ sectionID: "section", codeVersion: defaultSyncCodeVersion, blockID: "", folderID: "p1" });
const panel = new Node("article"); panel.connected = true;
const context = vm.createContext({
  createWorkspaceAccessGate, workspaceAccessState: null, activeWorkspaceID: "workspace", accountRuntimeGeneration: 1,
  syncedContent: { userID: "a", workspacePresentationAccess: "verified" }, syncLoadPromise: null,
  state: { utilityInstances: [] }, captureAccountRequest: () => "a", isCurrentAccountRequest: () => permitted,
  activeAccount: () => ({ userID: "a" }), ensureSyncedContentForRender: async () => context.syncedContent,
  loadSyncedContent: async () => context.syncedContent, reconcileProjectWorkspaces() {}, closeDeletedProjectDetails() {}, scopeSavedInstanceToWorkspace() {},
  enforceReaderPlanLimit() {}, renderUtilityWorkspace: async () => {},
  document: { createElement: tag => new Node(tag) }, syncCodeVersion, defaultSyncCodeVersion, renderReaderBlockBatches,
  currentContentSummary() { reads++; return structuredClone({ projects: [project], projectSections: links }); },
  workspaceProject: projects => projects.find(item => item.id === selected) || null,
  syncCodeVersionForPrefix: () => defaultSyncCodeVersion, markResearchSelectable() {},
  sectionDisplayTitle: (_number, title) => title, annotatedBlocksForSection: value => value.blocks,
  annotationTargetForSection: value => ({ sectionID: value.id, codeVersion: reader.codeVersion, blockID: "" }),
  annotationTargetForBlock: (value, block) => ({ sectionID: value.id, codeVersion: reader.codeVersion, blockID: block.id }),
  renderCodeBlock(block) { const node = new Node("p"); node.textContent = block.plainText; return node; },
  linkInlineCodeReferences() {}, decorateReaderDefinitions() {}, hasCapability: () => true,
  bookmarkIconSVG: saved => saved ? "saved" : "save", bookmarkActionLabel: saved => saved ? "Remove passage" : "Save passage",
  researchActionIconSVG: () => "research", noteAddIconSVG: () => "note",
});
const subscriptionLifecycle = source.slice(source.indexOf("const workspaceNodeAccessRecords"), source.indexOf("function readerPrivateContentAllowed"));
vm.runInContext(subscriptionLifecycle + ["workspaceAccessGateForRender", "normalizeAnnotationBlockID", "savedEvidenceKey", "projectSectionBelongsToProject", "workspaceSavedEvidenceKeys", "isSectionSaved",
  "readerPrivateContentAllowed", "renderReaderChapterSection", "renderAnnotatedCodeBlock", "renderInlineCommentBox"].map(actual).join("\n"), context);
const gate = context.workspaceAccessGateForRender();
await gate.ready;
panel.__workspaceAccessGate = gate;
const previousSaved = target => links.some(link => context.savedEvidenceKey(link) === context.savedEvidenceKey(target) && context.projectSectionBelongsToProject(link, selected === "p1" ? project : null));
function checkRendered(rendered) {
  const bookmarks = [rendered.querySelector(".reader-section-saved-marker"), ...rendered.querySelectorAll(".inline-comment").map(node => node.querySelector(".inline-bookmark-toggle"))];
  const targets = [{ sectionID: section.id, codeVersion: reader.codeVersion, blockID: "" }, ...section.blocks.map(block => ({ sectionID: section.id, codeVersion: reader.codeVersion, blockID: block.id }))];
  assert.equal(bookmarks.length, 501);
  assert.deepEqual(bookmarks.map(button => button.classList.contains("is-saved")), targets.map(previousSaved), "Every bookmark exactly matches prior Project, edition and block membership semantics");
  assert.deepEqual(rendered.querySelectorAll(".annotated-code-block").map(node => node.children[0].textContent), section.blocks.map(block => block.plainText));
}
const start = performance.now();
let rendered = context.renderReaderChapterSection(panel, reader, section, new Map());
await rendered._readerBlocksReady;
const afterMS = performance.now() - start;
checkRendered(rendered);
assert.equal(reads, 1, "500 block controls plus the whole-section marker share exactly one fresh summary even when the real settled gate eagerly notifies on subscribe");
const initialReads = reads;
links = [];
assert.equal(gate.retry(), true); await gate.ready;
assert.equal(reads - initialReads, 1, "501 access callbacks share one fresh notification snapshot after writes");
checkRendered(rendered);
links = [{ sectionID: "section", codeVersion: defaultSyncCodeVersion, blockID: "paragraph-7", folderID: "p1" }];
reads = 0;
rendered = context.renderReaderChapterSection(panel, reader, section, new Map());
await rendered._readerBlocksReady;
checkRendered(rendered); assert.equal(reads, 1, "A subsequent render sees new writes");
selected = "other-project";
rendered = context.renderReaderChapterSection(panel, reader, section, new Map());
await rendered._readerBlocksReady;
checkRendered(rendered);
permitted = false; reads = 0;
rendered = context.renderReaderChapterSection(panel, reader, section, new Map());
await rendered._readerBlocksReady;
assert.equal(reads, 0, "Public or pending content never reads private summary state");
assert.equal(rendered.querySelector(".reader-section-saved-marker").hidden, true);
console.log(JSON.stringify({ blocks: 500, projectLinks: 1002, currentSummaryReads: 1, revalidationSummaryReads: 1, pendingUpgradeSummaryReads: 1, currentRenderMS: +afterMS.toFixed(2) }));
console.log("Reader bookmark rendering passed: exact block/edition/Project membership parity, complete enacted text, pending privacy, fresh access callbacks, workspace changes and fresh subsequent writes.");

permitted = true; selected = "p1";
let releaseVerification;
context.workspaceAccessState = null;
context.ensureSyncedContentForRender = () => new Promise(resolve => { releaseVerification = () => resolve(context.syncedContent); });
const pendingGate = context.workspaceAccessGateForRender();
panel.__workspaceAccessGate = pendingGate; reads = 0;
rendered = context.renderReaderChapterSection(panel, reader, section, new Map());
await rendered._readerBlocksReady;
assert.equal(reads, 0, "The real pending gate does not read private state during construction");
assert.equal(rendered.querySelector(".reader-section-saved-marker").hidden, true);
await Promise.resolve(); releaseVerification(); await pendingGate.ready;
checkRendered(rendered);
assert.equal(rendered.querySelector(".reader-section-saved-marker").hidden, false);
assert.equal(reads, 1, "501 pending controls share one current snapshot at verification");
console.log("Reader access tests use actual subscribeWorkspaceNodeAccess and real settled/pending gates, including eager subscription notification and later private upgrade.");
