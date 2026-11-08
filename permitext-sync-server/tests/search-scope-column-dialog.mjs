import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { documentFixture } from "./helpers/workflow-dom.mjs";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const start = source.indexOf("async function openSearchCodeSourceSettings(");
assert.ok(start >= 0);
const implementation = source.slice(start, source.indexOf("\n}", start) + 2);
const document = documentFixture();
const create = document.createElement;
document.createElement = tag => {
  const node = create(tag);
  Object.defineProperty(node, "isConnected", { get: () => track.contains(node) });
  node.style = { setProperty(key, value) { this[key] = value; } };
  node.show = () => { node.open = true; node.presentation = "column"; };
  node.showModal = () => { throw new Error("Search scope must not open a page-wide modal"); };
  node.close = () => { node.open = false; };
  node.getBoundingClientRect = () => ({ top: 70, bottom: 250, left: 20, width: 1200 });
  return node;
};
const track = document.createElement("main");
document.querySelector = selector => track.querySelector(selector);
function panel(id) {
  const node = document.createElement("article"); node.className = "search-panel";
  node.dataset.paneId = `utility:search:${id}`;
  const dock = document.createElement("section"); dock.className = "search-dock";
  dock.getBoundingClientRect = () => ({ top: 120, bottom: 250, left: 220, width: 800 });
  node.clientLeft = 2;
  const trigger = document.createElement("button"); trigger.className = "search-scope-summary";
  dock.append(trigger); node.append(dock); track.append(node);
  return node;
}
const first = panel("one"), second = panel("two");
const instances = [{ id: "one", querySourceKeys: null }, { id: "two", querySourceKeys: null }];
const catalog = [{ key: "plumbing", codePrefix: "PC", canonicalEdition: "2014" }, { key: "building", codePrefix: "BC", canonicalEdition: "2022" }];
const mutations = [], resizes = [];
function observerClass(collection) {
  return class {
    constructor(callback) { this.callback = callback; collection.push(this); }
    observe() { this.connected = true; }
    disconnect() { this.connected = false; }
  };
}
let saves = 0, renders = 0;
const context = vm.createContext({ document, track,
  MutationObserver: observerClass(mutations), ResizeObserver: observerClass(resizes),
  state: { utilityInstances: instances }, activeWorkspaceID: "workspace",
  captureAccountRequest: () => "account", isCurrentAccountRequest: identity => identity === "account",
  paneIDForUtilityInstance: instance => `utility:search:${instance.id}`,
  activeCodeSourcesController: { ensureCatalog: async () => {}, state: { catalog, preferences: { isEnabled: () => true } } },
  searchPanelSources: instance => instance.querySourceKeys === null ? catalog : catalog.filter(item => instance.querySourceKeys.includes(item.key)),
  codeOptions: [
    { prefix: "BC", canonicalEdition: "2022", group: "2022 Construction Codes", label: "Building Code (2022)" },
    { prefix: "PC", canonicalEdition: "2014", group: "2014 Construction Codes (Historical)", label: "Plumbing Code (2014)" }
  ],
  codeOptionVersion: code => code.canonicalEdition, readerCodeOptionLabel: code => code.label,
  codeSourceKey: item => item.key, circleXIconSVG: () => "<svg></svg>",
  searchPositionState: instance => instance.position ||= {},
  saveWorkspaceState: () => { saves++; }, updateSearchScopeSummary() {},
  renderSearchResults: async () => { renders++; },
  showWebNotice: async (_title, message) => { throw new Error(message); }, openActiveCodeSourceSettings() {}
});
const rowsStart = source.indexOf("function activeCodeSourceMenuRows(");
vm.runInContext(source.slice(rowsStart,source.indexOf("\n}",rowsStart)+2)+"\n"+implementation, context);
const dialog = () => document.querySelector(".search-scope-dialog");
const action = (node, label) => node.querySelectorAll("button").find(button => button.textContent === label).dispatch("click");

await context.openSearchCodeSourceSettings(first);
let picker = dialog();
assert.equal(picker.parentNode, first, "The picker belongs to its Search column.");
assert.equal(picker.presentation, "column", "Other columns remain outside a page-wide modal.");
assert.equal(picker.querySelectorAll("input").length, 2);
assert.deepEqual(picker.querySelectorAll("h3").map(heading=>heading.textContent),["2022 Construction Codes","2014 Construction Codes (Historical)"],"Sources follow Reader group order even when the catalog is reversed");
assert.deepEqual(picker.querySelectorAll("label").map(label=>label.children[1].textContent),["Building Code (2022)","Plumbing Code (2014)"]);
assert.equal(picker.style["--search-scope-width"],"800px");
assert.equal(picker.style["--search-scope-left"],"198px","The menu accounts for the column border when aligning to Search");
picker.querySelectorAll("input")[0].checked = false;
picker.querySelectorAll("input")[0].dispatch("change");
action(picker, "Cancel");
assert.equal(instances[0].querySourceKeys, null, "Cancel leaves the active source scope unchanged.");
assert.equal(saves, 0);
assert.equal(dialog(), null);
assert.ok(!mutations.at(-1).connected && !resizes.at(-1).connected, "Closing disposes positioning and lifecycle observers.");

await context.openSearchCodeSourceSettings(first);
picker = dialog();
action(picker,"Clear selection");
assert.ok(picker.querySelectorAll("input").every(input=>!input.checked));
action(picker,"Use all enabled sources");
assert.ok(picker.querySelectorAll("input").every(input=>input.checked),"Bulk actions include sources in every group");
action(picker,"Cancel");
assert.equal(instances[0].querySourceKeys,null);

await context.openSearchCodeSourceSettings(first);
picker = dialog();
picker.querySelectorAll("input")[0].checked = false;
picker.querySelectorAll("input")[0].dispatch("change");
action(picker, "Apply to this search");
assert.deepEqual([...instances[0].querySourceKeys], ["plumbing"]);
assert.equal(instances[1].querySourceKeys, null, "Applying one picker does not change another Search column.");
assert.equal(saves, 1); assert.equal(renders, 1);

await context.openSearchCodeSourceSettings(first);
await context.openSearchCodeSourceSettings(second);
assert.equal(dialog().parentNode, second, "Opening another column's picker closes the old picker and opens the requested one.");
dialog().dispatch("keydown", { key: "Escape", preventDefault() {}, stopPropagation() {} });
assert.equal(dialog(), null);

await context.openSearchCodeSourceSettings(first);
picker = dialog(); context.activeWorkspaceID = "another-workspace";
action(picker, "Apply to this search");
assert.equal(saves, 1, "A stale workspace cannot apply a pending source selection.");
assert.equal(dialog(), null);
console.log("Search scope column dialog passed: column-local presentation, cancel/apply isolation, keyboard dismissal, observer cleanup, column switching and stale workspace guards.");
