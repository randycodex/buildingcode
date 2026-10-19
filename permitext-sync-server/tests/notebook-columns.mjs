import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {normalizeNotebookColumns, notebookColumnPaneID, createNotebookMountRegistry} from '../public/notebook-columns.js';
import {captureWorkspaceLayout, normalizeWorkspaceLayout} from '../public/workspace-state.js';
import {linkPaneToView} from '../public/workflow-views.js';

const project={id:'project',name:'Test Project'};
const initial=[{id:'primary',projectID:'project',cardID:'a',title:'Note A',open:true},
  {id:'second',projectID:'project',cardID:'b',title:'Note B',open:false}];
assert.equal(notebookColumnPaneID(initial[0]),'project:notebook:project');
assert.equal(notebookColumnPaneID(initial[1]),'project:notebook:project:note:second');
assert.equal(normalizeNotebookColumns([...initial,{...initial[0]},{id:'duplicate',projectID:'project',cardID:'a'}]).length,2);
assert.deepEqual(normalizeWorkspaceLayout(captureWorkspaceLayout({notebookColumns:initial})).notebookColumns,initial);

const projects=new Map(),events=[];
const registry=createNotebookMountRegistry(projects,{openCard:(...args)=>events.push(['open',...args])});
const makeMount=(id,cardID)=>({panel:{dataset:{paneId:id,projectId:'project'}},cardID,
  body:`Unsaved text ${cardID}`,scrollTop:123,activeCardID(){return this.cardID;},
  insertionTarget(){return {id:this.cardID,identity:this};},
  insertLinkedReference(id){assert.equal(id,this.cardID);events.push(['insert',id]);},
  async focusCard(id){this.cardID=id;},summary(){return {id:this.cardID,title:this.cardID};},
  persistDraft(){events.push(['persist',this.cardID]);},syncDraft(){events.push(['sync',this.cardID]);},
  confirmDiscardIfNeeded:async()=>true,dispose(){events.push(['dispose',this.cardID]);}});
const a=makeMount(notebookColumnPaneID(initial[0]),'a'),b=makeMount(notebookColumnPaneID(initial[1]),'b');
registry.register('project',a.panel.dataset.paneId,a);
const facade=projects.get('project');
registry.register('project',b.panel.dataset.paneId,b);
assert.equal(projects.get('project'),facade,'Adding a column retains the Project facade.');
registry.activate(b.panel.dataset.paneId);assert.equal(facade.insertionTarget().id,'b');
facade.insertLinkedReference('b');assert.deepEqual(events.at(-1),['insert','b']);
await facade.persistDraft();assert(events.some(event=>event[0]==='persist'&&event[1]==='a'));
assert(await facade.syncCard('a'),'Background notes sync through their own mounted editor.');
assert.equal(await facade.syncCard('missing'),false);
registry.remove(b.panel.dataset.paneId);assert.equal(facade.activeCardID(),'a');
assert.equal(a.body,'Unsaved text a');assert.equal(a.scrollTop,123);
await facade.focusCard('b');assert.deepEqual(events.at(-1),['open','project','b']);

