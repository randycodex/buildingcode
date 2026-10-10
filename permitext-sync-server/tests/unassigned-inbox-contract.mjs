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
  compareSavedCodeOrder: (left, right) => left.id.localeCompare(right.id), Date
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
console.log("Unassigned inbox passed: global recency, active-Project bulk assignment, additive edition/block/notes, partial retry and account fencing.");

function actualAsync(name) {
  const start = source.indexOf(`async function ${name}(`);
  assert(start >= 0);
  return source.slice(start, source.indexOf("\n}", start) + 2);
}
const inbox = { key: "saved", id: "inbox", unassignedInbox: true };
const retainedDetail = { key: "sdc", id: "detail" };
const toggleContext = vm.createContext({
  state: {
    utilityInstances: [{ key: "saved", id: "project-saved", selectedFolderID: "active" }, inbox, retainedDetail],
    projectHostPaneID: "project-saved",
    readers: [{ id: "reader", position: 1156 }, { id: "linked", savedSourcePaneID: "inbox", position: 80 }],
    paneOrder: ["project-saved", "reader", "inbox", "detail", "linked"],
    paneWeights: { "project-saved": 600, reader: 800, inbox: 600, detail: 600, linked: 800 },
    localAnnotations: structuredClone(records)
  },
  anchors: { detail: "inbox", other: "project-saved" },
  savedItemOpeningAttempts: new Map([["inbox", {}]]), activeWorkspaceID: "project:active",
  workspacePrivatePresentationAllowed: () => true,
  paneIDForUtilityInstance: item => item.id,
  sectionDetailAnchorsBySearch: () => toggleContext.anchors,
  closeLinkedReaderForSavedPane: () => { throw Error("Must retain open Readers"); },
  closeSavedItemDetailsForPane: () => { throw Error("Must retain open details"); },
  saveWorkspaceState() {}, transitions: 0,
  transitionWorkspace: () => {
    toggleContext.transitions++;
    return new Promise(resolve => { toggleContext.completeTransition = resolve; });
  },
  openUnassignedSaves: async () => {
    toggleContext.state.utilityInstances.push({ ...inbox, id: "reopened-inbox" });
  }
});
vm.runInContext(actual("unassignedInboxInstance") + "\nlet unassignedToggleInFlight = false;\n" +
  actualAsync("toggleUnassignedSaves") + "\n" + actualAsync("closeUtilityInstance"), toggleContext);
const pendingClose = vm.runInContext("toggleUnassignedSaves()", toggleContext);
await vm.runInContext("toggleUnassignedSaves()", toggleContext);
assert.equal(toggleContext.transitions, 1, "Repeated clicks during a pending close must not reopen or close twice");
toggleContext.completeTransition();
await pendingClose;
assert.deepEqual(Array.from(toggleContext.state.utilityInstances, item => item.id), ["project-saved", "detail"]);
assert.deepEqual(Array.from(toggleContext.state.readers, item => [item.id, item.position]), [["reader", 1156], ["linked", 80]]);
assert.equal(toggleContext.state.readers[1].savedSourcePaneID, undefined);
assert.deepEqual(toggleContext.anchors, { other: "project-saved" });
assert.equal(toggleContext.savedItemOpeningAttempts.has("inbox"), false, "Fence a delayed passage opening when closing the inbox");
assert.deepEqual(toggleContext.state.localAnnotations, records, "Toggling must not remove saved notes");
assert.equal(toggleContext.state.projectHostPaneID, "project-saved");
assert.equal(toggleContext.activeWorkspaceID, "project:active");
await vm.runInContext("toggleUnassignedSaves()", toggleContext);
assert.equal(toggleContext.state.utilityInstances.filter(item => item.unassignedInbox).length, 1);
console.log("Inbox toggle passed: open/close, rapid-click guard, active Project, Reader positions, notes and retained passage details.");
