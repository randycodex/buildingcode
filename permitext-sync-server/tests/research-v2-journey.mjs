import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtemp,rm,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createResearchV2Budget} from '../research-v2-budget.mjs';

const paid=process.argv.includes('--paid'),serve=process.argv.includes('--serve'),long=process.argv.includes('--long');
if(paid&&long)throw Error('The extended 25-turn session is an offline test; paid journeys use five turns.');
const pg=process.argv.includes('--postgres')?await(await import('./research-v2-local-postgres.mjs')).startResearchV2Postgres():null;
const scratch=await mkdtemp(join(tmpdir(),'research-journey-'));
const key=paid?(process.env.OPENAI_API_KEY||execFileSync('security',['find-generic-password','-a',process.env.USER,'-s','permitext-openai-api-key','-w'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()):'offline-journey';
for(const name of Object.keys(process.env))if(/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$|BLOB_|CLERK_|STRIPE_|RESEND_|APPLE_.*(?:SECRET|KEY))/.test(name))delete process.env[name];
const ledger=paid?resolve('data/research-v2-evaluation/budget-ledger.json'):join(scratch,'offline-budget.json');
Object.assign(process.env,{NODE_ENV:'test',OPENAI_API_KEY:key,PERMITEXT_SYNC_DATA_PATH:join(scratch,'store.json'),PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(scratch,'assets'),
 PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN:'1',PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:randomUUID(),PERMITEXT_RESEARCH_V2:'1',PERMITEXT_RESEARCH_V2_BUDGET_PATH:ledger,
 PERMITEXT_RESEARCH_MODEL:'gpt-6-luna',PERMITEXT_RESEARCH_MAX_REQUEST_USD:'1',PERMITEXT_RESEARCH_USER_DAILY_CAP_USD:'7',PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD:'7',
 PERMITEXT_RESEARCH_DAILY_CAP_USD:'7',PERMITEXT_RESEARCH_MONTHLY_CAP_USD:'7',PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS:'.1',
 PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS:'.01',PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:'.5',PERMITEXT_RESEARCH_PRICING_VERSION:'luna-standard-20261027'});
if(pg)process.env.PERMITEXT_SYNC_DATABASE_URL=pg.connectionString;
const budget=createResearchV2Budget({path:ledger}),before=await budget.summary();
if(paid&&before.limitUSD-before.accountedUSD<1)throw Error('The original $7 ledger cannot reserve this five-turn test safely.');
const nativeFetch=globalThis.fetch;let providerCalls=0;
globalThis.fetch=async(url,options)=>{
 assert.equal(String(url),'https://api.openai.com/v1/responses');providerCalls++;
 const body=JSON.parse(options.body);assert.equal(body.model,'gpt-6-luna');assert.equal(body.service_tier,'default');assert.equal(body.store,false);assert(!body.tools);
 if(paid){const response=await nativeFetch(url,options),payload=await response.clone().json();
  const input=JSON.parse(body.input);let output;try{output=JSON.parse((payload.output||[]).flatMap(item=>item.content||[]).filter(item=>item.type==='output_text').map(item=>item.text).join(''));}catch{output={status:payload.status};}
  (report.providerResponses||=[]).push({phase:body.text.format.name,question:(input.evidence||input).question,output,usage:payload.usage});return response;}
 const input=JSON.parse(body.input),packet=input.evidence||input,q=packet.question||'',handrail=packet.sources.find(s=>s.title.includes('1014.2'));
 if(q.startsWith('Retention check'))assert.equal(packet.history.length,report.turns.length*2,'A long session retains every prior exchange.');
 const missingSources=handrail?[]:['BC Section 1014.2 handrail height provision.'];
 const missingFacts=/comply|withdrawn/i.test(q)?['The verified handrail height above the ramp or stair nosing.']:[];
 const draft=handrail?{answerText:`The selected general range is 34 to 38 inches.${q.includes('36 inches')?' A stated 36 inches falls within that general range.':''} Alternating tread devices and ships ladders have a distinct 30 to 34 inch range. This does not establish full project compliance. [${handrail.id}]`,claims:[{text:'The general range is 34 to 38 inches.',sourceIDs:[handrail.id]}],missingSources,missingFacts}:
  {answerText:'The current ramp-slope passage does not establish handrail height.',claims:[],missingSources,missingFacts};
 const value=body.text.format.name==='permitext_v2_review'?{pass:true,issues:[]}:draft;
 return Response.json({status:'completed',model:body.model,service_tier:'default',usage:{input_tokens:300,output_tokens:150},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
};
const report={paid,database:pg?'disposable PostgreSQL':'disposable file store',engineSHA256:createHash('sha256').update(await readFile(new URL('../research-v2-engine.mjs',import.meta.url))).digest('hex'),budgetBefore:before,steps:[],turns:[],passed:false};
let server,lastHandled=Promise.resolve(),userID,token,account;
const capability=randomUUID();
try{
 const {handleRequest,publicSearchCatalogs,createFileStoreAdapter}=await import('../app.mjs');
 server=createServer((request,response)=>{
  if(serve&&request.url===`/preview/${capability}`){response.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
   response.end(`<script>localStorage.setItem('permitext:webAccount:v1',${JSON.stringify(JSON.stringify({userID,sessionToken:token,authProvider:'web',displayName:'Research journey test',entitlement:account.entitlement}))});location.replace('/workspace?research=v2')</script>`);return;}
  lastHandled=handleRequest(request,response);return lastHandled;
 });
 const portArgument=process.argv.find(arg=>arg.startsWith('--port='));
 await new Promise(resolve=>server.listen(serve?(portArgument?Number(portArgument.slice(7)):8806):0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 async function post(path,body,status=200,bearer=token){const start=performance.now();const response=await nativeFetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(bearer?{authorization:`Bearer ${bearer}`}:{})},body:JSON.stringify({auth:{accountUserID:userID},...body})});const result=await response.json();await lastHandled;
  report.steps.push({path,status:response.status,milliseconds:Math.round(performance.now()-start)});assert.equal(response.status,status,JSON.stringify(result));return result;}
 const credential={provider:'web',providerUserID:randomUUID(),displayName:'Research journey test'};
 account=(await post('/account/sign-in',{credential})).account;
 userID=account.appUserID;token=account.backendSessionToken;
 await post('/admin/lifetime-grants/grant',{userID},200,process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
 account=(await post('/account/sign-in',{credential})).account||account;token=account.backendSessionToken;
 const catalog=(await publicSearchCatalogs()).construction,version='CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1';
 const ramp=catalog.find(s=>s.codePrefix==='BC'&&s.sectionNumber==='1012.2');assert(ramp);
 const selection=(await post('/research/selections/review',{sectionID:String(ramp.id),codeVersion:version,reviewMode:'whole_section'})).selection;
 report.startingPassage=selection;
 let conversation=(await post('/research/conversations/create',{analysisMode:'conversation_only',selections:[selection]},201)).conversation;
 const context=()=>({conversationID:conversation.id,expectedRevision:conversation.revision,expectedEvidenceSetVersion:conversation.evidenceSetVersion,researchEngine:'v2',analysisMode:'conversation_only'});
 async function ask(question){const calls=providerCalls,start=performance.now(),body={...context(),question,requestID:randomUUID()};
  const result=await post('/research/conversations/message',body);conversation=result.conversation;const answer=conversation.messages.at(-1).answer;
  assert.equal(answer.verification.pass,true);report.turns.push({question,answer,calls:providerCalls-calls,milliseconds:Math.round(performance.now()-start)});
  console.log(JSON.stringify({turn:report.turns.length,calls:providerCalls-calls,missingSources:answer.additionalEvidenceNeeded?.length,missingFacts:answer.missingFacts?.length}));return {answer,body};}
 const first=await ask('Using only the current attachment, what handrail height is required? Identify any missing source.');
 assert(first.answer.additionalEvidenceNeeded.length>0);
 const firstID=conversation.messages.at(-1).id,original=(await post('/research/answers/get',{answerID:firstID})).answer;
 const beforeDiscovery=structuredClone(conversation),gap=first.answer.additionalEvidenceNeeded[0];
 let page=await post('/research/conversations/related',{...context(),focus:gap,question:'What handrail height is required?'}),candidate;
 while(!(candidate=page.candidates.find(c=>c.codePrefix==='BC'&&c.sectionNumber==='1014.2'))&&page.nextCursor)page=await post('/research/conversations/related',{...context(),focus:gap,question:'What handrail height is required?',cursor:page.nextCursor});
 assert(candidate,'The actual missing handrail source is discoverable.');
 conversation=(await post('/research/conversations/get',{conversationID:conversation.id})).conversation;
 for(const field of ['revision','evidenceSetVersion','contextRevision','sources','messages'])assert.deepEqual(conversation[field],beforeDiscovery[field],'Discovery is read-only.');
 const reviewed=(await post('/research/selections/review',{sectionID:candidate.sectionID,codeVersion:candidate.codeVersion,reviewMode:'whole_section'})).selection;
 report.reviewedHandrailText=reviewed.selectedText;
 conversation=(await post('/research/conversations/evidence',{...context(),action:'add_related',selections:[{...reviewed,reviewedSectionHash:reviewed.sectionTextHash}]})).conversation;
 const second=await ask('Explain only the general handrail height range in the attached handrail provision. Preserve its conditions; do not declare project compliance.');
 assert.match(second.answer.answerText,/34/);assert.match(second.answer.answerText,/38/);assert.match(second.answer.answerText,/alternating|ships/i);assert.match(second.answer.answerText,/30/);
 const third=await ask('Does my handrail comply? We have provided no verified project measurements. Explain what facts remain needed.');assert(third.answer.missingFacts.length>0);
 const fourth=await ask(`Regarding the earlier handrail question:\nRequested fact: ${third.answer.missingFacts[0]}\nMy response: For this test I state that the handrail height is 36 inches. Compare 36 inches only with the selected general height range; this is not a complete compliance assessment.`);
 assert.match(fourth.answer.answerText,/36/);
 const removed=conversation.sources.find(s=>s.kind==='selection'&&s.sectionNumber==='1014.2');assert(removed);
 conversation=(await post('/research/conversations/evidence',{...context(),action:'remove',sourceID:removed.id})).conversation;
 conversation=(await post('/research/conversations/get',{conversationID:conversation.id})).conversation;
 const fifth=await ask('Correction: the earlier 36-inch measurement is withdrawn. We have no verified measurements. The handrail provision was removed from attachments. Using only current attachments, identify the sources and project facts still needed to assess handrail height.');
 assert(fifth.answer.additionalEvidenceNeeded.length>0);assert(fifth.answer.missingFacts.length>0);
 if(long)for(let index=1;index<=20;index++){
  const retained=await ask(`Retention check ${index}: identify the absent handrail source using only current attachments. No new measurements or sources have been supplied.`);
  assert(retained.answer.additionalEvidenceNeeded.length>0);
 }
 assert.deepEqual((await post('/research/answers/get',{answerID:firstID})).answer,original,'Later attachments and facts do not rewrite the first answer.');
 const callsBeforeReplay=providerCalls;await post('/research/conversations/message',fifth.body);assert.equal(providerCalls,callsBeforeReplay,'Reopening and replay cannot rebill the last answer.');
 const operations=pg?(await pg.sql`SELECT operation FROM permitext_research_operations WHERE user_id=${userID}`).map(row=>row.operation):((await createFileStoreAdapter().read()).researchOperationsByUserID[userID]||[]);
 report.operations=operations.filter(op=>op.status==='completed').map(op=>({providerCalls:op.providerRequestCount,milliseconds:op.durationMilliseconds,costUSD:op.conservativeProviderCostUSD,reviews:op.verificationAttemptDiagnostics}));
 assert.equal(report.operations.length,long?25:5);assert.equal(report.operations.reduce((sum,op)=>sum+op.providerCalls,0),providerCalls);report.passed=true;
 if(serve){console.log(JSON.stringify({preview:base+`/preview/${capability}`,paid,conversationID:conversation.id}));await new Promise(resolve=>{process.once('SIGTERM',resolve);process.once('SIGINT',resolve);});}
}finally{
 report.providerCalls=providerCalls;report.budgetAfter=await budget.summary();
 if(paid){const output=resolve('data/research-v2-evaluation/journeys');await mkdir(output,{recursive:true});const path=join(output,new Date().toISOString().replace(/[:.]/g,'-')+'.json');await writeFile(path,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({receipt:path,passed:report.passed,budget:report.budgetAfter}));}
 else console.log(JSON.stringify({passed:report.passed,paidProviderCalls:0,steps:report.steps.length,turns:report.turns.length,providerCalls}));
 globalThis.fetch=nativeFetch;if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await pg?.close();await rm(scratch,{recursive:true,force:true});
}
