import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { researchColumnsLayout } from '../public/workflow-views.js';

assert.deepEqual(researchColumnsLayout([600], 2400, 0, 2), { fits: true, widths: [2398] });
assert.deepEqual(researchColumnsLayout([900, 600], 2403, 0, 3), { fits: true, widths: [1200, 1200] });
assert.deepEqual(researchColumnsLayout([900, 900, 600], 2404, 0, 4), { fits: true, widths: [800, 800, 800] });
assert.deepEqual(researchColumnsLayout([900, 900, 900, 600], 2405, 0, 5), { fits: true, widths: [600, 600, 600, 600] });
assert.deepEqual(researchColumnsLayout([400, 1400, 700, 600], 2404, 0, 5), { fits: false, widths: [600, 900, 700, 600] });
assert.deepEqual(researchColumnsLayout([900, 600], 2203, 1000, 3), { fits: true, widths: [600, 600] });

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function actual(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
let workflow = 'research';
const makePane = id => {
  const classes = new Set();
  return { dataset: { paneId: id }, style: { setProperty(name, value) { this[name] = value; } },
    classList: { contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name) },
    getBoundingClientRect() { return { width: Number(this.style.flex?.split(' ').at(-1)?.replace('px', '')) || 600 }; } };
};
let panels = [makePane('utility:search:one'), makePane('reader:one')];
const state = { paneWeights: { 'utility:search:one': 1400, 'reader:one': 400 } };
const track = { dataset: {}, clientWidth: 2403, inert: false,
  querySelectorAll: selector => selector.includes('.pane-divider') ? Array.from({length: panels.filter(p=>!p.classList.contains('is-workflow-hidden')).length+1},()=>({getBoundingClientRect:()=>({width:1})})) : panels };
const collapsed = new Set();
const context = vm.createContext({ state, track, activeWorkspaceID: 'test', window: { innerWidth: 2403 }, researchColumnsLayout,
  currentColumnWorkflowView: () => workflow, assistantHistoryWidth: 400,
  assistantHistoryOnlyPane: id => id === 'utility:analysis:history', paneIsCollapsed: id => collapsed.has(id), defaultPaneWidthForID: () => 600,
  applyPaneWeight(panel, id) { panel.style.flex = `1 0 ${state.paneWeights[id] || 600}px`; } });
vm.runInContext(['minimumPaneWidthForID', 'maximumPaneWidthForID', 'constrainPaneWidth', 'syncResearchColumnLayout', 'capturePaneResizeWidths'].map(actual).join('\n'), context);
const sizes = () => panels.map(p=>p.getBoundingClientRect().width);
context.syncResearchColumnLayout();
assert.deepEqual(sizes(), [1200, 1200], 'Existing unequal widths share the available screen');
assert.equal(panels[0].style.maxWidth, 'none', 'A fitting layout may exceed the overflow limit');
panels.push(makePane('reader:two'));
context.syncResearchColumnLayout();
assert.deepEqual(sizes(), [2399/3, 2399/3, 2399/3]);
panels.push(makePane('reader:three'));
context.syncResearchColumnLayout();
assert.deepEqual(sizes(), [600,600,600,600], 'Adding a fourth column crosses into horizontal scrolling at the minimum');
assert.equal(track.dataset.researchColumnSizing, 'overflow');
assert.equal(panels[0].style.maxWidth, '900px');
context.capturePaneResizeWidths();
state.paneWeights['utility:search:one'] = 850;
context.syncResearchColumnLayout();
assert.deepEqual(sizes(), [850,600,600,600], 'Manual overflow widths survive hydration/layout notifications');
track.clientWidth = 3605;
context.syncResearchColumnLayout({reset:true});
assert.deepEqual(sizes(), [900,900,900,900], 'A viewport change restores equal sharing');
collapsed.add('reader:three');
context.syncResearchColumnLayout();
assert.equal(panels[3].style.flex, '0 0 48px');
assert.equal(panels[3].style.maxWidth, '');
assert.deepEqual(sizes().slice(0,3), [3552/3,3552/3,3552/3], 'A collapsed rail does not consume a full share');
const hidden = makePane('reader:hidden'); hidden.classList.add('is-workflow-hidden'); panels.push(hidden);
state.paneWeights['reader:hidden'] = 720;
context.syncResearchColumnLayout();
assert.equal(state.paneWeights['reader:hidden'], 720, 'Retained Notebook columns keep their saved width');
track.inert = true;
context.syncResearchColumnLayout();
assert.equal(track.dataset.researchColumnSizing, undefined);
assert.ok(panels.every(p=>!p.dataset.researchSized), 'Settings restores the normal sizing rules');
track.inert = false;
context.syncResearchColumnLayout();
assert.equal(track.dataset.researchColumnSizing, 'fit');
context.window.innerWidth = 760;
context.syncResearchColumnLayout();
assert.equal(track.dataset.researchColumnSizing, undefined, 'Phone paging keeps its viewport width');
assert.equal(context.minimumPaneWidthForID('reader:one'), 600);
assert.equal(context.maximumPaneWidthForID('utility:search:one'), 900);
workflow = 'project-details';
assert.equal(context.minimumPaneWidthForID('reader:one'), 400, 'Project reference Reader bounds stay intact');
console.log('Research columns passed: equal one/two/three-column fit, 600px overflow, 900px resize limit, manual persistence, collapse, hidden views and phone isolation.');
