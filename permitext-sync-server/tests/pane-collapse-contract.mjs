import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { normalizeColumnGroups, orderColumnGroups, normalizeWorkspaceLayout } from '../public/workspace-state.js';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const actual = name => {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf('\n}', start) + 2);
};
const classes = new Set();
const draft = { value: 'Unsubmitted question', scrollTop: 460, scrollLeft: 0 };
const title = { setAttribute() {}, focus() {}, animate() {} };
const rail = { ...title, hidden: true };
const animations = [];
const panel = {
  dataset: { paneId: 'utility:search:1' }, style: {}, children: [],
  classList: { contains: name => classes.has(name), toggle: (name, on) => on ? classes.add(name) : classes.delete(name) },
  querySelector: selector => selector.includes('pane-collapsed-tab') ? rail : title,
  querySelectorAll: () => [draft],
  getBoundingClientRect: () => ({ width: classes.has('is-collapsed') ? 48 : 720 }),
  animate(frames, options) {
    let finish;
    const animation = { frames, options, finished: new Promise(resolve => { finish = resolve; }), cancel() {}, finish: () => finish() };
    animations.push(animation);
    return animation;
  }
};
const state = { collapsedPaneIDs: [], paneWeights: { 'utility:search:1': 720 }, paneOrder: ['utility:search:1'] };
let reducedMotion = false;
let saves = 0;
const context = vm.createContext({
  state, Set, Map, Array, Object,
  columnGroupForPane: id => state.columnGroups?.find(group => group.paneIDs.includes(id)),
  track: { querySelectorAll: () => [] },
  window: { matchMedia: () => ({ matches: reducedMotion }) },
  getComputedStyle: () => ({ paddingInline: '24px' }),
  captureReaderScrollPositions: () => new Map(), restoreReaderScrollPositions() {},
  applyPaneWeight() {}, closeActiveCustomSelect() {}, notifyWorkspaceLayoutChange() {},
  saveWorkspaceState: () => saves++
});
vm.runInContext(['paneIsCollapsed', 'applyPaneCollapsedState', 'updateCollapsedPaneDividers', 'setPaneCollapsed'].map(actual).join('\n'), context);
context.setPaneCollapsed(panel, true);
assert.equal(context.paneIsCollapsed(panel.dataset.paneId), true);
assert.equal(rail.hidden, false);
assert.equal(animations[0].frames[0].minWidth, '720px');
assert.equal(animations[0].frames[1].minWidth, '48px');
assert.equal(animations[0].options.duration, 240);
animations[0].finish();
await Promise.resolve();
// Simulate the browser resetting the hidden scroll container, then restore it.
draft.scrollTop = 0;
context.setPaneCollapsed(panel, false);
assert.equal(draft.scrollTop, 460);
assert.equal(draft.value, 'Unsubmitted question');
assert.equal(rail.hidden, true);
assert.deepEqual(state.paneWeights, { 'utility:search:1': 720 });
assert.deepEqual(state.paneOrder, ['utility:search:1']);
assert.equal(animations[1].frames[1].minWidth, '720px');
animations[1].finish();
await Promise.resolve();
reducedMotion = true;
context.setPaneCollapsed(panel, true);
assert.equal(animations.length, 2, 'Reduced motion skips both transitions');
context.setPaneCollapsed(panel, false);
assert.equal(animations.length, 2);
assert.equal(saves, 4);
console.log('Column collapse preserves live drafts, scroll, widths and order; animation and reduced motion passed.');

