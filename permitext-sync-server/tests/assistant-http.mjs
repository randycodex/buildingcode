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
const production=process.argv.includes('--production');
const postgres=production?await (await import('./research-v2-local-postgres.mjs')).startResearchV2Postgres():null;
const directory=await mkdtemp(join(tmpdir(),'permitext-current-project-'));
for(const key of Object.keys(process.env))if(/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$|BLOB_|CLERK_|STRIPE_|RESEND_|APPLE_.*(?:SECRET|KEY))/.test(key))delete process.env[key];
Object.assign(process.env,{NODE_ENV:'test',OPENAI_API_KEY:'offline-project-context-double',PERMITEXT_SYNC_DATA_PATH:join(directory,'store.json'),
 PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(directory,'assets'),PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:'synthetic-context-grant',PERMITEXT_RESEARCH_V2:'1',
 PERMITEXT_RESEARCH_V2_BUDGET_PATH:join(directory,'budget.json'),PERMITEXT_RESEARCH_MODEL:'gpt-6-luna',PERMITEXT_RESEARCH_MAX_REQUEST_USD:'1',
 PERMITEXT_RESEARCH_USER_DAILY_CAP_USD:'7',PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD:'7',PERMITEXT_RESEARCH_DAILY_CAP_USD:'7',PERMITEXT_RESEARCH_MONTHLY_CAP_USD:'7',
 PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS:'.1',PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS:'.01',PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:'.5',PERMITEXT_RESEARCH_PRICING_VERSION:'offline-context-test'});
