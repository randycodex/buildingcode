// Synthetic provider outputs exercise actual HTTP, validation, spend accounting
// and persistence. No legal acceptance or real provider quality is asserted.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const scratch=await mkdtemp(join(tmpdir(),'permitext-open-recovery-'));
for(const key of Object.keys(process.env)) if(/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key)) delete process.env[key];
Object.assign(process.env,JSON.parse(await readFile(new URL('../config/research-open-investigation.json',import.meta.url))),{
 NODE_ENV:'',OPENAI_API_KEY:'offline-provider-double',PERMITEXT_RESEARCH_SEMANTIC_SEARCH:'0',PERMITEXT_RESEARCH_WEB_SUPPORT:'0',
 PERMITEXT_SYNC_DATA_PATH:join(scratch,'store.json'),PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(scratch,'assets'),
 PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN:'1',PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:randomUUID(),PERMITEXT_EVIDENCE_DISCOVERY_BETA:'1',
 PERMITEXT_RESEARCH_USER_DAILY_CAP_USD:'5',PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD:'5',
 PERMITEXT_RESEARCH_DAILY_CAP_USD:'5',PERMITEXT_RESEARCH_MONTHLY_CAP_USD:'5'});
const nativeFetch=globalThis.fetch;
let scenario,calls,counts,doubleError;
const finding='Synthetic finding: correct the identification wording and preserve its exception.';
globalThis.fetch=async(url,options)=>{
 try {
  assert.equal(String(url),'https://api.openai.com/v1/responses');
  const body=JSON.parse(options.body),phase=body.text.format.name;
  assert.equal(body.model,'gpt-6-luna');assert.equal(body.store,false);
  calls.push(phase);const count=counts[phase]=(counts[phase]||0)+1;
  let value,status='completed';
  if(phase==='permitext_research_investigation'){
   assert.equal(body.service_tier,'default');
   if(scenario==='empty-gap') {
    const input=JSON.parse(body.input);assert.deepEqual(input.sources,[]);
    assert(input.corpusPlan.unavailable.some(corpus=>corpus.id==='nyc-2016-energy-code'));
   }
   value=scenario==='investigation-format'&&count===1 ? {ready:true} : {ready:true,queries:[],retainSourceIDs:[],reason:'Synthetic rule present.'};
  }else if(phase==='permitext_code_interpretation'){
   const match=[...body.input.matchAll(/PASSAGE_ID: ([^\n]+)\nSECTION_ID: ([^\n]+)\nCODE: MC\nSECTION: ([^\n]+)/g)].find(m=>m[3]==='304.12');
   if(!['empty-gap','energy-local-lookup','energy-thermal-referral'].includes(scenario))assert(match);
   const text='The identification must identify the area served, subject to the stated room-only exception.';
   value={answerText:text,supportedPoints:match?[{heading:'Identification',explanation:text,sectionID:match[2],sourceIDs:[match[1]]}]:[],
    citations:match?[{sectionID:match[2],sourceIDs:[match[1]],relevance:'Identification rule.'}]:[],
    assumptions:[],missingFacts:[],followUpQuestions:[],evidenceLimitations:[],additionalEvidenceNeeded:[],supportingSourceUses:[]};
   if(count>1){
    assert.equal(body.service_tier,'default');assert.equal(body.reasoning.effort,'high');
    assert(body.input.includes(finding),'The complete reviewer finding reaches the repair');
    if(scenario==='repair-format'&&count===2)value.supportedPoints[0].sourceIDs=['invented-passage'];
    if(scenario==='repair-format'&&count===3){assert(body.input.includes('structuredResponseFailure'));assert(body.input.includes('INVALID_RESEARCH_CITATION'));assert(body.input.includes('invented-passage'));}
    if(['citation-rescue','citation-content-change','terminal-citation'].includes(scenario)&&count===4){
     assert(body.instructions.includes('This is a citation-only correction.'));
     assert(body.input.includes('previousInterpretation'));
     if(scenario==='citation-content-change')value.answerText='Changed substantive conclusion.';
    }
   }
   if(['gap','empty-gap','rejected-gap'].includes(scenario))value={...value,
    answerText:scenario==='rejected-gap'?'Synthetic unsupported permission.':'The supplied text does not establish the requested rule.',
    supportedPoints:[],citations:[],evidenceLimitations:['The controlling source is missing.'],additionalEvidenceNeeded:['The specific operative rule.']};
   if(scenario==='energy-local-lookup'){
    if(count===1){
     assert(!body.input.includes('R403.7 Equipment sizing and efficiency rating.'));
     value={...value,answerText:'ECC R403.7 is not supplied.',supportedPoints:[],citations:[],
      evidenceLimitations:['ECC R403.7 is not supplied.'],additionalEvidenceNeeded:['ECC R403.7']};
    }else{
     const added=[...body.input.matchAll(/PASSAGE_ID: ([^\n]+-gap-R403\.7)\nSECTION_ID: ([^\n]+)\nCODE: ECC\nSECTION: R403\n/g)][0];
     assert(added,'The newly resolved exact source reaches the substantive repair.');
     const text='ECC R403.7 requires ACCA Manual S sizing based on ACCA Manual J loads or other approved calculation methodologies.';
     value={...value,answerText:text,supportedPoints:[{heading:'Sizing',explanation:text,sectionID:added[2],sourceIDs:[added[1]]}],
      citations:[{sectionID:added[2],sourceIDs:[added[1]],relevance:'The supplied sizing rule.'}]};
    }
   }
   if(scenario==='energy-thermal-referral'){
    if(count===1){
     assert(!body.input.includes('TABLE C402.1.2'));
     value={...value,answerText:'The supplied text does not establish the opaque-door U-factor limit.',supportedPoints:[],citations:[],
      evidenceLimitations:['The supplied commercial text does not include the opaque-door U-factor table.'],additionalEvidenceNeeded:['The applicable opaque-door thermal table.']};
    }else{
     const added=[...body.input.matchAll(/PASSAGE_ID: ([^\n]+-gap-C402\.1\.2)\nSECTION_ID: ([^\n]+)\nCODE: ECC\nSECTION: C402\n/g)][0];
     assert(added,'The supplied thermal referral reaches repair as an exact new source.');
     const text='Published Table C402.1.2 lists swinging-door U-0.37, subject to its governing scope and footnote g.';
     value={...value,answerText:text,supportedPoints:[{heading:'Thermal table',explanation:text,sectionID:added[2],sourceIDs:[added[1]]}],
      citations:[{sectionID:added[2],sourceIDs:[added[1]],relevance:'The complete supplied table and its footnote.'}]};
    }
   }
  }else{
   assert.equal(phase,'permitext_research_open_review');assert.equal(body.service_tier,'default');
   assert.equal(JSON.parse(body.input).evidenceGapOnly,['gap','empty-gap','rejected-gap'].includes(scenario)||['energy-local-lookup','energy-thermal-referral'].includes(scenario)&&count===1);
   if(scenario==='energy-local-lookup')assert(JSON.parse(body.input).evidence.some(source=>source.sourceID.endsWith('-gap-R403.7')&&source.text.includes('ACCA Manual S')));
   if(scenario==='energy-thermal-referral')assert(JSON.parse(body.input).evidence.some(source=>source.sourceID.endsWith('-gap-C402.1.2')&&
    /TABLE C402\.1\.2[\s\S]*Swinging door.*U-0\.37[\s\S]*g\. Swinging door U-factors/.test(source.text)));
   const citationScenario=['citation-rescue','citation-content-change','terminal-citation'].includes(scenario);
   const fail=scenario==='rejected-gap'||scenario==='repair-format'&&count===1||['energy-local-lookup','energy-thermal-referral'].includes(scenario)&&count===1||scenario==='second-substantive'&&count<3||citationScenario&&(count<4||scenario==='terminal-citation');
   value={pass:!fail,issues:fail?[{type:citationScenario&&count>1?'incorrect_citation':'unsupported_requirement',message:finding}]:[]};
   if(scenario==='review-format'&&count===1||scenario==='terminal-review')value={pass:false,issues:[]};
   if(scenario==='truncated-review'&&count===1)status='incomplete';
   if(scenario==='truncated-review'&&count===2)assert.equal(body.max_output_tokens,12000);
  }
  assert(calls.length<=9);
  return Response.json({model:body.model,status,
   ...(status==='incomplete'?{incomplete_details:{reason:'max_output_tokens'}}:{}),
   usage:{input_tokens:100,output_tokens:100},
   output:status==='incomplete'?[]:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
 }catch(e){doubleError=e;throw e;}
};
let server;
try {
 const {handleRequest}=await import('../app.mjs');server=createServer(handleRequest);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const request=async(path,body,token)=>{const r=await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`,{
  method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
  return {status:r.status,body:await r.json()};};
 const signed=await request('/account/sign-in',{credential:{provider:'web',providerUserID:randomUUID()}});
 const account=signed.body.account,token=account.backendSessionToken,auth={accountUserID:account.appUserID};
 await request('/admin/lifetime-grants/grant',{userID:account.appUserID},process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
 for(scenario of ['investigation-format','review-format','truncated-review','repair-format','gap','empty-gap','rejected-gap','terminal-review','citation-rescue','citation-content-change','terminal-citation','energy-local-lookup','energy-thermal-referral','second-substantive']){
  calls=[];counts={};doubleError=undefined;
  const created=await request('/research/conversations/create',{auth},token),conversationID=created.body.conversation.id;
  const result=await request('/research/conversations/message',{auth,conversationID,requestID:randomUUID(),
   question:scenario==='empty-gap'?'Under the 2016 NYC Energy Code, explain roof insulation.':
     scenario==='energy-local-lookup'?'Under the 2025 NYC Energy Code, what roof-recover insulation rules are supplied?':
     scenario==='energy-thermal-referral'?'I need simple, flush, paint-grade wood exterior entrance doors, 10 feet high, without glass. How can they comply with NYC energy requirements? My old schedule lists U-factor 0.77, SHGC 0.4, and air leakage 0.2 cfm/ft².':
     'For our NYC project, what identification rule does MC 304.12 provide for installed equipment?'},token);
  if(doubleError)throw doubleError;
  assert.equal(result.status,200,JSON.stringify(result.body));
  const answer=result.body.conversation.messages.at(-1).answer;
  const rejected=['rejected-gap','terminal-review','citation-content-change','terminal-citation'].includes(scenario);
  assert.equal(answer.mode,rejected?'clarification':'openai',scenario);
  if(rejected||['gap','empty-gap'].includes(scenario))assert.deepEqual(answer.citations,[]);
  if(scenario==='empty-gap')assert.equal(answer.verification.scope,'investigated_evidence_gap');
  if(scenario==='repair-format')assert.equal(counts.permitext_code_interpretation,3);
  if(scenario==='investigation-format')assert.equal(counts.permitext_research_investigation,2);
  if(['review-format','truncated-review','terminal-review'].includes(scenario))assert.equal(counts.permitext_research_open_review,2);
  if(scenario==='terminal-review')assert.equal(counts.permitext_code_interpretation,1,'Malformed reviewer is never a substantive repair finding');
  if(['citation-rescue','citation-content-change','terminal-citation'].includes(scenario)){
   assert.equal(counts.permitext_code_interpretation,4);
   assert.equal(counts.permitext_research_open_review,scenario==='citation-content-change'?3:4);
  }
  if(scenario==='second-substantive'){assert.equal(counts.permitext_code_interpretation,3);assert.equal(counts.permitext_research_open_review,3);}
  if(scenario==='energy-local-lookup'){
   assert.equal(counts.permitext_research_open_review,2);
   assert(answer.citations.some(citation=>citation.sourceIDs.some(id=>id.endsWith('-gap-R403.7'))));
  }
  if(scenario==='energy-thermal-referral'){
   assert.equal(counts.permitext_research_open_review,2);
   assert(answer.citations.some(citation=>citation.sourceIDs.some(id=>id.endsWith('-gap-C402.1.2'))));
  }
  const reopened=await request('/research/conversations/get',{auth,conversationID},token);
  assert.deepEqual(reopened.body.conversation.messages.at(-1).answer,answer,'Only the reviewed final answer or clarification persists');
 }
 const store=JSON.parse(await readFile(join(scratch,'store.json'),'utf8'));
 const operations=Object.values(store.researchOperationsByUserID).flatMap(items=>Array.isArray(items)?items:Object.values(items));
 assert.equal(operations.length,14);
 assert.deepEqual(operations.map(operation=>operation.providerRequestCount).sort(),[3,3,4,4,4,4,5,5,6,7,7,8,9,9]);
 for(const operation of operations){
  assert.equal(operation.pendingProviderRequestCount,0);
  assert(operation.actualProviderCostUSD>0,'Rejected outputs still incur provider expense');
 }
 console.log('Open recovery HTTP passed: malformed investigation/review, truncation allowance, exact citation repair, reviewed gaps, rejection, settled accounting and persistence; zero live provider calls.');
}finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}globalThis.fetch=nativeFetch;await rm(scratch,{recursive:true,force:true});}
