import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseFragment} from 'parse5';
import {createRequestRateLimit} from '../public/request-rate-limit.js';
import {createResearchV2View} from '../public/research-v2.js';
import {consumeRateLimit, createLocalRateLimitRepository, rateLimitPolicies} from '../rate-limit.mjs';
import {freezeResearchV2Turn, runResearchV2} from '../research-v2-engine.mjs';
import {researchFootnoteScopeIssues, researchTableFootnotes} from '../research-table-footnotes.mjs';
import {all, document, deferred, tick} from './helpers/research-test-dom.mjs';

Object.assign(globalThis,{document,ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>fn()});
const app = await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const actual = (start,end) => app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));

// A full hour of ordinary activity must not accumulate an hour-long lockout.
for(const path of ['notebook/cards/list','notebook/cards/save','reports/sources/list','reports/drafts/list','reports/drafts/save']) {
  const repository=createLocalRateLimitRepository(), principals=['ip:local','account:owner'];
  for(let minute=0;minute<60;minute++)for(let n=0;n<30;n++) {
    assert.equal((await consumeRateLimit({repository,path,principals,now:minute*60_000+n*1000})).allowed,true,path);
  }
  const now=3_600_000, limit=rateLimitPolicies.get(path).limit;
  for(let n=0;n<limit;n++)assert.equal((await consumeRateLimit({repository,path,principals,now})).allowed,true);
  const denied=await consumeRateLimit({repository,path,principals,now});
  assert.equal(denied.allowed,false,'Bursts are still bounded');assert.equal(denied.retryAfterSeconds,60);
  assert.equal((await consumeRateLimit({repository,path,principals,now:now+60_000})).allowed,true);
}
{
  const repository=createLocalRateLimitRepository();
  await repository.consume({scope:'notebook/cards/list',principal:'account:owner',limit:1,windowMs:3_600_000,now:0});
  assert.equal((await consumeRateLimit({repository,path:'notebook/cards/list',principals:['account:owner'],now:1000})).allowed,true,'Previous deployment hour buckets do not extend the new cooldown');
  assert.equal(rateLimitPolicies.get('reports/generate').windowMs,3_600_000,'Expensive PDF generation keeps its hourly protection');
}
{
  let now=0,calls=0;const limiter=createRequestRateLimit({now:()=>now});
  const identity={userID:'owner',generation:1,sessionToken:'secret'};
  const c=vm.createContext({requestRateLimit:limiter,JSON,Error,
    requirePrivateWorkspaceWritable(){},captureAccountRequest:()=>identity,requireCurrentAccountRequest(){},
    webSyncProtocolHeader:'protocol',webSyncProtocol:'1',webUpdateRequiredCode:'update-required',serverReachable:false,updateConnectionStatus(){},
    fetch:async()=>{calls++;return {ok:false,status:429,headers:{get:()=> '2'},json:async()=>({error:'Too many requests.'})};}});
  vm.runInContext(actual('async function postJSON(','async function deleteCapturedAccount('),c);
  await assert.rejects(c.postJSON('/notebook/cards/save',{}),error=>error.retryAfterSeconds===2&&/2 seconds/.test(error.message));
  await assert.rejects(c.postJSON('/notebook/cards/save',{}),error=>error.status===429);assert.equal(calls,1,'Retry clicks do not dispatch before Retry-After');
  identity.generation=2;await assert.rejects(c.postJSON('/notebook/cards/save',{}));assert.equal(calls,2,'Another session does not inherit a cooldown');
  now=2001;await assert.rejects(c.postJSON('/notebook/cards/save',{}));assert.equal(calls,3,'Expiry permits an explicit retry');
  now=Date.parse('2026-11-11T12:00:00Z');
  assert.equal(limiter.rejected('date','Wed, 11 Nov 2026 12:00:05 GMT').retryAfterSeconds,5);
}

