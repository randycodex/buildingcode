import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Exercise bulk actions with disposable records, never the user's projects.
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.events = {}; this.dataset = {}; }
  append(...items) { items.forEach(item => { item.parent = this; this.children.push(item); }); }
  replaceChildren(...items) { this.children = []; this.append(...items); }
  setAttribute(key, value) { this[key] = value; }
  addEventListener(key, handler) { this.events[key] = handler; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); }
  focus() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
}
const body = new Element('body');
const container = new Element('div');
body.append(container);
const records = Array.from({ length: 30 }, (_, i) => ({ id: String(i), name: `Project ${i}`, archived: false }));
records.push({ id: 'collection', collection: true }, { id: 'shared', sharedOnly: true });
const calls = [];
let allowDelete = false;
let restored = 0;
let current = true;
const contentUpdates = [];
const context = vm.createContext({
  container,
  document: { body, createElement: tag => new Element(tag), querySelector: () => null },
  captureAccountRequest: () => 1, isCurrentAccountRequest: () => current, requireCurrentAccountRequest() {},
  onChange: () => contentUpdates.push(records.filter(p => !p.deleted && !p.collection && !p.sharedOnly).map(p => ({id:p.id,archived:p.archived}))),
  currentContentSummary: () => ({ projects: records }), visibleProjectRecords: x => x.filter(p => !p.deleted),
  folderIsProject: p => !p.collection, projectIsArchived: p => !!p.archived, projectRecordID: p => p.id,
  activeWorkspaceRecord: () => null, trapWebModalFocus() {},
  archiveProjects: async projects => { calls.push(['archive', projects.length]); projects.forEach(p => p.archived = true); },
  restoreArchivedProject: async project => { project.archived = false; restored++; },
  deleteArchivedProjects: async (projects, options) => {
    calls.push(['delete', projects.length, options.includeNames]);
    if (allowDelete) projects.forEach(p => p.deleted = true);
    return allowDelete;
  },
  showProjectCreateSheet: () => {}, showWebNotice: async () => {},
});
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
vm.runInContext(app.slice(app.indexOf('function renderProjectManager('), app.indexOf('function showProjectCreateSheet(')), context);
vm.runInContext('renderProjectManager(container, { onChange })', context);
const all = (root = body) => [root, ...root.children.flatMap(child => all(child))];
assert.equal(container.children[0].role, 'region', 'Project management renders in its supplied Settings container');
assert.equal(all().some(node => node.role === 'dialog'), false, 'Project management does not open a popup');
assert.equal(all().some(node => node.tag === 'button' && node.textContent === 'Edit'), false,
  'Project identity editing is available only from Edit project in the Overview column.');
const click = async text => {
  const target = all().find(x => x.tag === 'button' && x.textContent === text);
  assert.ok(target, `Missing ${text}`);
  assert.ok(!target.disabled, `${text} unexpectedly disabled`);
  target.events.click();
  await new Promise(resolve => setImmediate(resolve));
};
await click('Select');
await click('Select All');
vm.runInContext('renderProjectManager(container, { onChange })', context);
await click('Archive Selected');
assert.deepEqual(calls[0], ['archive', 30], 'bulk archive includes projects beyond the old 24-row limit');
assert.ok(!records.at(-1).archived, 'shared-only projects are excluded');
assert.equal(contentUpdates.length,1);
assert.ok(contentUpdates.at(-1).every(p=>p.archived),'The Settings callback sees committed archive state.');
await click('Archived');
await click('Select All');
await click('Restore Selected');
assert.equal(restored, 30);
assert.equal(contentUpdates.length,2);
assert.ok(contentUpdates.at(-1).every(p=>!p.archived));
await click('Active');
await click('Select All');
await click('Delete Selected');
assert.equal(records.filter(p => p.deleted).length, 0, 'cancel must preserve records');
assert.deepEqual(calls.at(-1), ['delete', 30, true], 'confirmation includes the chosen names');
allowDelete = true;
await click('Delete Selected');
assert.equal(records.filter(p => p.deleted).length, 30);
assert.equal(contentUpdates.at(-1).length,0,'Deleted projects cannot linger in dependent Settings lists.');
assert.equal(contentUpdates.length,4);
assert.ok(!records.at(-2).deleted, 'collections are excluded from project management');
console.log('Project manager bulk archive, restore, delete cancellation, and scope checks passed.');
