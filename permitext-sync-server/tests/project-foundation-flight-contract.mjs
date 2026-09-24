import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const source=await readFile(new URL("../public/app.js",import.meta.url),"utf8");
const start=source.indexOf("const initialProjectFoundationReads = new Map();");
const end=source.indexOf("async function appendSavedProjectResearchConversations",start);
assert.ok(start>=0&&end>start);
let identity={userID:"a",sessionToken:"token-a",generation:1};
const requests=[];
const c=vm.createContext({
  activeWorkspaceID:"workspace-a",captureAccountRequest:()=>({...identity}),
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
assert.match(source,/foundation = hubPayload\?\.foundation \|\| await loadInitialProjectFoundation\(identity\)/);
console.log("Project foundation flights passed: initial consumer sharing, project/shared/account/workspace isolation and fresh reads after success/failure.");