function batchHarness(failAt=Infinity) {
  const cards=Array.from({length:5},(_,i)=>({id:`n${i+1}`,title:`Note ${i+1}`}));
  let attempts=0,refreshes=0,sourceRefreshes=0,trashRefreshes=0;const notices=[];
  const deleted=new Set();
  const c=vm.createContext({activeWorkspaceID:'w',state:{workflowNavigationGeneration:0,notebookColumns:[]},captureAccountRequest:()=>({userID:'owner'}),
    isCurrentAccountRequest:()=>true,projectDetailKey:()=> 'p',workspaceProject:()=>({id:'p'}),
    confirmWebWarning:async()=>true,showWebNotice:async(...args)=>notices.push(args),refreshOpenSettingsTrash:()=>trashRefreshes++,
    notebookColumnsForProject:()=>[],notebookColumnMounts:new Map(),notebookCatalogs:new Map([['p',cards]]),
    loadNotebookDraft:async()=>null,loadNotebookProjectSnapshot:async()=>null,
    deleteNotebookDraft:async()=>{},deleteNotebookCardSnapshot:async()=>{},requireCurrentAccountRequest(){},
    invalidateInitialProjectFoundation(){},saveWorkspaceState(){},syncNotebookNoteTabs(){},
    postResearch:async(path,body)=>{
      if(path==='/notebook/cards/get')return {card:{...cards.find(card=>card.id===body.cardID),version:1}};
      assert.equal(path,'/notebook/cards/delete');assert.equal(body.expectedVersion,1);assert.equal(body.recoverable,true);
      if(++attempts===failAt)throw Object.assign(Error('Try again in 5 seconds.'),{status:429});
      deleted.add(body.cardID);return {};
    },notebookMounts:new Map([['p',{refreshCards:async()=>{refreshes++;}}]]),
    reportDraftMounts:new Map([['p',{refreshSources:async()=>{sourceRefreshes++;}}]])});
  vm.runInContext(actual('async function moveClosedNotebookNoteToTrash(','function syncNotebookLanding('),c);
  return {c,cards,notices,deleted,stats:()=>({attempts,refreshes,sourceRefreshes,trashRefreshes})};
}
for(let n=0;n<5;n++) {
  const b=batchHarness();assert.equal(await b.c.mutateNotebookNotesFromMenu({id:'p'},b.cards,{trash:true}),true);
  assert.deepEqual(b.stats(),{attempts:5,refreshes:1,sourceRefreshes:1,trashRefreshes:1});assert.equal(b.notices.length,0);
  assert.equal(b.deleted.size,5);
}
{
  const b=batchHarness(4);assert.equal(await b.c.mutateNotebookNotesFromMenu({id:'p'},b.cards,{trash:true}),false);
  assert.deepEqual(b.stats(),{attempts:4,refreshes:1,sourceRefreshes:1,trashRefreshes:1});
  assert.equal(b.deleted.size,3);assert.equal(b.c.notebookCatalogs.get('p').length,2,'Only successful deletions leave the live catalog');
  assert.equal(b.notices[0][0],'3 of 5 Notes moved to Trash');assert.match(b.notices[0][1],/2 Notes remain unchanged: Note 4, Note 5.*5 seconds/);
}

// Test the real view across delayed creation, double clicks, failure and remount.
for(let n=0;n<5;n++) {
  const ready=deferred();let creates=0,draft='Keep old follow-up';
  const view=createResearchV2View({conversation:{id:'old',sources:[],messages:[]},initialDraft:draft,onDraft:text=>draft=text,
    onNew:async()=>{creates++;await ready.promise;},onSend:async()=>assert.fail('Cannot send during New chat')});
  const input=view.element.querySelector('.rv2-input'),button=view.element.querySelector('.rv2-new-chat');
  const transition=button.handlers.click();assert.equal(input.disabled,true,'Lock before the first await');
  await button.handlers.click();assert.equal(creates,1);assert.equal(button.disabled,true);
  assert.equal(view.element.querySelector('.rv2-send').disabled,true);assert.equal(draft,'Keep old follow-up');
  if(n===4)ready.reject(Error('Synthetic creation failure'));else ready.resolve();
  await transition;assert.equal(input.value,'Keep old follow-up');assert.equal(input.disabled,false);
  if(n===4)assert(all(view.element).some(node=>node.textContent.includes('Synthetic creation failure')));
  view.dispose();
  const next=createResearchV2View({conversation:{id:'new',sources:[],messages:[]},onDraft:text=>draft=text});
  const nextInput=next.element.querySelector('.rv2-input');nextInput.value='New accepted question';nextInput.handlers.input();await tick();
  assert.equal(draft,'New accepted question');assert.equal(nextInput.value,draft);next.dispose();
}

