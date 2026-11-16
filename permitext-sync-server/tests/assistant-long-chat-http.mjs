import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
// This digest comes from the pre-default-context canonical supplied-text record.
// New prompt semantics must not invalidate historical answers or Report sources.
const {assistantSuppliedText,assistantProjectSnapshotHash}=await import('../assistant-conversation-scope.mjs');
assert.equal(createHash('sha256').update(JSON.stringify(assistantSuppliedText({version:'20261019-conversation-only-v1',inputMode:'reader_passages',includeProjectContext:false,projectContext:null,projectID:'historical-project',facts:[],materials:[]},'Explain the selected text.'))).digest('hex'),
 '03011567c2abe7ef4dd45a5e052f60271ff65d21cac0dd78b3c802eef4049086');
const directory=await mkdtemp(join(tmpdir(),'permitext-current-project-'));
for(const key of Object.keys(process.env))if(/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$|BLOB_|CLERK_|STRIPE_|RESEND_|APPLE_.*(?:SECRET|KEY))/.test(key))delete process.env[key];
Object.assign(process.env,{NODE_ENV:'test',OPENAI_API_KEY:'offline-project-context-double',PERMITEXT_SYNC_DATA_PATH:join(directory,'store.json'),
 PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(directory,'assets'),PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:'synthetic-context-grant',PERMITEXT_RESEARCH_V2:'1',
 PERMITEXT_RESEARCH_V2_BUDGET_PATH:join(directory,'budget.json'),PERMITEXT_RESEARCH_MODEL:'gpt-6-luna',PERMITEXT_RESEARCH_MAX_REQUEST_USD:'1',
 PERMITEXT_RESEARCH_USER_DAILY_CAP_USD:'7',PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD:'7',PERMITEXT_RESEARCH_DAILY_CAP_USD:'7',PERMITEXT_RESEARCH_MONTHLY_CAP_USD:'7',
 PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS:'.1',PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS:'.01',PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:'.5',PERMITEXT_RESEARCH_PRICING_VERSION:'offline-context-test'});
