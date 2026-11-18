import assert from 'node:assert/strict';
import {moveReportBlock, reportDropIndex, reportOutlineDropIndex, groupReportOutline, createReportOutline, createReportInsertion, reportInsertionIndex, scrollReportTarget, revealOutlineHandle, navigateReportOutline} from '../public/report-outline.js';
import {createReportAutosave} from '../public/report-autosave.js';
import {createReportUndo} from '../public/report-undo.js';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Test every source/target boundary, including adjacent no-op drops and both ends.
for (let from = 0; from < 5; from++) for (let to = 0; to < 5; to++) for (const after of [false, true]) {
  const blocks = Array.from({length: 5}, (_, id) => ({id, excludedCommentKeys: ['private'], text: `Item ${id}`}));
  const moved = blocks[from], originals = [...blocks];
  const boundary = to + Number(after);
  const expected = originals.filter(block => block !== moved);
  expected.splice(boundary > from ? boundary - 1 : boundary, 0, moved);
  moveReportBlock(blocks, from, reportDropIndex(from, to, after));
  assert.deepEqual(blocks, expected);
  assert.ok(blocks.every(block => originals.includes(block)), 'Keep comments and source identities on the live objects');
}
for (const indices of [[-1, 0], [0, -1], [0, 2], [0, 0], [0, 0.5]]) {
  const blocks = [{id: 'a'}, {id: 'b'}], before = [...blocks];
  assert.equal(moveReportBlock(blocks, ...indices), false);
  assert.deepEqual(blocks, before);
}
const orderedSources = ['evidence', 'heading', 'heading', 'notebookCard', 'evidence', 'heading', 'researchAnswer']
  .map((kind, id) => ({kind, id: String(id), excludedCommentKeys: ['private']}));
const groups = groupReportOutline(orderedSources);
assert.deepEqual(groups.map(group => [group.block.id, group.children.map(block => block.id)]),
  [['0', []], ['1', []], ['2', ['3', '4']], ['5', ['6']]], 'Only actual headings group subsequent items, including consecutive headings');
assert.deepEqual(groups.flatMap(group => [group.block, ...group.children]), orderedSources, 'Preserve source order and live identities');
assert.deepEqual(groupReportOutline([]), []);
assert.equal(reportOutlineDropIndex(orderedSources, 0, 2, true, true), 4, 'Drop below a collapsed heading after its hidden contents');
assert.equal(reportOutlineDropIndex(orderedSources, 0, 2, true, false), 2, 'An expanded heading exposes its first insertion boundary');
assert.equal(reportOutlineDropIndex(orderedSources, 2, 2, true, true), 2, 'Dropping a folded heading onto itself does not move it past its own children');
const navigationScrolls = [];
const scrollContainer = {scrollTop: 100, getBoundingClientRect: () => ({top: 84, bottom: 1080}), scrollTo: value => navigationScrolls.push(value)};
const pinnedNavigation = [];
scrollReportTarget({...scrollContainer,
  querySelector: () => ({getBoundingClientRect: () => ({height: 84})}),
  scrollTo: value => pinnedNavigation.push(value)
}, {getBoundingClientRect: () => ({top: 316})});
assert.equal(pinnedNavigation[0].top, 232, 'Outline destinations remain below both pinned control rows');
scrollReportTarget(scrollContainer, {getBoundingClientRect: () => ({top: 316})});
assert.deepEqual(navigationScrolls, [{top: 300, behavior: 'smooth'}], 'Navigation scrolls only the document, preserving outer toolbars');
revealOutlineHandle(scrollContainer, {getBoundingClientRect: () => ({top: 1060, bottom: 1090})});
assert.equal(scrollContainer.scrollTop, 118, 'Keyboard focus scrolls only the outline');
let completePreview, navigationCurrent = true, navigated = 0;
const previewReady = new Promise(resolve => { completePreview = resolve; });
const pendingNavigation = navigateReportOutline({requests: [previewReady], isCurrent: () => navigationCurrent, navigate: () => navigated++});
await Promise.resolve(); assert.equal(navigated, 0, 'Do not measure a destination while earlier previews are still changing height');
completePreview(); await pendingNavigation; assert.equal(navigated, 1);
navigationCurrent = false;
await navigateReportOutline({requests: [Promise.reject(Error('Preview unavailable'))], isCurrent: () => navigationCurrent, navigate: () => navigated++});
assert.equal(navigated, 1, 'New navigation, manual scrolling, reordering and account changes cancel stale jumps');

