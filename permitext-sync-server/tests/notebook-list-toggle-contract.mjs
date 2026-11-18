import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function actual(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return `${source.slice(start - 6, start) === 'async ' ? 'async ' : ''}${source.slice(start, source.indexOf('\n}', start) + 2)}`;
}
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.attrs = {}; this.className = ''; this.text = ''; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren() { this.children = []; }
  set textContent(value) { this.text = value; }
  get textContent() { return this.text + this.children.map(node => node.textContent).join(''); }
  setAttribute(name, value) { this.attrs[name] = value; }
  addEventListener() {}
  get classList() { return {toggle:(name, on) => {
    const names = new Set(this.className.split(' ').filter(Boolean));
    on ? names.add(name) : names.delete(name); this.className = [...names].join(' ');
  }}; }
  querySelectorAll(selector) {
    return this.children.flatMap(node => [
      ...((selector.startsWith('.') ? node.className.split(' ').includes(selector.slice(1)) : node.tag === selector) ? [node] : []),
      ...node.querySelectorAll(selector)
    ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}
const project = {id:'project'}, state = {notebookListHidden:false};
const editorID = 'project:notebook:project:note:editor';
let notesOpen = true, allowed = true, saves = 0, transitions = 0;
const context = vm.createContext({
  state, document:{createElement:tag => new Element(tag), querySelector:() => null},
  // Deferred panels are built before they belong to the workspace track.
  track:{querySelector:() => null,querySelectorAll:()=>[]}, applyPaneWeight() {},
  workspacePrivatePresentationAllowed:() => allowed, hasCapability:() => allowed,
  workspaceProject:() => project, projectDetailKey:value => value?.id || '',
  captureAccountRequest:()=>1,isCurrentAccountRequest:()=>true,activeWorkspaceID:'workspace',
  sharedNotesOpen:() => notesOpen, detachedProjectWindow:false, isProAccount:() => true,
  paneCanCollapse:() => false,
  selectedNotebookColumn:() => ({id:'editor',cardID:'a'}), notebookColumnPaneID:() => editorID,
  isProjectNotebookPaneID:id => id.startsWith('project:notebook:'),
  notebookCatalogs:new Map([['project',[{id:'a',title:'Note A'},{id:'b',title:'Note B'}]]]),
  notebookCatalogRequests:new Map(), saveWorkspaceState(){saves++;},
  notebookIndexTitleScroll:null, attachResearchHistoryTitleScroll:() => ({refresh(){}}),
  projectToolTogglePending:false, prependWorkspaceButtonIcon() {},
  async transitionWorkspace(mode){assert.equal(mode,'utility'); transitions++;}
});
vm.runInContext(['researchHistoryDayIndex','researchConversationHistoryGroups','notebookHistoryGroups',
  'notebookIndexPaneID','updateNotebookListToggle','createNotebookListToggle','renderNotebookIndex','syncNotebookLanding',
  'paneIsCollapsed','transitionNotebookList','toggleNotebookList','workflowPaneIsVisible'].map(actual).join('\n'), context);
const panel = context.renderNotebookIndex(project);
const localToggle = panel.querySelector('.notebook-list-toggle');
assert.equal(localToggle.textContent,'List');
assert.equal(localToggle.attrs['aria-expanded'],'true');
const notesRegion = panel.querySelector('.notebook-index-list');
const [header, actions, list] = notesRegion.children;
assert.equal(header.tag,'header');
assert.equal(header.querySelector('button'),localToggle);
assert.equal(actions.querySelector('.notebook-index-create').textContent,'New note +');
assert.equal(actions.querySelector('.notebook-index-menu-button').attrs['aria-label'],'Notes options');
assert.deepEqual(list.querySelectorAll('li').map(node => node.textContent), ['Note A','Note B'], 'A newly reopened deferred panel renders existing notes before mounting.');
assert.equal(list.querySelector('.notebook-index-group-label').textContent,'Older','Unknown dates are not presented as recent.');
context.notebookCatalogs.get('project')[0].updatedAt=new Date().toISOString();
context.syncNotebookLanding(null,panel);
assert.equal(list.querySelector('.notebook-index-group-label').textContent,'7 days','A changed edit date refreshes grouping even when its title is unchanged.');
assert.equal(notesRegion.children[0],header,'Refreshing the list retains the collapse control above the actions.');
project.sharedRole = 'viewer';
context.syncNotebookLanding(null,panel);
assert.equal(actions.hidden,true,'The viewer can browse notes without seeing editing actions.');
delete project.sharedRole;
context.syncNotebookLanding(null,panel);
assert.equal(actions.hidden,false);
const indexID = context.notebookIndexPaneID(project);
await context.toggleNotebookList();
assert.equal(context.workflowPaneIsVisible(indexID), true, 'The collapsed list remains mounted as a rail.');
assert.equal(context.paneIsCollapsed(indexID), true);
assert.equal(context.workflowPaneIsVisible(editorID), true, 'Hiding the list leaves the selected note visible.');
context.updateNotebookListToggle(localToggle);
assert.equal(localToggle.textContent,'List');
assert.equal(localToggle.attrs['aria-expanded'],'false');
await context.toggleNotebookList();
assert.equal(context.workflowPaneIsVisible(indexID), true);
assert.equal(context.paneIsCollapsed(indexID), false);
assert.equal(saves, 2); assert.equal(transitions, 2);
allowed = false;
assert.equal(await context.toggleNotebookList(), false);
allowed = true; notesOpen = false;
assert.equal(await context.toggleNotebookList(), false);
assert.equal(saves, 2, 'The closed Notes tool cannot change list visibility.');
notesOpen=true;state.notebookListHidden=true;
const revealed=[];
context.scrollPaneIntoView=id=>revealed.push(id);
context.track.querySelector=selector=>selector.includes(' .notebook-list-toggle')?{focus(){}}:{dataset:{paneId:indexID}};
await context.toggleNotebookList();
assert.deepEqual(revealed,[indexID],'Expanding Notes keeps the list reachable beside the notepad.');
console.log('Notes list toggle passed: immediate deferred contents, independent editor visibility, persistence and access/view guards.');

const railState = {notebookListHidden:true,paneWeights:{[indexID]:280}};
const rail = {dataset:{paneId:indexID},style:{setProperty(key,value){this[key]=value;}},
  classList:{contains:()=>false},getBoundingClientRect:()=>({width:80})};
const sizing = vm.createContext({state:railState,currentColumnWorkflowView:()=> 'notebook',
  minimumPaneWidthForID:()=>200,defaultPaneWidthForID:()=>280,migrateLegacyPaneWidth:(_id,value)=>value,
  assistantHistoryOnlyPane:()=>false,isFlexibleReaderPaneID:()=>false,paneCanCollapse:()=>false,
  workspaceColumnExpansion:null,track:{querySelectorAll:()=>[rail]}});
vm.runInContext(['applyPaneWeight','paneIsCollapsed','capturePaneResizeWidths'].map(actual).join('\n'),sizing);
sizing.applyPaneWeight(rail,indexID);
assert.equal(rail.style.flex,'0 0 80px');
assert.equal(rail.dataset.notebookListCollapsed,'true');
sizing.capturePaneResizeWidths();
assert.equal(railState.paneWeights[indexID],280,'Resizing other columns must not save the rail width over the expanded list width.');
railState.notebookListHidden=false;
sizing.applyPaneWeight(rail,indexID);
assert.equal(rail.style.flex,'0 0 300px','Reopening always restores the fixed expanded width.');
assert.equal(rail.dataset.notebookListCollapsed,'false');

let reducedMotion = false, updates = 0, cancelled = 0;
let widths=[280,1000],padding='24px';
const motionClasses = new Set(), motions = [];
function animate(frames,options) {
  let finish,reject;
  const finished=new Promise((resolve,fail)=>{finish=resolve;reject=fail;});
  motions.push({frames,options,finish});
  return {finished,cancel(){cancelled++;reject(Error('Animation interrupted'));}};
}
const livePanels=[0,1].map(index=>({isConnected:true,index,animate,getBoundingClientRect:()=>({width:widths[index]})}));
const motion = vm.createContext({track:{querySelectorAll:()=>livePanels},
  window:{matchMedia:()=>({matches:reducedMotion})},
  getComputedStyle:element=>({paddingInlineStart:element.index===0?padding:'24px',paddingInlineEnd:element.index===0?padding:'24px'}),
  document:{documentElement:{classList:{add:name=>motionClasses.add(name),remove:name=>motionClasses.delete(name)}},
    startViewTransition(){assert.fail('The live heading must never be replaced with a snapshot.');}}});
vm.runInContext(actual('transitionNotebookList'),motion);
const firstMotion = motion.transitionNotebookList(()=>{updates++;widths=[80,1200];padding='0px';});
await Promise.resolve();
assert.equal(motions.length,2,'Only the two live columns animate; the heading stays anchored.');
assert.equal(motions[0].frames[0].flexBasis,'280px');assert.equal(motions[0].frames[1].flexBasis,'80px');
assert(motions.every(animation=>animation.frames.every(frame=>frame.minWidth==='0px')),'Expanded minimum widths cannot block the width animation.');
// A quick reversal starts from the pixels currently on screen, before the
// previous animation is cancelled back to its underlying final geometry.
widths=[150,1130];padding='11px';
const secondMotion = motion.transitionNotebookList(()=>{updates++;widths=[280,1000];padding='24px';});
await firstMotion;
assert.equal(cancelled,2,'A quick second toggle interrupts the earlier live motion.');
assert(motionClasses.has('notes-list-motion'),'An older completion cannot clear the newer transition.');
assert.equal(motions[2].frames[0].flexBasis,'150px');
motions.slice(2).forEach(animation=>animation.finish());await secondMotion;
assert.equal(updates,2);assert.equal(motionClasses.size,0);
assert(motions.every(animation=>animation.options.duration===260&&animation.frames.every(frame=>!('opacity' in frame)&&!('transform' in frame))),
  'Live titles retain full opacity and their font size throughout the resize.');
reducedMotion=true;
await motion.transitionNotebookList(()=>{updates++;});
assert.equal(motions.length,4,'Reduced motion changes visibility without starting an animation.');
assert.equal(updates,3);
reducedMotion=false;
await assert.rejects(motion.transitionNotebookList(()=>{throw Error('Update failed');}),/Update failed/);
assert.equal(motionClasses.size,0,'A failed update cannot leave motion styles active.');
console.log('Notes rail passed: 80px collapse, retained width, live titles without snapshots/fades, interrupted transitions, cleanup and reduced motion.');

// An open notepad keeps a blank writing area after the selected Note is trashed.
const retained = {notebooks:[project], notebookColumns:[{id:'primary',cardID:'removed',open:true,selected:true}]};
let blankPages = 0;
const permanent = vm.createContext({state:retained, workspaceProject:()=>project, sharedNotesOpen:()=>true,
  notebookColumnsForProject:()=>retained.notebookColumns,
  notebookColumnPaneID:column=>column.id,
  notebookColumnMounts:new Map([['primary',{async createLocalNote(options) {
    assert.equal(options.retiredCardID,'removed'); blankPages++;
  }}]]),
  openNotebooks:()=>retained.notebooks,projectDetailMatches:(a,b)=>a.id===b.id,
  saveWorkspaceState(){},transitionWorkspace:async()=>{},syncNotebookNoteTabs(){}});
vm.runInContext(actual('retireNotebookNoteColumns'),permanent);
await permanent.retireNotebookNoteColumns(project,'removed');
assert.equal(retained.notebookColumns[0].open,true);
assert.equal(retained.notebookColumns[0].cardID,'');
assert.equal(retained.notebookColumns[0].newNote,true,'The final removed Note leaves a fresh, unsaved writing page.');
assert.equal(retained.notebooks[0],project);
assert.equal(blankPages,1,'A retained editor opens the blank page immediately instead of keeping a placeholder.');
console.log('Open notepad passed: retain a blank page after final Note removal.');

const now=new Date('2026-11-14T12:00:00');
const notes=[
 {id:'today',createdAt:'2020-01-01T12:00:00',updatedAt:'2026-11-14T12:00:00'},
 {id:'six-days',updatedAt:'2026-11-08T12:00:00'},
 {id:'seven-days',updatedAt:'2026-11-07T12:00:00'},
 {id:'thirteen-days',updatedAt:'2026-11-01T12:00:00'},
 {id:'fourteen-days',updatedAt:'2026-10-31T12:00:00'},
 {id:'twenty-nine-days',updatedAt:'2026-10-16T12:00:00'},
 {id:'thirty-days',updatedAt:'2026-10-15T12:00:00'},
 {id:'prior-year',updatedAt:'2025-11-01T12:00:00'},
 {id:'undated',updatedAt:'unavailable'},
 {id:'',column:{id:'local-draft'}}
];
const before=JSON.stringify(notes),groups=context.notebookHistoryGroups(notes,now);
assert.deepEqual(Array.from(groups,group=>group.id),['last-7-days','previous-7-days','previous-30-days','month-2026-10','year-2025','older','drafts']);
assert.deepEqual(Array.from(groups.slice(0,3),group=>Array.from(group.cards,card=>card.id)),
 [['today','six-days'],['seven-days','thirteen-days'],['fourteen-days','twenty-nine-days']]);
assert.equal(groups[0].cards[0],notes[0]);assert.equal(JSON.stringify(notes),before,'Presentation grouping preserves original Note records and creation dates.');
assert.equal(context.notebookHistoryGroups([{id:'fallback',updatedAt:'invalid',createdAt:'2026-11-10T12:00:00'}],now)[0].id,'last-7-days');
console.log('Notebook date groups passed: Assistant buckets, latest edit dates, creation fallback, day boundaries, month/year groups, undated Notes and local drafts.');