// Expanded handles and collapsed title tabs share the same reorder behavior.
function eventNode() {
  const listeners = {};
  return { dataset: {}, listeners, addEventListener(type, callback) {
    (listeners[type] ||= []).push(callback);
  }, emit(type, event = {}) { for (const callback of listeners[type] || []) callback(event); } };
}
const grip = eventNode(), collapsedTab = eventNode(), dragPane = eventNode();
dragPane.dataset.paneId = 'reader:drag';
dragPane.classList = { add() {}, remove() {} };
dragPane.querySelector = () => grip;
grip.classList = { add() {} };
dragPane.querySelectorAll = () => [grip, collapsedTab];
const dragState = { collapsedPaneIDs: ['reader:drag'], paneOrder: ['reader:drag', 'reader:target'] };
const dragContext = vm.createContext({
  state: dragState, Date, draggedPaneID: '', dragPreviewOrder: [],
  track: { querySelectorAll: () => [] }, saveWorkspaceState() {},
  transitionWorkspace() {},
  clearDragPreviewOrder() { dragContext.dragPreviewOrder = []; }
});
vm.runInContext(actual('bindPaneDragging'), dragContext);
dragContext.bindPaneDragging([dragPane]);
dragContext.bindPaneDragging([dragPane]);
for (const handle of [grip, collapsedTab]) {
  assert.equal(handle.draggable, true);
  assert.equal(handle.listeners.dragstart.length, 1, 'Reusing a pane cannot duplicate drag listeners');
}
assert.equal(dragPane.listeners.drop.length, 1);
let transfer;
collapsedTab.emit('dragstart', { dataTransfer: { setData: (type, id) => { transfer = [type, id]; } } });
assert.deepEqual(transfer, ['text/plain', 'reader:drag']);
dragContext.dragPreviewOrder = ['reader:target', 'reader:drag'];
collapsedTab.emit('dragend');
assert.deepEqual(dragState.paneOrder, ['reader:target', 'reader:drag']);
assert.deepEqual(dragState.collapsedPaneIDs, ['reader:drag'], 'Dragging must not expand the column');
assert.ok(collapsedTab._suppressExpandUntil > Date.now(), 'Drop-generated clicks cannot immediately expand the tab');
console.log('Collapsed and expanded drag handles share reorder logic without duplicate listeners or expanding on drop.');

// Header controls must remain clickable and cannot initiate a column drag.
let preventedHeaderDrag = false;
grip.emit('pointerdown', { target: { closest: () => ({ tagName: 'BUTTON' }) } });
grip.emit('dragstart', { preventDefault: () => { preventedHeaderDrag = true; } });
assert.equal(preventedHeaderDrag, true);
grip.emit('pointerdown', { target: { closest: () => null } });
grip.emit('dragstart', { dataTransfer: { setData: (_type, id) => { transfer = id; } } });
assert.equal(transfer, 'reader:drag', 'Empty header space initiates the same column drag');
console.log('Header dragging excludes title buttons and other interactive controls.');

// Project columns move as a unit without changing individual collapsed state.
const savedID = 'utility:saved:one', notebookID = 'project:notebook:p', reportID = 'project:report-draft:p';
const orderState = { utilities: {}, utilityInstances: [], paneOrder: ['reader:one', notebookID, savedID, reportID], collapsedPaneIDs: [notebookID] };
const orderContext = vm.createContext({
  state: orderState, Set, normalizeColumnGroups, orderColumnGroups,
  defaultActivePaneIDs: () => [savedID, notebookID, reportID, 'reader:one'],
  savedPaneIDs: () => [savedID], primarySavedPaneID: () => savedID,
  openProjectDetails: () => [{ id: 'p' }],
  paneIDForProjectNotebook: () => notebookID, paneIDForProjectReportDraft: () => reportID,
  isCodeQuestionPaneID: () => false, openResearchConversationPaneIDs: () => [], openCodeQuestionPaneIDs: () => [],
  isProjectDetailPaneID: () => false, isProjectToolPaneID: () => false,
  searchIDForLinkedReaderPane: () => '', paneIDForResearchConversation: () => ''
});
vm.runInContext(['savedProjectColumnGroup', 'groupSavedProjectColumns', 'pinCriticalWorkflowPanesToLeft', 'activePaneIDs', 'columnGroupForPane', 'reconcileColumnGroups', 'basePaneGroupForMove', 'paneGroupForMove', 'orderWithPaneMoved'].map(actual).join('\n'), orderContext);
assert.deepEqual(Array.from(orderContext.activePaneIDs()), ['reader:one', savedID, notebookID, reportID]);
for (const member of [savedID, notebookID, reportID]) {
  orderState.paneOrder = orderContext.orderWithPaneMoved(member, 'reader:one', 'before');
  assert.deepEqual(Array.from(orderContext.activePaneIDs()), [savedID, notebookID, reportID, 'reader:one']);
  orderState.paneOrder = orderContext.orderWithPaneMoved(member, 'reader:one', 'after');
  assert.deepEqual(Array.from(orderContext.activePaneIDs()), ['reader:one', savedID, notebookID, reportID]);
}
assert.equal(orderContext.orderWithPaneMoved(notebookID, reportID, 'after'), null);
orderState.paneOrder = orderContext.orderWithPaneMoved('reader:one', notebookID, 'after');
assert.deepEqual(Array.from(orderContext.activePaneIDs()), [savedID, notebookID, reportID, 'reader:one']);
assert.deepEqual(orderState.collapsedPaneIDs, [notebookID]);
assert.deepEqual(Array.from(orderContext.savedProjectColumnGroup([savedID, reportID])), [savedID, reportID]);
console.log('Saved, Notebook and Report move together from any member; internal order and individual collapse state are preserved.');