class Element {
  constructor() {
    this.children = []; this.attributes = {}; this.dataset = {}; this.events = {}; this.offsetHeight = 50;
    const classes = new Set();
    this.classList = {add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)), contains: name => classes.has(name)};
  }
  append(...children) { for (const child of children) { if (child.parentElement) child.parentElement.children.splice(child.parentElement.children.indexOf(child), 1); child.parentElement = this; this.children.push(child); } }
  replaceChildren(...children) { this.children.forEach(child => { child.parentElement = null; }); this.children = []; this.append(...children); }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
  addEventListener(key, fn) { this.events[key] = fn; }
  removeEventListener(key) { delete this.events[key]; }
  getBoundingClientRect() { return this.rect || {top: 0, bottom: 600}; }
  focus() {}
  setPointerCapture() {}
  querySelector(selector) { return this.children.find(child => child.className?.split(' ').includes(selector.slice(1))) || this.children.map(child => child.querySelector(selector)).find(Boolean); }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.className?.split(' ').includes(selector.slice(1)) ? [child] : []), ...child.querySelectorAll(selector)]); }
  contains(element) { return this.children.includes(element); }
}
globalThis.document = {createElement: () => new Element()};
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
const blocks = [{id: 'a', kind: 'evidence'}, {id: 'b', kind: 'paragraph'}, {id: 'c', kind: 'heading'}];
const draft = {id: 'draft', version: 1, blocks}, writes = [];
const autosave = createReportAutosave({read: () => draft, isCurrent: () => true, retain: async () => ({}),
  acknowledge: async () => {}, write: async value => { writes.push(value); return {...value, version: value.version + 1}; },
  onSaved: saved => { draft.version = saved.version; }, setTimer: () => 1, clearTimer() {}});
const moves = [], navigations = [], body = new Element(), introduction = new Element(), targets = blocks.map(() => new Element());
const controller = createReportOutline({blocks, introduction, targets, documentBody: body,
  describe: block => ({title: block.id}), dragIcon: '', onNavigate: target => navigations.push(target),
  onMove: (block, index, area) => { moves.push({id: block.id, index, area}); if (moveReportBlock(blocks, blocks.indexOf(block), index)) { controller.reorder(); autosave.change(); } }});
const getRows = () => controller.element.querySelectorAll('.report-outline-item');
let rows = getRows();
rows[1].querySelector('.report-outline-drag').events.keydown({key: 'ArrowDown', preventDefault() {}});
assert.deepEqual(moves[0], {id: 'b', index: 2, area: 'outline'});
await autosave.flush();
assert.deepEqual(writes[0].blocks.map(block => block.id), ['a', 'c', 'b'], 'Outline movement reaches the saved report payload');
rows = getRows();
assert.deepEqual(rows.map(row => row.dataset.blockId), ['a', 'c', 'b']);
rows[2].querySelector('.report-outline-drag').events.keydown({key: 'ArrowUp', preventDefault() {}});
assert.deepEqual(blocks.map(block => block.id), ['a', 'b', 'c'], 'Repeated moves use current positions');
rows = getRows();
// Drop handler uses the dragged block identity, rather than the position captured before a move.
let nativeDragImage;
rows[1].events.dragstart({dataTransfer: {setData() {}, setDragImage: image => {nativeDragImage = image;}}});
assert.equal(nativeDragImage, controller.element.querySelector('.report-outline-drag-image'), 'Native row drags use the transparent image instead of a boxed row ghost');
assert.equal(controller.element.classList.contains('is-reordering'), true);
rows[0].events.drop({clientY: 0, preventDefault() {}});
assert.equal(controller.element.classList.contains('is-reordering'), false);
assert.deepEqual(blocks.map(block => block.id), ['b', 'a', 'c']);
await autosave.flush();
assert.deepEqual(writes.at(-1).blocks.map(block => block.id), ['b', 'a', 'c']);
controller.element.children[1].children[0].events.click();
assert.equal(navigations[0], introduction);
assert.equal(controller.element.querySelector('.report-outline-toggle'), undefined, 'No artificial Contents group');
controller.dispose();
assert.equal(body.events.scroll, undefined, 'Detach old scroll listeners when rebuilding or leaving the report');

// Exercise the actual app integration: reorder mounted rows without recreating previews/editors.
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const reorderStart = app.indexOf('  function reorderDraftBlock(');
const activeDraft = {blocks: [{id: 'x'}, {id: 'y'}, {id: 'z'}]};
const documentBody = new Element(), documentRows = activeDraft.blocks.map(block => Object.assign(new Element(), {_reportBlock: block}));
const blockBody = new Element(); blockBody.append(...documentRows);
documentBody.scrollTop = 1706;
documentBody.querySelectorAll = () => [...blockBody.children];
const calls = [];
const context = vm.createContext({activeDraft, shell: {querySelector: () => documentBody}, moveReportBlock,
  outlineNavigationGeneration: 0, outlineController: {reorder: () => calls.push('outline'), announce() {}}, reportBlockTitle: b => b.id,
  renderIncludedReportComments: () => calls.push('comments'), panel: {}, setDirty: () => calls.push('dirty')});
