import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
const source=await readFile(new URL("../public/app.js",import.meta.url),"utf8");
const start=source.indexOf("async function deleteSavedEvidenceBatch(");
const actual=source.slice(start,source.indexOf("\n}",start)+2);
let identity="a", requests=[], pulls=0, mode="ok";
const context=vm.createContext({
  requirePrivateWorkspaceWritable(){},captureAccountRequest:()=>identity,
  requireCurrentAccountRequest:previous=>{if(previous!==identity)throw Error("Account changed");},
  activeAccount:()=>({userID:"a",sessionToken:"synthetic"}),
  flushSyncOutbox:async()=>{},state:{syncOutbox:[],syncConflicts:[]},
  syncProjectIdentity:value=>value,syncCodeVersion:value=>value,normalizeAnnotationBlockID:value=>value||"",
  syncedContent:{mutations:[],latestEventID:12},
  postJSON:async(path,body)=>{
    requests.push({path,body});
    if(mode==="failure")throw Error("Offline");
    if(mode==="switch")identity="b";
    return {deletedCount:body.items.length,mutations:[],latestEventID:99};
  },mergeSyncedMutations:(a,b)=>[...a,...b],summarizeMutations:()=>({}),
  saveWorkspaceState(){},loadSyncedContent:async()=>{pulls++;},
  Date
});
vm.runInContext(actual,context);
const items=Array.from({length:401},(_,i)=>({sectionID:i+1,codeVersion:"2022",blockID:"p"}));
assert.equal(await context.deleteSavedEvidenceBatch(items,{clientID:"p"}),401);
assert.deepEqual(requests.map(r=>r.body.items.length),[200,200,1]);
assert(requests.every(r=>r.path==="/saved/evidence/delete-batch"&&r.body.projectID==="p"));
assert.equal(pulls,1);assert.equal(context.syncedContent.latestEventID,12,"Do not skip unrelated sync changes");
context.state.syncOutbox=[{accountUserID:"a"}];requests=[];
await assert.rejects(context.deleteSavedEvidenceBatch(items),/Finish syncing/);assert.equal(requests.length,0);
context.state.syncOutbox=[];mode="failure";
await assert.rejects(context.deleteSavedEvidenceBatch(items),/Offline/);
mode="switch";
await assert.rejects(context.deleteSavedEvidenceBatch(items),/Account changed/);
console.log("Web batch deletion passed: bounded requests, one reconciliation, outbox barrier, failure and account fencing.");
