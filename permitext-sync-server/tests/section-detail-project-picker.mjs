import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const start = source.indexOf("function removeReaderNotesProjectPicker(");
const end = source.indexOf("\nfunction showReaderNotesProjectPicker(", start);
assert(start >= 0 && end > start);

// Minimal event-capable DOM for executing the picker with deferred persistence.
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.events = {}; this.attributes = {}; this.value = ""; this.style = {}; }
  matches(selector) {
    if (selector === "button:not(:disabled)") return this.tag === "button" && !this.disabled;
    return selector.startsWith(".") ? (this.className || "").split(" ").includes(selector.slice(1)) : this.tag === selector;
  }
  querySelectorAll(selectors) {
    const matches = [];
    for (const child of this.children) {
      if (selectors.split(",").some(selector => child.matches(selector.trim()))) matches.push(child);
      matches.push(...child.querySelectorAll(selectors));
    }
    return matches;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector); }
  append(...nodes) { nodes.forEach(node => { node.parent = this; this.children.push(node); }); }
  prepend(node) { node.parent = this; this.children.unshift(node); }
  after(node) { node.parent = this.parent; this.parent.children.splice(this.parent.children.indexOf(this) + 1, 0, node); }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name]; }
  addEventListener(name, callback) { this.events[name] = callback; }
  dispatchEvent(event) { this.events[event.type]?.(event); }
  fire(name, properties = {}) { return this.events[name]?.({ preventDefault() {}, ...properties }); }
  focus() { documentStub.activeElement = this; }
  contains(node) { return this === node || this.children.some(child => child.contains(node)); }
  getBoundingClientRect() { return this.rect || { left: 500, right: 1000, bottom: 65, width: 500 }; }
  get offsetWidth() { return 260; }
  get offsetHeight() { return 120; }
  get isConnected() { return Boolean(this.root || this.parent?.isConnected); }
}

const first = { id: "first", name: "First", folderType: "project" };
const second = { id: "second", name: "Second", folderType: "project" };
const collection = { id: "collection", name: "Legacy collection", folderType: "saved_collection" };
const payload = { sectionID: "261", codeVersion: "2014-edition", blockID: "paragraph-2" };
let persistence;
let creation;
let permitted = true;
let saveEvents = 0;
let closes = 0;
const body = new Element("body");
body.root = true;
const track = new Element("main");
body.append(track);
const documentStub = { body, createElement: tag => new Element(tag), querySelector: selector => body.querySelector(selector), events: {}, addEventListener(name, callback) { this.events[name] = callback; } };
const observers = [];
const context = vm.createContext({
  document: documentStub,
  track,
  window: { innerWidth: 1000, innerHeight: 700, events: {}, addEventListener(name, callback) { this.events[name] = callback; } },
  activeWorkspaceID: "original",
  captureAccountRequest: () => ({}),
  isCurrentAccountRequest: () => true,
  closeWorkspaceContextMenu() {},
  AbortController,
  MutationObserver: class { constructor(callback) { this.callback = callback; observers.push(this); } observe() {} disconnect() { this.disconnected = true; } },
  activeFolderRecords: folders => folders,
  currentContentSummary: () => ({ projects: [first, collection, second] }),
  folderIsProject: folder => folder.folderType === "project",
  readerPrivateContentAllowed: () => permitted,
  persistSectionFolderSelection: (...args) => persistence(...args),
  createProjectFolder: input => creation(input),
  syncReaderNoteBookmarkButtons() {},
  refreshOpenAnnotationProjectEditors() {},
  CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
  requestAnimationFrame: callback => callback()
});
vm.runInContext(source.slice(start, end), context);
vm.runInContext(source.slice(source.indexOf("function closeSectionSaveProjectSheet("), source.indexOf("\nfunction showSectionProjectAssignment(")), context);

function openPicker() {
  const panel = new Element("article");
  panel.root = true;
  panel.className = "section-detail-panel";
  const bookmark = new Element("button");
  bookmark.className = "section-detail-save";
  const sheet = new Element("section");
  panel.append(bookmark, sheet);
  sheet.addEventListener("permitext-folder-save", event => { assert.equal(event.detail.saved, true); saveEvents += 1; });
  context.showSectionDetailProjectPicker(sheet, payload, { onClose() { closes += 1; sheet.remove(); } });
  return { panel, bookmark, sheet, options: sheet.querySelectorAll(".section-detail-project-option") };
}

let resolveSave;
let calls = 0;
persistence = (target, selected, visible) => {
  calls += 1;
  assert.equal(target, payload, "Direct assignment retains the exact edition and paragraph target.");
  assert.equal(selected.length, 1);
  assert.equal(selected[0], first);
  assert.equal(visible.length, 1, "Other Project and collection memberships must not be candidates for removal.");
  assert.equal(visible[0], first);
  return new Promise(resolve => { resolveSave = resolve; });
};
const active = openPicker();
assert.deepEqual(active.options.map(button => button.textContent), ["First", "Second"], "Only Projects are offered.");
active.options[0].fire("click");
active.options[0].fire("click");
assert.equal(calls, 1, "Repeated clicks cannot create overlapping assignments.");
assert.equal(active.bookmark.disabled, true);
resolveSave({ saved: true });
await new Promise(setImmediate);
assert.equal(active.sheet.isConnected, false, "A successful direct selection returns to the passage.");
assert.equal(active.bookmark.disabled, false, "The retained passage can be unbookmarked after the picker detaches.");
assert.equal(saveEvents, 1);
assert.equal(closes, 1);

