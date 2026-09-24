import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Execute the actual initial-hydration catch/status helper. Deferred errors
// exercise stale ownership, while the real Retry listener targets one pane.
const source=await readFile(new URL("../public/app.js",import.meta.url),"utf8");
const start=source.indexOf("async function renderProjectReportDraft(");
const end=source.indexOf("\nfunction closeProjectDetailForProject(",start);
assert.ok(start>=0&&end>start);
const renderer=source.slice(start,end);
const helper=renderer.match(/  const showStatusError = \(message\) => \{[\s\S]*?\n  \};/);
const catchStart=renderer.lastIndexOf("  } catch (error) {");
const catchEnd=renderer.lastIndexOf("\n  return panel;");
assert.ok(helper&&catchStart>0&&catchEnd>catchStart);
const catchClause=renderer.slice(catchStart,catchEnd);
assert.match(renderer,/const requestWorkspaceID = activeWorkspaceID;/);

async function check({stale=false,disposed=false,pro=false,workspaceChanged=false}={}) {
 let reject;
 const pending=new Promise((_resolve,failure)=>{reject=failure;});
 const status={hidden:true,textContent:""},panel={isConnected:false},buttons=[],refreshes=[];
 const context=vm.createContext({status,panel,pending,disposed:false,requestIdentity:1,generation:1,
  activeWorkspaceID:"workspace",requestWorkspaceID:"workspace",identity:{id:"project"},paneID:"report:project",open:true,
  shell:{append(button){buttons.push(button);}},
  document:{createElement(){return{disabled:false,addEventListener(event,fn){this[event]=fn;}};}},
  isCurrentAccountRequest(identity){return identity===context.generation;},
  projectHasOpenReportDraft(){return context.open;},
  async renderUtilityWorkspace(options){refreshes.push(options);}
 });
 vm.runInContext(helper[0],context);
 const result=vm.runInContext(`(async()=>{try{await pending;${catchClause}return panel;})()`,context);
 if(stale)context.generation++;
 context.disposed=disposed;
 if(workspaceChanged)context.activeWorkspaceID="other";
 reject(Object.assign(new Error("Synthetic request failed"),pro?{payload:{code:"PRO_REQUIRED_EXPORTS"}}:{}));
 assert.equal(await result,panel);
 if(stale||disposed||workspaceChanged){assert.deepEqual(status,{hidden:true,textContent:""});assert.equal(buttons.length,0);return;}
 assert.equal(status.hidden,false);
 assert.equal(status.textContent,pro?"Professional Project Reports are included with Permitext Pro.":"Report unavailable: Synthetic request failed");
 assert.equal(buttons.length,1);const retry=buttons[0];assert.equal(retry.textContent,"Retry Report");
 // A detached result cannot start another request before publication.
 await retry.click();assert.equal(refreshes.length,0);
 panel.isConnected=true;await retry.click();
 assert.deepEqual(JSON.parse(JSON.stringify(refreshes)),[{refreshPaneIDs:["report:project"],skipDeletedProjectCleanup:true,persist:false}],"Retry refreshes only its Report and preserves neighboring panes.");
 assert.equal(retry.disabled,false);
 for(const invalidate of [()=>{context.generation++;},()=>{context.activeWorkspaceID="other";},()=>{context.disposed=true;},()=>{context.open=false;},()=>{panel.isConnected=false;}]){
  context.generation=1;context.activeWorkspaceID="workspace";context.disposed=false;context.open=true;panel.isConnected=true;
  invalidate();await retry.click();assert.equal(refreshes.length,1,"Stale, closed, disposed or switched-workspace retry must do nothing.");
 }
 // Double click does not start parallel retries, and a rejected retry is visible/recoverable.
 context.generation=1;context.activeWorkspaceID="workspace";context.disposed=false;context.open=true;panel.isConnected=true;
 let rejectRetry;context.renderUtilityWorkspace=()=>{refreshes.push("retry");return new Promise((_resolve,failure)=>{rejectRetry=failure;});};
 const running=retry.click();await retry.click();assert.equal(refreshes.length,2);assert.equal(retry.disabled,true);
 rejectRetry(new Error("Synthetic retry failed"));await running;assert.equal(retry.disabled,false);assert.equal(status.textContent,"Report unavailable: Synthetic retry failed");
}
await check();await check({pro:true});await check({stale:true});await check({disposed:true});await check({workspaceChanged:true});await check({stale:true,disposed:true,pro:true});
console.log("Report hydration failures passed: visible errors, isolated Retry, double-click prevention, failed retry recovery, and stale/account/workspace/disposal guards.");
