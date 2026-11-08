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
function harness({ editing = false, inline = false, beforeSave, alwaysVisible = false, readOnly = false, autoSave = false } = {}) {
  const body = new Element("body"), panel = new Element("section"), background = new Element("div");
  background.className = "projects-content"; panel.append(background); body.append(panel);
  const lookup = deferred(), write = deferred(), created = [], updated = [], notices = [], callbacks = [];
  let record = {id:"existing",name:"Existing",address:"Old address",description:"Original",color:"#334455",structuredFacts:[{key:'occupancy',value:'R-2',source:'user'}]};
  const c = vm.createContext({
    document: { createElement: tag => new Element(tag), activeElement: new Element("button"), querySelector: () => null }, HTMLElement: Element,
    activeWorkspaceID: "workspace", account: "owner", captureAccountRequest: () => c.account,
    isCurrentAccountRequest: identity => c.account === identity,
    activeAccount: () => ({userID: c.account}), projectIdentity: project => project, folderType: () => "project", folderTypeLabel: () => "Project",
    projectColorOptions: ["#334455", "#556677"], trapWebModalFocus() { callbacks.push("trap"); },
    postResearch: () => lookup.promise,
    createProjectFolder: async details => { created.push(details); if (c.failWrite) throw Error("Storage unavailable"); if (c.holdWrite) await write.promise; return {id: "created"}; },
    workspaceProject: () => record, projectStructuredFacts: project => project.structuredFacts || [],
    updateProjectFolder: async (project, details) => { updated.push(details); if (c.failWrite) throw Error("Storage unavailable"); if (c.holdWrite) await write.promise; if(c.rejectWrite)return false; record={...record,...details}; return true; },
    transitionWorkspace: async () => { callbacks.push("transition"); }, projectOverviewRefreshPaneIDs: () => [], paneIDForProjectDetail: () => "",
    refreshOpenAnnotationProjectEditors() {}, appendMutedRow: (...args) => notices.push(args)
  });
  vm.runInContext(source.slice(start, end), c);
  const controller = c.showProjectCreateSheet(panel, editing ? record : null,
    {inline, beforeSave, alwaysVisible, readOnly, autoSave, onCancel: alwaysVisible ? () => callbacks.push("cancel") : undefined,
      onCreated: async () => callbacks.push("created"), onSaved: () => callbacks.push("saved")});
  const overlay = panel.querySelector(".project-sheet-overlay"), form = panel.querySelector("form");
  const name = panel.querySelector(".project-name-input"), address = panel.querySelector(".project-address-input"), description = panel.querySelector(".project-description-input");
  const cancel = form.querySelectorAll("button").find(button => button.textContent === "Cancel");
  const save = form.querySelectorAll("button").find(button => button.textContent === "Save");
  const propertyImport = form.querySelectorAll("button").find(button => button.textContent === "Import ZOLA property records (Optional)");
  if (!autoSave) {
    name.value = "Typed project"; address.value = "Synthetic address";
    if (description) description.value = "Typed description";
    name.events.input();
    // Property lookup is optional and starts only when the user requests import.
    propertyImport.events.click();
  }
  return {c, panel, overlay, form, name, address, description, cancel, save, lookup, write, created, updated, notices, callbacks,controller,propertyImport,
    submit: () => form.events.submit(event()),
    resolveLookup: (structuredFacts = [{key:'borough',value:'Manhattan',status:'sourced',source:'nyc-planning'}]) => lookup.resolve({property: {normalizedAddress: "Normalized address", structuredFacts}})
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
  assert.equal(details.name, "Typed project"); assert.equal(details.address, "Synthetic address", "Tax-lot lookup must preserve the entered building address");
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
  const h = harness({editing:true,inline:true,alwaysVisible:true});
  assert.equal(h.name.focused, undefined, 'Visible Context fields do not steal focus from the top tabs.');
  h.overlay.events.keydown(event('Escape'));
  assert.equal(h.overlay.isConnected,true,'Escape bubbles to close the whole Context menu.');
  h.cancel.events.click(); h.resolveLookup(); await tick();
  assert.deepEqual(h.callbacks,['cancel'],'Cancel tells Context to reset the visible form.');
  assert.equal(h.updated.length,0,'Cancel discards field changes without saving.');
}
{
  const h = harness({editing:true,inline:true,alwaysVisible:true,readOnly:true});
  assert.equal(h.name.disabled,true); assert.equal(h.address.disabled,true);
  assert.equal(h.save.parent.hidden,true,'Shared Project identity stays visible without edit actions.');
  h.resolveLookup(); await h.submit();
  assert.equal(h.updated.length,0,'Read-only Context fields cannot submit changes.');
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
const autoOptions = {editing:true,inline:true,alwaysVisible:true,autoSave:true};
{
  const h = harness(autoOptions);
  assert.equal(h.cancel,undefined); assert.equal(h.save,undefined,'Context has no manual save controls.');
  await h.controller.flush(); assert.equal(h.updated.length,0,'Opening or closing unchanged fields does not write.');
  h.name.value='Renamed'; h.name.events.input(); await tick();
  assert.equal(h.updated.length,0,'Typing waits for blur.');
  h.name.events.blur(); await h.controller.flush();
  assert.deepEqual(Object.keys(h.updated[0]),['name']); assert.equal(h.updated[0].name,'Renamed');
  h.form.querySelectorAll('.project-color-swatch')[1].events.click(); await h.controller.flush();
  assert.deepEqual(Object.keys(h.updated[1]),['color'],'Color changes preserve address, facts and narrative.');
  assert.equal(h.overlay.isConnected,true,'Autosave keeps the same mounted form.');
  assert.equal(h.callbacks.includes('transition'),false);
  h.name.value=''; h.name.events.blur(); await h.controller.flush();
  assert.equal(h.name.value,'Renamed','A blank required name restores the saved value.');
  assert.equal(h.updated.length,2);
}
{
  const h = harness(autoOptions); h.c.holdWrite=true;
  h.name.value='First'; h.name.events.blur(); await tick();
  h.name.value='Latest'; h.name.events.blur();
  h.form.querySelectorAll('.project-color-swatch')[1].events.click();
  assert.equal(h.name.disabled,false,'A pending save leaves fields editable.');
  assert.equal(h.updated.length,1,'Saves are serialized.');
  h.write.resolve(); await h.controller.flush();
  assert.equal(h.updated.length,2); assert.equal(h.updated[1].name,'Latest'); assert.equal(h.updated[1].color,'#556677');
}
{
  const h = harness(autoOptions); h.c.failWrite=true;
  h.name.value='Retain this'; h.name.events.blur();
  await assert.rejects(h.controller.flush(),/Storage unavailable/);
  const retry=h.form.querySelector('.project-identity-retry');
  assert.equal(retry.hidden,false); assert.equal(h.name.value,'Retain this');
  h.c.failWrite=false; retry.events.click(); await h.controller.flush();
  assert.equal(retry.hidden,true); assert.equal(h.updated.at(-1).name,'Retain this');
}
for (const action of ['account','workspace','detach']) {
  const fence=deferred(), h=harness({...autoOptions,beforeSave:async()=>{await fence.promise;return true;}});
  h.address.value='New address'; h.address.events.blur(); await tick();
  if(action==='account')h.c.account='other';
  if(action==='workspace')h.c.activeWorkspaceID='other';
  if(action==='detach')h.panel.remove();
  fence.resolve(); await h.controller.flush();
  assert.equal(h.updated.length,0,`${action} fences a delayed address save.`);
}
{
  let flushes=0;
  const h=harness({...autoOptions,beforeSave:async()=>{flushes++;return true;}});
  h.address.value='New address'; h.address.events.blur(); await h.controller.flush();
  assert.equal(flushes,1); assert.equal(h.updated[0].address,'New address');
  assert.deepEqual(Array.from(h.updated[0].structuredFacts),[],'A new address clears facts from the previous property.');
}
{
  const h=harness(autoOptions), importing=h.propertyImport.events.click();
  h.resolveLookup([{key:'occupancy',value:'R-3',status:'sourced',source:'nyc-planning'}, {key:'borough',value:'Manhattan',status:'sourced',source:'nyc-planning'}]);
  await importing; await h.controller.flush();
  assert.equal(h.updated.length,1,'Import works at the already-saved address and persists automatically.');
  assert.equal(h.updated[0].structuredFacts.find(f=>f.key==='occupancy').value,'R-2','Import preserves manually entered facts.');
  assert.equal(h.updated[0].structuredFacts.find(f=>f.key==='borough').value,'Manhattan');
}
{
  const h=harness({...autoOptions,readOnly:true});
  h.name.value='Blocked'; await h.controller.flush();
  assert.equal(h.updated.length,0,'Shared read-only identity cannot autosave.');
}
console.log("Project sheet passed: manual saves, cancellation fences, Context autosave, queued edits, retry retention, property import and read-only access.");
