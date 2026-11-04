import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const actual = name => {
  const match = source.match(new RegExp(`^(?:async )?function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?^}`, 'm'));
  assert.ok(match, name);
  return match[0];
};
let pro = false;
const state = { readers: [{id:'first'}, {id:'second'}, {id:'third'}],
  paneWeights: {'reader:second':300}, paneOrder: ['reader:first','reader:second'],
  searchLinkedReaders: {search:'second'}, utilities: {}, utilityInstances: [] };
const c = vm.createContext({ state, isProAccount:()=>pro,
  paneIDForReader:r=>`reader:${r.id}`, searchLinkedReadersBySearch:()=>state.searchLinkedReaders });
const blocked = ['createGeneralWorkspace', 'duplicateNamedWorkspace', 'openCalculatorColumn',
  'openNewSearchColumn', 'openNewResearchColumn', 'toggleGenericWorkboard'];
vm.runInContext([...blocked, 'toggleUtilityPane', 'focusUtility', 'focusRecentUtilityColumn',
  'switchWorkflowView', 'enforceReaderPlanLimit', 'defaultActivePaneIDs', 'workflowPaneIsVisible',
  'syncReaderToolbarButton'].map(actual).join('\n'), c);
// Denied actions must return before touching storage, prompts, or tool loaders.
for (const name of blocked) assert.equal(await c[name](), false, name);
for (const name of ['toggleUtilityPane','focusUtility','focusRecentUtilityColumn']) {
  for (const key of ['search','analysis','calculator','saved','archive']) assert.equal(await c[name](key), false);
}
assert.equal(await c.switchWorkflowView('notebook'), false);
assert.equal(await c.switchWorkflowView('project'), false);
assert.deepEqual(Array.from(c.defaultActivePaneIDs()), ['reader:first']);
assert.equal(c.workflowPaneIsVisible('utility:search'), false);
assert.equal(c.workflowPaneIsVisible('reader:second'), false);
assert.equal(c.workflowPaneIsVisible('reader:first'), true);
assert.equal(c.enforceReaderPlanLimit(), true);
assert.equal(state.readers.length, 1);
assert.deepEqual(state.searchLinkedReaders, {});
assert.equal(state.paneWeights['reader:second'], undefined);
assert.equal(c.enforceReaderPlanLimit(), false);
c.workspaceColumnsRequireProject = () => false;
const button = {dataset:{}, querySelector:()=>({}), classList:{toggle(){}}, setAttribute(){}};
c.syncReaderToolbarButton(button);
assert.equal(button.disabled, true);
state.readers = [];
c.syncReaderToolbarButton(button);
assert.equal(button.disabled, false);
pro = true;
state.readers = [{id:'first'}, {id:'second'}, {id:'third'}];
assert.equal(c.enforceReaderPlanLimit(), false);
assert.equal(state.readers.length, 3);
c.syncReaderToolbarButton(button);
assert.equal(button.disabled, false);
console.log('Free access passed: blocked tools and workspace actions, restored panes, one-reader limit, and Pro readers.');
