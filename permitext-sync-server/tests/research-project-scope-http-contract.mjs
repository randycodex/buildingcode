// Isolated HTTP regression for the actual three-question conversation. Legal
// turns use provider doubles; this proves routing and persistence, not accuracy.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const scratch=await mkdtemp(join(tmpdir(),'permitext-project-scope-'));
for(const key of Object.keys(process.env))if(/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key))delete process.env[key];
Object.assign(process.env,{NODE_ENV:'',OPENAI_API_KEY:'offline-double',PERMITEXT_SYNC_DATA_PATH:join(scratch,'store.json'),PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(scratch,'assets'),
 PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN:'1',PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:randomUUID(),PERMITEXT_RESEARCH_ENGINE:'open',PERMITEXT_RESEARCH_LUNA_ONLY:'1',PERMITEXT_RESEARCH_SEMANTIC_SEARCH:'0',
 PERMITEXT_RESEARCH_MODEL:'gpt-6-luna',PERMITEXT_RESEARCH_FAST_MODEL:'gpt-6-luna',PERMITEXT_RESEARCH_ROUTING_MODE:'single',PERMITEXT_EVIDENCE_DISCOVERY_BETA:'1',
 PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS:'.1',PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS:'.01',PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:'.5',PERMITEXT_RESEARCH_PRICING_VERSION:'offline',
 PERMITEXT_RESEARCH_MAX_REQUEST_USD:'1',PERMITEXT_RESEARCH_USER_DAILY_CAP_USD:'5',PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD:'5',PERMITEXT_RESEARCH_DAILY_CAP_USD:'5',PERMITEXT_RESEARCH_MONTHLY_CAP_USD:'5'});
const nativeFetch=globalThis.fetch;let phases=[],doubleError;
globalThis.fetch=async(url,options)=>{
 if(String(url)!=='https://api.openai.com/v1/responses')throw Error('Offline test blocks external property lookup');
 try{
 const body=JSON.parse(options.body),phase=body.text.format.name;phases.push(phase);let value;
 if(phase==='permitext_research_investigation')value={ready:phases.filter(p=>p===phase).length>1,queries:phases.filter(p=>p===phase).length===1?['BC 310.4 Residential Group R-2','ZR 22-12 Use Group II residences']:[],retainSourceIDs:[],reason:'Offline source discovery'};
 else if(phase==='permitext_code_interpretation') {
  assert.match(body.instructions,/saved Project link/);
  const match=[...body.input.matchAll(/PASSAGE_ID: ([^\n]+)\nSECTION_ID: ([^\n]+)\nCODE: BC\nSECTION: ([^\n]+)/g)].find(m=>m[3]==='310.4');assert(match);
  const text='If the proposed residential portion contains more than two dwelling units occupied for permanent residence, consider Group R-2 under the supplied BC § 310.4. Existing property inventory does not establish proposed uses.';
  value={answerText:text,supportedPoints:[{heading:'Conditional occupancy',explanation:text,sectionID:match[2],sourceIDs:[match[1]]}],citations:[{sectionID:match[2],sourceIDs:[match[1]],relevance:text}],assumptions:[],missingFacts:['Proposed uses'],followUpQuestions:[],evidenceLimitations:[],additionalEvidenceNeeded:[],supportingSourceUses:[]};
 }else {assert.equal(phase,'permitext_research_open_review');assert.match(body.instructions,/silently discards the attached site/);value={pass:true,issues:[]};}
 return Response.json({model:body.model,status:'completed',usage:{input_tokens:100,output_tokens:100},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
 }catch(error){doubleError=error;throw error;}
};
let server;
try{
 const {handleRequest}=await import('../app.mjs');server=createServer(handleRequest);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const request=async(path,body,token)=>{const r=await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
 const signed=await request('/account/sign-in',{credential:{provider:'web',providerUserID:randomUUID()}}),account=signed.body.account,token=account.backendSessionToken,auth={accountUserID:account.appUserID};
 await request('/admin/lifetime-grants/grant',{userID:account.appUserID},process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
 const projectID=randomUUID();const structuredFacts=[{key:'zoning-districts',label:'Zoning District(s)',value:'R8',status:'sourced',source:'nyc-planning',sourceText:'Offline fixture'}, {key:'residential-units',label:'Residential Units',value:'37',status:'sourced',source:'nyc-planning',sourceText:'Existing property inventory'}];
 assert.equal((await request('/sync/push',{batch:{user:{id:account.appUserID},mutations:[{project:{id:projectID,clientID:projectID,userID:account.appUserID,name:'Isolated use group regression',address:'155 EAST 182 STREET, Bronx, NY 10453',structuredFacts,updatedAt:new Date().toISOString()}}]}},token)).status,200);
 const created=await request('/research/conversations/create',{auth,projectID},token),conversationID=created.body.conversation.id;
 const questions=['how do you determine the use group for this site?','for this specific project, which use groups apply to it?','no no, this is a new project -'];
 for(const [index,question] of questions.entries()){
  phases=[];const requestID=randomUUID();const r=await request('/research/conversations/message',{auth,conversationID,question,requestID},token);if(doubleError)throw doubleError;
  assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.conversation.primaryProjectID,projectID);
  const answer=r.body.conversation.messages.at(-1).answer;
  if(index<2){assert(phases.includes('permitext_research_open_review'));assert(answer.citations.length);assert.equal(answer.verification.pass,true);}
  else{assert.deepEqual(phases,[]);assert.equal(answer.verification.reason,'project_scope');assert.match(answer.answerText,/same property, or a different property/);
   const repeat=await request('/research/conversations/message',{auth,conversationID,question,requestID},token);assert.equal(repeat.status,200);assert.equal(repeat.body.conversation.messages.length,6);assert.deepEqual(phases,[]);}
 }
 const reopened=await request('/research/conversations/get',{auth,conversationID},token);
 assert.equal(reopened.body.conversation.messages.length,6);assert.equal(reopened.body.conversation.primaryProjectID,projectID);
 assert(reopened.body.conversation.projectInformation.facts.some(f=>f.includes('R8')));
 assert(reopened.body.conversation.projectInformation.facts.some(f=>f.includes('37')));
 console.log('Three-turn HTTP replay passed: legal turns retain reviews/citations; ambiguous correction makes zero provider calls; project facts and six messages survive replay/reopen.');
}finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}globalThis.fetch=nativeFetch;await rm(scratch,{recursive:true,force:true});}
