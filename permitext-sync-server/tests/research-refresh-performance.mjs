import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {writeSearchQuerySession,withoutPersistentSearchQueries} from '../public/search-query-session.js';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function actual(name){const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));assert.ok(start>=0,name);return source.slice(start,source.indexOf('\n}',start)+2);}
let owner='A',now=1000;const pending=[],published=[];
const c=vm.createContext({activeAccount:()=>({userID:owner}),captureAccountRequest:()=>owner,Date:{now:()=>now},codeQuestionContextChangedError:()=>new Error('Context changed'),load:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),publish:x=>published.push(x)});
vm.runInContext(`${actual('createResearchRefresh')}\nglobalThis.read=createResearchRefresh(load,publish);`,c);
const initial=Array.from({length:8},()=>c.read({reuseRecent:true}));
await Promise.resolve();assert.equal(pending.length,1,'Eight history columns share one request, rather than eight');
pending[0].resolve('first');await Promise.all(initial);assert.deepEqual(published,['first']);
assert.equal(await c.read({reuseRecent:true}),'first');assert.equal(pending.length,1,'Immediate remount reuses recent metadata');
const slow=c.read();await Promise.resolve();const fresh=c.read();await Promise.resolve();
pending[2].resolve('latest');await fresh;pending[1].resolve('obsolete');assert.equal(await slow,'latest');assert.deepEqual(published,['first','latest'],'A superseded response never replaces newer history');
now+=2000;const staleFailure=c.read();await Promise.resolve();const recovery=c.read();await Promise.resolve();pending[4].resolve('recovered');await recovery;pending[3].reject(Error('old failure'));assert.equal(await staleFailure,'recovered');
const oldAccount=c.read();await Promise.resolve();owner='B';pending[5].resolve('private A');await assert.rejects(oldAccount,/Context changed/);assert.ok(!published.includes('private A'));
const otherAccount=c.read({reuseRecent:true});await Promise.resolve();assert.equal(pending.length,7);pending[6].resolve('private B');await otherAccount;
const error=c.read();await Promise.resolve();pending[7].reject(Error('network'));await assert.rejects(error,/network/);const retry=c.read({reuseRecent:true});await Promise.resolve();
// Failed explicit refresh may leave a previous successful cache; let it expire to test transport retry.
if(pending.length===9){pending[8].resolve('retry');await retry;}else {assert.equal(await retry,'private B');now+=2000;const expired=c.read({reuseRecent:true});await Promise.resolve();pending[8].resolve('retry');await expired;}

const beforeMutation=c.read();await Promise.resolve();const mutationPending=pending.at(-1);
c.read.invalidate();mutationPending.resolve('before mutation');for(let i=0;i<12;i++)await Promise.resolve();
assert.notEqual(pending.at(-1),mutationPending,'Mutation invalidation causes an authoritative replacement read');
pending.at(-1).resolve('after mutation');assert.equal(await beforeMutation,'after mutation');assert.ok(!published.includes('before mutation'));

let clock=0,next=0,epoch=1,writes=0;const timers=new Map(),stored=new Map();
const d=vm.createContext({activeWorkspaceID:'one',captureAccountRequest:()=>epoch,isCurrentAccountRequest:x=>x===epoch,setTimeout(fn,delay){const id=++next;timers.set(id,{fn,time:clock+delay});return id;},clearTimeout:id=>timers.delete(id),workspaceRestoreError:false,restoreResearchWorkspaceState(){},captureResearchWorkspaceState(){},detachedProjectWindow:false,persistCodeQuestionAccountState(){},captureColumnGroupContents(){},state:{draft:''},track:{scrollLeft:0},captureWorkspaceLayout:s=>({...s}),workspaceSnapshotKey:id=>id,workspaceLayoutWithoutCodeQuestionData:x=>x,localStorage:{setItem(k,v){writes++;stored.set(k,v);}},workspaceRegistry:null,globalWorkspaceStateKeys:[],baseWorkspaceKey:'global',writeSearchQuerySession,withoutPersistentSearchQueries,sessionStorage:{setItem(){},removeItem(){}},tabWorkspaceKey:'tab',updateConnectionStatus(){}});
vm.runInContext(`let pendingSearchQueryPersistence=null,pendingResearchDraftPersistence=null;${['consumeSearchQueryPersistence','consumeResearchDraftPersistence','scheduleResearchDraftPersistence','flushResearchDraftPersistence','saveWorkspaceState'].map(actual).join('\n')}`,d);
function advance(ms){clock+=ms;for(const [id,t]of [...timers])if(t.time<=clock){timers.delete(id);t.fn();}}
for(let i=1;i<=50;i++){d.state.draft='x'.repeat(i);d.scheduleResearchDraftPersistence();advance(10);}
assert.equal(writes,0);advance(325);assert.equal(writes,2,'Fifty keystrokes produce one snapshot/global pair instead of 100 writes');assert.equal(JSON.parse(stored.get('one')).draft.length,50);
d.state.draft='blur';d.scheduleResearchDraftPersistence();d.flushResearchDraftPersistence();assert.equal(writes,4);advance(400);assert.equal(writes,4);
d.state.draft='submit';d.scheduleResearchDraftPersistence();d.saveWorkspaceState();advance(400);assert.equal(writes,6,'Explicit durable save consumes the pending timer');
d.state.draft='old';d.scheduleResearchDraftPersistence();epoch++;advance(400);assert.equal(writes,6,'A stale account cannot write');
d.state.draft='switch';d.scheduleResearchDraftPersistence();d.flushResearchDraftPersistence();d.activeWorkspaceID='two';advance(400);assert.equal(stored.has('two'),false);
assert.match(actual('replaceActiveAccount'),/flushResearchDraftPersistence\(\)/);
assert.match(source,/addEventListener\("pagehide", flushResearchDraftPersistence\)/);
assert.equal((source.match(/input\.addEventListener\("blur", flushResearchDraftPersistence\)/g)||[]).length,2);
console.log('Research performance: 8 concurrent columns -> 1 history request; 50 keystrokes -> 2 storage writes, with stale-response, account, retry, blur and durable-flush coverage.');
