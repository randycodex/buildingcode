import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const source=await readFile(new URL("../public/app.js",import.meta.url),"utf8");
const start=source.indexOf("const initialProjectFoundationScopes = new Set();");
const end=source.indexOf("async function appendSavedProjectResearchConversations",start);
assert.ok(start>=0&&end>start);
let identity={userID:"a",sessionToken:"token-a",generation:1};
const requests=[];
const c=vm.createContext({
  activeWorkspaceID:"workspace-a",captureAccountRequest:()=>({...identity}),
  isCurrentAccountRequest:request=>JSON.stringify(request)===JSON.stringify(identity),
  requireCurrentAccountRequest(request){if(JSON.stringify(request)!==JSON.stringify(identity))throw new Error("Account changed");},
  accountContextChangedError:()=>new Error("Workspace changed"),projectDetailKey:project=>project.id,
  postResearch(path,body){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});requests.push({path,body,resolve,reject});return promise;}
});
vm.runInContext(source.slice(start,end),c);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const a=c.loadInitialProjectFoundation({id:"p"});
const b=c.loadInitialProjectFoundation({id:"p"});
assert.equal(a,b);await tick();assert.equal(requests.length,1);
requests[0].resolve({id:"foundation"});assert.equal((await a).id,"foundation");await b;
const fresh=c.loadInitialProjectFoundation({id:"p"});await tick();assert.equal(requests.length,2);
requests[1].reject(new Error("Network failed"));await assert.rejects(fresh,/Network failed/);
const retry=c.loadInitialProjectFoundation({id:"p"});
const other=c.loadInitialProjectFoundation({id:"other"});
const shared=c.loadInitialProjectFoundation({id:"p",sharedOrganizationID:"firm"});
await tick();assert.equal(requests.length,5);
requests[2].resolve({id:"retry"});requests[3].resolve({id:"other"});requests[4].resolve({project:{id:"shared"}});
assert.equal((await shared).id,"shared");await Promise.all([retry,other]);
const stale=c.loadInitialProjectFoundation({id:"p"});const staleCheck=assert.rejects(stale,/Account changed/);await tick();
identity={userID:"b",sessionToken:"token-b",generation:2};
const next=c.loadInitialProjectFoundation({id:"p"});await tick();assert.equal(requests.length,7);
requests[5].resolve({id:"old-private"});requests[6].resolve({id:"new-private"});await staleCheck;assert.equal((await next).id,"new-private");
const beforeSwitch=c.loadInitialProjectFoundation({id:"p"});const cancelled=assert.rejects(beforeSwitch,/Workspace changed/);await tick();
c.activeWorkspaceID="workspace-b";const afterSwitch=c.loadInitialProjectFoundation({id:"p"});await tick();assert.equal(requests.length,9);
requests[7].resolve({});requests[8].resolve({});await cancelled;await afterSwitch;
assert.match(source,/loadInitialProjectFoundation\(identity\),\s*notebookRequest\("\/notebook\/cards\/list"/);
assert.match(source,/foundation = hubPayload\?\.foundation \|\| await \(options.foundationScope/);
console.log("Project foundation flights passed: initial consumer sharing, project/shared/account/workspace isolation and fresh reads after success/failure.");
const scope=c.createInitialProjectFoundationScope();scope.register("notebook");scope.register("saved");
const count=requests.length;
const note=scope.read({id:"scoped"});await tick();requests[count].resolve({id:"initial"});await note;scope.release("notebook");
assert.equal((await scope.read({id:"scoped"})).id,"initial");assert.equal(requests.length,count+1);
c.invalidateInitialProjectFoundation("scoped");
const refreshed=scope.read({id:"scoped"});await tick();requests[count+1].resolve({id:"mutated"});assert.equal((await refreshed).id,"mutated");
scope.release("saved");
assert.equal(vm.runInContext("initialProjectFoundationScopes.size",c),0,"Final consumer releases scope storage");
const reopened=c.createInitialProjectFoundationScope();reopened.register("saved");
const again=reopened.read({id:"scoped"});await tick();requests[count+2].resolve({id:"reopened"});await again;reopened.release("saved");
const cancelledScope=c.createInitialProjectFoundationScope();cancelledScope.register("never-mounted");cancelledScope.release("never-mounted");
assert.equal(vm.runInContext("initialProjectFoundationScopes.size",c),0,"Canceled consumer leaves no retained scope");
console.log("Project foundation scoped sharing passed: non-overlapping initial reads, mutation invalidation, fresh reopen and lease cleanup.");
const pendingScope=c.createInitialProjectFoundationScope();pendingScope.register("saved");
const beforeMutation=requests.length;
const oldFlight=pendingScope.read({id:"pending-mutation"});await tick();
c.invalidateInitialProjectFoundation("pending-mutation");
const newFlight=pendingScope.read({id:"pending-mutation"});await tick();
assert.equal(requests.length,beforeMutation+2,"Post-mutation read cannot join pre-mutation in-flight request");
requests[beforeMutation].resolve({id:"old"});requests[beforeMutation+1].resolve({id:"new"});
await oldFlight;assert.equal((await newFlight).id,"new");
const cached=pendingScope.read({id:"pending-mutation"});
const cachedRejected=assert.rejects(cached,/Workspace changed/);
c.activeWorkspaceID="workspace-c";
await cachedRejected;
pendingScope.release("saved");
assert.equal(vm.runInContext("initialProjectFoundationScopes.size",c),0);
console.log("Project foundation invalidation passed: pending-flight mutation boundary and cached-result identity recheck.");
