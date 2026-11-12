import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
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
const nativeFetch=globalThis.fetch,packets=[];let duringWriter=null,server;
globalThis.fetch=async(input,options)=>{
 if(String(input)!=='https://api.openai.com/v1/responses')return nativeFetch(input,options);
 const body=JSON.parse(options.body);packets.push(body.input);
 if(body.text.format.name!=='permitext_v2_review'&&duringWriter){const hook=duringWriter;duringWriter=null;await hook();}
 const output=body.text.format.name==='permitext_v2_review'?{pass:true,issues:[]}:
  {answerText:'The Project facts are recorded statements and require confirmation before application.',claims:[],missingSources:[],missingFacts:[]};
 return Response.json({model:body.model,status:'completed',service_tier:'default',usage:{input_tokens:200,output_tokens:80},
  output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output)}]}]});
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
 assert.equal(conversation.assistantScope.includeProjectContext,true);assert.equal(conversation.assistantScope.projectContextMode,'current');
 const send=async(requestID)=>{const result=await post('/research/conversations/message',{conversationID:conversation.id,question:'Summarize the recorded Project facts.',requestID,
  researchEngine:'v2',analysisMode:'conversation_only',expectedRevision:conversation.revision,expectedEvidenceSetVersion:conversation.evidenceSetVersion||1});conversation=result.conversation;return conversation.messages.at(-1);};
 // Updating the live Project during the writer must not alter the reviewer input.
 duringWriter=()=>change('CONTEXT_BETA: revised laboratory renovation.','4','confirmed');
 const first=await send('current-alpha');
 const alpha=(await post('/research/answers/get',{answerID:first.id})).answer;
 const frozenAlpha=JSON.stringify(alpha),snapshot=first.answer.inputSnapshot.projectContextSnapshot;
 const {immutableResearchAnswer}=await import('../project-foundation-contract.mjs');
 assert.doesNotThrow(()=>immutableResearchAnswer(alpha));
 const reorder=value=>Array.isArray(value)?value.map(reorder):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).reverse().map(key=>[key,reorder(value[key])])):value;
 assert.doesNotThrow(()=>immutableResearchAnswer(reorder(alpha)),'JSON database key ordering must not invalidate an exact captured snapshot');
 const mismatched=structuredClone(alpha);mismatched.assistantScopeSnapshot.projectContext.projectInformation.description='Altered context';
 assert.throws(()=>immutableResearchAnswer(mismatched),/Research answers require evidence/,'A captured context must match its digest and answer input');
 assert(snapshot.capturedAt);assert.equal(snapshot.projectInformation.description,'CONTEXT_ALPHA: proposed office renovation.');
 assert.equal(snapshot.contentHash,assistantProjectSnapshotHash(snapshot.projectInformation));
 assert.equal(snapshot.projectInformation.structuredFacts.find(f=>f.id==='current-stories').status,'stated');
 assert.equal(snapshot.projectInformation.structuredFacts.find(f=>f.id==='current-stories').sourceText,'Synthetic field survey; verify independently.');
 assert.equal(packets.length,2);assert(packets.every(packet=>packet.includes('CONTEXT_ALPHA')&&!packet.includes('CONTEXT_BETA')),'Writer and reviewer use the same frozen input during live edits');
 const replay=await post('/research/conversations/message',{conversationID:conversation.id,question:'Summarize the recorded Project facts.',requestID:'current-alpha',researchEngine:'v2',analysisMode:'conversation_only'});
 assert.equal(replay.conversation.messages.at(-1).id,first.id);assert.equal(packets.length,2,'Successful replay cannot generate with new facts');
 const second=await send('current-beta'),beta=second.answer.inputSnapshot.projectContextSnapshot;
 assert.equal(beta.projectInformation.description,'CONTEXT_BETA: revised laboratory renovation.');
 assert.equal(beta.projectInformation.structuredFacts.find(f=>f.id==='current-stories').value,'4');
 assert.equal(beta.projectInformation.structuredFacts.find(f=>f.id==='current-stories').status,'confirmed');
 assert.notEqual(beta.contentHash,snapshot.contentHash);
 assert.equal(JSON.stringify((await post('/research/answers/get',{answerID:first.id})).answer),frozenAlpha,'Later questions preserve the complete original answer record');
 // Exclusion is durable for future turns and does not modify historical context.
 conversation=(await post('/research/conversations/project-context',{conversationID:conversation.id,include:false})).conversation;
 conversation=(await post('/research/conversations/get',{conversationID:conversation.id})).conversation;
 assert.equal(conversation.assistantScope.projectContextMode,'excluded');
 const excluded=await send('current-excluded');
 assert.equal(excluded.answer.charged,false);assert.equal(packets.length,4,'No context and no passages produce a free material-needed response');
 const excludedRecord=(await post('/research/answers/get',{answerID:excluded.id})).answer;
 assert.equal(excludedRecord.projectContextSnapshot.projectInformation,null);
 await change('CONTEXT_GAMMA: latest recorded proposal.','5','stated');
 conversation=(await post('/research/conversations/project-context',{conversationID:conversation.id,include:true})).conversation;
 const third=await send('current-gamma');assert.equal(third.answer.inputSnapshot.projectContextSnapshot.projectInformation.description,'CONTEXT_GAMMA: latest recorded proposal.');
 assert.equal(JSON.stringify((await post('/research/answers/get',{answerID:first.id})).answer),frozenAlpha);
 // A different account cannot inspect or toggle the owner's Project/chat.
 const otherID='apple:synthetic-current-context-other';await post('/admin/lifetime-grants/grant',{userID:otherID},200,process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
 const other=(await post('/account/sign-in',{credential:{provider:'apple',providerUserID:'synthetic-current-context-other',email:'other-context@example.test'}})).account.backendSessionToken;
 await post('/research/conversations/project-context',{auth:{accountUserID:otherID},conversationID:conversation.id,include:true},404,other);
 await post('/research/answers/get',{auth:{accountUserID:otherID},answerID:first.id},404,other);
 console.log('PASS current Project context: default-on, current facts each question, writer/reviewer frozen during edits, status/provenance/hash, replay, opt-out/re-enable, immutable old answers and account isolation; paid provider calls: 0.');
}finally{globalThis.fetch=nativeFetch;server?.closeAllConnections();if(server)await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});}