vm.runInContext(actual('singleExpandedDividerEdge'), context);
state.collapsedPaneIDs = ['collapsed'];
assert.equal(context.singleExpandedDividerEdge('reader', 'collapsed').side, 'right');
assert.equal(context.singleExpandedDividerEdge('collapsed', 'reader').side, 'left');
assert.equal(context.singleExpandedDividerEdge('reader', 'other-reader'), null);
assert.equal(context.singleExpandedDividerEdge('collapsed', ''), null);
assert.equal(context.singleExpandedDividerEdge('', 'reader').side, 'left');
console.log('Expanded columns resize beside collapsed neighbors on either edge.');

// Unique project columns are stripped from both active and stored groups.
orderState.columnGroups = normalizeColumnGroups([{ id: 'mixed', name: 'Research pack', paneIDs: ['reader:one', savedID, notebookID, reportID], columns: { [savedID]: { kind: 'utility' } }, collapsed: true }]);
assert.deepEqual(orderState.columnGroups[0].paneIDs, ['reader:one']);
assert.deepEqual(orderState.columnGroups[0].columns, {});
orderContext.reconcileColumnGroups([]);
assert.deepEqual(Array.from(orderState.columnGroups[0].paneIDs), ['reader:one']);
assert.deepEqual(normalizeColumnGroups([{ id: 'unique-only', paneIDs: [savedID, notebookID, reportID] }]), []);
assert.deepEqual(normalizeWorkspaceLayout(orderState).columnGroups, JSON.parse(JSON.stringify(orderState.columnGroups)));
assert.deepEqual(orderColumnGroups(['a','b','c','d'], [{paneIDs:['a','c']}]), ['a','c','b','d']);
console.log('Saved, Notebook and Report are excluded from active and persisted custom groups; remaining columns are preserved.');

// Reset updates the future expanded widths without changing visibility or group membership.
const resetState = { paneWeights: { a: 950, b: 820 }, collapsedPaneIDs: ['a'], columnGroups: [{ id: 'g', paneIDs: ['b'], collapsed: true }] };
const resetContext = vm.createContext({
  state: resetState, track: { scrollLeft: 0, scrollWidth: 1200, clientWidth: 1000, querySelectorAll: () => [] },
  activePaneIDs: () => ['a', 'b'], defaultPaneWidthForID: () => 600,
  saveWorkspaceState() {}, async transitionWorkspace() {}, requestAnimationFrame: fn => fn()
});
vm.runInContext('async ' + actual('resetVisibleColumnWidths'), resetContext);
await resetContext.resetVisibleColumnWidths();
assert.deepEqual(JSON.parse(JSON.stringify(resetState.paneWeights)), { a: 600, b: 600 });
assert.deepEqual(resetState.collapsedPaneIDs, ['a']);
assert.equal(resetState.columnGroups[0].collapsed, true);
console.log('Reset restores default widths while preserving collapsed columns and groups.');

