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
