import { createPublicCodeRevisionController, isPublicCodePath } from "../public/public-code-revision.js";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
const source=await readFile(new URL("../public/app.js",import.meta.url),"utf8");
function actual(name){const a=source.search(new RegExp(`(?:async )?function ${name}\\(`));const b=source.indexOf("\n}",a);assert.ok(a>=0&&b>a);return source.slice(a,b+2);}
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const requests=[],paints=[],statuses=[];let generation=1; let scopeToken=1; let scopeError=null;
 const element=()=>({dataset:{},classList:{remove(){}},append(){},remove(){},addEventListener(){},querySelector(){return null;},querySelectorAll(){return[];}});
 const results=element(),panel={isConnected:true,querySelector:()=>results};
 const instance={id:"search",query:"concrete",codeFilters:[],searchEdition:"all",position:{loadedPages:1}};
 const c=vm.createContext({defaultSyncCodeVersion:"2022",AbortController,Promise,Date,encodeURIComponent,crypto:{randomUUID:()=>String(Math.random())},activeWorkspaceID:"a",
 prepareSearchPanelScope:async()=>{if(scopeError)throw scopeError;return {token:scopeToken,querySuffix:"&sourceScope=scope"+scopeToken};},isCurrentActiveCodeSourceContext:token=>token===scopeToken,
 captureAccountRequest:()=>generation,isCurrentAccountRequest:g=>g===generation,
 normalizeSearchInstance:i=>i,normalizeSearchCodeFilters:f=>f,searchPositionState:i=>i.position,searchResultPageSize:25,
 document:{createElement:element},requestAnimationFrame:fn=>fn(),clear:()=>paints.push("clear"),
 updateSearchDock:(_p,_i,_n,options)=>statuses.push(options?.status||"results"),renderSearchPlaceholder:(_r,message)=>paints.push(message.title),
 renderSearchHistory:async()=>{},searchResultMatchesExactQuery:()=>true,appendSearchResultGroups:()=>paints.push("rows"),saveWorkspaceState(){},
 api(path,options){const d=defer();requests.push({...d,path,signal:options.signal});return d.promise;}
 });
 c.fetchCodeSearch=c.api;
 vm.runInContext(["normalizeSearchResultSources","applyInitialSearchGroupExpansion","cancelSearchPanelRequest","renderSearchResults","appendSearchLoadMore"].map(actual).join("\n"),c);
 return{c,requests,paints,statuses,panel,results,instance,switchAccount(){generation++;},changeScope(){scopeToken++;},failScope(){scopeError=new Error("Repair code source preferences");}};
}

{
 const f=fixture();const pending=f.c.renderSearchResults(f.panel,f.instance);await tick();
 assert.ok(f.requests[0].path.endsWith("&sourceScope=scope1"));
 f.requests[0].resolve({results:[{}],hasMore:true,nextOffset:2,nextCandidateOffset:5});await pending;
 const more=f.results.searchLoadMore();await tick();
 assert.ok(f.requests[1].path.includes("candidateOffset=5&sourceScope=scope1"));
 f.changeScope();const before=f.paints.length;
 f.requests[1].resolve({results:[{}],hasMore:false});
 assert.equal(await more,false);assert.equal(f.paints.length,before);
 assert.equal(await f.results.searchLoadMore(),false);assert.equal(f.requests.length,2);
}
{
 const f=fixture();const pending=f.c.renderSearchResults(f.panel,f.instance);await tick();
 f.changeScope();const before=f.paints.length;
 f.requests[0].resolve({results:[{}],hasMore:false});await pending;
 assert.equal(f.paints.length,before);
}
{
 const f=fixture();const first=f.c.renderSearchResults(f.panel,f.instance);await tick();
 f.instance.querySourceKeys=['building'];
 const latest=f.c.renderSearchResults(f.panel,f.instance);await tick();
 assert.equal(f.requests[0].signal.aborted,true,'An immediate source change cancels the previous search');
 const before=f.paints.length;
 f.requests[0].resolve({results:[{}],hasMore:false});await first;
 assert.equal(f.paints.length,before,'An earlier source selection cannot repaint the latest search');
 f.requests[1].resolve({results:[{}],hasMore:false});await latest;
 assert.equal(f.paints.at(-1),'rows');
}
{
 const f=fixture();f.failScope();await f.c.renderSearchResults(f.panel,f.instance);
 assert.equal(f.requests.length,0);assert.ok(f.paints.includes("Search unavailable"));
 assert.equal(f.instance.query,"concrete");assert.equal(f.instance.position.loadedPages,1);
}
console.log("Web Search active scope passed: first/page URL binding, stale first/page responses ignored, stale cursor blocked, corrupt preference never sends unrestricted API.");

// Actual app scope preparation with the real account-scoped controller.
const { createActiveCodeSourceController } = await import("../public/active-code-source-controller.js");
const { createActiveCodeSourcePreferences, codeSourceKey, codeSourceIdentity } = await import("../public/active-code-sources.js");
const sourceA = { canonicalEdition: "2022", jurisdictionID: 1, codeID: 1, categoryID: 1 };
const sourceB = { ...sourceA, canonicalEdition: "2014" };
function realFixture() {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const loads = [];
  const controller = createActiveCodeSourceController({ storage, respectSourcePreferences:false, loadCatalog() { const gate = defer(); loads.push(gate); return gate.promise; } });
  controller.setContext({ accountID: null, sessionID: "one" });
  const context = vm.createContext({ activeCodeSourcesController: controller, encodeURIComponent, codeSourceKey, codeSourceIdentity,
    accountContextChangedError: () => new Error("Account context changed") });
  vm.runInContext(["prepareActiveCodeSearchScope", "searchPanelSources", "prepareSearchPanelScope", "isCurrentActiveCodeSourceContext"].map(actual).join("\n"), context);
  return { context, controller, values, storage, loads };
}
{
  const f = realFixture();
  const result = await f.context.prepareActiveCodeSearchScope();
  assert.equal(result.querySuffix, "");
  assert.equal(f.loads.length, 0, "All-enabled requires no catalog fetch");
  assert.equal(f.context.isCurrentActiveCodeSourceContext(result.token), true);
  createActiveCodeSourcePreferences(f.storage).update(null, sourceA, false);
  f.controller.reload();
  assert.equal(f.context.isCurrentActiveCodeSourceContext(result.token), false);
  const unfiltered = await f.context.prepareActiveCodeSearchScope();
  assert.equal(f.loads.length,0,"Retired library preferences cannot narrow or delay a default Search");
  assert.equal(unfiltered.querySuffix,"");
}
{
  const f = realFixture();
  createActiveCodeSourcePreferences(f.storage).update(null, sourceA, false);
  f.controller.reload();
  const pending = f.context.prepareSearchPanelScope({querySourceKeys:[codeSourceKey(sourceA)]});
  await tick();
  f.controller.setContext({ accountID: "other", sessionID: "two" });
  f.loads[0].resolve([sourceA, sourceB]);
  await assert.rejects(pending, /context changed/);
  assert.equal((await f.context.prepareActiveCodeSearchScope()).querySuffix, "");
}
{
  const f = realFixture();
  f.values.set("permitext.active-code-sources.v1.guest", "corrupt");
  f.controller.reload();
  assert.equal((await f.context.prepareActiveCodeSearchScope()).querySuffix,"");
  assert.equal(f.loads.length, 0);
  assert.equal(f.values.get("permitext.active-code-sources.v1.guest"), "corrupt");
}
console.log("Actual app/controller scope helpers passed: all-code default, Search-only filters, pending account switch and corrupt legacy preferences ignored.");