// Reopening a saved group restores its own identities, alongside ungrouped columns of the same kinds.
const reopenState = {
  readers: [{ id: 'outside-reader' }],
  utilityInstances: [{ id: 'outside-search', key: 'search', query: 'outside' }, { id: 'outside-research', key: 'analysis' }],
  paneWeights: {}, paneOrder: ['reader:outside-reader'], collapsedPaneIDs: [],
  columnGroups: [{ id: 'saved-group', paneIDs: ['reader:owned', 'utility:search:owned-search', 'utility:analysis:owned-research'], columns: {
    'reader:owned': { kind: 'reader', value: {id:'owned', chapterID: 4}, width: 850, collapsed: true },
    'utility:search:owned-search': { kind:'utility', value:{id:'owned-search',key:'search',query:'fire'},width:600 },
    'utility:analysis:owned-research': { kind:'utility', value:{id:'owned-research',key:'analysis',conversationID:'conversation'},width:700 }
  }}]
};
const reopenContext = vm.createContext({state:reopenState, CSS:{escape:x=>x}, captureColumnGroupContents(){},
  defaultActivePaneIDs:()=>[...reopenState.readers.map(r=>'reader:'+r.id),...reopenState.utilityInstances.map(i=>'utility:'+i.key+':'+i.id)],
  track:{querySelector:()=>null}, pendingGroupReaderPositions:new Map(), researchNewChatDrafts:new Map(), researchDraftPaneIDs:new Set(),
  paneIDForUtilityInstance:i=>'utility:'+i.key+':'+i.id, defaultPaneWidthForID:()=>600, saveWorkspaceState(){}, async transitionWorkspace(){}, showWebNotice(){throw Error('Unexpected missing snapshot');}
});
vm.runInContext('async '+actual('restoreSavedColumnGroup'), reopenContext);
await reopenContext.restoreSavedColumnGroup('saved-group');
assert.equal(reopenState.readers.length,2);
assert.equal(reopenState.utilityInstances.length,4);
assert.equal(reopenState.utilityInstances[0].query,'outside');
assert.equal(reopenState.utilityInstances[2].query,'fire');
assert.equal(reopenState.paneWeights['reader:owned'],850);
assert.ok(reopenState.collapsedPaneIDs.includes('reader:owned'));
const restoredOrder=[...reopenState.paneOrder];
await reopenContext.restoreSavedColumnGroup('saved-group');
assert.equal(reopenState.readers.length,2);
assert.equal(reopenState.utilityInstances.length,4);
assert.deepEqual([...reopenState.paneOrder],restoredOrder);
const roundTrip=normalizeWorkspaceLayout(JSON.parse(JSON.stringify(reopenState)));
assert.equal(roundTrip.columnGroups[0].columns['utility:search:owned-search'].value.query,'fire');
console.log('Saved group reopening restores owned Reader/Search/Research identities, widths and state without duplicates or taking over ungrouped columns.');

// Keyboard/menu stepping reuses the same real grouping + ordering functions as drag.
vm.runInContext(actual('orderWithPaneStepped'), orderContext);
orderState.columnGroups=[];
orderState.paneOrder=['reader:one',savedID,notebookID,reportID];
assert.equal(orderContext.orderWithPaneStepped('reader:one',-1),null);
assert.deepEqual(Array.from(orderContext.orderWithPaneStepped(notebookID,-1)),[savedID,notebookID,reportID,'reader:one']);
assert.equal(orderContext.orderWithPaneStepped(reportID,1),null);
orderState.utilities.settings=true;
orderContext.defaultActivePaneIDs=()=>['utility:settings',savedID,notebookID,reportID,'reader:one','reader:two'];
orderState.paneOrder=['utility:settings','reader:one',savedID,notebookID,reportID,'reader:two'];
assert.equal(orderContext.orderWithPaneStepped('utility:settings',1),null,'Pinned Settings cannot move right');
assert.equal(orderContext.orderWithPaneStepped('reader:one',-1),null,'Columns cannot move before pinned Settings');
orderState.columnGroups=[{id:'readers',paneIDs:['reader:one','reader:two']}];
assert.deepEqual(Array.from(orderContext.orderWithPaneStepped('reader:two',1)),['utility:settings',savedID,notebookID,reportID,'reader:one','reader:two']);
assert.deepEqual(orderState.collapsedPaneIDs,[notebookID]);
console.log('Keyboard column moves preserve linked project/named groups, boundaries and pinned Settings.');

