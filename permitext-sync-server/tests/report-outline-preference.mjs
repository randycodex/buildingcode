import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {initialReportOutlineHidden} from '../public/minimal-workflow.js';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function declaration(name) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\n}', start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end + 2);
}
const helpersStart = source.indexOf('  const reportSectionExpanded = ');
const helpersEnd = source.indexOf('  const mountState = ', helpersStart);
const toggleStart = source.indexOf('    if (panel.dataset.outlineHidden === undefined)');
const toggleEnd = source.indexOf('    const versionsToggle = ', toggleStart);
assert.ok(helpersStart >= 0 && helpersEnd > helpersStart && toggleStart >= 0 && toggleEnd > toggleStart);
let accountID = 'owner', disk, saves = 0;
const context = vm.createContext({
  state: {projectSectionExpansion: {}}, activeAccount: () => ({userID: accountID}),
  projectDetailKey: project => project.id, initialReportOutlineHidden,
  saveWorkspaceState() { saves++; disk = JSON.stringify(context.state); },
  syncReferenceReaderLayout() {}, saveStatus: {},
  document: {createElement: () => ({className: '', setAttribute() {}, addEventListener(type, callback) {this[type] = callback;}})},
  primaryActions: {insertBefore(button) {context.toggle = button;}}
});
vm.runInContext(['projectSectionExpansionKey', 'projectSectionExpanded', 'persistProjectSectionExpansion'].map(declaration).join('\n') + `
function mountReport(identity, blocks, dataset = {}) {
  const panel = {dataset}, activeDraft = {blocks}, reportSourceGroupExpanded = new Map();
  ${source.slice(helpersStart, helpersEnd)}
  ${source.slice(toggleStart, toggleEnd)}
  return panel;
}`, context);
const developed = [{kind:'heading'}, {kind:'heading'}];
let panel = context.mountReport({id:'alpha'}, []);
assert.equal(panel.dataset.outlineHidden, 'true');
assert.equal(saves, 0, 'automatic defaults must not become intentional preferences');
context.toggle.click();
assert.equal(panel.dataset.outlineHidden, 'false');
context.state = JSON.parse(disk); // Refresh while a different workflow is open.
panel = context.mountReport({id:'alpha'}, []);
assert.equal(panel.dataset.outlineHidden, 'false', 'explicit show must survive Report disposal and page reload');
context.toggle.click();
context.state = JSON.parse(disk);
panel = context.mountReport({id:'alpha'}, developed);
assert.equal(panel.dataset.outlineHidden, 'true', 'explicit hide must survive remount even as a report grows');
assert.equal(context.mountReport({id:'beta'}, developed).dataset.outlineHidden, 'false', 'another project keeps its own default');
accountID = 'another-owner';
assert.equal(context.mountReport({id:'alpha'}, developed).dataset.outlineHidden, 'false', 'another account cannot inherit private presentation preferences');
assert.equal(context.mountReport({id:'alpha'}, [], {outlineHidden:'false'}).dataset.outlineHidden, 'false', 'exact tab resume takes precedence on an existing mounted panel');
console.log('PASS: actual Report toggle persists intentional outline preference across reload, project/account isolation and contextual defaults.');
