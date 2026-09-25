import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function actual(name){const a=source.search(new RegExp(`(?:async )?function ${name}\\(`));return source.slice(a,source.indexOf('\n}',a)+2);}
function fixture(count){
 const messages=[],buttons=[];let requests=0,dialogs=0,current=true;
 const results={dataset:{},classList:{remove(){}},append(button){buttons.push(button);},querySelector(){return null;}};
 const panel={isConnected:true,querySelector:()=>results};
 const instance={query:'concrete',codeFilters:[],searchEdition:'all'};
 const context={AbortController,encodeURIComponent,crypto:{randomUUID:()=> 'token'},activeWorkspaceID:'workspace',
 captureAccountRequest:()=> 'account',isCurrentAccountRequest:()=>true,normalizeSearchInstance:i=>i,normalizeSearchCodeFilters:i=>i,
 searchPositionState:()=>({}),searchResultPageSize:25,isCurrentActiveCodeSourceContext:()=>current,
 prepareActiveCodeSearchScope:async()=>({token:{},querySuffix:'&sourceScope=scoped',enabledSourceCount:count}),
 updateSearchDock(){},renderSearchPlaceholder:(_results,message)=>messages.push(message),clear(){},searchResultMatchesExactQuery:()=>true,
 document:{createElement:()=>({addEventListener(_event,callback){this.click=callback;}})},openActiveCodeSourceSettings(){dialogs++;},
 api:async()=>{requests++;return {results:[],hasMore:false};}};
 vm.createContext(context);vm.runInContext(actual('cancelSearchPanelRequest')+'\n'+actual('renderSearchResults'),context);
 return {context,panel,instance,results,messages,buttons,requests:()=>requests,dialogs:()=>dialogs,stale(){current=false;}};
}
{
 const f=fixture(0);await f.context.renderSearchResults(f.panel,f.instance);
 assert.equal(f.requests(),0);assert.equal(f.messages.at(-1).title,'All code sources are off');
 assert.equal(f.instance.query,'concrete');assert.equal(f.results.dataset.restoringSearch,'false');assert.equal(f.results.dataset.searchHasMore,'false');
 assert.equal(f.buttons[0].textContent,'Manage code sources');f.buttons[0].click();assert.equal(f.dialogs(),1);
 f.stale();f.buttons[0].click();assert.equal(f.dialogs(),1);
}
{
 const f=fixture(1);await f.context.renderSearchResults(f.panel,f.instance);
 assert.equal(f.requests(),1);assert.match(f.messages.at(-1).body,/your enabled code sources/);assert.doesNotMatch(f.messages.at(-1).body,/all codes/);
}
{
 const f=fixture(0);let resolve;f.context.prepareActiveCodeSearchScope=()=>new Promise(r=>resolve=r);
 const pending=f.context.renderSearchResults(f.panel,f.instance);f.stale();resolve({token:{},querySuffix:'scope',enabledSourceCount:0});await pending;
 assert.equal(f.requests(),0);assert.equal(f.buttons.length,0);assert.equal(f.messages.at(-1).title,'Searching');
}
console.log('PASS Search all-off: no request, query preserved, guarded Manage action, scoped empty wording, stale load suppression');