persistence = async () => ({ saved: false });
const retry = openPicker();
retry.options[0].fire("click");
await new Promise(setImmediate);
assert.equal(retry.sheet.isConnected, true);
assert.match(retry.sheet.querySelector(".reader-notes-project-status").textContent, /could not be added/);
assert.equal(retry.options[0].disabled, false);
persistence = async () => { throw new Error("Try again later"); };
retry.options[0].fire("click");
await new Promise(setImmediate);
assert.equal(retry.sheet.querySelector(".reader-notes-project-status").textContent, "Try again later");
assert.equal(retry.bookmark.disabled, false);

const created = { id: "created", name: "New Project", folderType: "project" };
creation = async input => { assert.equal(input.name, "New Project"); assert.equal(input.folderType, "project"); return created; };
persistence = async (_target, selected) => { assert.equal(selected[0], created); return { saved: false }; };
retry.sheet.querySelector(".reader-notes-new-project").fire("click");
const form = retry.sheet.querySelector("form");
form.querySelector("input").value = "  New Project  ";
await form.fire("submit");
assert.equal(retry.sheet.querySelector("form"), null);
assert.equal(retry.sheet.querySelectorAll(".section-detail-project-option").length, 3, "A created Project remains available if adding its passage fails.");
assert.equal(retry.sheet.querySelector(".reader-notes-new-project").hidden, false);
persistence = async () => ({ saved: true });
retry.sheet.querySelectorAll(".section-detail-project-option")[2].fire("click");
await new Promise(setImmediate);
assert.equal(retry.sheet.isConnected, false);
assert.equal(retry.bookmark.disabled, false);

// Completion after revoking access must not re-enable a private control.
persistence = () => new Promise(resolve => { resolveSave = resolve; });
const revoked = openPicker();
revoked.options[0].fire("click");
permitted = false;
resolveSave({ saved: false });
await new Promise(setImmediate);
assert.equal(revoked.bookmark.disabled, true);
permitted = true;

const owner = new Element("article");
owner.className = "section-detail-panel";
const anchor = new Element("button");
anchor.rect = { left: 835, right: 925, bottom: 65, width: 90 };
const note = new Element("textarea");
note.value = "Draft remains visible";
const ownerBookmark = new Element("button");
ownerBookmark.className = "section-detail-save";
owner.append(anchor, note, ownerBookmark);
track.append(owner);
context.showSectionDetailProjectMenu(owner, payload, anchor);
let menu = owner.__sectionProjectMenu;
assert.equal(menu.parent, body, "The menu floats outside the column without covering its passage.");
assert.equal(note.value, "Draft remains visible");
assert.equal(menu.style.left, "665px");
assert.equal(menu.style.top, "71px");
assert.equal(anchor.getAttribute("aria-expanded"), "true");
assert.equal(menu.getAttribute("role"), "menu");
const items = menu.querySelectorAll("button:not(:disabled)");
menu.fire("keydown", { key: "End" });
assert.equal(documentStub.activeElement, items.at(-1));
menu.fire("keydown", { key: "Home" });
assert.equal(documentStub.activeElement, items[0]);
menu.fire("keydown", { key: "Escape" });
assert.equal(owner.__sectionProjectMenu, undefined);
assert.equal(anchor.getAttribute("aria-expanded"), "false");
assert.equal(documentStub.activeElement, anchor);
assert.equal(observers.at(-1).disconnected, true);

context.showSectionDetailProjectMenu(owner, payload, anchor);
context.showSectionDetailProjectMenu(owner, payload, anchor);
assert.equal(owner.__sectionProjectMenu, undefined, "The trigger toggles its menu closed.");
context.showSectionDetailProjectMenu(owner, payload, anchor);
documentStub.events.pointerdown({ target: note });
assert.equal(owner.__sectionProjectMenu, undefined, "Clicking outside dismisses the menu.");

context.showSectionDetailProjectMenu(owner, payload, anchor);
menu = owner.__sectionProjectMenu;
menu.querySelector(".reader-notes-new-project").fire("click");
assert.equal(menu.getAttribute("role"), "dialog", "The name entry supports form keyboard interaction.");
menu.fire("keydown", { key: "Tab" });
assert.equal(owner.__sectionProjectMenu, menu, "Tab can move from the name field to Create and add.");
menu.fire("keydown", { key: "Escape" });

context.showSectionDetailProjectMenu(owner, payload, anchor);
menu = owner.__sectionProjectMenu;
calls = 0;
persistence = async () => { calls += 1; return { saved: true }; };
context.activeWorkspaceID = "replacement";
menu.querySelector(".section-detail-project-option").fire("click");
assert.equal(calls, 0, "A menu from a previous workspace cannot assign a passage.");
observers.at(-1).callback();
assert.equal(owner.__sectionProjectMenu, undefined);
context.activeWorkspaceID = "original";
context.showSectionDetailProjectMenu(owner, payload, anchor);
owner.remove();
observers.at(-1).callback();
assert.equal(body.querySelector(".section-detail-project-menu"), null, "Closing the column removes its floating menu and listeners.");
console.log("Source Detail Project assignment, retry, creation, and anchored menu lifecycle passed.");
