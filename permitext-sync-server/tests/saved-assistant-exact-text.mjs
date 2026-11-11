import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createResearchOperationGate} from '../public/research-operation-gate.js';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start=app.indexOf('async function startFocusedResearchFromSavedItem('),end=app.indexOf('\n}',start);
const full='The number of occupants shall be computed from the full saved paragraph. '.repeat(6)+'The final condition and exception must remain included.';
let delivered;
const c=vm.createContext({primarySavedPaneID:()=> 'saved-pane',startNewResearchFromSelection:async selection=>{delivered=selection;return selection;}});
vm.runInContext(app.slice(start,end+2),c);
await c.startFocusedResearchFromSavedItem({id:'bookmark',sectionID:'2152',savedColumnKind:'bookmark',previewText:full.slice(0,240),savedContentComparisonText:full},'project');
assert.equal(delivered.selectedText,full);assert.equal(delivered.savedItemID,'bookmark');assert.equal(delivered.projectID,'project');assert.equal(delivered.originSurface,'saved');
await c.startFocusedResearchFromSavedItem({id:'project-section',projectID:'project',sectionID:'2152',savedColumnKind:'bookmark',savedContentComparisonText:full},'project');
assert.equal(delivered.savedItemID,'','Project sections must not masquerade as account Saved item IDs');
assert.equal(delivered.selectedText,full);assert.equal(delivered.projectID,'project');
await c.startFocusedResearchFromSavedItem({sectionID:'2152',selectedText:'An explicitly selected shorter range.',savedContentComparisonText:full,previewText:'A card preview.'});
assert.equal(delivered.selectedText,'An explicitly selected shorter range.','An explicit selection must not expand to a containing paragraph');
await c.startFocusedResearchFromSavedItem({sectionID:'2152',previewText:'Exceptions:'});assert.equal(delivered.selectedText,'Exceptions:','Legacy heading-only evidence remains literal');
await assert.rejects(c.startFocusedResearchFromSavedItem({sectionID:'2152'}),/enough source text/);
const navigationState={workflowNavigationGeneration:0};let visibleView='notebook',opened='',created=0,allowSwitch=true;
const n=vm.createContext({state:navigationState,activeAccount:()=>({}),hasCapability:()=>true,currentColumnWorkflowView:()=>visibleView,
 researchOperations:createResearchOperationGate(),researchOperationScope:()=> 'owner:workspace',
 switchWorkflowView:async(view)=>{if(!allowSwitch)return false;visibleView=view;navigationState.workflowNavigationGeneration++;return true;},
 captureAccountRequest:()=>({userID:'owner'}),isCurrentAccountRequest:()=>true,activeWorkspaceID:'workspace',
 postResearch:async()=>{assert.equal(visibleView,'research');created++;return {conversation:{id:'new-chat'}};},
 researchV2Enabled:()=>false,window:{},refreshResearchConversationList:async()=>{},
 openResearchConversation:async id=>{opened=id;}});
vm.runInContext(app.slice(app.indexOf('async function startNewResearchFromSelection('),app.indexOf('async function addResearchSelectionToCurrent(')),n);
await n.startNewResearchFromSelection({sectionID:'2152',selectedText:full,projectID:'project'});
assert.equal(visibleView,'research');assert.equal(opened,'new-chat');assert.equal(created,1,'Notebook evidence reveals the Assistant before opening the new chat');
visibleView='notebook';allowSwitch=false;await n.startNewResearchFromSelection({sectionID:'2152',selectedText:full});assert.equal(created,1,'Cancelled view changes do not create a hidden chat');
console.log('Saved Evidence → Assistant: full saved passage beyond 240 characters, explicit shorter selection, legacy heading-only text, exact source ID and no-text guard passed.');
