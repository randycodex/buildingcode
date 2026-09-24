import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function actual(name){const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));const end=source.indexOf('\n}',start);assert.ok(start>=0&&end>start);return source.slice(start,end+2);}
let epoch=1,clock=0,next=0,writes=0,searches=0,history=0,cancels=0;
const timers=new Map(),stored=new Map();
const c=vm.createContext({activeWorkspaceID:'a',captureAccountRequest:()=>epoch,isCurrentAccountRequest:x=>x===epoch,setTimeout(fn,delay){const id=++next;timers.set(id,{fn,time:clock+delay});return id;},clearTimeout:id=>timers.delete(id),workspaceRestoreError:false,restoreResearchWorkspaceState(){},captureResearchWorkspaceState(){},detachedProjectWindow:false,persistCodeQuestionAccountState(){},captureColumnGroupContents(){},state:{query:''},track:{scrollLeft:0},captureWorkspaceLayout:s=>({...s}),workspaceSnapshotKey:id=>id,workspaceLayoutWithoutCodeQuestionData:x=>x,localStorage:{setItem(k,v){writes++;stored.set(k,v);}},workspaceRegistry:null,globalWorkspaceStateKeys:[],baseWorkspaceKey:'global',sessionStorage:{removeItem(){}},tabWorkspaceKey:'tab',updateConnectionStatus(){},searchTimers:new Map(),cancelSearchPanelRequest(){cancels++;},updateSearchDock(){},sectionDetailsBySearch:()=>({}),transitionWorkspace(){},renderSearchResults(){searches++;},setSearchRecentPopoverOpen(){},recordRecentSearch(){history++;}});
vm.runInContext('let pendingSearchQueryPersistence=null;\n'+['consumeSearchQueryPersistence','flushSearchQueryPersistence','scheduleSearchQueryPersistence','saveWorkspaceState','installSearchQueryInputHandlers'].map(actual).join('\n'),c);
function advance(ms){clock+=ms;for(const [id,t] of [...timers])if(t.time<=clock){timers.delete(id);t.fn();}}
const listeners={};const input={value:'',addEventListener(k,fn){listeners[k]=fn;},getAttribute:()=>null};const panel={isConnected:true};const instance=c.state;
c.installSearchQueryInputHandlers(panel,instance,input,'search:1');
for(const value of ['c','co','con','conc','concr','concre','concret','concrete']){input.value=value;listeners.input({});advance(20);}
assert.equal(writes,0,'typing does not serialize on each keystroke');advance(325);assert.equal(writes,2,'one real workspace snapshot and global write');assert.equal(JSON.parse(stored.get('a')).query,'concrete');assert.equal(searches,1);
input.value='final';listeners.input({});listeners.blur();assert.equal(writes,4);advance(400);assert.equal(writes,4,'blur consumes idle write');
input.value='durable';listeners.input({});c.saveWorkspaceState();assert.equal(writes,6);advance(400);assert.equal(writes,6,'unrelated durable save consumes pending query');
input.value='old account';listeners.input({});epoch++;advance(400);assert.equal(writes,6,'stale identity never writes into replacement account');
// Rebind for current account, then verify composition suppression and final edit.
c.installSearchQueryInputHandlers(panel,instance,input,'search:2');const beforeSearch=searches;
listeners.compositionstart();input.value='中';listeners.input({isComposing:true});listeners.keydown({key:'Enter',isComposing:true});advance(400);assert.equal(searches,beforeSearch);assert.equal(history,0);
input.value='中文';listeners.compositionend();listeners.input({isComposing:false});advance(400);assert.equal(searches,beforeSearch+1,'compositionend + final input coalesce');assert.equal(JSON.parse(stored.get('a')).query,'中文');listeners.keydown({key:'Enter'});assert.equal(history,1);
input.value='navigation';listeners.input({});c.flushSearchQueryPersistence();c.activeWorkspaceID='b';advance(400);assert.equal(JSON.parse(stored.get('a')).query,'navigation');assert.equal(stored.has('b'),false);
assert.ok(cancels>=12);
assert.match(actual('replaceActiveAccount'),/flushSearchQueryPersistence\(\)/);
assert.match(actual('switchWorkspace'),/saveWorkspaceState\(\);\s*activeWorkspaceID = workspaceID/);
assert.match(source,/addEventListener\("pagehide", flushSearchQueryPersistence\)/);
console.log('Search query persistence passed: real write counts, final snapshot, idle/blur/durable flush, account/workspace safety and IME.');