vm.runInContext(app.slice(reorderStart, app.indexOf('  const reportSwitch = ', reorderStart)), context);
context.reorderDraftBlock(activeDraft.blocks[2], 0);
assert.deepEqual(blockBody.children, [documentRows[2], documentRows[0], documentRows[1]], 'Move the mounted editors and source previews');
assert.equal(documentBody.scrollTop, 1706, 'Reordering keeps the document scroll position');
assert.deepEqual(calls, ['outline', 'comments', 'dirty']);

// Initial sync may clean up workspace columns while the screen's editor is still loading.
const cleanups = [], mounts = new Map([['report', {dispose: () => cleanups.push('report')}], ['other', {dispose: () => cleanups.push('other') }]]);
let current = true;
const cleanupContext = vm.createContext({reportDraftMounts: mounts, reportScreen: {projectID: 'report', isCurrent: () => current}});
const cleanupStart = app.indexOf('function cleanupInactiveReportDraftMounts(');
vm.runInContext(app.slice(cleanupStart, app.indexOf('\nfunction disposeProjectWorkboardMount(', cleanupStart)), cleanupContext);
cleanupContext.cleanupInactiveReportDraftMounts([]);
assert.deepEqual(cleanups, ['other'], 'A loading report stays owned by its current screen before DOM attachment');
current = false;
cleanupContext.cleanupInactiveReportDraftMounts([]);
assert.deepEqual(cleanups, ['other', 'report'], 'Changed account/workspace screens still release stale editors');

const pointerMoves = [], pointerBlocks = [{id: '1'}, {id: '2'}, {id: '3'}];
const pointer = createReportOutline({blocks: pointerBlocks, introduction, targets, documentBody: body,
  describe: block => ({title: block.id}), dragIcon: '', onNavigate() {},
  onMove: (block, index) => pointerMoves.push([block.id, index])});
const pointerRows = pointer.element.querySelectorAll('.report-outline-item');
pointerRows.forEach((row, index) => { row.rect = {top: 100 + index * 50, bottom: 150 + index * 50}; });
const pointerHandle = pointerRows[2].querySelector('.report-outline-drag');
pointerHandle.events.pointerdown({button: 0, pointerId: 1, clientY: 225, preventDefault() {}});
pointerHandle.events.pointermove({clientY: 105});
assert.equal(pointer.element.classList.contains('is-reordering'), true);
assert.equal(pointerRows[0].classList.contains('is-drop-before'), true, 'Mark the actual insertion boundary before releasing the pointer');
pointerHandle.events.pointerup();
assert.equal(pointerRows[0].classList.contains('is-drop-before'), false, 'Release clears the insertion line');
assert.equal(pointer.element.classList.contains('is-reordering'), false);
assert.deepEqual(pointerMoves, [['3', 0]], 'Captured pointer dragging works across row buttons');
pointerHandle.events.pointerdown({button: 0, pointerId: 1, clientY: 225, preventDefault() {}});
pointerHandle.events.pointermove({clientY: 105});
pointerHandle.events.pointercancel();
assert.equal(pointerRows[0].classList.contains('is-drop-before'), false, 'Cancellation clears the insertion line too');
assert.equal(pointerMoves.length, 1, 'Cancelled dragging must not alter the draft');
pointer.dispose();

// Folded groups retain their state, never become invisible drag targets, and reveal focused children.
const sectionExpansion = new Map(), sectionBlocks = orderedSources.slice(), sectionTargets = sectionBlocks.map(() => new Element());
const sectionMoves = [], sectionNavigations = [];
const options = {blocks: sectionBlocks, introduction, targets: sectionTargets, documentBody: body, sectionExpansion,
  describe: block => ({title: block.id}), dragIcon: '', onNavigate: target => sectionNavigations.push(target),
  onMove: (block, index) => sectionMoves.push([block.id, index])};
