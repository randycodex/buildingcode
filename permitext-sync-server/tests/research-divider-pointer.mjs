import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { researchColumnsLayout } from '../public/workflow-views.js';
import { adjacentColumnWidths } from '../public/column-expansion.js';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function actual(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
function fixture(ids, availableWidth = 2403, collapsedIDs = []) {
  const collapsed = new Set(collapsedIDs), handlers = new Map(), frames = new Map(), classes = new Set();
  const state = { paneWeights: Object.fromEntries(ids.map(id => [id, 600])) };
  const paneWidth = pane => Math.min(Number.parseFloat(pane.style.flex?.split(' ').at(-1)) || 600,
    Number.parseFloat(pane.style.maxWidth) || Infinity);
  const makePane = id => {
    const flags = new Set();
    return {
      dataset: { paneId: id },
      style: { setProperty(name, value) { this[name] = value; } },
      classList: { contains: name => name === 'is-collapsed' && collapsed.has(id) || flags.has(name), add: name => flags.add(name) },
      getBoundingClientRect() {
        const before = panes.slice(0, panes.indexOf(this));
        const naturalLeft = 1 + before.reduce((sum, pane) => sum + paneWidth(pane) + 1, 0) - track.scrollLeft;
        const left = flags.has('is-pinned') ? Math.max(0, naturalLeft) : naturalLeft;
        return { width: paneWidth(this), left, right: left + paneWidth(this) };
      }
    };
  };
  const panes = ids.map(makePane);
  const track = {
    dataset: {}, clientWidth: availableWidth, scrollWidth: availableWidth, scrollLeft: 0,
    classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
    querySelectorAll: selector => selector.includes('.pane-divider')
      ? Array.from({ length: panes.length + 1 }, () => ({ getBoundingClientRect: () => ({ width: 1 }) })) : panes,
    querySelector: selector => panes.find(p => selector.includes(`"${p.dataset.paneId}"`)),
    getBoundingClientRect: () => ({ left: 0, right: availableWidth })
  };
  let frameID = 0, saves = 0, layouts = 0, workflow = 'research';
  const handle = {
    setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {}, setAttribute() {},
    getBoundingClientRect: () => ({ left: 800, right: 801 })
  };
  const context = vm.createContext({ workspaceColumnExpansion: undefined, adjacentColumnWidths,
    state, track, activeWorkspaceID: 'test', CSS: { escape: value => value }, researchColumnsLayout,
    currentColumnWorkflowView: () => workflow, assistantHistoryWidth: 400,
    assistantHistoryOnlyPane: id => id === 'utility:analysis', paneIsCollapsed: id => collapsed.has(id),
    defaultPaneWidthForID: () => 600, isFlexibleReaderPaneID: id => id.startsWith('reader:'),
    activePinnedPaneID: () => '',
    isProjectCoordinationPaneID: () => false,
    window: {
      innerWidth: availableWidth,
      addEventListener: (type, fn) => handlers.set(type, fn), removeEventListener: type => handlers.delete(type),
      requestAnimationFrame: fn => { frames.set(++frameID, fn); return frameID; },
      cancelAnimationFrame: id => frames.delete(id)
    },
    syncReferenceReaderLayout() {}, scheduleVisibleReaderScrollIndicatorUpdates() {}, updateAdjacentDividerValue() {},
    notifyWorkspaceLayoutChange() { layouts++; context.syncResearchColumnLayout(); }, saveWorkspaceState() { saves++; }
  });
  vm.runInContext(['minimumPaneWidthForID', 'maximumPaneWidthForID', 'constrainPaneWidth', 'migrateLegacyPaneWidth',
    'applyPaneWeight', 'syncResearchColumnLayout', 'capturePaneResizeWidths', 'singleExpandedDividerEdge', 'startPaneResize', 'startPaneEdgeResize'].map(actual).join('\n'), context);
  context.syncResearchColumnLayout();
  return {
    context, state, track, panes, handlers, frames, classes, makePane,
    get saves() { return saves; }, get layouts() { return layouts; },
    set workflow(value) { workflow = value; },
    event: (clientX, button = 0) => ({ clientX, button, pointerId: 7, currentTarget: handle, preventDefault() {} }),
    widths: () => panes.map(p => p.getBoundingClientRect().width),
    move(clientX, pointerId = 7) { handlers.get('pointermove')({ clientX, pointerId }); },
    frame() { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(16)); },
    finish(clientX, type = 'pointerup') { handlers.get(type)({ clientX, pointerId: 7 }); }
  };
}