const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function actual(name){const start=source.indexOf(`function ${name}(`);assert(start>=0,name);return source.slice(start,source.indexOf('\n}',start)+2);}
let sequence=0,workspace='workspace',account='account',requests=0;
const state={notebooks:[project],notebookColumns:structuredClone(initial),paneWeights:{},paneOrder:[a.panel.dataset.paneId]};
const catalog=new Map([['project',[{id:'a',title:'Note A'},{id:'b',title:'Note B'}]]]);
const context=vm.createContext({state,normalizeNotebookColumns,notebookColumnPaneID,linkPaneToView,
  projectDetailKey:p=>p?.id||'',projectIdentity:p=>p,workspaceProject:()=>project,
  projectHasOpenNotebook:p=>state.notebooks.some(item=>item.id===p.id),openNotebooks:()=>state.notebooks,
  captureAccountRequest:()=>account,isCurrentAccountRequest:value=>value===account,
  get activeWorkspaceID(){return workspace;},currentColumnWorkflowView:()=> 'notebook',hasCapability:()=>true,
  crypto:{randomUUID:()=>`column-${++sequence}`},defaultNotebookPaneWidth:600,
  notebookColumnMounts:registry.mounts,notebookColumnRegistry:registry,notebookMounts:projects,notebookCatalogs:catalog,
  savedPaneIDs:()=>[],placeEvidenceBeforeNotebook(){},saveWorkspaceState(){},
  placePaneAfter(anchor,id){state.paneOrder.splice(state.paneOrder.indexOf(anchor)+1,0,id);},
  async transitionWorkspace(){
    for(const column of state.notebookColumns){const id=notebookColumnPaneID(column);
      if(!column.open){registry.remove(id);continue;}
      if(!registry.mounts.has(id))registry.register('project',id,makeMount(id,column.cardID));
    }
  },whenWorkspacePaneReady:async()=>true,paneIsCollapsed:()=>false,scrollPaneIntoView:id=>events.push(['scroll',id]),syncNotebookNoteTabs(){},
  projectToolTogglePending:false,navigator:{onLine:true},emptyNotebookDocument:()=>({document:[]}),
  async postResearch(path,payload){assert.equal(path,'/notebook/cards/save');requests++;return {card:{id:`new-${requests}`,title:payload.title,document:payload.document}};},
  showWebNotice:async(...args)=>assert.fail(args.join(': '))});
vm.runInContext(['notebookColumnsForProject','notebookPaneIDsForProject','openNotebookNoteColumn','closeNotebookNoteColumn','createNotebookNoteColumn'].map(name=>(['openNotebookNoteColumn','closeNotebookNoteColumn','createNotebookNoteColumn'].includes(name)?'async ':'')+actual(name)).join('\n'),context);
await context.openNotebookNoteColumn(project,{id:'b',title:'Note B'});
assert.equal(registry.mounts.size,2);assert.equal(registry.mounts.get(a.panel.dataset.paneId),a);
assert.equal(a.body,'Unsaved text a');assert.equal(a.scrollTop,123);
await context.openNotebookNoteColumn(project,{id:'b',title:'Note B'});
assert.equal(registry.mounts.size,2,'Opening an open note focuses it without duplicating the editor.');
await context.closeNotebookNoteColumn(project,b.panel.dataset.paneId);
assert.equal(registry.mounts.size,1);assert.equal(registry.mounts.get(a.panel.dataset.paneId),a);
assert.equal(state.notebookColumns.find(item=>item.cardID==='b').open,false);
await context.createNotebookNoteColumn(project);await context.createNotebookNoteColumn(project);
assert.equal(requests,2);assert.equal(registry.mounts.size,3);
assert.deepEqual(Array.from(catalog.get('project').slice(-2),card=>card.title),['Note 1','Note 2']);
assert.equal(new Set(state.notebookColumns.filter(item=>item.open).map(notebookColumnPaneID)).size,3);
assert.equal(a.body,'Unsaved text a','Creating notes cannot replace an existing editor.');
context.navigator.onLine=false;
await context.createNotebookNoteColumn(project);
const offlineColumn=state.notebookColumns.find(item=>item.newNote);
assert(offlineColumn,'Offline creation opens a separate pending Note column.');
assert.equal(requests,2,'Offline Note creation does not require a server request.');
assert.equal(registry.mounts.size,4);
await context.createNotebookNoteColumn(project);
assert.equal(registry.mounts.size,4,'Reuse the pending offline Note without duplicating its recovery slot.');
assert.equal(registry.mounts.get(a.panel.dataset.paneId),a);
assert.equal(a.body,'Unsaved text a');
assert.equal(normalizeWorkspaceLayout(captureWorkspaceLayout(state)).notebookColumns.find(item=>item.newNote).id,offlineColumn.id);
context.navigator.onLine=true;
let finishSave; const originalSave=context.postResearch;
context.postResearch=()=>new Promise(resolve=>finishSave=resolve);
const lateCreation=context.createNotebookNoteColumn(project);
state.workflowNavigationGeneration=1;
finishSave({card:{id:'late-note',title:'Late Note'}});
await lateCreation;
assert.equal(registry.mounts.size,4,'A late create response cannot open a Note in a subsequently selected view.');
context.postResearch=originalSave;
let release; a.confirmDiscardIfNeeded=()=>new Promise(resolve=>release=resolve);
const closing=context.closeNotebookNoteColumn(project,a.panel.dataset.paneId);workspace='different';release(true);
assert.equal(await closing,false);assert.equal(state.notebookColumns[0].open,true,'A workspace switch fences a late close.');
facade.dispose();assert.equal(registry.mounts.size,0);assert.equal(projects.size,0);
console.log('Independent Notebook columns passed: persisted identities, focus/insert routing, background saves, duplicate prevention, close/reopen, separate new Notes, retained edits/scroll and workspace fencing.');

