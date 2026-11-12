import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
import {emptyWorkspaceLayout, applyWorkspaceLayout} from "../public/workspace-state.js";
import {documentFixture} from "./helpers/workflow-dom.mjs";

const app = await readFile(new URL("../public/app.js",import.meta.url),"utf8");
const actual = name => { const match=app.match(new RegExp(`^(?:async )?function ${name}\\([\\s\\S]*?^}`,"m")); assert.ok(match,name); return match[0]; };
let pro=false, selected=null, projects=[], clears=0, opens=0, settings=0, choices=0, creates=0;
const document=documentFixture();
document.querySelector=()=>null;
const track=document.createElement('main');
const state={...emptyWorkspaceLayout(),readers:[{id:"legacy-reader"}],utilityInstances:[{id:"legacy-search",key:"search"}],
 utilities:{search:true,calculator:true},localSavedItems:[{id:"recoverable"}]};
const context=vm.createContext({state,document,track,isProAccount:()=>pro,readerShortcuts:null,
 detachedProjectWindow:false,detachedProject:null,activeWorkspaceID:'general',workspaceActionsButton:{},
 activeWorkspaceRecord:()=>selected,currentContentSummary:()=>({projects}),
 activeFolderRecords:values=>values.filter(p=>!p.deletedAt&&!p.archivedAt),
 mergeProjectsWithOrganizationAccess:values=>values,visibleProjectRecords:values=>values,
 projectRecordID:project=>project.id,
 clearTimeout(){},setTimeout:()=>1,emptyWorkspaceLayout,
 applyStoredWorkspaceLayout:layout=>{clears++;applyWorkspaceLayout(state,layout);},
 openProjectDetails:()=>state.projectDetails,
 openCodeQuestionPaneIDs:()=>[],supplementalResearchConversationIDs:[],
 codeQuestionWorkspaceState:()=>({}),closeCodeDecisionContext:value=>value,setCodeQuestionWorkspaceState(){},
 workspacePrivatePresentationAllowed:()=>true,visibleWorkspaceRecords:()=>projects.filter(p=>!p.deletedAt&&!p.archivedAt),
 openWorkspaceContextMenu:async()=>{choices++;},createNewWorkspace:async()=>{creates++;},
 openReaderCodePicker:()=>{opens++;},currentColumnWorkflowView:()=>"research",captureAccountRequest:()=>({}),
 paneIDForReader:reader=>`reader:${reader.id}`,
 restoreAssistantConversationOwners:()=>assert.fail('Unselected workspace must not restore Assistant owners'),
 toggleAccountDialog:()=>{settings++;},releaseSurfaceVisibility:{workboard:true},
 repeatableUtilityKeys:new Set(['search','analysis','saved'])});
vm.runInContext("let projectRequiredColumnNoticeVisible=false,projectRequiredColumnNoticeTimer=null;"+
 ["workspaceProject","workspaceColumnsRequireProject","notifyProjectRequiredForColumn","enforceProjectRequiredWorkspace",
 'openReaderFromToolbar','defaultActivePaneIDs','workspacePaneDescriptors','renderProjectRequiredWorkspace',
 'toggleUtilityPane','focusUtility','focusRecentUtilityColumn','openNewSearchColumn','openNewResearchColumn','openCalculatorColumn','openGenericWorkboard'].map(actual).join("\n"),context);

// Free reading never requires a private workspace, signed in or signed out.
for (selected of [null,{id:'general'}, {id:'project:p',projectID:'p'}]) {
 assert.equal(context.workspaceColumnsRequireProject(),false);
 assert.equal(context.notifyProjectRequiredForColumn(),false);
 assert.equal(context.enforceProjectRequiredWorkspace(),false);
}
assert.equal(clears,0);
await context.openReaderFromToolbar({});assert.equal(opens,1,'Free Reader remains public');

pro=true; selected=null;
projects=[{id:'p',name:'Existing workspace'}];
for (const workspace of [null,{id:'general'},{id:'missing',projectID:'missing'}]) {
 selected=workspace;
 assert.equal(context.workspaceColumnsRequireProject(),true,'Existing workspaces do not count as a selection');
 assert.deepEqual(Array.from(context.defaultActivePaneIDs()),[],'Restored readers and utilities cannot appear before selection');
 assert.deepEqual(Array.from(context.workspacePaneDescriptors()),[],'No column loaders run before selection');
 for (const action of ['openReaderFromToolbar','openNewSearchColumn','openNewResearchColumn','openCalculatorColumn','openGenericWorkboard']) {
  await context[action]({});
 }
 for (const key of ['search','analysis','calculator','saved','archive']) {
  assert.equal(await context.toggleUtilityPane(key),false,key);
  assert.equal(await context.focusUtility(key),false,key);
  assert.equal(await context.focusRecentUtilityColumn(key),false,key);
 }
}
assert.equal(opens,1,'Pro cannot reach the Reader picker without a selected workspace');
assert.equal(state.readers[0].id,'legacy-reader','Blocked entry points do not alter restored layouts');
assert.equal(state.utilityInstances.length,1);
await context.focusUtility('settings');assert.equal(settings,1,'Settings remains available to manage workspaces');
let prompt=context.renderProjectRequiredWorkspace();
assert.equal(prompt.querySelector('button').textContent,'Choose workspace');
let stopped=false;
prompt.querySelector('button').dispatch('click',{stopPropagation(){stopped=true;}});assert.equal(choices,1);
assert.equal(stopped,true,'The opening click cannot immediately dismiss the workspace chooser');
projects=[];prompt=context.renderProjectRequiredWorkspace();
assert.equal(prompt.querySelector('button').textContent,'add workspace');
prompt.querySelector('button').dispatch('click',{stopPropagation(){}});assert.equal(creates,1);
assert.equal(context.enforceProjectRequiredWorkspace(),true);
assert.equal(state.readers.length,0,'Unassigned columns retire when the verified shell renders');
assert.equal(state.utilityInstances.length,0);
assert.equal(state.localSavedItems[0].id,'recoverable','Account content is preserved');

projects=[{id:'p',name:'Selected workspace'}]; selected={id:'project:p',projectID:'p'};
assert.equal(context.workspaceColumnsRequireProject(),false,'The selected active workspace unlocks columns');
await context.openReaderFromToolbar({});assert.equal(opens,2);
for (const flag of ['archivedAt','deletedAt']) {
 projects=[{id:'p',[flag]:'2026-11-08'}];
 assert.equal(context.workspaceColumnsRequireProject(),true,'Unavailable workspace cannot unlock columns');
}
context.detachedProjectWindow=true;context.detachedProject={id:'p'};
assert.equal(context.workspaceColumnsRequireProject(),false,'Detached windows retain their explicitly selected workspace');
console.log('Workspace selection required: Pro entry points and restored columns blocked until selection, existing/archived/deleted workspace handling, Free Reader and Settings preserved.');
