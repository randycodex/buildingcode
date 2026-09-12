import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Exercise bulk actions with disposable records, never the user's projects.
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.events = {}; this.dataset = {}; }
  append(...items) { items.forEach(item => { item.parent = this; this.children.push(item); }); }
  replaceChildren() { this.children = []; }
  setAttribute(key, value) { this[key] = value; }
  addEventListener(key, handler) { this.events[key] = handler; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); }
  focus() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
}
const body = new Element('body');
const records = Array.from({ length: 30 }, (_, i) => ({ id: String(i), name: `Project ${i}`, archived: false }));
records.push({ id: 'collection', collection: true }, { id: 'shared', sharedOnly: true });
const calls = [];
let allowDelete = false;
let restored = 0;
const context = vm.createContext({
  document: { body, createElement: tag => new Element(tag), querySelector: () => null },
  captureAccountRequest: () => 1, isCurrentAccountRequest: () => true, requireCurrentAccountRequest() {},
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
vm.runInContext(app.slice(app.indexOf('function openProjectManager()'), app.indexOf('function showProjectCreateSheet(')), context);
vm.runInContext('openProjectManager()', context);
const all = (root = body) => [root, ...root.children.flatMap(child => all(child))];
const click = async text => {
  const target = all().find(x => x.tag === 'button' && x.textContent === text);
  assert.ok(target, `Missing ${text}`);
  assert.ok(!target.disabled, `${text} unexpectedly disabled`);
  target.events.click();
  await new Promise(resolve => setImmediate(resolve));
};
await click('Select');
await click('Select All');
await click('Archive Selected');
assert.deepEqual(calls[0], ['archive', 30], 'bulk archive includes projects beyond the old 24-row limit');
assert.ok(!records.at(-1).archived, 'shared-only projects are excluded');
await click('Archived');
await click('Select All');
await click('Restore Selected');
assert.equal(restored, 30);
await click('Active');
await click('Select All');
await click('Delete Selected');
assert.equal(records.filter(p => p.deleted).length, 0, 'cancel must preserve records');
assert.deepEqual(calls.at(-1), ['delete', 30, true], 'confirmation includes the chosen names');
allowDelete = true;
await click('Delete Selected');
assert.equal(records.filter(p => p.deleted).length, 30);
assert.ok(!records.at(-2).deleted, 'collections are excluded from project management');
console.log('Project manager bulk archive, restore, delete cancellation, and scope checks passed.');
