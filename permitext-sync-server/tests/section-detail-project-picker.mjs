import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const start = source.indexOf("function removeReaderNotesProjectPicker(");
const end = source.indexOf("\nfunction showReaderNotesProjectPicker(", start);
assert(start >= 0 && end > start);

// Minimal event-capable DOM for executing the picker with deferred persistence.
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.events = {}; this.attributes = {}; this.value = ""; }
  matches(selector) { return selector.startsWith(".") ? (this.className || "").split(" ").includes(selector.slice(1)) : this.tag === selector; }
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
  addEventListener(name, callback) { this.events[name] = callback; }
  dispatchEvent(event) { this.events[event.type]?.(event); }
  fire(name) { return this.events[name]?.({ preventDefault() {} }); }
  focus() {}
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
const context = vm.createContext({
  document: { createElement: tag => new Element(tag) },
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
console.log("Source Detail direct Project assignment, retry, creation, and control restoration passed.");
