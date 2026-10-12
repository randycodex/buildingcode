import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function actual(name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0);
  return source.slice(start, source.indexOf("\n}", start) + 2);
}
class Element {
  constructor(tag = "div", className = "") {
    this.tag = tag; this.className = className; this.children = []; this.events = {};
    this.attributes = {}; this.classList = { toggle() {}, add() {} };
  }
  append(...nodes) { nodes.forEach(node => { node.parent = this; this.children.push(node); }); }
  before(node) { node.parent = this.parent; this.parent.children.splice(this.parent.children.indexOf(this), 0, node); }
  prepend(node) { node.parent = this; this.children.unshift(node); }
  querySelector(selector) {
    return this.children.find(child => child.className.split(" ").includes(selector.slice(1))) || null;
  }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
  addEventListener(name, callback) { this.events[name] = callback; }
}
const oldEdition = { id: "old", sectionID: "261", codeVersion: "2014", blockID: "", noteBody: "Keep historical note", createdAt: "2026-10-08" };
const currentEdition = { id: "current", sectionID: "261", codeVersion: "2022", blockID: "paragraph", noteBody: "Keep paragraph note", createdAt: "2026-10-10" };
const noteOnly = { id: "note", sectionID: "262", codeVersion: "2014", noteBody: "Keep note-only record", updatedAt: "2026-10-09" };
const records = [oldEdition, currentEdition, noteOnly];
const originalRecords = structuredClone(records);
const project = { id: "target", name: "Target", folderType: "project" };
const links = new Map([['other:old', { projectID: "other", item: oldEdition }]]);
let menuOptions, controller, failID = "", afterPersist;
const panel = new Element();
const select = new Element("button", "saved-evidence-select-toggle");
const remove = new Element("button", "saved-evidence-delete-selection");
const cancel = new Element("button", "saved-evidence-cancel-selection");
panel.append(select, remove, cancel);
const context = vm.createContext({
  document: { createElement: tag => new Element(tag) }, Option: function(label, value) { return { label, value }; },
  activeFolderRecords: items => items, folderIsProject: item => item.folderType === "project",
  currentContentSummary: () => ({ projects: [project] }), projectRecordID: item => item.id,
  workspaceProject: () => ({ id: "active-project" }), activeWorkspaceID: "project:active", identity: "A",
  captureAccountRequest: () => context.identity,
  requireCurrentAccountRequest: identity => { if (context.identity !== identity) throw Error("Account changed"); },
  accountContextChangedError: () => Error("Workspace changed"),
  showSectionDetailProjectMenu: (_panel, _record, _anchor, options) => { menuOptions = options; },
  persistSectionInProject: async (destination, record) => {
    if (record.id === failID) throw Error("Temporary failure");
    links.set(`${destination.id}:${record.id}`, { projectID: destination.id, item: structuredClone(record) });
    afterPersist?.();
    return true;
  },
  refreshOpenSavedPanes: async () => {}, selectionIndicatorIconSVG: () => "", folderAddIconSVG: () => "",
  compareSavedCodeOrder: (left, right) => left.id.localeCompare(right.id), searchCodeFilterOptions: () => [], Date
});
vm.runInContext(["savedItemSelectionID", "sortSavedItems", "createSavedBulkSelectionController"].map(actual).join("\n"), context);
assert.deepEqual(Array.from(context.sortSavedItems(records, "recentlySaved"), item => item.id), ["current", "note", "old"],
  "Sort before pagination across editions, including note-only records");
controller = context.createSavedBulkSelectionController(panel, records, { allowProjectAssignment: true, inbox: true });
select.events.click();
controller.toggle(oldEdition); controller.toggle(currentEdition); controller.toggle(noteOnly);
const assign = panel.querySelector(".saved-inbox-assign-selection");
assert.equal(assign.hidden, false, "Inbox bulk assignment is available beside an active Project");
assign.events.click();
failID = "current";
await assert.rejects(menuOptions.onAssign(project), /Temporary failure/);
assert.equal(controller.isActive(), true, "Keep selection available for retry after partial failure");
failID = "";
assign.events.click();
await menuOptions.onAssign(project);
assert.equal(controller.isActive(), false);
assert.deepEqual(records, originalRecords, "Assignment must preserve original saved records and notes");
assert.equal(links.size, 4, "Additive assignment must preserve other Project links and retry without duplicates");
assert.equal(links.get("target:current").item.codeVersion, "2022");
assert.equal(links.get("target:current").item.blockID, "paragraph");
assert.equal(links.get("target:old").item.codeVersion, "2014");
assert.equal(links.get("target:note").item.noteBody, noteOnly.noteBody);
select.events.click(); controller.toggle(oldEdition); controller.toggle(currentEdition);
assign.events.click();
afterPersist = () => { context.identity = "B"; };
await assert.rejects(menuOptions.onAssign(project), /Account changed/);
assert.equal(controller.isActive(), true);
console.log("Project bulk assignment passed: global recency, active-Project bulk assignment, additive edition/block/notes, partial retry and account fencing.");

// Bulk removal confirms once, preserves other destinations, and fences accounts.
let prompts=0, individualPrompts=0, removed=[], approve=true;
context.identity='A';
context.currentContentSummary=()=>({projects:[project],projectSections:[{...oldEdition,folderClientID:'other'}]});
context.savedEvidenceKey=item=>`${item.codeVersion}:${item.sectionID}:${item.blockID}`;
context.projectSectionBelongsToProject=(item,folder)=>item.folderClientID===folder.id;
context.openWebWarning=async()=>{individualPrompts++;return true;};
context.removeSectionFromProject=async(folder,item,options)=>{removed.push({id:item.id,...options});};
context.confirmWebWarning=async()=>{prompts++;return approve;};
context.showWebNotice=async()=>{};
context.refreshVisibleSyncedDerivedState=()=>{};
context.refreshProjectSourceConsumers=async()=>{};
vm.runInContext('async '+actual('unlinkEvidenceFromFolder'),context);
controller=context.createSavedBulkSelectionController(panel,records,{
  removeConfirmationDetail:'Unlinked records are deleted; other destinations remain.',
  removeAction:(item,options)=>context.unlinkEvidenceFromFolder(project,item,null,{...options,refreshPanes:false})
});
select.events.click(); records.forEach(item=>controller.toggle(item));
approve=false; await remove.events.click(); assert.equal(removed.length,0,'Cancel makes no mutations');
approve=true; await remove.events.click();
assert.equal(prompts,2,'Exactly one prompt per bulk attempt'); assert.equal(individualPrompts,0);
assert.equal(removed.length,3); assert.equal(removed[0].removeBookmark,false,'Other destination preserves saved record');
assert.equal(removed[1].removeBookmark,true); assert.equal(removed[2].removeBookmark,true);
await context.unlinkEvidenceFromFolder(project,currentEdition);
assert.equal(individualPrompts,1,'Single-item removal still warns');
console.log('Bulk deletion passed one confirmation, cancel, final-destination cleanup and shared-evidence preservation.');
const beforeSwitch=removed.length;
context.confirmWebWarning=async()=>{context.identity='B';return true;};
await assert.rejects(remove.events.click(),/Account changed/);
assert.equal(removed.length,beforeSwitch,'Account switch during confirmation cannot authorize deletion');
