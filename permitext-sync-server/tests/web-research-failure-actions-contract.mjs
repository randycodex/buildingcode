import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { researchFailureRecovery } from "../public/research-failure-recovery.js";

const source=await readFile(new URL("../public/app.js",import.meta.url),"utf8");
function extract(name) {
  const marker=source.includes(`async function ${name}(`)?`async function ${name}(`:`function ${name}(`;
  const start=source.indexOf(marker),end=source.indexOf("\n}",start);
  assert(start>=0&&end>start,name);return source.slice(start,end+2);
}
function element(){return {children:[],dataset:{},events:{},style:{setProperty(){}},setAttribute(){},append(...nodes){this.children.push(...nodes);},addEventListener(name,action){this.events[name]=action;}};}
function all(node){return [node,...node.children.flatMap(all)];}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function harness(code){
  const requests=[],opens=[],reports=[],accounts=[],draft={value:"Keep my unsent composer draft"};let generation=1,saved=true,barrier=null;
  const progress={id:"exact-request",conversationID:"owned-conversation",question:"Exact original question",status:"failed",errorCode:code,error:"PRIVATE_DIAGNOSTIC",stages:new Map(),controller:new AbortController()};
  const identity={generation:1};
  const context=vm.createContext({Map,Date,AbortController,clearInterval(){},localStorage:{},researchFailureRecovery,
    CSS:{escape:value=>value},document:{createElement:element,querySelector(selector){reports.push(selector);return saved?{click(){reports.push("opened local form");}}:null;}},
    researchProgressStages:[{id:"preparing_question",label:"Preparing the question"}],
    captureAccountRequest:()=>identity,isCurrentAccountRequest:request=>request.generation===generation,
    requireCurrentAccountRequest(request){if(request.generation!==generation)throw Error("Account changed");},
    activeResearchProgress:new Map(),captureResearchProgressView:()=>({}),researchProgressViewIsCurrent:()=>true,researchProgressConversationConflict:()=>null,
    persistResearchProgressSession(){},refreshResearchProgressCard(){},startResearchProgressTimer(){},updateResearchProgressSession(){},researchRequestRecoveryScope:()=>({}),removeResearchRequestRecovery(){},
    researchProgressStatusLabel:()=>"Research interrupted",researchProgressElapsed:()=>"00:01",renderResearchPixelGrid:element,
    researchFailureMessage:(error,question)=>researchFailureRecovery(error,question).text,hasAvailableWebResearchTurnPack:()=>false,
    supplementalResearchConversations:new Map(),researchUsage:null,
    async openResearchConversation(id){opens.push(id);if(barrier)await barrier.promise;return {id,messages:saved?[{id:"real-assistant-id",role:"assistant",requestID:progress.id}]:[]};},
    async openSupplementalResearchConversation(){throw Error("Unexpected supplemental open");},
    toggleUtilityPane:key=>accounts.push(key),
    postResearchWithProgress(body){const value={body,...deferred()};requests.push(value);return value.promise;}
  });
  vm.runInContext(["researchProgressFailureRecovery","openResearchProgressIssueReport","renderResearchProgressCard","runResearchProgressSession"].map(extract).join("\n"),context);
  progress.retry=()=>context.runResearchProgressSession(progress,{}, {retrying:true});
  return {context,progress,requests,opens,reports,accounts,draft,render:()=>context.renderResearchProgressCard(progress),missing:()=>{saved=false;},hold:()=>{barrier=deferred();return barrier;},switchAccount:()=>{generation++;}};
}
for(const code of ["RESEARCH_VERIFICATION_FAILED","INVALID_RESEARCH_VERIFICATION","INVALID_RESEARCH_RESPONSE","RESEARCH_EVIDENCE_NOT_FOUND"]){
  const test=harness(code),card=test.render(),buttons=all(card);
  assert(!buttons.some(node=>node.textContent==="Retry"));
  const recovery=test.context.researchProgressFailureRecovery(test.progress).text;
  assert(recovery.includes("“Exact original question”"));
  assert.doesNotMatch(recovery,/PRIVATE|saved|repeat|still here/i);
  const report=buttons.find(node=>node.textContent==="Report this issue");assert(report);
  await test.progress.retry();assert.equal(test.requests.length,0,"A stale retry callback cannot pay to repeat a semantic failure.");
  await report.events.click();
  assert.deepEqual(test.opens,[test.progress.conversationID]);
  assert.equal(test.requests.length,0);
  assert(test.reports[0].includes("real-assistant-id"),"The form identity comes from the actual loaded assistant record.");
  assert.equal(test.reports[1],"opened local form");
  assert.equal(test.draft.value,"Keep my unsent composer draft");
}
{
  const test=harness("INVALID_RESEARCH_VERIFICATION");test.missing();
  await all(test.render()).find(node=>node.textContent==="Report this issue").events.click();
  assert.equal(test.requests.length,0);assert.equal(test.reports.length,0,"No assistant ID means no fake answer feedback identity.");
  const support=all(test.render()).find(node=>node.textContent==="Contact support");assert(support);
  await support.events.click();assert.deepEqual(test.accounts,["settings"]);
}
{
  const test=harness("RESEARCH_VERIFICATION_FAILED"),hold=test.hold();
  const report=all(test.render()).find(node=>node.textContent==="Report this issue");
  const first=report.events.click();await report.events.click();assert.equal(test.opens.length,1,"Repeated clicks do not reopen concurrently.");
  test.switchAccount();hold.resolve();await first;
  assert.equal(test.reports.length,0,"A late old-account response cannot open another account's form.");assert.equal(test.requests.length,0);
}
for(const [error,button] of [[{errorCode:"RESEARCH_SPEND_CAP"},"Contact support"],[{errorCode:"RESEARCH_NOT_CONFIGURED"},"Contact support"],[{errorCode:"",errorStatus:401},"Open Account"],[{errorCode:"RESEARCH_ADDON_REQUIRED"},"Open Account"]]){
  const test=harness(error.errorCode);Object.assign(test.progress,error);
  assert(all(test.render()).some(node=>node.textContent===button));
  assert(!all(test.render()).some(node=>node.textContent==="Retry"));await test.progress.retry();assert.equal(test.requests.length,0);
}
{
  const test=harness("RESEARCH_INTERRUPTED");assert(all(test.render()).some(node=>node.textContent==="Retry"));
  const retry=test.progress.retry();assert.equal(test.requests.length,1);
  assert.equal(test.requests[0].body.requestID,test.progress.id);assert.equal(test.requests[0].body.question,"Exact original question");
  await test.progress.retry();assert.equal(test.requests.length,1,"Concurrent retries stay bounded.");
  test.requests[0].resolve({conversation:{id:test.progress.conversationID,messages:[]}});await retry;
}
{
  const test=harness("RESEARCH_INTERRUPTED"),retry=test.progress.retry();
  const abort=new DOMException("Cancelled","AbortError");assert.equal(abort.code,20);
  test.requests[0].reject(abort);await retry;
  assert.equal(test.progress.errorCode,"RESEARCH_CANCELLED");assert.equal(test.progress.status,"cancelled");
  assert(all(test.render()).some(node=>node.textContent==="Retry"));
}