// Use the actual code passage, including its real table row markers and notes.
const prepared=JSON.parse(await readFile(new URL('../../NYC CC APP/NYCCCApp/Resources/CodeContent/authored/new-york-city/2022-construction-codes/prepared/sections/2152.json',import.meta.url),'utf8'));
const plain=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(plain).join(' ');
const text=plain(parseFragment(prepared.blocks.map(block=>block.html||'').join(' '))).replace(/\s+/g,' ').trim();
const source={id:'S1',sectionID:'2152',edition:'2022',text};
const packet=freezeResearchV2Turn({question:'Compare the Business and Reading rooms table factors and keep footnotes separate.',sources:[source]});
assert.match(packet.sources[0].tableFootnotes.find(note=>note.marker==='c').quote,/R-2/);
assert.doesNotMatch(packet.sources[0].tableFootnotes.find(note=>note.marker==='d').quote,/R-2|R-3/);
const bad={answerText:'Business has notes b and d; note d concerns a Group R-2 or R-3 rooftop or terrace and its maximum occupant load exceeding 74. [S1]',
  claims:[{text:'Note d concerns a Group R-2 rooftop.',sourceIDs:['S1']}],missingSources:[],missingFacts:[]};
assert(researchFootnoteScopeIssues(bad,packet.sources).length);
for(const answerText of ['Footnote c concerns a Group R-2 or R-3 rooftop or terrace. [S1]',
  'Footnote d is not limited to Group R-2 or R-3. [S1]',
  'Footnote c concerns Group R-2 or R-3; footnote d has a separate threshold. [S1]',
  'Does footnote d only concern Group R-2? [S1]'])assert.equal(researchFootnoteScopeIssues({answerText},packet.sources).length,0);
for(let n=0;n<5;n++) {
  const scope=['A','B','F-1','H-5','R-2'][n],marker=['b','c','d','e','f'][n];
  const notes=researchTableFootnotes(`Table 9.1 Values. a. Applies to Group ${scope}. ${marker}. Where the load exceeds 74 persons, review the certificate.`);
  assert(researchFootnoteScopeIssues({answerText:`Note ${marker} is limited to Group ${scope}. [S1]`},[{id:'S1',tableFootnotes:notes}]).length,'The guard is not hardcoded to c/d or residential groups');
}
const good={...bad,answerText:'Business uses 100 gross; Reading rooms uses 50 net. Note b permits the stated deduction. Note d requires the stated certificate when the rooftop or terrace load exceeds 74; it does not state a Group R-2/R-3 limitation. [S1]',claims:[{text:'Business uses 100 gross and Reading rooms 50 net.',sourceIDs:['S1']}]};
const payload=value=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]});
let phases=[];
const result=await runResearchV2({question:packet.question,sources:[source]},{call:async(body,{phase})=>{
  phases.push(phase);assert.match(body.instructions,/Read every labeled table footnote independently/);
  const input=JSON.parse(body.input),evidence=input.evidence||input;
  assert.equal(evidence.sources[0].tableFootnotes.length,5);
  return payload(phase==='review'?{pass:true,issues:[]}:phase==='draft'?bad:good);
}});
assert.deepEqual(phases,['draft','review','repair','review']);assert.equal(result.reviews[0].pass,false);assert.equal(result.reviews[1].pass,true);
assert.equal(result.status,'reviewed');
const rejected=await runResearchV2({question:packet.question,sources:[source]},{call:async(_body,{phase})=>payload(phase==='review'?{pass:true,issues:[]}:bad)});
assert.equal(rejected.status,'review_failed');assert(!rejected.draft.answerText.includes('Group R-2'),'Unchecked text cannot be published');
console.log('Three production workflow fixes passed: 60-minute bounded workloads, actual transport Retry-After cooldown, five-item batch/partial results, five delayed New chat transitions, and canonical table-footnote scope repair/rejection.');
