import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {normalizeWorkflowView, paneBelongsToView, linkPaneToView, createWorkflowScrollStore} from '../public/workflow-views.js';
import {captureWorkspaceLayout, applyWorkspaceLayout} from '../public/workspace-state.js';
const membership=linkPaneToView({},'reader:linked','notebook');
assert.equal(paneBelongsToView('reader:linked','research',membership),false,'A new linked Reader belongs to its originating view');
assert.equal(paneBelongsToView('project:notebook:a','notebook',linkPaneToView({},'project:notebook:a','research')),true);
assert.equal(paneBelongsToView('reader:linked','notebook',membership),true);
assert.equal(paneBelongsToView('reader:other','notebook',membership),false);
assert.equal(paneBelongsToView('section:detail:one','notebook',{}, {'section:detail:one':'utility:saved:a'}),true);
const restored={};
applyWorkspaceLayout(restored,captureWorkspaceLayout({workflowView:'notebook',workflowMembership:membership,workflowScroll:{research:120,notebook:400}}));
assert.equal(restored.workflowView,'notebook');
assert.deepEqual(restored.workflowMembership,membership);
assert.deepEqual(restored.workflowScroll,{research:120,notebook:400});
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const actual=name=>{const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));assert.ok(start>=0);return source.slice(start,source.indexOf('\n}',start)+2);};
const pane=id=>({dataset:{paneId:id},scrollTop:0,scrollLeft:0,isConnected:true,querySelectorAll:()=>[],draft:'Unsaved text'});
const reader=pane('reader:one'), notebook=pane('project:notebook:a'); reader.scrollTop=1700; notebook.scrollTop=400;
const panes=[reader,notebook], state={workflowView:'research',workflowMembership:{},workflowScroll:{notebook:70}};
const track={scrollLeft:110,querySelectorAll:()=>panes};
let constructions=0, needProject=false;
const c=vm.createContext({state,track,normalizeWorkflowView,paneBelongsToView,workflowScrollStore:createWorkflowScrollStore(),
  detachedProjectWindow:false,sectionDetailAnchorsBySearch:()=>({}),paneIDForSectionDetail:id=>id,
  document:{querySelectorAll:()=>[]},notifyProjectRequiredForColumn:()=>needProject,
  captureReaderScrollPositions:()=>new Map(),restoreReaderScrollPositions(){},saveWorkspaceState(){},
  defaultActivePaneIDs:()=>panes.map(p=>p.dataset.paneId),
  appendPaneSequence(actualPanes){actualPanes.forEach((p,i)=>assert.equal(p,panes[i]));for(const p of actualPanes)p.scrollTop=0;},
  openProjectNotebook(){constructions++;},focusRecentUtilityColumn(){constructions++;}
});
vm.runInContext(['currentWorkflowView','workflowPaneAnchors','workflowPaneIsVisible','syncWorkflowNavigation','switchWorkflowView'].map(actual).join('\n'),c);
await c.switchWorkflowView('notebook'); assert.equal(track.scrollLeft,70);
notebook.scrollTop=450; track.scrollLeft=200;
await c.switchWorkflowView('research');
assert.equal(reader.scrollTop,1700); assert.equal(track.scrollLeft,110);
assert.equal(notebook.draft,'Unsaved text'); assert.equal(constructions,0);
await c.switchWorkflowView('notebook'); assert.equal(notebook.scrollTop,450); assert.equal(track.scrollLeft,200);
assert.equal(state.workflowNavigationGeneration,3,'Each actual view change invalidates pending navigation');
needProject=true; assert.equal(await c.switchWorkflowView('research'),false); assert.equal(state.workflowView,'notebook');
console.log('Workflow views passed: independent visibility, linked destinations, layout persistence, retained editors, nested scroll and project guard.');

const closed=[];
c.activeWorkspaceID='a'; c.captureAccountRequest=()=>({}); c.isCurrentAccountRequest=()=>true;
c.workspacePaneDescriptors=()=>panes.map(p=>({id:p.dataset.paneId,close:async()=>{closed.push(p.dataset.paneId);}}));
vm.runInContext(actual('closeAllColumns'),c);
await c.closeAllColumns();
assert.deepEqual(closed,['project:notebook:a'],'Close all only closes this view');