if(postgres)process.env.PERMITEXT_SYNC_DATABASE_URL=postgres.connectionString;
const nativeFetch=globalThis.fetch;let server,calls=0,figureCounts=0,figureCalls=0,figureHash;
function assertSelectedFigure(parts){
 const images=parts.filter(part=>part.type==='input_image');
 assert.equal(images.length,1,'Only the selected Reader figure reaches the provider');
 assert.equal(images[0].detail,'high');
 const bytes=Buffer.from(images[0].image_url.split(',')[1],'base64');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),figureHash);
}
globalThis.fetch=async(url,options)=>{
 if(String(url)==='https://api.openai.com/v1/responses/input_tokens'){
  figureCounts++;
  const request=JSON.parse(options.body);
  assert.equal(request.model,'gpt-6-luna');
  assertSelectedFigure(request.input[0].content);
  assert.equal(request.input[0].content.length,1,'Token counting only needs the public image');
  return Response.json({object:'response.input_tokens',input_tokens:950});
 }
 if(String(url)!=='https://api.openai.com/v1/responses')return nativeFetch(url,options);
 calls++;const body=JSON.parse(options.body);let output;
 const text=t=>[{type:'message',role:'assistant',content:[{type:'output_text',text:t}]}];
 if(body.text?.format?.name==='assistant_conversational_intent'){const c=JSON.parse(body.input);if(c.currentQuestion==='Reconsider earlier evidence')assert(c.priorEvidence.length>0);output=text(JSON.stringify({question:c.currentQuestion,subject:'Current question',reference:'latest exchange',clarification:'',evidenceIDs:c.currentQuestion==='Reconsider earlier evidence'?[c.priorEvidence.find(s=>s.sectionID).id]:[]}));}
 else if(body.tools?.some(t=>t.type==='web_search'))output=[{type:'web_search_call',action:{type:'search'}},{type:'message',role:'assistant',content:[{type:'output_text',text:'Public source finding.',annotations:[{type:'url_citation',url:'https://www.nyc.gov/example',title:'Official example'}]}]}];
 else if(Array.isArray(body.input)){
  if(Array.isArray(body.input[0].content)){
   figureCalls++;
   const content=body.input[0].content;
   assertSelectedFigure(content);
   assert.match(content[1].text,/PASSAGE_ID S1/);
   assert.equal(JSON.parse(content[0].text).attachedPassages[0].id,'S1');
   output=figureCalls===1?[{type:'function_call',call_id:'figure-source',name:'read_library',arguments:'{"sectionIDs":["S1"]}'}]:text('The official chapter figure accompanies this code passage. [S1]');
  }
  else if(body.input.at(-1).type==='function_call_output'){const r=JSON.parse(body.input.at(-1).output);if(r.candidates)output=[{type:'function_call',call_id:'read-1',name:'read_library',arguments:JSON.stringify({sectionIDs:[r.candidates[0].id]})}];else output=text(r.sources?.[0]?.id?.startsWith('S')?'A retrieved rule. [S1]':'The public source says this. [W1]');}
  else if(JSON.parse(body.input[0].content).question==='Find provisions')output=[{type:'function_call',call_id:'library-1',name:'search_library',arguments:JSON.stringify({query:'2022 NYC BC 1007.1.1 403.5.1 remoteness interior exit stairways'})}];
  else if(JSON.parse(body.input[0].content).question==='Reconsider earlier evidence'){const recalled=JSON.parse(body.input[0].content).readEvidence;assert(recalled.length>0);output=text(`A recalled rule. [${recalled[0].id}]`);}
  else if(JSON.parse(body.input[0].content).question==='Use web')output=[{type:'function_call',call_id:'web-1',name:'search_web',arguments:JSON.stringify({query:'NYC public code'})}];
  else output=text('Your project context is available.');
 }else output=text(JSON.stringify(body.text.format.name==='permitext_v2_review'?{pass:true,issues:[]}:{answerText:'These are recorded project facts.',claims:[],missingSources:[],missingFacts:[]}));
 const inputTokens=Array.isArray(body.input?.[0]?.content)?1250:200;
 return Response.json({model:body.model,status:'completed',service_tier:'default',usage:{input_tokens:inputTokens,output_tokens:80},output});
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
 if(production){Object.assign(process.env,{NODE_ENV:'production',VERCEL:'1',VERCEL_ENV:'preview',PERMITEXT_RESEARCH_V2_ROLLOUT:'all',PERMITEXT_RESEARCH_V2_DEFAULT:'v2'});delete process.env.PERMITEXT_RESEARCH_V2_BUDGET_PATH;}

 const send=async(question,assistantMode='experimental',requestID=crypto.randomUUID(),expected=200)=>{
  const result=await post('/research/conversations/message',{conversationID:conversation.id,question,assistantMode,requestID,researchEngine:'v2',analysisMode:'conversation_only',expectedRevision:conversation.revision,expectedEvidenceSetVersion:conversation.evidenceSetVersion||1},expected);
  if(result.conversation)conversation=result.conversation;return result;
 };
 await send('Use web','experimental','web');const answer=conversation.messages.at(-1);assert.equal(answer.answer.verification.pass,false);assert.equal(answer.answer.assistant,true);
 assert.match(answer.answer.answerText,/https:\/\/www.nyc.gov/);assert.equal(answer.answer.supportingSources.length,1);
 const saved=(await post('/research/answers/get',{answerID:answer.id})).answer;
 assert(saved.assistantResearchTrace.length);assert.equal(saved.webEvidenceSnapshot.length,1);assert.deepEqual(saved.officialEvidenceSnapshot,[]);
 const before=calls;await send('Use web','experimental','web');assert.equal(calls,before,'Replay must not spend twice');
 await send('Summarize project facts.');assert.equal(conversation.messages.at(-1).answer.verification.status,'unreviewed');
 await send('Summarize the recorded Project facts.','current');assert.equal(conversation.messages.at(-1).answer.verification.pass,false,'Obsolete Current mode uses the same conversational Assistant');
 await send('Find provisions');
 await send('Reconsider earlier evidence');
 const recalledRecord=(await post('/research/answers/get',{answerID:conversation.messages.at(-1).id})).answer;
 assert(recalledRecord.assistantResearchTrace.some(t=>t.tool==='recall_evidence'&&t.result.sources.length));
 assert(recalledRecord.evidence.length);assert(conversation.messages.at(-1).answer.citations.length);
 process.env.PERMITEXT_ASSISTANT_EXPERIMENTAL='0';await send('Summarize project facts.','current','obsolete-mode');assert.equal(conversation.messages.at(-1).answer.researchEngine,'assistant-luna-20261116-v1');
 const oldClient=await post('/research/conversations/message',{conversationID:conversation.id,question:'Summarize project facts.',requestID:'old-client-no-mode',expectedRevision:conversation.revision,expectedEvidenceSetVersion:conversation.evidenceSetVersion||1});assert.equal(oldClient.conversation.messages.at(-1).answer.researchEngine,'assistant-luna-20261116-v1');
 assert.equal(figureCounts,0,'Text-only Assistant turns do not call image token counting');

 const mapPassage={sectionID:'6881',
  selectedText:'Within the boroughs of Staten Island (Richmond County) and Queens, the fire districts shall comprise such areas indicated on the "fire district maps" as per Figures D106.1(1) and D106.1(2).'};
 const reviewed=await post('/research/selections/review',mapPassage);
 assert.equal(reviewed.requiresVisualReview,true);
 assert(reviewed.visualSources.length>reviewed.maximumVisualSelections);
 const figure=reviewed.visualSources[0];
 const readerSelection={...reviewed.selection,visualSourceIDs:[figure.id],visualReviewConfirmed:true};
 await post('/research/conversations/create',{analysisMode:'conversation_only',originSurface:'ios-reader',selections:[reviewed.selection]},400);
 await post('/research/conversations/create',{analysisMode:'conversation_only',originSurface:'ios-reader',
  selections:[{...readerSelection,visualSourceIDs:['visual-source-client-forgery']}]},400);
 const manual=(await post('/research/conversations/create',{analysisMode:'conversation_only',originSurface:'ios-reader',selections:[readerSelection]},201)).conversation;
 assert(manual.sources[0].visualReviewConfirmedAt,'Old clients retain a true manual approval timestamp');

 const maps=await post('/research/selections/review',{...mapPassage,includeOfficialFigures:true});
 assert.equal(maps.requiresVisualReview,false);
 const mapConversation=(await post('/research/conversations/create',{analysisMode:'conversation_only',originSurface:'ios-reader',selections:[maps.selection]},201)).conversation;
 assert.deepEqual(mapConversation.sources[0].visualSources,[],'A large map series is never silently sampled');
 assert(mapConversation.sources[0].visualEvidenceNotice);

 const official=await post('/research/selections/review',{sectionID:'12339',selectedText:'Suds pressure zone',includeOfficialFigures:true});
 assert.equal(official.requiresVisualReview,false);
 assert.equal(official.selection.includeOfficialFigures,true);
 assert.equal(official.visualSources.length,1);
 figureHash=official.visualSources[0].contentHash;
 await post('/research/conversations/create',{originSurface:'ios-reader',selections:[official.selection]},400);
 await post('/research/conversations/create',{analysisMode:'conversation_only',originSurface:'ios-reader',
  selections:[{...official.selection,visualSourceIDs:[official.visualSources[0].id],visualReviewConfirmed:true}]},400);
 const created=(await post('/research/conversations/create',{analysisMode:'conversation_only',originSurface:'ios-reader',selections:[official.selection]},201)).conversation;
 assert.equal(created.sources[0].attachedFigureCount,1);
 assert.equal(created.sources[0].visualReviewConfirmedAt,null,'Automatic attachment never claims manual review');
 assert.equal(created.sources[0].visualSources[0].contentHash,figureHash);
 conversation=(await post('/research/conversations/evidence',{conversationID:mapConversation.id,selections:[official.selection],originSurface:'ios-reader'})).conversation;
 assert.equal(conversation.sources.find(source=>source.sectionID==='12339').attachedFigureCount,1);
 conversation=created;
 const figureAnswer=(await send('Describe the attached figure and cite its source.','experimental','reader-figure')).conversation.messages.at(-1);
 assert.equal(figureCounts,1,'Repeated model calls in one turn reuse the image token count');
 assert.equal(figureCalls,2,'The figure remains available after a library tool call');
 assert.equal(figureAnswer.answer.citations[0].sectionID,'12339');
 const figureRecord=(await post('/research/answers/get',{answerID:figureAnswer.id})).answer;
 assert.deepEqual(figureRecord.evidence[0].visualSources.map(image=>image.contentHash),[figureHash]);
 await send('Describe the attached figure and cite its source.','experimental','reader-figure');
 assert.deepEqual([figureCounts,figureCalls],[1,2],'Replaying the turn does not count or analyze the figure twice');
 if(production){const usage=await postgres.sql`SELECT count(*)::int AS n FROM permitext_research_usage WHERE user_id=${userID} AND mode='openai'`;assert(Number(usage[0].n)>0,'Hosted Assistant uses durable application accounting');}
 console.log('PASS Assistant HTTP: selected official chapter image reaches the multimodal request, with token counting, citation and replay; default engine and text flows also pass. No paid calls.');
}finally{globalThis.fetch=nativeFetch;server?.closeAllConnections();if(server)await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});await postgres?.close();}
