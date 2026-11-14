import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { researchColumnsLayout, notebookColumnsLayout } from '../public/workflow-views.js';
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
    dataset: {}, clientWidth: availableWidth, scrollLeft: 0,
    get scrollWidth() { return Math.max(availableWidth, 1 + panes.reduce((sum, pane) => sum + paneWidth(pane) + 1, 0)); },
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
    state, track, activeWorkspaceID: 'test', CSS: { escape: value => value }, researchColumnsLayout, notebookColumnsLayout,
    getComputedStyle:()=>({paddingLeft:'1px',paddingRight:'1px',getPropertyValue:()=> '800px'}),
    currentColumnWorkflowView: () => workflow, assistantHistoryWidth: 400,
    defaultUtilityPaneWidth: 400, defaultResearchPaneWidth: 920,
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
    'applyPaneWeight', 'syncNotebookColumnLayout', 'syncResearchColumnLayout', 'capturePaneResizeWidths','notebookReferenceResize', 'singleExpandedDividerEdge', 'startPaneResize', 'startPaneEdgeResize'].map(actual).join('\n'), context);
  context.syncResearchColumnLayout();
  return {
    context, state, track, panes, handlers, frames, classes, makePane, handle,
    get saves() { return saves; }, get layouts() { return layouts; },
    set workflow(value) { workflow = value; },
    event: (clientX, button = 0) => ({ clientX, button, pointerId: 7, currentTarget: handle, preventDefault() {} }),
    widths: () => panes.map(p => p.getBoundingClientRect().width),
    move(clientX, pointerId = 7) { handlers.get('pointermove')({ clientX, pointerId }); },
    frame(time = 16) { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(time)); },
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
assert.deepEqual(pair.widths(), [1260, 1140, 630, 630], 'Adding columns preserves manually resized widths');
pair.context.syncResearchColumnLayout({reset:true});
assert.deepEqual(pair.widths(), [600, 630, 630, 630], 'Explicit reset restores each column minimum in overflow');
assert.equal(pair.context.maximumPaneWidthForID('utility:search:one'), 900, 'Overflow retains the 900px maximum');

const assistantPair = fixture(['utility:analysis:one', 'reader:one']);
assistantPair.context.assistantHistoryWidth = 320;
assistantPair.context.startPaneResize(assistantPair.event(1201), 'utility:analysis:one', 'reader:one');
assistantPair.move(1401); assistantPair.frame(); assistantPair.finish(1401);
assert.deepEqual(assistantPair.widths(), [1400,1000], 'Assistant divider transfers width from an equal split');
assert.equal(assistantPair.state.researchColumnWidthsManual, true);
delete assistantPair.track._researchColumnLayout;
assistantPair.context.syncResearchColumnLayout();
assert.deepEqual(assistantPair.widths(), [1400,1000], 'The resized Assistant survives a fresh layout instance');
assistantPair.context.syncResearchColumnLayout({reset:true});
assert.deepEqual(assistantPair.widths(), [1200,1200], 'Reset returns Assistant to an equal split');

const unlimited = fixture(['reader:one', 'reader:two']);
unlimited.context.startPaneResize(unlimited.event(1201), 'reader:one', 'reader:two');
unlimited.move(1801); unlimited.frame(); unlimited.finish(1801);
assert.deepEqual(unlimited.widths(), [1800,630], 'Reader resizing is not capped by the fitted layout maximum');
assert.equal(unlimited.context.maximumPaneWidthForID('reader:one'), Infinity);

// Shared dividers must not impose the old combined-width cap. This is the
// common four-Reader layout where every neighboring column starts at 630px.
const minimumPair = fixture(['reader:one', 'reader:two', 'reader:three', 'reader:four'], 2405);
minimumPair.context.startPaneResize(minimumPair.event(601), 'reader:one', 'reader:two');
minimumPair.move(1801); minimumPair.frame();
assert.deepEqual(minimumPair.widths(), [1830, 630, 630, 630], 'The Reader follows the drag even when its neighbor cannot shrink');
minimumPair.finish(1801);
assert.deepEqual(minimumPair.widths(), [1830, 630, 630, 630], 'The wider Reader survives release and layout synchronization');
assert.equal(minimumPair.state.paneWeights['reader:one'], 1830);
assert.equal(minimumPair.saves, 1);
minimumPair.context.startPaneResize(minimumPair.event(1801), 'reader:one', 'reader:two');
minimumPair.move(-199); minimumPair.frame(); minimumPair.finish(-199);
assert.deepEqual(minimumPair.widths(), [630, 2630, 630, 630], 'Dragging the other direction can expand the right Reader beyond the pair total');

