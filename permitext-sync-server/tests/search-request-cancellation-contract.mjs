import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
const source=await readFile(new URL("../public/app.js",import.meta.url),"utf8");
function actual(name){const a=source.search(new RegExp(`(?:async )?function ${name}\\(`));const b=source.indexOf("\n}",a);assert.ok(a>=0&&b>a);return source.slice(a,b+2);}
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const requests=[],paints=[],statuses=[];let generation=1;
 const element=()=>({dataset:{},classList:{remove(){}},append(){},remove(){},addEventListener(){},querySelector(){return null;},querySelectorAll(){return[];}});
 const results=element(),panel={isConnected:true,querySelector:()=>results};
 const instance={id:"search",query:"concrete",codeFilters:[],searchEdition:"all",position:{loadedPages:1}};
 const c=vm.createContext({AbortController,Promise,Date,encodeURIComponent,crypto:{randomUUID:()=>String(Math.random())},activeWorkspaceID:"a",
 captureAccountRequest:()=>generation,isCurrentAccountRequest:g=>g===generation,
 normalizeSearchInstance:i=>i,normalizeSearchCodeFilters:f=>f,searchPositionState:i=>i.position,searchResultPageSize:25,
 document:{createElement:element},requestAnimationFrame:fn=>fn(),clear:()=>paints.push("clear"),
 updateSearchDock:(_p,_i,_n,options)=>statuses.push(options?.status||"results"),renderSearchPlaceholder:(_r,message)=>paints.push(message.title),
 renderSearchHistory:async()=>{},searchResultMatchesExactQuery:()=>true,appendSearchResultGroups:()=>paints.push("rows"),saveWorkspaceState(){},
 api(path,options){const d=defer();requests.push({...d,path,signal:options.signal});return d.promise;}
 });
 vm.runInContext(["cancelSearchPanelRequest","renderSearchResults","appendSearchLoadMore"].map(actual).join("\n"),c);
 return{c,requests,paints,statuses,panel,results,instance,switchAccount(){generation++;}};
}
for(const change of ["query","edition","prefix","account","workspace","closed","cancel"]){
 const f=fixture(),pending=f.c.renderSearchResults(f.panel,f.instance);await tick();
 if(change==="query")f.instance.query="steel";
 if(change==="edition")f.instance.searchEdition="2014";
 if(change==="prefix")f.instance.codeFilters=["BC"];
 if(change==="account")f.switchAccount();
 if(change==="workspace")f.c.activeWorkspaceID="b";
 if(change==="closed")f.panel.isConnected=false;
 if(change==="cancel")f.c.cancelSearchPanelRequest(f.panel);
 const before=f.paints.length;
 f.requests[0].reject(new Error("Delayed failure"));await pending;
 assert.equal(f.paints.length,before,change);assert.equal(f.statuses.includes("unavailable"),false,change);
 if(change==="cancel") {
  assert.equal(f.requests[0].signal.aborted,true);
  assert.equal(f.results.dataset.restoringSearch,"false","Cancel/clear must re-enable scroll persistence");
 }
}
{
 const f=fixture();const old=f.c.renderSearchResults(f.panel,f.instance);await tick();f.instance.query="steel";const next=f.c.renderSearchResults(f.panel,f.instance);await tick();
 assert.equal(f.requests[0].signal.aborted,true);
 f.requests[1].resolve({results:[{}],hasMore:true,nextOffset:25});await next;
 const before=f.paints.length;f.requests[0].resolve({results:[{}],hasMore:false});await old;assert.equal(f.paints.length,before);
 const more=f.results.searchLoadMore();await tick();assert.equal(f.requests[2].signal,f.requests[1].signal);
 f.c.cancelSearchPanelRequest(f.panel);assert.equal(f.requests[2].signal.aborted,true);
 const statusCount=f.statuses.length;f.requests[2].reject(new Error("Old page failed"));assert.equal(await more,false);assert.equal(f.statuses.length,statusCount);
}
// Real api cancellation must never enter offline fallback or update connection state.
for(const phase of ["fetch","json","fallback"]){
 const gate=defer();let offlineCalls=0,updates=0;const controller=new AbortController();
 const c=vm.createContext({serverReachable:true,fetch:()=>phase==="fetch"?gate.promise:Promise.resolve({ok:phase==="json",status:503,json:()=>gate.promise}),
 hasCapability:()=>true,shouldUseOfflineFallback:()=>true,offlineAPI:()=>{offlineCalls++;return gate.promise;},updateConnectionStatus(){updates++;}});
 vm.runInContext(actual("api"),c);const pending=c.api("/code/search",{signal:controller.signal});await tick();controller.abort();gate.resolve(phase==="fetch"?{ok:true,json:async()=>({})}:{});
 await assert.rejects(pending,{name:"AbortError"});assert.equal(updates,0);assert.equal(c.serverReachable,true);assert.equal(offlineCalls,phase==="fallback"?1:0);
}
console.log("Search cancellation passed: superseded query, edition/account/close guards, obsolete errors/load-more, physical abort signal and offline/status isolation.");
