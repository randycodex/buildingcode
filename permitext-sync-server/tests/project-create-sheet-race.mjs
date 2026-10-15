import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const start = source.indexOf("function showProjectCreateSheet(");
const end = source.indexOf("\nfunction appendProjectEmptyCard(", start);
assert.ok(start > 0 && end > start);
const event = key => ({ key, preventDefault() {}, stopPropagation() {} });
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return {promise, resolve, reject}; };
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.events = {}; this.attributes = {}; this.style = {setProperty() {}}; this.dataset = {}; this.value = ""; this.disabled = false; this.hidden = false; this.classList = {toggle() {}}; }
  append(...items) { for (const item of items) { item.parent = this; this.children.push(item); } }
  prepend(item) { item.parent = this; this.children.unshift(item); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(item => item !== this); this.parent = null; }
  get isConnected() { return this.tag === "body" || !!this.parent?.isConnected; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  addEventListener(name, fn) { this.events[name] = fn; }
  focus() { this.focused = true; }
  querySelectorAll(selector) { const all = this.children.flatMap(item => [item, ...item.querySelectorAll("*")]); return selector === "*" ? all : all.filter(item => selector.split(/,\s*/).some(part => part.startsWith(".") ? item.className?.split(" ").includes(part.slice(1)) : item.tag === part)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}
function harness({ editing = false, inline = false, beforeSave } = {}) {
  const body = new Element("body"), panel = new Element("section"), background = new Element("div");
  background.className = "projects-content"; panel.append(background); body.append(panel);
  const lookup = deferred(), write = deferred(), created = [], updated = [], notices = [], callbacks = [];
  const c = vm.createContext({
    document: { createElement: tag => new Element(tag), activeElement: new Element("button") }, HTMLElement: Element,
    activeWorkspaceID: "workspace", account: "owner", captureAccountRequest: () => c.account,
    isCurrentAccountRequest: identity => c.account === identity,
    activeAccount: () => ({userID: c.account}), projectIdentity: project => project, folderType: () => "project", folderTypeLabel: () => "Project",
    projectColorOptions: ["#334455", "#556677"], trapWebModalFocus() { callbacks.push("trap"); },
    postResearch: () => lookup.promise,
    createProjectFolder: async details => { created.push(details); if (c.failWrite) throw Error("Storage unavailable"); if (c.holdWrite) await write.promise; return {id: "created"}; },
    updateProjectFolder: async (project, details) => { updated.push(details); if (c.failWrite) throw Error("Storage unavailable"); if (c.holdWrite) await write.promise; return !c.rejectWrite; },
    transitionWorkspace: async () => { callbacks.push("transition"); }, projectOverviewRefreshPaneIDs: () => [], paneIDForProjectDetail: () => "",
    refreshOpenAnnotationProjectEditors() {}, appendMutedRow: (...args) => notices.push(args)
  });
  vm.runInContext(source.slice(start, end), c);
  c.showProjectCreateSheet(panel, editing ? {id: "existing", name: "Existing", address: "Old address", description: "Original", color: "#334455"} : null,
    {inline, beforeSave, onCreated: async () => callbacks.push("created"), onSaved: () => callbacks.push("saved")});
  const overlay = panel.querySelector(".project-sheet-overlay"), form = panel.querySelector("form");
  const name = panel.querySelector(".project-name-input"), address = panel.querySelector(".project-address-input"), description = panel.querySelector(".project-description-input");
  const cancel = form.querySelectorAll("button").find(button => button.textContent === "Cancel");
  const save = form.querySelectorAll("button").find(button => button.textContent === "Save");
  name.value = "Typed project"; address.value = "Synthetic address";
  if (description) description.value = "Typed description";
  name.events.input();
  return {c, panel, overlay, form, name, address, description, cancel, save, lookup, write, created, updated, notices, callbacks,
    submit: () => form.events.submit(event()),
    resolveLookup: () => lookup.resolve({property: {normalizedAddress: "Normalized address", structuredFacts: [{status: "sourced"}]}})
  };
}

for (const action of ["cancel", "escape", "account", "workspace", "detach"]) {
  const h = harness(), pending = h.submit();
  if (action === "cancel") h.cancel.events.click();
  if (action === "escape") h.overlay.events.keydown(event("Escape"));
  if (action === "account") h.c.account = "other";
  if (action === "workspace") h.c.activeWorkspaceID = "other";
  if (action === "detach") h.panel.remove();
  h.resolveLookup(); await pending;
  assert.equal(h.created.length, 0, `${action} during lookup prevents delayed creation`);
  assert.equal(h.callbacks.length, 0, `${action} prevents late callbacks/navigation`);
}
for (const options of [{editing:false},{editing:true},{editing:true,inline:true}]) {
  const h = harness(options), first = h.submit();
  h.name.events.input();
  assert.equal(h.save.disabled, true, "Input events cannot re-enable Save during pending submission");
  assert.equal(h.name.disabled, true); assert.equal(h.address.disabled, true);
  if (h.description) assert.equal(h.description.disabled, true);
  const duplicate = h.submit();
  h.resolveLookup(); await Promise.all([first, duplicate]);
  assert.equal(h.created.length + h.updated.length, 1, "Repeated submission writes one Project");
  const details = (options.editing ? h.updated : h.created)[0];
  assert.equal(details.name, "Typed project"); assert.equal(details.address, "Normalized address");
  assert.equal(Object.hasOwn(details, 'description'), !options.inline, 'Inline identity saves preserve context owned by the separate editor.');
  assert.equal(h.overlay.isConnected, false);
  if (options.inline) assert.deepEqual(h.callbacks, ["saved"], "Inline saving refreshes its own screen without a background workspace transition.");
}
{
  const h = harness({editing:true,inline:true});
  assert.equal(h.overlay.getAttribute("role"), "region");
  assert.equal(h.overlay.getAttribute("aria-modal"), null);
  assert.match(h.overlay.className, /is-inline/);
  assert.equal(h.description, null, 'Edit project has no duplicate description field.');
  h.overlay.events.keydown(event("Tab"));
  assert.deepEqual(h.callbacks, [], "Inline editing must not trap focus within the form.");
  const pending = h.submit();
  h.cancel.events.click(); h.resolveLookup(); await pending;
  assert.equal(h.updated.length, 0, "Canceling a pending inline lookup cannot save the discarded draft.");
}
{
  const h = harness({editing:true,inline:true,beforeSave:async()=>false});
  await h.submit();
  assert.equal(h.updated.length, 0, "A failed Facts or Records flush cannot be bypassed by the identity editor.");
  assert.equal(h.overlay.isConnected, true);
}
{
  const h = harness({editing:true,inline:true}); h.c.rejectWrite = true;
  const pending=h.submit(); h.resolveLookup(); await pending;
  assert.equal(h.overlay.isConnected,true,"A denied update preserves the inline draft for retry.");
  assert.equal(h.name.value,"Typed project");
}
{
  const h = harness(); h.c.failWrite = true;
  const pending = h.submit(); h.resolveLookup(); await pending;
  const error = h.form.querySelectorAll("*").find(item => item.getAttribute("role") === "alert");
  assert.ok(error && !error.hidden, "A failed save exposes an inline alert inside the open sheet");
  assert.match(error.textContent, /Storage unavailable/);
  assert.equal(h.notices.length, 0, "Failure must not be hidden behind the sheet");
  assert.equal(h.name.value, "Typed project"); assert.equal(h.description.value, "Typed description");
  assert.equal(h.save.disabled, false); assert.equal(h.cancel.disabled, false); assert.equal(h.name.disabled, false);
  h.c.failWrite = false; await h.submit();
  assert.equal(h.created.length, 2, "An explicit retry is available after failure");
  assert.equal(h.overlay.isConnected, false);
}
{
  const h = harness(); h.c.holdWrite = true;
  const pending = h.submit(); h.resolveLookup(); await tick();
  assert.equal(h.created.length, 1);
  assert.equal(h.cancel.disabled, true, "Cancellation is unavailable after persistence begins");
  h.overlay.events.keydown(event("Escape"));
  assert.equal(h.overlay.isConnected, true, "Escape cannot imply cancellation of an already-started write");
  h.write.resolve(); await pending;
  assert.equal(h.overlay.isConnected, false);
}
console.log("Project sheet passed: pending lookup cancellation/context fences, single submission, frozen input, write boundary, inline error retention and explicit retry.");