for (const direction of ['right', 'left']) {
  const heldPair = fixture(['reader:one', 'reader:two', 'reader:three', 'reader:four'], 1605);
  const targetX = direction === 'right' ? 1604 : 1;
  const growingIndex = direction === 'right' ? 0 : 1;
  heldPair.context.startPaneResize(heldPair.event(601), 'reader:one', 'reader:two');
  heldPair.move(targetX); heldPair.frame(16);
  const firstWidth = heldPair.widths()[growingIndex];
  for (const time of [32, 48, 64, 80, 96]) heldPair.frame(time);
  assert(heldPair.widths()[growingIndex] > firstWidth, 'Holding a shared Reader divider at either screen edge keeps expanding it');
  assert(heldPair.track.scrollLeft > 0, 'Newly added Reader width becomes visible before release');
  assert.equal(heldPair.widths()[1 - growingIndex], 630, 'The neighboring Reader retains its minimum');
  assert.deepEqual(heldPair.widths().slice(2), [630, 630], 'Unrelated Readers retain their widths during edge growth');
  const beforeRelease = heldPair.widths();
  const scrollBeforeRelease = heldPair.track.scrollLeft;
  heldPair.finish(targetX);
  assert.deepEqual(heldPair.widths(), beforeRelease, 'Release retains the accumulated edge expansion');
  assert.equal(heldPair.track.scrollLeft, scrollBeforeRelease);
  assert.equal(heldPair.frames.size, 0); assert.equal(heldPair.handlers.size, 0);
}

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

// The outside grip stays sticky at the viewport edge. Its position never
// reveals the growing column's overflow, so scrolling must follow the column.
for (const [ids, initialScroll] of [
  [['reader:0'], 0],
  [['reader:0','reader:1','reader:2'], 0],
  [['reader:0','reader:1','reader:2'], 100],
  [['reader:0','utility:calculator'], 0]
]) {
  const availableWidth = 1605;
  const held = fixture(ids, availableWidth);
  held.track.scrollLeft = initialScroll;
  const paneID = ids.at(-1);
  const pane = held.panes.at(-1);
  held.handle.getBoundingClientRect = () => ({left: availableWidth - 1, right: availableWidth});
  const initialHiddenWidth = Math.max(0, pane.getBoundingClientRect().right - availableWidth);
  const initialWidth = pane.getBoundingClientRect().width;
  held.context.startPaneEdgeResize(held.event(availableWidth - 1), paneID, 'right');
  held.move(availableWidth - 9); held.frame(16);
  for (const time of [32,48,64,80,96]) held.frame(time);
  assert(pane.getBoundingClientRect().width > initialWidth, 'Holding near the edge widens the column before release');
  assert(held.track.scrollLeft > initialScroll, 'The workspace follows the widening column while the pointer is still held');
  assert(held.track.scrollLeft - initialScroll <= pane.getBoundingClientRect().width - initialWidth + 1,
    'A partially hidden column does not jump to its previously offscreen end');
  assert(pane.getBoundingClientRect().right - availableWidth <= initialHiddenWidth + 1,
    'The newly added width stays visible instead of accumulating offscreen');
  assert.equal(held.saves, 0, 'The live preview does not persist intermediate frames');
  const scrolledBeforeRelease = held.track.scrollLeft;
  held.finish(availableWidth - 9);
  assert.equal(held.track.scrollLeft, scrolledBeforeRelease, 'Release does not cause an extra scroll jump');
  assert.equal(held.frames.size, 0); assert.equal(held.handlers.size, 0);
}
console.log('Research divider pointer behavior passed: click/jitter stability, adjacent pairs, cancellation, sticky-edge live scrolling, partly hidden columns and overflow bounds.');

