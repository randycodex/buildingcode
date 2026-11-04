import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const start = source.indexOf('function renderWorkspaceTabs(');
const actual = source.slice(start, source.indexOf('\n}', start) + 2);
let account = null, allowed = false, projects = [], panes = [], view = 'research', created = 0, privateReads = 0;
const prompt = {hidden: true, querySelector: () => button};
const button = {};
const classes = new Set();
const shell = {classList: {toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); }}, querySelector: () => prompt};
const context = vm.createContext({
  isProAccount: () => true,
  document: {querySelector: () => shell},
  renderProjectUpdateBadge() {}, detachedProjectWindow: false,
  workspacePrivatePresentationAllowed: () => allowed,
  activeAccount: () => account,
  visibleWorkspaceRecords() { privateReads++; assert(allowed); return projects; },
  currentColumnWorkflowView: () => view,
  defaultActivePaneIDs: () => panes.map(pane => pane.id),
  workflowPaneIsVisible: id => panes.find(pane => pane.id === id)?.view === view,
  workspaceActionsButton: null,
  createNewWorkspace: async () => { created++; }
});
vm.runInContext(actual, context);
context.renderWorkspaceTabs();
assert.equal(privateReads, 0, 'A guest can open the reading shell without inspecting private Projects.');
assert.equal(prompt.hidden, true, 'Guests keep the public first-use welcome instead of a project-creation overlay.');

for (const id of ['reader:loading', 'utility:search:loading']) {
  panes = [{id, view: 'research'}];
  context.renderWorkspaceTabs();
  assert.equal(prompt.hidden, true, 'A requested public column, including its loading shell, takes precedence over project creation.');
}
panes = [];
context.renderWorkspaceTabs();
assert.equal(prompt.hidden, true, 'Closing a guest column does not turn project creation into a reading prerequisite.');
view = 'notebook';
context.renderWorkspaceTabs();
assert.equal(prompt.hidden, true, 'The Research empty-state action cannot cover another working view.');
view = 'research';
account = {userID: 'owner'};
context.renderWorkspaceTabs();
assert.equal(privateReads, 0, 'Pending/denied private access must not expose cached Project names.');
assert.equal(prompt.hidden, true, 'Unverified private access is not proof of an empty account.');
allowed = true;
context.renderWorkspaceTabs();
assert.equal(prompt.hidden, false, 'A verified account with zero Projects can still use the public reading workspace.');
await button.onclick();
assert.equal(created, 1, 'The optional workspace action remains usable for a verified empty account.');
panes = [{id: 'reader:pro-loading', view: 'research'}];
context.renderWorkspaceTabs();
assert.equal(prompt.hidden, true, 'A Pro Reader also takes precedence over optional project creation.');
panes = [];
context.renderWorkspaceTabs();
assert.equal(prompt.hidden, false, 'Closing the last Pro column can reveal the optional workspace action again.');
projects = [{id: 'project:p1', name: 'P1'}];
context.renderWorkspaceTabs();
assert.equal(classes.has('has-no-workspace'), false);
assert.equal(prompt.hidden, true, 'An existing Project keeps its normal workspace navigation.');
assert.deepEqual(projects, [{id: 'project:p1', name: 'P1'}]);
console.log('General reading workspace passed: guest/Pro empty accounts, public loading columns, close/reopen, view isolation, private-access fencing and optional project creation.');
