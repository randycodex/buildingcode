const visibleReaderReveals = [];
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {readerTabs,initializeReaderTabs,addReaderTab,openRecentReaderTab,canAddReaderTab,maximumReaderTabs} from '../public/reader-tabs.js';
import {linkPaneToView} from '../public/workflow-views.js';
const source=readFileSync(new URL('../public/app.js', import.meta.url),'utf8');
const actual=name=>{const start=source.indexOf(`function ${name}(`);return source.slice(start,source.indexOf('\n}',start)+2);};
const readerLimit=source.slice(source.indexOf('const maximumReaderColumns'), source.indexOf('function newReaderState('));
const code=readerLimit+actual('activateNotebookReference')+'\n'+source.slice(source.indexOf('function reusableSearchReader('),source.indexOf('\nfunction removeSectionDetail(',source.indexOf('function reusableSearchReader(')));
let serial=0;
const state={readers:[{id:'manual',sectionID:'1'}],paneWeights:{}};
const hidden=new Set();
const navigationDependencies={workingResearchNote:()=>null,currentColumnWorkflowView:()=> 'research', resolvedReaderSourceNavigations:new WeakMap(),
  track:{dataset:{},querySelector:()=>null}, CSS:{escape:value=>value}};
const context={columnExpansionController:()=>({reveal:node=>visibleReaderReveals.push(node)}),paneIsCollapsed:()=>false,state,workflowPaneIsVisible:id=>!hidden.has(id),workspaceColumnsRequireProject:()=>false,captureAccountRequest:()=>({}),isCurrentAccountRequest:()=>true,activeWorkspaceID:"test",whenWorkspacePaneReady:async()=>true,resolveReaderSource:async x=>x,searchResultDetail:x=>x,readerFieldsForSectionDetail:(x,o)=>({...x,...o}),normalizeAnnotationBlockID:x=>x,readerMatchesSource:(r,d)=>r.sectionID===d.sectionID,readerIsClearlyAvailable:()=>false,isProAccount:()=>true,newReaderState:x=>({id:`new-${++serial}`,...x}),paneIDForReader:r=>r.id,defaultPaneWidthForID:()=>600,placePaneAfter(){},appendPaneIfMissing(){},updateBrowserSectionURL(){},scheduleContinuitySync(){},saveWorkspaceState(){},transitionWorkspace:async()=>{},revealReaderSourceTarget(){},scrollPaneIntoView(){}};
Object.assign(context,navigationDependencies);
vm.createContext(context);vm.runInContext(code,context);
const open=(sectionID,extra={})=>context.openSourceInReader({sectionID},'search-a',{sourceSurface:'search',...extra});
const first=await open('2');const second=await open('3');assert.equal(first.id,second.id);assert.equal(state.readers.length,2);assert.equal(state.readers[0].sectionID,'1');
second.searchPreviewPaneID='';const third=await open('4');assert.equal(third.id,second.id);assert.equal(second.sectionID,'4');
const explicit=await open('5',{forceNewReader:true});assert.notEqual(explicit.id,third.id);assert.equal(explicit.searchPreviewPaneID,'');
assert.equal((await open('6')).id,third.id);
const other=await context.openSourceInReader({sectionID:'7'},'search-b',{sourceSurface:'search'});assert.notEqual(other.id,third.id);
console.log('Each Search owns one Reader; unrelated Readers and explicit new Readers stay untouched.');

const manualSection = state.readers[0].sectionID;
const notebook = await context.openSourceInReader({sectionID:'1'},'notebook');
assert.notEqual(notebook.id, 'manual', 'Notebook links preserve a matching unrelated Reader');
assert.equal(state.readers[0].sectionID,manualSection);
assert.equal((await context.openSourceInReader({sectionID:'8'},'notebook')).id, notebook.id);

hidden.add(notebook.id);
const independent = await context.openSourceInReader({sectionID:'9'},'notebook');
assert.notEqual(independent.id,notebook.id,'A link cannot move a hidden Reader in another view');
assert.equal(notebook.sectionID,'8');
assert.equal(state.readers.length,6);
assert.equal((await open('still-available')).id,third.id,'An owned Reader remains available at the column limit');
state.readers.pop(); // Leave a slot for the delayed creation cases below.

