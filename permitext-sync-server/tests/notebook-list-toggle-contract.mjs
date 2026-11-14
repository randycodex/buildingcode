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
let view = 'notebook', allowed = true, saves = 0, transitions = 0;
const context = vm.createContext({
  state, document:{createElement:tag => new Element(tag), querySelector:() => null},
  // Deferred panels are built before they belong to the workspace track.
  track:{querySelector:() => null}, applyPaneWeight() {},
  workspacePrivatePresentationAllowed:() => allowed, hasCapability:() => allowed,
  workspaceProject:() => project, projectDetailKey:value => value?.id || '',
  captureAccountRequest:()=>1,isCurrentAccountRequest:()=>true,activeWorkspaceID:'workspace',
  currentWorkflowView:() => view, currentColumnWorkflowView:() => view, isProAccount:() => true,
  selectedNotebookColumn:() => ({id:'editor',cardID:'a'}), notebookColumnPaneID:() => editorID,
  isProjectNotebookPaneID:id => id.startsWith('project:notebook:'),
  notebookCatalogs:new Map([['project',[{id:'a',title:'Note A'},{id:'b',title:'Note B'}]]]),
  notebookCatalogRequests:new Map(), saveWorkspaceState(){saves++;},
  notebookIndexTitleScroll:null, attachResearchHistoryTitleScroll:() => ({refresh(){}}),
  projectToolTogglePending:false, prependWorkspaceButtonIcon() {},
  async transitionWorkspace(mode){assert.equal(mode,'utility'); transitions++;}
});
vm.runInContext(['researchHistoryDayIndex','researchConversationHistoryGroups','notebookHistoryGroups',
  'notebookIndexPaneID','updateNotebookListToggle','createNotebookListToggle','renderNotebookIndex','syncNotebookLanding','toggleNotebookList','workflowPaneIsVisible'].map(actual).join('\n'), context);
const panel = context.renderNotebookIndex(project);
const localToggle = panel.querySelector('.notebook-list-toggle');
assert.equal(localToggle.attrs['aria-label'],'Hide notes list');
assert.equal(localToggle.attrs['aria-expanded'],'true');
const list = panel.querySelector('.notebook-index-body');
assert.deepEqual(list.querySelectorAll('li').map(node => node.textContent), ['Note A','Note B'], 'A newly reopened deferred panel renders existing notes before mounting.');
assert.equal(list.children[0].textContent,'New note +');
assert.equal(list.querySelector('.notebook-index-group-label').textContent,'Older','Unknown dates are not presented as recent.');
context.notebookCatalogs.get('project')[0].updatedAt=new Date().toISOString();
context.syncNotebookLanding(null,panel);
assert.equal(list.querySelector('.notebook-index-group-label').textContent,'7 days','A changed edit date refreshes grouping even when its title is unchanged.');
const indexID = context.notebookIndexPaneID(project);
await context.toggleNotebookList();
assert.equal(context.workflowPaneIsVisible(indexID), false);
assert.equal(context.workflowPaneIsVisible(editorID), true, 'Hiding the list leaves the selected note visible.');
context.updateNotebookListToggle(localToggle);
assert.equal(localToggle.attrs['aria-label'],'Show notes list');
assert.equal(localToggle.attrs['aria-expanded'],'false');
await context.toggleNotebookList();
assert.equal(context.workflowPaneIsVisible(indexID), true);
assert.equal(saves, 2); assert.equal(transitions, 2);
allowed = false;
assert.equal(await context.toggleNotebookList(), false);
allowed = true; view = 'research';
assert.equal(await context.toggleNotebookList(), false);
assert.equal(saves, 2, 'Unavailable tools and other working views cannot change list visibility.');
console.log('Notes list toggle passed: immediate deferred contents, independent editor visibility, persistence and access/view guards.');

// Notebook is a permanent writing area, including older saved layouts that
// closed it and the transition after its last active Note moves to Trash.
const retained = {notebooks:[project], notebookColumns:[{id:'primary',cardID:'removed',open:true,selected:true}]};
let reopened = 0;
let blankPages = 0;
const permanent = vm.createContext({state:retained, workspaceProject:()=>project,
  currentColumnWorkflowView:()=> 'notebook',
  notebookColumnsForProject:()=>retained.notebookColumns,
  notebookColumnPaneID:column=>column.id,
  notebookColumnMounts:new Map([['primary',{async createLocalNote(options) {
    assert.equal(options.retiredCardID,'removed'); blankPages++;
  }}]]),
  openNotebooks:()=>retained.notebooks,projectDetailMatches:(a,b)=>a.id===b.id,
  savedInstanceForPaneID:()=>({}),primarySavedPaneID:()=> 'evidence',
  projectHasOpenNotebook:()=>false,openProjectNotebook:async()=>{reopened++;},
  saveWorkspaceState(){},transitionWorkspace:async()=>{},syncNotebookNoteTabs(){}});
vm.runInContext(['prepareNotebookView','retireNotebookNoteColumns','closeProjectNotebook','closeNotebookNoteColumn'].map(actual).join('\n'),permanent);
await permanent.prepareNotebookView({openNote:false});
assert.equal(reopened,1,'Returning to Notebook restores its writing area even after a saved close.');
assert.equal(await permanent.closeProjectNotebook(project),false);
assert.equal(await permanent.closeNotebookNoteColumn(project,'primary'),false);
await permanent.retireNotebookNoteColumns(project,'removed');
assert.equal(retained.notebookColumns[0].open,true);
assert.equal(retained.notebookColumns[0].cardID,'');
assert.equal(retained.notebookColumns[0].newNote,true,'The final removed Note leaves a fresh, unsaved writing page.');
assert.equal(retained.notebooks[0],project);
assert.equal(blankPages,1,'A retained editor opens the blank page immediately instead of keeping a placeholder.');
console.log('Permanent notepad passed: reopen saved layouts, reject close actions and retain a blank page after final Note removal.');

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