// The toolbar reflects the actual column order, including an unsaved Note.
const tabColumns=[...initial.map(column=>({...column,open:true})),
  {id:'pending',projectID:'project',cardID:'',title:'Pending Note',open:true},
  {id:'recently-saved',projectID:'project',cardID:'recent',title:'Recently saved Note',open:true}];
const tabs={children:[],replaceChildren(){this.children=[];},append(button){this.children.push(button);}};
const tabState={paneOrder:[notebookColumnPaneID(tabColumns[1]),notebookColumnPaneID(tabColumns[2]),notebookColumnPaneID(tabColumns[0])]};
const tabContext=vm.createContext({state:tabState,notebookTabs:tabs,newNotebookNoteButton:{},closedNotebookNotesButton:{},closedNotebookNoteChoices:null,notebookClosedMenu:null,
  workspacePrivatePresentationAllowed:()=>true,workspaceProject:()=>project,projectDetailKey:p=>p.id,
  notebookCatalogs:new Map([['project',[{id:'a',title:'Note A'},{id:'closed',title:'Closed Note'},{id:'b',title:'Note B'}]]]),
  notebookColumnsForProject:()=>tabColumns,notebookColumnPaneID,notebookColumnMounts:new Map(),
  hasCapability:()=>true,projectToolTogglePending:false,
  document:{createElement(){return {attrs:{},setAttribute(key,value){this.attrs[key]=value;},addEventListener(){}};}}
});
vm.runInContext(actual('syncNotebookNoteTabs'),tabContext);
tabContext.syncNotebookNoteTabs();
assert.deepEqual(tabs.children.map(button=>button.textContent),['Note B','Pending Note','Note A','Recently saved Note']);
tabState.paneOrder.reverse();
tabContext.syncNotebookNoteTabs();
assert.deepEqual(tabs.children.map(button=>button.textContent),['Note A','Pending Note','Note B','Recently saved Note'],
  'Reordering mounted columns immediately updates their toolbar buttons, with closed Notes in the overflow menu.');
assert.deepEqual(tabs.children.map(button=>button.attrs['aria-pressed']),['true','true','true','true']);
assert.deepEqual(Array.from(tabContext.closedNotebookNoteChoices.notes,card=>card.title),['Closed Note']);
tabColumns[0].open=false;tabContext.syncNotebookNoteTabs();
assert(!tabs.children.some(button=>button.textContent==='Note A'));
assert(tabContext.closedNotebookNoteChoices.notes.some(card=>card.id==='a'),'Closing a Note moves its button into the overflow menu.');
tabColumns[0].open=true;tabContext.syncNotebookNoteTabs();
assert(tabs.children.some(button=>button.textContent==='Note A'));
assert(!tabContext.closedNotebookNoteChoices.notes.some(card=>card.id==='a'),'Reopening a Note removes it from the overflow menu.');

let view='notebook',evidenceID='evidence',visible=true;
const pinState={pinnedPaneID:'reader:research'};
const pinContext=vm.createContext({state:pinState,isProAccount:()=>true,currentColumnWorkflowView:()=>view,
  primarySavedPaneID:()=>evidenceID,workflowPaneIsVisible:()=>visible,savedEvidenceColumnGroup:()=>[]});