// Reproduce a wide Search beside collapsed Readers and Assistant history.
const edge = fixture(['utility:search:one', 'reader:one', 'reader:two', 'utility:analysis'], 2405, ['reader:one', 'reader:two']);
assert.deepEqual(edge.widths(), [1904, 48, 48, 400]);
const before = JSON.stringify(edge.state);
for (const jitter of [0, 2]) {
  edge.context.startPaneEdgeResize(edge.event(1905), 'utility:search:one', 'right');
  assert.deepEqual(edge.widths(), [1904, 48, 48, 400], 'Pressing the divider must not clamp or freeze any pane');
  assert.equal(edge.track.dataset.researchColumnSizing, 'fit');
  edge.move(1905 + jitter); edge.frame(); edge.finish(1905 + jitter);
  assert.deepEqual(edge.widths(), [1904, 48, 48, 400], 'Clicking with small pointer jitter leaves the layout unchanged');
  assert.equal(JSON.stringify(edge.state), before);
  assert.equal(edge.saves, 0); assert.equal(edge.layouts, 0);
  assert.equal(edge.handlers.size, 0); assert.equal(edge.frames.size, 0);
}
edge.context.startPaneEdgeResize(edge.event(1905), 'utility:search:one', 'right');
edge.move(1885, 8); edge.frame();
assert.deepEqual(edge.widths(), [1904, 48, 48, 400], 'An unrelated pointer cannot start resizing');
edge.handlers.get('pointerup')({ clientX: 1885, pointerId: 8 });
assert.equal(edge.handlers.size, 3, 'An unrelated pointer cannot end the pending drag');
edge.move(1785); edge.frame();
assert.deepEqual(edge.widths(), [1784, 48, 48, 400], 'A real drag starts from the visible width, including widths above 900px');
assert.ok(edge.classes.has('is-resizing'));
edge.finish(1785);
assert.deepEqual(edge.widths(), [1784, 48, 48, 400], 'The chosen width survives the layout notification on release');
assert.equal(edge.saves, 1); assert.equal(edge.classes.has('is-resizing'), false);
assert.equal(edge.track.dataset.researchColumnSizing, 'manual');
edge.workflow = 'project-details';
assert.equal(edge.context.maximumPaneWidthForID('reader:one'), Infinity, 'Reference Readers have no maximum width');

// Two fitted expanded panes must share their existing space without snapping.
const pair = fixture(['utility:search:one', 'reader:one']);
pair.context.startPaneResize(pair.event(1201), 'utility:search:one', 'reader:one');
pair.finish(1201);
assert.deepEqual(pair.widths(), [1200, 1200]); assert.equal(pair.saves, 0);
assert.equal(pair.track.dataset.researchColumnSizing, 'fit');
pair.context.startPaneResize(pair.event(1201), 'utility:search:one', 'reader:one');
pair.move(1261); pair.frame(); pair.finish(1261);
assert.deepEqual(pair.widths(), [1260, 1140], 'Dragging transfers the requested pixels between wider fitted panes');
assert.equal(pair.saves, 1); assert.equal(pair.handlers.size, 0);
pair.panes.push(pair.makePane('reader:two'), pair.makePane('reader:three'));
pair.context.syncResearchColumnLayout();
assert.deepEqual(pair.widths(), [600, 600, 600, 600], 'Adding columns restores the existing 600px overflow layout');
assert.equal(pair.context.maximumPaneWidthForID('utility:search:one'), 900, 'Overflow retains the 900px maximum');

const unlimited = fixture(['reader:one', 'reader:two']);
unlimited.context.startPaneResize(unlimited.event(1201), 'reader:one', 'reader:two');
unlimited.move(1801); unlimited.frame(); unlimited.finish(1801);
assert.deepEqual(unlimited.widths(), [1800,600], 'Reader resizing is not capped by the fitted layout maximum');
assert.equal(unlimited.context.maximumPaneWidthForID('reader:one'), Infinity);

const unrelated = fixture(['reader:one', 'reader:two', 'reader:three'], 2404);
unrelated.context.startPaneResize(unrelated.event(801), 'reader:one', 'reader:two');
unrelated.move(861); unrelated.frame(); unrelated.finish(861, 'pointercancel');
assert.deepEqual(unrelated.widths(), [860, 740, 800], 'Resizing a pair preserves the third column');
assert.equal(unrelated.handlers.size, 0); assert.equal(unrelated.frames.size, 0);
unrelated.context.startPaneResize(unrelated.event(801, 2), 'reader:one', 'reader:two');
assert.equal(unrelated.handlers.size, 0, 'Secondary clicks cannot start a drag');

// Outside workspace grips target the column at the visible edge, even if the
// logical first/last column is off-screen. A pinned column remains on top.
const overflow = fixture(['reader:one', 'reader:two', 'reader:three', 'reader:four'], 1605);
const leftTarget = () => overflow.context.singleExpandedDividerEdge('', 'reader:one', {});
const rightTarget = () => overflow.context.singleExpandedDividerEdge('reader:four', '', {});
assert.equal(leftTarget().paneID, 'reader:one');
assert.equal(rightTarget().paneID, 'reader:three', 'The right grip must not resize an off-screen trailing column');
overflow.track.scrollLeft = 805;
assert.equal(leftTarget().paneID, 'reader:two', 'The left grip follows the leading visible column after horizontal scrolling');
assert.equal(rightTarget().paneID, 'reader:four');
overflow.panes[0].classList.add('is-pinned');
assert.equal(leftTarget().paneID, 'reader:one', 'A pinned surface owns the outside left grip above scrolling columns');
console.log('Research divider pointer behavior passed: click/jitter stability, collapsed neighbors, wider fitted drags, adjacent pairs, cancellation, unrelated panes and overflow bounds.');