// Menu activation invokes real movement/collapse helpers without rerendering editors.
let focused=null, menu=null, mountedPass=null, menuSaves=0, collapsedCall=null;
function menuNode(tag='button') {
  return {tag,children:[],attrs:{},listeners:{},style:{},offsetWidth:180,offsetHeight:200,
    setAttribute(k,v){this.attrs[k]=v;}, addEventListener(k,fn){this.listeners[k]=fn;},
    append(...nodes){this.children.push(...nodes);}, remove(){this.removed=true;},
    focus(){focused=this;}, getBoundingClientRect(){return {left:0,right:600,bottom:50,width:600};},
    querySelectorAll(){return this.children.filter(x=>x.tag==='button'&&!x.disabled);},
    querySelector(){return this.querySelectorAll()[0]||null;}, contains(){return false;}};
}
const anchor=menuNode(), menuRail=menuNode();
const retainedEditor={value:'Unsent live question',scrollTop:321};
const menuPanel={dataset:{paneId:'reader:one'},editor:retainedEditor,
  getBoundingClientRect:anchor.getBoundingClientRect,
  querySelector:selector=>selector.includes('pane-collapsed-tab')?menuRail:anchor,
  classList:{contains:()=>false}};
const peerPanel={dataset:{paneId:'reader:two'}};
let menuOrder=['reader:one','reader:two'];
const menuState={paneOrder:menuOrder,columnGroups:[]};
const menuContext=vm.createContext({state:menuState,AbortController,
  document:{querySelector:()=>null,createElement:tag=>menuNode(tag),body:{append:n=>{menu=n;}},addEventListener(){},get activeElement(){return focused;}},
  window:{innerWidth:1200,innerHeight:800},
  track:{querySelectorAll:()=>[menuPanel,peerPanel]},
  activePaneIDs:()=>menuOrder,paneGroupForMove:id=>[id],openCodeQuestionPaneIDs:()=>[],
  orderWithPaneMoved:()=>[...menuOrder].reverse(),
  appendPaneSequence:nodes=>{mountedPass=nodes;menuOrder=Array.from(menuState.paneOrder);},
  saveWorkspaceState:()=>menuSaves++,workspacePrivatePresentationAllowed:()=>false,
  canGroupColumn:()=>false,columnGroupForPane:()=>{throw Error('Private group lookup for guest');},
  appendReaderMenuControls(){},paneIsCollapsed:()=>false,
  setPaneCollapsed:(...args)=>{collapsedCall=args;menuRail.focus();}
});
vm.runInContext(['orderWithPaneStepped','movePaneOneStep','openColumnGroupMenu'].map(actual).join('\n'),menuContext);
menuContext.openColumnGroupMenu(menuPanel,anchor);
assert.equal(menu.attrs['aria-label'],'Column options');assert.equal(anchor.attrs['aria-expanded'],'true');
assert.deepEqual(menu.children.map(x=>x.textContent),['Collapse column','Move left','Move right']);
assert.equal(menu.children[1].disabled,true);assert.equal(menu.children[2].disabled,false);
assert.equal(focused,menu.children[0]);
menu.listeners.keydown({key:'ArrowDown',preventDefault(){}});assert.equal(focused,menu.children[2],'Arrow keys skip disabled move');
menu.children[2].listeners.click();
assert.equal(anchor.attrs['aria-expanded'],'false');assert.equal(focused,anchor);
assert.equal(mountedPass[0],menuPanel);assert.equal(mountedPass[1],peerPanel);
assert.equal(menuPanel.editor,retainedEditor);assert.equal(retainedEditor.value,'Unsent live question');assert.equal(retainedEditor.scrollTop,321);
assert.equal(menuSaves,1);
menuContext.openColumnGroupMenu(menuPanel,anchor);menu.children[0].listeners.click();
assert.equal(collapsedCall[0],menuPanel);assert.equal(collapsedCall[1],true);assert.equal(collapsedCall[2].focus,true);assert.equal(focused,menuRail);
menuContext.openColumnGroupMenu(menuPanel,anchor);menu.listeners.keydown({key:'Escape',preventDefault(){}});
assert.equal(focused,anchor);assert.equal(anchor.attrs['aria-expanded'],'false');
// Named-group focus restoration selects the first visible member, never hidden siblings.
const groupRail=menuNode(),groupAnchor=menuNode();
const groupPanel={dataset:{paneId:'a'},classList:{contains:()=>false},querySelector:s=>s.includes('pane-collapsed-tab')?groupRail:groupAnchor};
menuContext.track.querySelectorAll=()=>[{dataset:{paneId:'hidden'},classList:{contains:()=>true}},groupPanel];
vm.runInContext(actual('focusColumnGroupControl'),menuContext);
menuContext.paneIsCollapsed=()=>true;menuContext.focusColumnGroupControl({paneIDs:['hidden','a']});assert.equal(focused,groupRail);
menuContext.paneIsCollapsed=()=>false;menuContext.focusColumnGroupControl({paneIDs:['hidden','a']});assert.equal(focused,groupAnchor);
console.log('Column menu actual handlers preserve mounted editors, skip disabled actions, return focus, and keep private groups unavailable to guests.');