// A delayed source cannot open in a different view, or reveal after switching
// away and back while its column is hydrating.
for (const delay of ['metadata', 'hydration']) {
  let finish;
  const gate = new Promise(resolve => { finish = resolve; });
  const priorCount = state.readers.length;
  const reveals = [];
  context.resolveReaderSource = delay === 'metadata' ? () => gate : async item => item;
  context.whenWorkspacePaneReady = delay === 'hydration' ? () => gate : async () => true;
  context.revealReaderSourceTarget = () => reveals.push('reveal');
  context.scrollPaneIntoView = () => reveals.push('scroll');
  const pending = open('delayed', {forceNewReader:true});
  await new Promise(resolve => setImmediate(resolve));
  state.workflowNavigationGeneration = (state.workflowNavigationGeneration || 0) + 2;
  finish(delay === 'metadata' ? {sectionID:'delayed'} : true);
  assert.equal(await pending, null);
  assert.equal(state.readers.length, priorCount + (delay === 'hydration' ? 1 : 0));
  assert.deepEqual(reveals, [], 'A stale source must not scroll or reveal in the current view');
}
console.log('Delayed source navigation remains confined to its originating view.');

assert(visibleReaderReveals.length > 0, 'Explicit source navigation reveals its destination through the shared column layout.');

// Evidence opens sources first, reuses exact sources, and retires only the
// oldest tab when Notebook reaches capacity.
{
 const kept={id:'kept',codePrefix:'BC',codeVersion:'2022',sectionID:'101',scrollPosition:{sectionID:'101',anchorOffset:-67}};
 initializeReaderTabs(kept);
 let notices=0;
 const notebookContext=vm.createContext({...context,
  state:{readers:[kept],paneWeights:{},notebookReaderHidden:true,workflowMembership:{kept:['notebook']}},
  currentColumnWorkflowView:()=> 'notebook',resolveReaderSource:async item=>item,
  whenWorkspacePaneReady:async()=>true,isCurrentAccountRequest:()=>true,
  readerTabs,addReaderTab,openRecentReaderTab,canAddReaderTab,maximumReaderTabs,linkPaneToView,
  rememberReaderTabPosition(){},retainReaderColumn(){},showWebNotice:async()=>notices++,
  workflowPaneIsVisible:()=>false});
 vm.runInContext(actual('prepareReaderSourceTab')+'\n'+code+'\nconst savedItemOpeningAttempts = new Map();\nasync '+actual('openSavedItemInReader'),notebookContext);
 const opened=await notebookContext.openSavedItemInReader({sectionID:'102',codePrefix:'BC',codeVersion:'2022'},'saved');
 assert.equal(opened,kept);assert.equal(notebookContext.state.readers.length,1);assert.equal(notebookContext.state.notebookReaderHidden,false);
 assert.equal(notebookContext.state.notebookReferenceActive,'reader','Evidence source navigation selects Reader in the shared reference slot.');
 assert.equal(readerTabs(kept).length,2);assert.equal(readerTabs(kept)[0].id,kept.activeTabID);assert.equal(kept.sectionID,'102');
 for(let index=0;index<4;index++)addReaderTab(kept,{codePrefix:'BC',codeVersion:'2022',sectionID:`${index+3}01`},`extra-${index}`);
 for(let index=0;index<8;index++){
  notebookContext.state.notebookReaderHidden=true;kept.internalSearchQuery='old Reader search';
  const before=readerTabs(kept);
  const sectionID=`new-${index}`;
  assert.equal(await notebookContext.openSavedItemInReader({sectionID,codePrefix:index%2?'PC':'BC',codeVersion:index%2?'2014':'2022'},'saved'),kept);
  assert.equal(kept.sectionID,sectionID);assert.equal(readerTabs(kept)[0].id,kept.activeTabID);assert.equal(kept.internalSearchQuery,'');
  assert.equal(readerTabs(kept).length,6);assert.equal(notebookContext.state.notebookReaderHidden,false);
  assert.equal(JSON.stringify(readerTabs(kept).slice(1)),JSON.stringify(before.slice(0,5)));
 }
 const reopen=readerTabs(kept).at(-1),prior=readerTabs(kept);
 await notebookContext.openSavedItemInReader({sectionID:reopen.sectionID,codePrefix:reopen.codePrefix,codeVersion:reopen.codeVersion},'saved');
 assert.equal(kept.activeTabID,reopen.id);assert.equal(readerTabs(kept)[0].id,reopen.id);assert.equal(readerTabs(kept).length,6);
 assert.deepEqual(readerTabs(kept).slice(1).map(tab=>tab.id),prior.filter(tab=>tab.id!==reopen.id).map(tab=>tab.id));
 assert.equal(notices,0);assert.equal(notebookContext.state.readers.length,1);
 // Reserve history synchronously even before the first Reader is hydrated.
 notebookContext.state.readers=[];notebookContext.state.workflowMembership={};
 for(const sectionID of ['initial-source','next-source'])await notebookContext.openSavedItemInReader({sectionID,codePrefix:'BC',codeVersion:'2022'},'saved');
 assert.equal(notebookContext.state.readers.length,1);
 assert.deepEqual(readerTabs(notebookContext.state.readers[0]).map(tab=>tab.sectionID),['next-source','initial-source']);
}
console.log('Notebook Evidence passed: sources open first, exact sources move first, oldest tabs retire at six, and the closed Reader reopens.');