// Execute the shipped Research transport parser. Fetch/stream interruptions are
// typed, whereas explicit semantic error frames preserve their code/reason.
async function transport(fetchImpl){
  const ctx=vm.createContext({fetch:fetchImpl,TextDecoder,Error,serverReachable:true,activeAccount:()=>({sessionToken:"fixture"}),captureAccountRequest:()=>({}),requireCurrentAccountRequest(){},researchRequestBody:value=>value,updateConnectionStatus(){}});
  vm.runInContext(extract("postResearchWithProgress"),ctx);return ctx.postResearchWithProgress({question:"Q"});
}
await assert.rejects(transport(async()=>{throw TypeError("Failed to fetch");}),{code:"RESEARCH_INTERRUPTED"});
const streamed=reader=>({status:200,headers:{get:()=>"application/x-ndjson"},body:{getReader:()=>reader}});
await assert.rejects(transport(async()=>streamed({read:async()=>{throw TypeError("Stream disconnected");}})),{code:"RESEARCH_INTERRUPTED"});
await assert.rejects(transport(async()=>streamed({read:async()=>({done:true})})),{code:"RESEARCH_INTERRUPTED"});
const encoded=new TextEncoder().encode(JSON.stringify({type:"error",error:{status:502,code:"RESEARCH_VERIFICATION_FAILED",message:"PRIVATE_DRAFT",recoveryReason:"verification_context"}})+"\n");
await assert.rejects(transport(async()=>streamed({read:async()=>({done:false,value:encoded})})),error=>error.code==="RESEARCH_VERIFICATION_FAILED"&&error.payload.recoveryReason==="verification_context");
assert(!extract("postJSON").includes("RESEARCH_INTERRUPTED"),"Unrelated POST/save failures are not classified as Research transport.");
console.log("Web failure actions passed: actual no-paid-repeat guard, real saved form identity, explicit local report opening/support fallback, account/draft/duplicate controls, same-request transport, midstream/semantic distinction and DOM cancellation; synthetic transport/DOM only.");