// Evidence has its own bounds even when restoring older, wider layouts.
const evidence = fixture(['utility:saved:one','project:notebook:one']);
evidence.workflow = 'research';
const evidenceID = 'utility:saved:one';
for (const [stored, expected] of [[100,300],[450,450],[1200,600]]) {
  evidence.state.paneWeights[evidenceID] = stored;
  evidence.context.applyPaneWeight(evidence.panes[0],evidenceID);
  assert.equal(evidence.widths()[0],expected);
  assert.equal(evidence.state.paneWeights[evidenceID],expected);
  assert.equal(evidence.panes[0].style.flex,`0 0 ${expected}px`,'Evidence does not absorb spare viewport space');
}
for (const id of ['utility:saved',evidenceID]) {
  assert.equal(evidence.context.minimumPaneWidthForID(id),300);
  assert.equal(evidence.context.maximumPaneWidthForID(id),600);
}
evidence.context.activePinnedPaneID = () => evidenceID;
assert.equal(evidence.context.singleExpandedDividerEdge(evidenceID,'project:notebook:one').paneID,evidenceID);
evidence.context.startPaneEdgeResize(evidence.event(600),evidenceID,'right');
evidence.move(-400); evidence.frame(); evidence.finish(-400);
assert.deepEqual(evidence.widths(),[300,600],'Pinned Evidence can shrink without resizing a Note');
evidence.context.startPaneEdgeResize(evidence.event(300),evidenceID,'right');
evidence.move(1300); evidence.frame(); evidence.finish(1300);
assert.deepEqual(evidence.widths(),[600,600],'Pinned Evidence stops at its maximum');
evidence.context.startPaneEdgeResize(evidence.event(0),evidenceID,'left');
evidence.move(1000); evidence.frame(); evidence.finish(1000);
assert.equal(evidence.widths()[0],300,'The outer left grip uses the same minimum');
assert.equal(evidence.context.minimumPaneWidthForID('project:notebook:one'),600);
assert.equal(evidence.context.maximumPaneWidthForID('reader:one'),Infinity);
console.log('Evidence pointer resizing and restored widths stay within 300–600 pixels; Note and Reader bounds are preserved.');

// Notebook reference columns borrow from the notepad, even when another
// reference is at its minimum. The fitted layout must preserve that choice.
{
 const ids=['reader:one','utility:saved:one','project:notes-index:one','project:notebook:one'];
 const notebook=fixture(ids,3054);notebook.workflow='notebook';
 ids.forEach((id,index)=>notebook.state.paneWeights[id]=[900,360,200,2000][index]);
 notebook.context.syncResearchColumnLayout();
 const before=notebook.widths();
 notebook.context.startPaneResize(notebook.event(1261),ids[1],ids[2]);
 notebook.move(1341);notebook.frame();
 assert.deepEqual(notebook.widths(),[900,440,200,before[3]-80],'Evidence takes its extra width from the notepad while Notes stays at 200px.');
 notebook.finish(1341);
 assert.deepEqual(notebook.widths(),[900,440,200,before[3]-80],'Both reference widths survive release.');
 notebook.context.startPaneResize(notebook.event(1341),ids[1],ids[2]);
 notebook.move(2341);notebook.frame();notebook.finish(2341);
 assert.equal(notebook.widths()[1],600,'Evidence reaches its existing 600px cap.');
 assert.deepEqual(notebook.widths(),[900,600,200,before[3]-240],'Growing Evidence preserves Reader and Notes.');
 notebook.context.startPaneResize(notebook.event(1703),ids[2],ids[3]);
 notebook.move(2203);notebook.frame();notebook.finish(2203);
 assert.deepEqual(notebook.widths(),[900,600,350,before[3]-390],'Growing Notes borrows only from the notepad and respects its cap.');
 notebook.context.syncResearchColumnLayout();assert.equal(notebook.widths()[1],600,'A fresh fit preserves the chosen Evidence width.');
}
console.log('Notebook reference dividers passed: notepad supplies the extra space, other references stay fixed, caps and saved geometry hold.');