// Supplemental Research is independent; unified primary identity is never substituted for it.
orderState.columnGroups=[];
orderState.utilities={analysis:true};
orderState.researchConversationID='primary';
orderState.utilityInstances=[];
orderContext.paneIDForUtilityInstance=instance=>`utility:${instance.key}:${instance.id}`;
vm.runInContext(actual('paneIDForResearchConversation'),orderContext);
const supplemental='research:conversation:retained';
orderContext.defaultActivePaneIDs=()=>['utility:analysis',savedID,supplemental];
orderContext.openResearchConversationPaneIDs=()=>['utility:analysis',supplemental];
orderState.paneOrder=['utility:analysis',savedID];
assert.deepEqual(Array.from(orderContext.activePaneIDs()),['utility:analysis',supplemental,savedID], 'First-open placement stays beside History');
orderState.paneOrder=['utility:analysis',savedID,supplemental];
assert.deepEqual(Array.from(orderContext.basePaneGroupForMove('utility:analysis')),['utility:analysis']);
assert.deepEqual(Array.from(orderContext.basePaneGroupForMove(supplemental)),[supplemental]);
orderState.paneOrder=orderContext.orderWithPaneStepped(supplemental,-1);
assert.deepEqual(Array.from(orderContext.activePaneIDs()),['utility:analysis',supplemental,savedID]);
orderState.paneOrder=orderContext.orderWithPaneStepped(supplemental,-1);
assert.deepEqual(Array.from(orderContext.activePaneIDs()),[supplemental,'utility:analysis',savedID]);
orderState.researchConversationID='';
assert.deepEqual(Array.from(orderContext.basePaneGroupForMove(supplemental)),[supplemental]);
// Use groupable Reader rather than Saved; explicit normalized groups still override independence.
orderState.columnGroups=[{id:'explicit',paneIDs:['utility:analysis',supplemental]}];
assert.deepEqual(Array.from(orderContext.paneGroupForMove(supplemental)),['utility:analysis',supplemental]);
console.log('Supplementary Research moves independently through real identity/order functions and retains its position after normalization.');

// Legacy Code Decisions anchors cannot advertise moves that normalization undoes.
menuState.utilities={analysis:true};
menuContext.openCodeQuestionPaneIDs=()=>['cq:index','cq:record'];
menuContext.openResearchConversationPaneIDs=()=>['research:conversation:retained'];
menuOrder=['utility:analysis','research:conversation:retained','cq:index','cq:record','reader:one','reader:two'];
assert.equal(menuContext.orderWithPaneStepped('research:conversation:retained',1),null);
assert.equal(menuContext.orderWithPaneStepped('cq:record',1),null);
assert.equal(menuContext.orderWithPaneStepped('reader:one',-1),null,'Cannot move across anchored target');
assert.ok(menuContext.orderWithPaneStepped('reader:one',1),'Unrelated neighboring columns remain movable');
console.log('Code Decisions legacy anchors disable only affected move units/targets; unrelated columns remain movable.');