// Exercise both Note citation paths through the real source opener. Reading a
// citation must retain the current Note and its unsaved writing in Notebook.
{
 const kept={id:'citation-reader',codePrefix:'BC',codeVersion:'2022',sectionID:'101'};
 initializeReaderTabs(kept);
 const note={id:'current-note',cardID:'authored-note',draft:'Keep this unsaved analysis'};
 const notebookState={readers:[kept],paneWeights:{},notebookReaderVisibilityVersion:1,notebookReaderHidden:true,
  notebookColumns:[note],workflowMembership:{[kept.id]:['notebook']}};
 const c=vm.createContext({...context,state:notebookState,currentColumnWorkflowView:()=> 'notebook',
  resolveReaderSource:async item=>item,whenWorkspacePaneReady:async()=>true,isCurrentAccountRequest:()=>true,
  readerTabs,addReaderTab,openRecentReaderTab,canAddReaderTab,maximumReaderTabs,linkPaneToView,
  rememberReaderTabPosition(){},retainReaderColumn(){},workflowPaneIsVisible:()=>false,
  currentContentSummary:()=>({savedItems:[{sectionID:'102',codePrefix:'BC',codeVersion:'2022'}]})});
 vm.runInContext(actual('prepareReaderSourceTab')+'\n'+code,c);
 const start=source.indexOf('async function openNotebookReference(');
 vm.runInContext(source.slice(start,source.indexOf('\n}',start)+2),c);
 for(const reference of [
  {referenceKind:'canonicalSection',referenceID:'102',label:'BC § 102'},
  {referenceKind:'selectedPassage',referenceID:'passage',evidenceLink:{source:{sectionID:'103',codePrefix:'BC',codeVersion:'2022'},passages:[{exact:'Exact source text'}]}}
 ]) {
  notebookState.notebookReaderHidden=true;
  await c.openNotebookReference({id:'project'},{},reference,()=>assert.fail('A code citation must not select another Note'),'note-pane','project');
  assert.equal(notebookState.notebookReaderHidden,false);
  assert.equal(notebookState.readers.length,1);assert.equal(notebookState.readers[0],kept);
  assert.equal(readerTabs(kept)[0].id,kept.activeTabID);
  assert.equal(notebookState.notebookColumns[0],note);assert.equal(note.draft,'Keep this unsaved analysis');
 }
 assert.equal(readerTabs(kept).length,3);
}
console.log('Notebook citations passed: canonical sections and exact passages reveal Reader while retaining the current Note and draft.');