vm.runInContext(actual('activePinnedPaneID'),pinContext);
assert.equal(pinContext.activePinnedPaneID(),'evidence','Open Notebook Evidence is automatically pinned.');
assert.equal(pinState.pinnedPaneID,'reader:research','The automatic Evidence pin preserves the separate Research preference.');
evidenceID='';assert.equal(pinContext.activePinnedPaneID(),'','Closing Evidence releases the fixed column.');
evidenceID='evidence';visible=false;assert.equal(pinContext.activePinnedPaneID(),'','A hidden Evidence column cannot cover another view.');
visible=true;view='research';assert.equal(pinContext.activePinnedPaneID(),'reader:research');
view='report';assert.equal(pinContext.activePinnedPaneID(),'');
view='notebook';
pinContext.activePaneIDs=()=>['evidence','note:a','note:b'];
pinContext.paneGroupForMove=id=>[id];
pinContext.openCodeQuestionPaneIDs=()=>[];
pinContext.orderWithPaneMoved=()=>['evidence','note:b','note:a'];
vm.runInContext(actual('orderWithPaneStepped'),pinContext);
assert.equal(pinContext.orderWithPaneStepped('evidence',1),null,'Evidence cannot be moved away from the fixed left edge.');
assert.equal(pinContext.orderWithPaneStepped('note:a',-1),null,'Notes cannot move before fixed Evidence.');
assert.deepEqual(Array.from(pinContext.orderWithPaneStepped('note:b',-1)),['evidence','note:b','note:a']);
console.log('Notebook layout passed: Evidence auto-pin, closed/hidden release, retained Research preference and Note buttons in live column order.');

// Closed-note deletion is recoverable and fenced against navigation or local drafts.
for (const mode of ['saved','cancel','navigate','pending-draft']) {
  let workspaceID='workspace';const requests=[],notices=[];
  const closedProject={id:'project'},closedCard={id:'closed',title:'Closed Note'};
  const closedState={workflowNavigationGeneration:0,notebookColumns:[{id:'closed-column',projectID:'project',cardID:'closed',open:false},{id:'other-column',projectID:'other',cardID:'other',open:false}]};
  const catalog=new Map([['project',[closedCard,{id:'keep',title:'Retained Note'}]]]);
  const t=vm.createContext({state:closedState,notebookCatalogs:catalog,notebookMounts:new Map(),reportDraftMounts:new Map(),
    captureAccountRequest:()=>({userID:'owner'}),isCurrentAccountRequest:()=>true,get activeWorkspaceID(){return workspaceID;},
    projectDetailKey:p=>p?.id||'',workspaceProject:()=>closedProject,notebookColumnsForProject:()=>closedState.notebookColumns,
    loadNotebookDraft:async()=>mode==='pending-draft'?{document:{}}:null,
    async postResearch(path,body){requests.push({path,body});return path.endsWith('/get')?{card:{...closedCard,version:7}}:{};},
    async confirmWebWarning(){if(mode==='navigate')workspaceID='other';return mode!=='cancel';},
    requireCurrentAccountRequest(){},deleteNotebookDraft:async()=>{},deleteNotebookCardSnapshot:async()=>{},loadNotebookProjectSnapshot:async()=>null,
    invalidateInitialProjectFoundation(){},saveWorkspaceState(){},syncNotebookNoteTabs(){},showWebNotice:async(...args)=>notices.push(args)});
  vm.runInContext('async '+actual('moveClosedNotebookNoteToTrash'),t);
  await t.moveClosedNotebookNoteToTrash(closedProject,closedCard);
  const deletion=requests.find(item=>item.path.endsWith('/delete'));
  if(mode==='saved'){
    assert.equal(deletion.body.recoverable,true);assert.equal(deletion.body.expectedVersion,7);
    assert.equal(closedState.notebookColumns.length,1);assert.equal(closedState.notebookColumns[0].projectID,'other');
    assert.deepEqual(catalog.get('project').map(card=>card.id),['keep']);
  } else assert(!deletion,`${mode} cannot delete a Note.`);
  if(mode==='pending-draft')assert.match(notices[0][1],/draft is preserved/);
}
console.log('Closed-note Trash action passed: current version, recoverable deletion, preserved other Notes, cancelled/stale navigation and pending-draft rejection.');
