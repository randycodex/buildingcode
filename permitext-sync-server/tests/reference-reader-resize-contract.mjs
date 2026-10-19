import { adjacentColumnWidths } from "../public/column-expansion.js";
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { referenceColumnsWidth, reportColumnsLayout } from '../public/workflow-views.js';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function actual(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
function fixture(view, widths = [800], sourcesWidth = 0) {
  const availableWidth = sourcesWidth ? 2859 : 1920;
  const properties = new Map(), classes = new Set(), handlers = new Map(), frames = new Map();
  const state = { paneWeights: Object.fromEntries(widths.map((width, i) => [`reader:${i}`, width])) };
  const shell = {
    clientWidth: availableWidth,
    style: { setProperty: (key, value) => properties.set(key, value) },
    classList: { toggle: (key, on) => on ? classes.add(key) : classes.delete(key) }
  };
  const reportPanel = { dataset: { libraryOpen: String(sourcesWidth > 0), libraryWidth: String(sourcesWidth) } };
  const dockWidth = () => Number(properties.get('--reference-readers-width')?.replace('px', '') || 0);
  const reportWidth = () => Math.max(Number(properties.get('--reference-document-min-width')?.replace('px', '') || 600), availableWidth - dockWidth());
  const panes = widths.map((width, i) => ({
    dataset: { paneId: `reader:${i}` }, width,
    getBoundingClientRect() { return { width: this.width }; }
  }));
  const trackClasses = new Set();
  const track = {
    scrollLeft: 0, clientWidth: availableWidth, scrollWidth: availableWidth,
    classList: { add: key => trackClasses.add(key), remove: key => trackClasses.delete(key) },
    querySelector: selector => panes.find(pane => selector.includes(`"${pane.dataset.paneId}"`)),
    querySelectorAll: () => panes,
    getBoundingClientRect: () => ({ left: reportWidth(), right: reportWidth() + dockWidth() })
  };
  let frameID = 0, saves = 0, released = 0;
  const handle = {
    attrs: {}, setAttribute(key, value) { this.attrs[key] = value; },
    setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture: () => released++,
    getBoundingClientRect: () => ({ left: reportWidth() + 1, right: reportWidth() + 2 })
  };
  const context = vm.createContext({
    workspaceColumnExpansion: null, adjacentColumnWidths,
    state, track, CSS: { escape: value => value }, referenceColumnsWidth, reportColumnsLayout,
    currentColumnWorkflowView: () => view,
    defaultActivePaneIDs: () => panes.map(pane => pane.dataset.paneId), workflowPaneIsVisible: () => true,
    paneIsCollapsed: () => false, assistantHistoryOnlyPane: () => false,
    minimumPaneWidthForID: () => 400, defaultPaneWidthForID: () => 600,
    applyPaneWeight: (pane, id) => { pane.width = state.paneWeights[id]; },
    document: { querySelector: selector => selector === '.workspace-shell' ? shell : selector === '.account-screen[open]' ? null : view === 'report' ? reportPanel : null },
    window: {
      innerWidth: availableWidth,
      addEventListener: (name, callback) => handlers.set(name, callback),
      removeEventListener: name => handlers.delete(name),
      requestAnimationFrame: callback => { frames.set(++frameID, callback); return frameID; },
      cancelAnimationFrame: id => frames.delete(id)
    },
    scheduleVisibleReaderScrollIndicatorUpdates() {},
    updateAdjacentDividerValue() {}, saveWorkspaceState: () => saves++,
    notifyWorkspaceLayoutChange: () => context.syncReferenceReaderLayout()
  });
  vm.runInContext(['maximumPaneWidthForID','constrainPaneWidth','syncReferenceReaderLayout', 'capturePaneResizeWidths', 'startPaneEdgeResize', 'startPaneResize'].map(actual).join('\n'), context);
  context.syncReferenceReaderLayout();
  return {
    context, handle, panes, state, properties, handlers, frames, dockWidth, reportWidth, trackClasses,
    get saves() { return saves; }, get released() { return released; },
    event: clientX => ({ clientX, currentTarget: handle, pointerId: 1, preventDefault() {} }),
    move(clientX) { handlers.get('pointermove')({ clientX }); },
    frame(time = 16) {
      const pending = [...frames]; frames.clear();
      pending.forEach(([, callback]) => callback(time));
    },
    finish(name, clientX) { handlers.get(name)({ clientX, pointerId: 1 }); }
  };
}

// Exercise a held drag, before pointerup can mask the stale document layout.
for (const [view, sourcesWidth] of [['project-details', 0]]) {
  const f = fixture(view, [800], sourcesWidth);
  const startX = f.reportWidth() + 1;
  const originalReportWidth = f.reportWidth();
  f.context.startPaneEdgeResize(f.event(startX), 'reader:0', 'left');
  f.move(startX - 160); f.frame();
  assert.equal(f.panes[0].width, 960);
  assert.equal(f.dockWidth(), 963, `${view}: the reference dock grows while the mouse is held`);
  assert.equal(f.reportWidth(), originalReportWidth - 160, `${view}: the document gives up the same width immediately`);
  assert.equal(f.saves, 0, 'Pointer frames do not persist every intermediate width');
  assert.ok(f.trackClasses.has('is-resizing'));
  assert.equal(f.frames.size, 0, 'Stopping at the moving divider must not trigger automatic growth');
  f.frame(32); assert.equal(f.panes[0].width, 960);
  f.move(startX + 600); f.frame(48);
  assert.equal(f.panes[0].width, 400, 'Dragging right retains the Reader minimum');
  assert.equal(f.dockWidth(), 403, 'The dock contracts before release too');
  f.finish('pointercancel', startX + 600);
  assert.equal(f.saves, 1); assert.equal(f.released, 1);
  assert.equal(f.handlers.size, 0); assert.equal(f.frames.size, 0);
  assert.equal(f.trackClasses.has('is-resizing'), false);
}

// Adjacent Readers keep the neighbor's minimum width.
const report = fixture('report', [800]);
assert.equal(report.dockWidth(), 0, 'Report keeps existing Readers hidden while retaining their state');
assert.equal(report.panes[0].width, 800);
const pair = fixture('project-details', [600, 700]);
pair.context.startPaneResize(pair.event(1300), 'reader:0', 'reader:1');
pair.move(1140); pair.frame();
assert.deepEqual(pair.panes.map(pane => pane.width), [440, 860]);
assert.equal(pair.dockWidth(), 1304, 'Adjacent resizing updates the dock during the drag when a minimum is reached');
pair.move(2300); pair.frame();
assert.deepEqual(pair.panes.map(pane => pane.width), [900,400], 'Pointer resizing retains the neighboring Reader minimum');
pair.finish('pointerup', 2300);
assert.equal(pair.saves, 1); assert.equal(pair.handlers.size, 0);

const shared = fixture('research', [800, 800, 800]);
shared.state.paneWeights = {'reader:0':600,'reader:1':600,'reader:2':600};
shared.context.startPaneResize(shared.event(800), 'reader:0', 'reader:1');
shared.move(900); shared.frame();
assert.deepEqual(shared.panes.map(pane => pane.width), [900,700,800], 'Pointer resizing changes only the selected pair, preserving previously shared space.');
shared.move(1200); shared.frame();
assert.deepEqual(shared.panes.map(pane => pane.width), [1200,400,800], 'A Reader can grow beyond 900px while preserving its neighbor and the untouched column.');
shared.finish('pointerup',1200);
assert.equal(shared.state.paneWeights['reader:2'],800,'The untouched rendered width also survives saving.');

// Preserve edge-driven growth for ordinary workspace columns at the viewport edge.
const ordinary = fixture('research');
ordinary.context.startPaneEdgeResize(ordinary.event(8), 'reader:0', 'left');
ordinary.move(0); ordinary.frame(16); ordinary.frame(32);
assert.ok(ordinary.panes[0].width > 801);
ordinary.finish('pointerup', 0);
assert.equal(ordinary.frames.size, 0);
console.log('Reference Reader resize passed: Report isolation and live Project details geometry, stopped-pointer stability, adjacent minimums, cancellation, cleanup and ordinary edge growth.');
