import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const start = source.indexOf("function openActiveCodeSourceSettings(");
const end = source.indexOf("\n}", start) + 2;
let existing = null, wired = 0, restored = 0, cloned = 0;
function element() {
  return { listeners: {}, style: {}, children: [], setAttribute() {}, focus() {},
    append(...children) { this.children.push(...children); },
    addEventListener(name, fn) { this.listeners[name] = fn; },
    showModal() { this.shown = true; }, close() { this.listeners.close(); },
    remove() { existing = null; }, querySelector() { return this.children[0]; } };
}
const title = {};
const card = { setAttribute() {}, querySelector: () => title };
const c = vm.createContext({
  document: { activeElement: { isConnected: true, focus() { restored++; } },
    querySelector: () => existing, createElement: element, body: { append(dialog) { existing = dialog; } } },
  settingsTemplate: { content: { querySelector(selector) {
    assert.equal(selector, ".settings-active-sources-card");
    return { cloneNode() { cloned++; return card; } };
  } } },
  crypto: { randomUUID: () => "unique" },
  wireSettingsActiveCodeSources(dialog, options) { assert.equal(dialog, existing); assert.equal(options.enabled, true); wired++; }
});
vm.runInContext(source.slice(start, end) + "\nthis.open = openActiveCodeSourceSettings;", c);
c.open();
assert.equal(existing.shown, true);
assert.equal(existing.children.length, 2);
assert.equal(wired, 1);
assert.equal(title.id, "active-source-dialog-title-unique");
c.open();
assert.equal(cloned, 1);
existing.children[0].listeners.click();
assert.equal(existing, null);
assert.equal(restored, 1);
console.log("Public source dialog passed: source-only clone, no account gate, singleton modal, explicit close and focus restoration.");
