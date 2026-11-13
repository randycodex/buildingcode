const visibleReaderReveals = [];
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {readerTabs,initializeReaderTabs,addReaderTab,canAddReaderTab,maximumReaderTabs} from '../public/reader-tabs.js';
import {linkPaneToView} from '../public/workflow-views.js';
const source=readFileSync(new URL('../public/app.js', import.meta.url),'utf8');
const code=source.slice(source.indexOf('function reusableSearchReader('),source.indexOf('\nfunction removeSectionDetail(',source.indexOf('function reusableSearchReader(')));
let serial=0;
const state={readers:[{id:'manual',sectionID:'1'}],paneWeights:{}};
const hidden=new Set();
const navigationDependencies={currentColumnWorkflowView:()=> 'research', resolvedReaderSourceNavigations:new WeakMap(),
  track:{querySelector:()=>null}, CSS:{escape:value=>value}};
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

// A hidden Notebook Reader still owns its six reading sessions. Evidence can
// reveal it and add a tab, but must never create a second Notebook column.
{
 const kept={id:'kept',codePrefix:'BC',codeVersion:'2022',sectionID:'101',scrollPosition:{sectionID:'101',anchorOffset:-67}};
 initializeReaderTabs(kept);
 const original=JSON.stringify(readerTabs(kept)[0]);let notices=0;
 const notebookContext=vm.createContext({...context,
  state:{readers:[kept],paneWeights:{},notebookReaderHidden:true,workflowMembership:{kept:['notebook']}},
  currentColumnWorkflowView:()=> 'notebook',resolveReaderSource:async item=>item,
  whenWorkspacePaneReady:async()=>true,isCurrentAccountRequest:()=>true,
  readerTabs,addReaderTab,canAddReaderTab,maximumReaderTabs,linkPaneToView,
  rememberReaderTabPosition(){},retainReaderColumn(){},showWebNotice:async()=>notices++,
  workflowPaneIsVisible:()=>false});
 vm.runInContext(code,notebookContext);
 const opened=await notebookContext.openSourceInReader({sectionID:'102',codePrefix:'BC',codeVersion:'2022'},'saved',{sourceSurface:'saved',forceNewReader:true});
 assert.equal(opened,kept);assert.equal(notebookContext.state.readers.length,1);assert.equal(notebookContext.state.notebookReaderHidden,false);
 assert.equal(readerTabs(kept).length,2);assert.equal(JSON.stringify(readerTabs(kept)[0]),original);
 for(let index=0;index<4;index++)addReaderTab(kept,{codePrefix:'BC',codeVersion:'2022',sectionID:`${index+3}01`},`extra-${index}`);
 notebookContext.state.notebookReaderHidden=true;const before=JSON.stringify(kept);
 assert.equal(await notebookContext.openSourceInReader({sectionID:'999'},'saved',{sourceSurface:'saved',forceNewReader:true}),null);
 assert.equal(notices,1);assert.equal(notebookContext.state.readers.length,1);assert.equal(notebookContext.state.notebookReaderHidden,true);assert.equal(JSON.stringify(kept),before);
}
console.log('Hidden Notebook Reader passed: Evidence reopens the retained column, preserves prior tabs, and respects its six-tab limit.');
