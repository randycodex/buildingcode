import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash, randomUUID} from 'node:crypto';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const scratch=await mkdtemp(join(tmpdir(),'permitext-explicit-reference-'));
const serve=process.argv.includes('--serve'), loginPath=`/reference-test/${randomUUID()}`;
let browserAccount;
for(const key of Object.keys(process.env))if(/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$|BLOB_|CLERK_|STRIPE_|RESEND_|APPLE_.*(?:SECRET|KEY))/.test(key))delete process.env[key];
Object.assign(process.env,{NODE_ENV:'test',OPENAI_API_KEY:'offline-reference-double',PERMITEXT_SYNC_DATA_PATH:join(scratch,'store.json'),
 PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(scratch,'assets'),PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:'synthetic-reference-grant',
 PERMITEXT_RESEARCH_V2:'1',PERMITEXT_RESEARCH_V2_BUDGET_PATH:join(scratch,'budget.json'),PERMITEXT_RESEARCH_MODEL:'gpt-6-luna',
 PERMITEXT_RESEARCH_MAX_REQUEST_USD:'1',PERMITEXT_RESEARCH_USER_DAILY_CAP_USD:'7',PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD:'7',
 PERMITEXT_RESEARCH_DAILY_CAP_USD:'7',PERMITEXT_RESEARCH_MONTHLY_CAP_USD:'7',PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS:'.1',
 PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS:'.01',PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:'.5',
 PERMITEXT_RESEARCH_PRICING_VERSION:'offline-reference-test'});