const grouped = createReportOutline(options);
const section = grouped.element.querySelectorAll('.report-outline-section')[1];
const headingRow = section.children[0], childGroup = section.children[1];
const sectionToggle = headingRow.querySelector('.report-outline-section-toggle');
childGroup.children[0].querySelector('.report-outline-link').events.click();
assert.equal(sectionNavigations[0], sectionTargets[3]);
sectionToggle.events.click();
assert.equal(childGroup.hidden, true);
assert.equal(headingRow.querySelector('.report-outline-link').attributes['aria-current'], 'location', 'A folded heading represents its current child');
grouped.reorder();
assert.equal(childGroup.hidden, true, 'Reordering keeps folded headings folded');
const sectionRows = grouped.element.querySelectorAll('.report-outline-item');
sectionRows.forEach((row, index) => { row.rect = {top: 100 + index * 50, bottom: 150 + index * 50}; });
sectionRows[3].rect = sectionRows[4].rect = {top: 0, bottom: 0};
sectionRows[5].rect = {top: 250, bottom: 300};
sectionRows[6].rect = {top: 300, bottom: 350};
const sectionHandle = sectionRows[0].querySelector('.report-outline-drag');
sectionHandle.events.pointerdown({button: 0, pointerId: 1, clientY: 125, preventDefault() {}});
sectionHandle.events.pointermove({clientY: 245});
sectionHandle.events.pointerup();
assert.deepEqual(sectionMoves, [['0', 4]], 'Pointer drops below a folded heading skip its hidden rows');
grouped.reveal(sectionBlocks[3]);
assert.equal(childGroup.hidden, false, 'Reordering focus can reveal a newly nested item');
sectionToggle.events.click();
grouped.dispose();
const remounted = createReportOutline({...options, blocks: sectionBlocks.map(block => ({...block}))});
assert.equal(remounted.element.querySelectorAll('.report-outline-section-items')[1].hidden, true, 'Fold state survives refreshed draft objects');
remounted.dispose();
autosave.dispose();

// Remove is a separate action on every item, including headings and children.
{
  const items=[{id:'heading',kind:'heading'},{id:'note',kind:'notebookCard',sourceID:'saved-note'}];
  const removed=[],navigated=[],reordered=[];
  const removable=createReportOutline({blocks:items,introduction:new Element(),targets:items.map(()=>new Element()),documentBody:new Element(),
    describe:block=>({title:block.title||block.id}),dragIcon:'',removeIcon:'<svg></svg>',
    onNavigate:target=>navigated.push(target),onMove:block=>reordered.push(block),onRemove:block=>removed.push(block)});
  const actions=removable.element.querySelectorAll('.report-outline-remove');
  assert.equal(actions.length,2);assert.equal(actions[0].attributes['aria-label'],'Remove heading from Report');
  assert.equal(removable.element.querySelector('.report-outline-introduction').querySelector('.report-outline-remove'),undefined);
  let stopped=0,prevented=0;
  actions[1].events.click({preventDefault(){prevented++;},stopPropagation(){stopped++;}});
  assert.equal(removed[0],items[1]);assert.equal(stopped,1);assert.equal(prevented,1);
  assert.equal(navigated.length,0);assert.equal(reordered.length,0,'Removing must not navigate or start a reorder.');
  items[1].title='Renamed note';removable.refreshLabels();
  assert.equal(actions[1].attributes['aria-label'],'Remove Renamed note from Report');
  items.reverse();removable.reorder();
  removable.element.querySelectorAll('.report-outline-remove')[0].events.click({preventDefault(){},stopPropagation(){}});
  assert.equal(removed.at(-1),items[0],'Reordered actions still remove their original block object.');
  removable.dispose();
}

