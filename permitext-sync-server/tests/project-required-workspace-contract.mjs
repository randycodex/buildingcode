import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
const app = await readFile(new URL("../public/app.js",import.meta.url),"utf8");
const actual = name => { const match=app.match(new RegExp(`^(?:async )?function ${name}\\([\\s\\S]*?^}`,"m")); assert.ok(match,name); return match[0]; };
let account=null, projects=[], clears=0, opens=0;
const state={readers:[{id:"reader"}],utilities:{search:true},localSavedItems:[{id:"recoverable"}]};
const context=vm.createContext({state,activeAccount:()=>account,hasCapability:()=>Boolean(account),
 syncedContent:{userID:"owner",workspacePresentationAccess:"verified",get summary(){return {projects};}},
 clearTimeout(){},applyStoredWorkspaceLayout(){clears++;},activeAccountRequest:null});
vm.runInContext("let projectRequiredColumnNoticeVisible=false,projectRequiredColumnNoticeTimer=null;"+
 ["workspaceColumnsRequireProject","notifyProjectRequiredForColumn","enforceProjectRequiredWorkspace"].map(actual).join("\n"),context);
for(account of [null,{userID:"owner"}]) for(projects of [[],[{id:"reference",folderType:"reference"}],[{id:"project",archivedAt:"2026-10-10"}]]) {
 assert.equal(context.workspaceColumnsRequireProject(),false,"Public reading stays available without an active Project");
 assert.equal(context.notifyProjectRequiredForColumn(),false);
 assert.equal(context.enforceProjectRequiredWorkspace(),false);
}
assert.equal(clears,0,"Lack of a Project does not discard a reader or search layout");
assert.equal(state.readers[0].id,"reader");
assert.equal(state.localSavedItems[0].id,"recoverable");
// The actual Reader toolbar still delegates to the established public picker.
context.openReaderCodePicker=async()=>{opens++;};
context.currentColumnWorkflowView=()=>"research";
context.captureAccountRequest=()=>({});
context.activeWorkspaceID="public";
context.isProAccount=()=>Boolean(account);
vm.runInContext(actual("openReaderFromToolbar"),context);
await context.openReaderFromToolbar({dataset:{},getAttribute:()=>null});
assert.equal(opens,1);
console.log("Project-free reading passed: anonymous/Pro/empty/archived workspaces retain readers and use the public Reader picker.");