const nativeFetch=globalThis.fetch, packets=[];let server;
globalThis.fetch=async(input,options)=>{
 assert.equal(String(input),'https://api.openai.com/v1/responses','No web, discovery, or embedding calls');
 const body=JSON.parse(options.body),value=JSON.parse(body.input),packet=value.evidence || value;
 packets.push(packet);assert.equal(body.model,'gpt-6-luna');assert.equal(body.store,false);assert(!body.tools);
 const referenced=packet.sources.find(source=>source.id==='S2');
 const output=body.text.format.name==='permitext_v2_review'?{pass:true,issues:[]}:
  {answerText:referenced?'The referenced table and its footnotes are supplied. [S2]':'The selected passage refers to a reduction table. [S1]',
   questionTitle:'Appliance clearance rules',claims:[{text:'The source contains the stated text.',sourceIDs:[referenced?'S2':'S1']}],missingSources:[],missingFacts:[]};
 return Response.json({model:body.model,status:'completed',service_tier:'default',usage:{input_tokens:200,output_tokens:80},
  output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output)}]}]});
};
try{
 const {handleRequest, researchCorpusResources, resolveResearchAssemblySection}=await import('../app.mjs');
 const {createResearchCorpusRegistry}=await import('../research-corpus-registry.mjs');
 const corpus=createResearchCorpusRegistry()[0],{catalog}=await researchCorpusResources({selected:[corpus],passageSearch:false});
 const source=await resolveResearchAssemblySection({codePrefix:'FGC',sectionNumber:'308.3.2',corpusID:corpus.id,
  codeVersion:corpus.codeVersion,codeEdition:corpus.codeEdition},catalog);
 server=createServer((request,response)=>{
  if(serve && request.method==='GET' && request.url===loginPath){
   response.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer'});
   response.end(`<script>localStorage.setItem('permitext:webAccount:v1',${JSON.stringify(JSON.stringify(browserAccount))});location.replace('/workspace/reference-qa')</script>`);return;
  }
  return handleRequest(request,response);
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`,userID='apple:synthetic-reference-owner';let token;
 const post=async(path,body={},expected=200,bearer=token)=>{
  const response=await nativeFetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(bearer?{authorization:`Bearer ${bearer}`}:{})},
   body:JSON.stringify({auth:{accountUserID:userID},...body})});
  const result=await response.json();assert.equal(response.status,expected,`${path}: ${JSON.stringify(result).slice(0,1000)}`);return result;
 };
 await post('/admin/lifetime-grants/grant',{userID},200,process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
 const account=(await post('/account/sign-in',{credential:{provider:'apple',providerUserID:'synthetic-reference-owner',email:'references@example.test',displayName:'Reference QA'}})).account;
 token=account.backendSessionToken;
 browserAccount={userID:account.appUserID,sessionToken:token,authProvider:'apple',displayName:'Reference QA',entitlement:account.entitlement};
 if(serve)await post('/sync/push',{batch:{user:{id:userID},mutations:[{project:{id:'reference-qa-record',clientID:'reference-qa',userID,
  name:'Reference QA',description:'Synthetic reference retrieval check.',address:'Synthetic test address',codeVersion:corpus.codeVersion,
  colorHex:'#334455',sortOrder:0,updatedAt:new Date().toISOString()}}]}});
 let conversation=(await post('/research/conversations/create',{...(serve?{projectID:'reference-qa'}:{}),analysisMode:'conversation_only',selections:[{sectionID:source.sectionID,selectedText:source.text}]},201)).conversation;
 const attached=JSON.stringify(conversation.sources);
 const input={conversationID:conversation.id,question:'Explain these rules.',requestID:'reference-first',researchEngine:'v2',analysisMode:'conversation_only',
  expectedRevision:conversation.revision,expectedEvidenceSetVersion:conversation.evidenceSetVersion || 1};
 conversation=(await post('/research/conversations/message',input)).conversation;
 const message=conversation.messages.at(-1),answer=message.answer;
 assert.equal(packets.length,2,'Reference retrieval adds no model call beyond the writer/reviewer pair');
 assert.equal(JSON.stringify(conversation.sources),attached,'Automatic references do not become permanent attachments');
 assert.equal(answer.referenceLookup.added.length,1);assert.equal(answer.referenceLookup.added[0].label,'FGC Table 308.2');
 assert.equal(answer.sourceSummary.crossReferenceCount,1);assert.equal(answer.codeBasis.retrievalScope,'selected-passages-and-explicit-references');
 assert.match(answer.codeBasis.disclosure,/no broad or external search/);assert(!answer.retrieval.webSupportSearched);
 assert.equal(answer.additionalEvidenceNeeded.length,0);assert.equal(packets[0].sources[0].text,source.text);
 assert.deepEqual(packets[0].sources,packets[1].sources,'Writer and reviewer receive the identical expanded source packet');
 const table=packets[0].sources[1];assert.equal(table.edition,source.codeEdition);assert.equal(table.codeVersion,source.codeVersion);
 assert.equal(table.tables[0].grids.reduce((sum,grid)=>sum+grid.rows.length,0),18);
 for(const marker of 'abcdefghijk')assert(table.tableFootnotes.some(note=>note.marker===marker),`Note ${marker} reaches both model phases`);
 const record=(await post('/research/answers/get',{answerID:message.id})).answer,frozen=JSON.stringify(record);
 assert.equal(record.evidence[1].passageText,table.text);assert.equal(record.evidence[1].provenance.origin,'permitext_cross_reference');
 assert.equal(record.evidence[1].structuredSource.rowCount,18,'The full grid remains stored with the original answer');
 assert.equal(record.evidence[1].passageTextHash,createHash('sha256').update(table.text).digest('hex'));
 assert.equal(record.evidence[1].sourceLibraryVersion,source.codeVersion);
 if(serve){
  await writeFile('/tmp/per-codes-reference-browser-test.json',JSON.stringify({url:base+loginPath,base,conversationID:conversation.id}));
  console.log('Reference QA browser server ready; synthetic account and offline provider only.');
  await new Promise(resolve=>process.once('SIGTERM',resolve));
 }else{
 await post('/research/conversations/message',input);assert.equal(packets.length,2,'Replay reuses the original immutable answer');
 conversation=(await post('/research/conversations/message',{...input,requestID:'reference-selected-only',
  expectedRevision:conversation.revision,question:'Using only the selected passage, explain the wording.'})).conversation;
 assert.equal(packets.length,4);assert.equal(packets[2].sources.length,1,'An explicit selected-only request suppresses expansion');
 assert.equal(conversation.messages.at(-1).answer.referenceLookup.added.length,0);
 assert.equal(JSON.stringify((await post('/research/answers/get',{answerID:message.id})).answer),frozen);
 conversation=(await post('/research/conversations/evidence',{conversationID:conversation.id,action:'remove',sourceID:conversation.sources[0].id,
  expectedRevision:conversation.revision,expectedEvidenceSetVersion:conversation.evidenceSetVersion})).conversation;
 conversation=(await post('/research/conversations/message',{...input,requestID:'reference-removed',question:'Explain these rules.',
  expectedRevision:conversation.revision,expectedEvidenceSetVersion:conversation.evidenceSetVersion})).conversation;
 assert.equal(packets.length,4,'Removing the attached passage stops reuse of its automatically retrieved references');
 assert.equal(conversation.messages.at(-1).answer.charged,false);
 console.log('PASS reference HTTP flow: complete real table/notes in writer + reviewer, unchanged attachments, source provenance + grid snapshot, correct citations, replay, selected-only opt-out, removal and immutable history; paid calls: 0.');
 }
}finally{globalThis.fetch=nativeFetch;server?.closeAllConnections();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