// The actual app removal shares Undo, saving and identity guards with the document.
{
  const data={id:'report',version:1,title:'Keep this Report title',introduction:'Keep this introduction',blocks:[
    {id:'section',kind:'heading',text:'Section'},
    {id:'source',kind:'evidence',sourceID:'saved-evidence',excludedCommentKeys:['private']},
    {id:'writing',kind:'paragraph',text:'Keep this report-specific wording'}]};
  const original=structuredClone(data),history=createReportUndo(),saved=[],focus=[],announcements=[];
  history.bind(data);
  const saving=createReportAutosave({read:()=>data,isCurrent:()=>true,retain:async()=>({}),acknowledge:async()=>{},
    write:async snapshot=>{saved.push(snapshot);return{...snapshot,version:snapshot.version+1};},
    onSaved:value=>{data.version=value.version;},setTimer:()=>1,clearTimer(){}});
  const c=vm.createContext({activeDraft:data,disposed:false,generatingReport:false,deletingReport:false,
    requestIdentity:'account',requestWorkspaceID:'workspace',activeWorkspaceID:'workspace',isCurrentAccountRequest:()=>true,
    CSS:{escape:value=>value},reportBlockTitle:block=>block.id,outlineController:{reveal(){},announce:text=>announcements.push(text)},
    shell:{querySelector:selector=>({focus:options=>focus.push({selector,options})})},renderWorkspaceContent(){},
    setDirty(){history.record(data);saving.change();}});
  const start=app.indexOf('  function removeDraftBlock(');
  vm.runInContext(app.slice(start,app.indexOf('  function reorderDraftBlock(',start)),c);
  const section=data.blocks[0];assert.equal(c.removeDraftBlock(section,'outline'),true);
  assert.deepEqual(data.blocks.map(block=>block.id),['source','writing'],'Removing a heading retains its child items.');
  assert.match(focus.at(-1).selector,/data-block-id="source"/);assert.equal(focus.at(-1).options.preventScroll,true);
  assert.equal(announcements[0],'section removed from Report.');
  await saving.flush();assert.deepEqual(saved[0].blocks.map(block=>block.id),['source','writing']);
  assert.equal(c.removeDraftBlock(section),false,'A stale removed block cannot delete the last remaining item.');
  Object.assign(data,history.undo(data));
  assert.deepEqual(data.blocks,original.blocks,'Undo restores exact source references, exclusions and authored text.');
  assert.equal(data.title,original.title);assert.equal(data.introduction,original.introduction);
  for(const flag of ['disposed','generatingReport','deletingReport']){
    c[flag]=true;assert.equal(c.removeDraftBlock(data.blocks[0],'outline'),false);c[flag]=false;
  }
  c.isCurrentAccountRequest=()=>false;assert.equal(c.removeDraftBlock(data.blocks[0]),false);c.isCurrentAccountRequest=()=>true;
  c.activeWorkspaceID='other';assert.equal(c.removeDraftBlock(data.blocks[0]),false);c.activeWorkspaceID='workspace';
  while(data.blocks.length)c.removeDraftBlock(data.blocks[0],'outline');
  assert.equal(focus.at(-1).selector,'.report-outline-introduction .report-outline-link','Deleting the final item retains keyboard access to the Outline.');
  await saving.flush();saving.dispose();
}
{
  const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const start=source.indexOf('    const addReportContent = kind => {');
  const implementation=source.slice(start,source.indexOf('    reportFormatting = ',start));
  for(const kind of ['heading','paragraph','list','ordered']) {
    const draft={id:'selected-report',blocks:['a','b','c'].map(id=>({id,kind:'paragraph',text:id}))};
    const insertion=createReportInsertion(); insertion.select(draft,'b');
    let next=0, sidebarTransitions=0;
    const context=vm.createContext({activeDraft:draft,reportInsertion:insertion,reportInsertionIndex,
      crypto:{randomUUID:()=>`new-${++next}`},panel:{dataset:{},querySelector:()=>({focus(){}})},
      setDirty(){},renderWorkspaceContent(){},transitionReportSidebars(){sidebarTransitions++;},outlineController:{reveal(){}},reportFormatting:{focus(){}}});
    vm.runInContext(implementation+'\nglobalThis.add=addReportContent;',context);
    context.add(kind); context.add('paragraph');
    assert.deepEqual(draft.blocks.map(block=>block.id),['a','b','new-1','new-2','c']);
    assert.equal(draft.blocks[2].kind,kind==='ordered'?'list':kind);
    insertion.select(draft,null);context.add('heading');assert.equal(draft.blocks[0].id,'new-3','Introduction inserts before the first content item.');
    insertion.select(draft,'missing');context.add('paragraph');assert.equal(draft.blocks.at(-1).id,'new-4','A removed anchor safely falls back to the end.');
    insertion.select(draft,'b');context.add('source');assert.equal(insertion.selected(draft),'b','Opening Sources retains the selected insertion target.');
    assert.equal(context.panel.dataset.libraryOpen, 'true');
    assert.equal(sidebarTransitions, 1);
  }
  const insertion=createReportInsertion(),draft={id:'',blocks:[{id:'b'}]};
  insertion.select(draft,'b');draft.id='saved';insertion.remember(draft);
  const refreshed=structuredClone(draft);assert.equal(insertion.selected(refreshed),'b');
  insertion.select({id:'different',blocks:[]},null);assert.equal(insertion.selected(refreshed),'b','Selection remains isolated by report.');
}
console.log('Report outline passed: heading/paragraph/list/source insertion after selection, sequential additions, Introduction and stale anchors, per-report selection, folding, dragging, saves and cleanup.');
console.log('Outline removal passed: per-item actions, current labels, reorder identity, retained children, Undo, autosave, focus, stale-item and access guards.');