const nativeFetch=globalThis.fetch;let server,calls=0,rejectContext=0;
globalThis.fetch=async(url,options)=>{
 if(String(url)!=='https://api.openai.com/v1/responses')return nativeFetch(url,options);
 calls++;const body=JSON.parse(options.body);let output;
 if(rejectContext>0){rejectContext--;return Response.json({error:{code:'context_length_exceeded',message:'Synthetic context capacity rejection'}},{status:400});}
 if(body.text?.format?.name==='assistant_conversational_intent'){const c=JSON.parse(body.input);if(c.currentQuestion==='What entrance width did I confirm?'){assert(c.archive.messages>=1000);assert(Buffer.byteLength(JSON.stringify(body))<140000);assert(JSON.stringify(c).includes('42 inches'));}}
 const text=t=>[{type:'message',role:'assistant',content:[{type:'output_text',text:t}]}];
 if(body.text?.format?.name==='assistant_conversational_intent'){const c=JSON.parse(body.input);if(c.currentQuestion==='Reconsider earlier evidence')assert(c.priorEvidence.length>0);output=text(JSON.stringify({question:c.currentQuestion,subject:'Current question',reference:'latest exchange',clarification:'',evidenceIDs:c.currentQuestion==='Reconsider earlier evidence'?[c.priorEvidence.at(-1).id]:c.currentQuestion==='Which stair separation provision did we save?'?c.priorEvidence.filter(s=>/1007\.1\.1/.test(s.title)).map(s=>s.id):[]}));}
 else if(body.tools?.some(t=>t.type==='web_search'))output=[{type:'web_search_call',action:{type:'search'}},{type:'message',role:'assistant',content:[{type:'output_text',text:'Public source finding.',annotations:[{type:'url_citation',url:'https://www.nyc.gov/example',title:'Official example'}]}]}];
 else if(Array.isArray(body.input)){
  if(body.input.at(-1).type==='function_call_output'){const r=JSON.parse(body.input.at(-1).output);if(r.candidates)output=[{type:'function_call',call_id:'read-1',name:'read_library',arguments:JSON.stringify({sectionIDs:[r.candidates[0].id]})}];else output=text(r.sources?.[0]?.id?.startsWith('S')?'A retrieved rule. [S1]':'The public source says this. [W1]');}
  else if(JSON.parse(body.input[0].content).question==='What entrance width did I confirm?'){assert(JSON.stringify(body.input).includes('42 inches'));output=text('You confirmed 42 inches. The earlier 39-inch width was an unverified assumption.');}
  else if(JSON.parse(body.input[0].content).question==='Which stair separation provision did we save?'){const c=JSON.parse(body.input[0].content);assert(c.earlierEvidence.length);output=text(`The saved stair separation provision is here. [${c.earlierEvidence[0].id}]`);}
  else if(JSON.parse(body.input[0].content).question==='Find provisions')output=[{type:'function_call',call_id:'library-1',name:'search_library',arguments:JSON.stringify({query:'2022 NYC BC 1007.1.1 403.5.1 remoteness interior exit stairways'})}];
  else if(JSON.parse(body.input[0].content).question==='Reconsider earlier evidence'){const recalled=JSON.parse(body.input[0].content).earlierEvidence;assert(recalled.length>0);output=text(`A recalled rule. [${recalled[0].id}]`);}
  else if(JSON.parse(body.input[0].content).question==='Use web')output=[{type:'function_call',call_id:'web-1',name:'search_web',arguments:JSON.stringify({query:'NYC public code'})}];
  else output=text('Your project context is available.');
 }else output=text(JSON.stringify(body.text.format.name==='permitext_v2_review'?{pass:true,issues:[]}:{answerText:'These are recorded project facts.',claims:[],missingSources:[],missingFacts:[]}));
 return Response.json({model:body.model,status:'completed',service_tier:'default',usage:{input_tokens:200,output_tokens:80},output});
};
try{
 const {handleRequest}=await import('../app.mjs');
 server=createServer(handleRequest);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`,userID='apple:synthetic-current-context',projectID='current-context-project';let token;
 const post=async(path,body={},expected=200,bearer=token)=>{
  const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(bearer?{authorization:`Bearer ${bearer}`}:{})},body:JSON.stringify({auth:{accountUserID:userID},...body})});
  const result=await response.json();assert.equal(response.status,expected,`${path}: ${JSON.stringify(result).slice(0,1200)}`);return result;
 };
 await post('/admin/lifetime-grants/grant',{userID},200,process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
 token=(await post('/account/sign-in',{credential:{provider:'apple',providerUserID:'synthetic-current-context',email:'context@example.test',displayName:'Synthetic context test'}})).account.backendSessionToken;
 const project={id:'current-context-record',clientID:projectID,userID,name:'Current context QA',address:'Synthetic address',codeVersion:'2022-construction',colorHex:'#334455',sortOrder:0};
 let update=0;
 const change=async(description,value,status)=>post('/sync/push',{batch:{user:{id:userID},mutations:[{project:{...project,description,
  structuredFacts:[{id:'current-stories',key:'stories-above-grade',label:'Stories Above Grade',value,status,source:'user',sourceText:'Synthetic field survey; verify independently.'}],
  updatedAt:new Date(Date.now()+1000*++update).toISOString()}}]}});
 await change('CONTEXT_ALPHA: proposed office renovation.','3','stated');
 let conversation=(await post('/research/conversations/create',{projectID,analysisMode:'conversation_only',requestID:'create-default-context'},201)).conversation;

 const send=async(question,assistantMode='experimental',requestID=crypto.randomUUID(),expected=200)=>{
  const result=await post('/research/conversations/message',{conversationID:conversation.id,question,assistantMode,requestID,researchEngine:'v2',analysisMode:'conversation_only',expectedRevision:conversation.revision,expectedEvidenceSetVersion:conversation.evidenceSetVersion||1},expected);
  if(result.conversation)conversation=result.conversation;return result;
 };
 process.env.PERMITEXT_ASSISTANT_EXPERIMENTAL='1';
 await send('Find provisions');
 const path=process.env.PERMITEXT_SYNC_DATA_PATH;
 const store=JSON.parse(await readFile(path,'utf8'));
 const entries=Object.entries(store.researchConversationsByUserID).find(([,items])=>items.some(c=>c.id===conversation.id));
 const persisted=entries[1].find(c=>c.id===conversation.id);
 const contextRevision=persisted.contextRevision||0;
 const original=persisted.messages;
 const old=Array.from({length:1000},(_,i)=>({id:`long-${i}`,role:i%2?'assistant':'user',...(i%2?{answer:{answerText:`Unrelated coordination response ${i}. `+'ceiling layouts '.repeat(30)}}:{question:`Unrelated coordination question ${i}. `+'ceiling layouts '.repeat(30)}),contextRevision,createdAt:new Date().toISOString()}));
 old[10].question='The entrance clear width is 39 inches, an unverified assumption.';
 old[600].question='Correction: the approved entrance clear width is confirmed at 42 inches, replacing the 39-inch assumption.';
 persisted.messages=[...original,...old];
 const historicalDigest=createHash('sha256').update(JSON.stringify(persisted.messages)).digest('hex');
 const answerDigests=(store.researchAnswersByUserID[entries[0]]||[]).map(r=>createHash('sha256').update(JSON.stringify(r)).digest('hex'));
 await writeFile(path,JSON.stringify(store));
 await send('What entrance width did I confirm?');assert.match(conversation.messages.at(-1).answer.answerText,/42 inches/);
 let after=JSON.parse(await readFile(path,'utf8'));let saved=after.researchConversationsByUserID[entries[0]].find(c=>c.id===conversation.id);
 assert.equal(createHash('sha256').update(JSON.stringify(saved.messages.slice(0,original.length+1000))).digest('hex'),historicalDigest);
 assert.equal(saved.messages.length,original.length+1002);
 assert.deepEqual((after.researchAnswersByUserID[entries[0]]||[]).slice(0,answerDigests.length).map(r=>createHash('sha256').update(JSON.stringify(r)).digest('hex')),answerDigests);
 await send('Which stair separation provision did we save?');assert(conversation.messages.at(-1).answer.citations.length);
 const beforeFailure=(JSON.parse(await readFile(path,'utf8'))).researchConversationsByUserID[entries[0]].find(c=>c.id===conversation.id).messages.length;
 rejectContext=2;const failure=await send('A synthetic capacity check','experimental','context-failure',503);
 assert.equal(failure.code,'ASSISTANT_CONTEXT_CAPACITY');assert.match(failure.error,/complete conversation and sources are saved/);assert(!/approved Luna/.test(failure.error));
 after=JSON.parse(await readFile(path,'utf8'));saved=after.researchConversationsByUserID[entries[0]].find(c=>c.id===conversation.id);
 assert.equal(saved.messages.length,beforeFailure,'A failed answer must not erase or replace saved history');
 console.log('PASS long-chat HTTP: 1,000+ messages, distant correction, original messages/answer hashes preserved, earlier source reloaded/cited, automatic capacity retry and clear saved-history error; no paid calls.');
}finally{globalThis.fetch=nativeFetch;server?.closeAllConnections();if(server)await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});}