// Reader uses the same donor, can grow beyond 900px, and stops at an 800px
// notepad through both its inner divider and outer grip.
{
 const ids=['reader:one','utility:saved:one','project:notes-index:one','project:notebook:one'];
 const notebook=fixture(ids,3054);notebook.workflow='notebook';
 ids.forEach((id,index)=>notebook.state.paneWeights[id]=[810,450,250,2000][index]);
 notebook.context.syncResearchColumnLayout();const before=notebook.widths();
 const maximum=before[0]+before[3]-800;
 assert.equal(notebook.context.maximumPaneWidthForID(ids[0]),maximum);
 notebook.context.startPaneResize(notebook.event(811),ids[0],ids[1]);
 notebook.move(2811);notebook.frame();
 assert.deepEqual(notebook.widths(),[maximum,450,250,800],'Only Reader and the notepad change during the drag.');
 notebook.finish(2811);
 assert.ok(maximum>900);assert.deepEqual(notebook.widths(),[maximum,450,250,800]);
 notebook.context.startPaneResize(notebook.event(1548),ids[0],ids[1]);
 notebook.move(1308);notebook.frame();notebook.finish(1308);
 assert.deepEqual(notebook.widths(),[maximum-240,450,250,1040],'Shrinking Reader returns space to the notepad.');
 notebook.context.startPaneEdgeResize(notebook.event(1),ids[0],'left');
 notebook.move(-999);notebook.frame();notebook.finish(-999);
 assert.deepEqual(notebook.widths(),[maximum,450,250,800],'The outside grip respects the same 800px floor.');
 notebook.context.syncResearchColumnLayout();assert.deepEqual(notebook.widths(),[maximum,450,250,800],'Fitting preserves a Reader wider than 900px.');
}
console.log('Notebook Reader divider passed: notepad-only resizing, fixed Evidence/Notes, growth beyond 900px, exact 800px floor and restored geometry.');

{
 const ids=['reader:one','utility:saved:one','project:notes-index:one','project:notebook:one'];
 const notebook=fixture(ids,2450);notebook.workflow='notebook';
 ids.forEach((id,index)=>notebook.state.paneWeights[id]=[900,450,220,1000][index]);
 notebook.context.syncResearchColumnLayout();const before=notebook.widths();
 notebook.context.startPaneResize(notebook.event(1351),ids[1],ids[2]);
 notebook.move(2351);notebook.frame();notebook.finish(2351);
 assert.deepEqual(notebook.widths(),[before[0],before[1]+before[3]-800,before[2],800],
  'Evidence stops at the writing width instead of squeezing Notes or Reader.');
}

// With Reader closed, the outer Evidence grip still borrows from the notepad.
{
 const ids=['utility:saved:one','project:notes-index:one','project:notebook:one'];
 const notebook=fixture(ids,3054);notebook.workflow='notebook';
 ids.forEach((id,index)=>notebook.state.paneWeights[id]=[400,250,2000][index]);
 notebook.context.syncResearchColumnLayout();const before=notebook.widths();
 notebook.context.startPaneEdgeResize(notebook.event(1),ids[0],'left');
 notebook.move(-99);notebook.frame();notebook.finish(-99);
 assert.deepEqual(notebook.widths(),[500,250,before[2]-100]);
}

// Notebook Notes uses the Assistant sidebar's 200–350px bounds while keeping
// the existing writing page in place.
{
 const notebook=fixture(['project:notes-index:one','project:notebook:one'],1920);
 notebook.workflow='notebook';notebook.context.syncResearchColumnLayout();
 const notesID='project:notes-index:one',editorID='project:notebook:one';
 assert.equal(notebook.context.minimumPaneWidthForID(editorID),800);
 assert.equal(notebook.context.maximumPaneWidthForID(notesID),350);
 notebook.context.startPaneResize(notebook.event(351),notesID,editorID);
 notebook.move(-849);notebook.frame();notebook.finish(-849);
 assert.deepEqual(notebook.widths(),[200,1715],'The Notes divider stops at 200px.');
 notebook.context.startPaneResize(notebook.event(201),notesID,editorID);
 notebook.move(1401);notebook.frame();notebook.finish(1401);
 assert.deepEqual(notebook.widths(),[350,1565],'The Notes divider stops at 350px.');
 assert.equal(notebook.state.paneWeights[notesID],350);assert.equal(notebook.saves,2);
 notebook.context.syncResearchColumnLayout();assert.deepEqual(notebook.widths(),[350,1565],'Fitting does not undo the chosen Notes width');
}
console.log('Notebook Notes divider passed: 200–350px pointer bounds, stable writing space and saved geometry.');
