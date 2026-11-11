import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {searchCitationQuery} from '../public/search-citation-query.js';
import {prepareLocalSearch,matchLocalSearch} from '../public/downloaded-library-core.js';
import {researchSelectedTables} from '../research-table-footnotes.mjs';
import {researchV2FailureMessage} from '../research-v2-engine.mjs';
const scratch=await mkdtemp(join(tmpdir(),'citation-workflow-'));
for(const key of Object.keys(process.env))if(/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$|BLOB_|CLERK_|STRIPE_|RESEND_|APPLE_.*(?:SECRET|KEY))/.test(key))delete process.env[key];
Object.assign(process.env,{NODE_ENV:'test',OPENAI_API_KEY:'offline-double',PERMITEXT_SYNC_DATA_PATH:join(scratch,'store.json'),PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(scratch,'assets'),PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN:'1',PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:randomUUID(),PERMITEXT_RESEARCH_V2:'1',PERMITEXT_RESEARCH_V2_BUDGET_PATH:join(scratch,'budget.json'),PERMITEXT_RESEARCH_MODEL:'gpt-6-luna',PERMITEXT_RESEARCH_MAX_REQUEST_USD:'1',PERMITEXT_RESEARCH_USER_DAILY_CAP_USD:'7',PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD:'7',PERMITEXT_RESEARCH_DAILY_CAP_USD:'7',PERMITEXT_RESEARCH_MONTHLY_CAP_USD:'7',PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS:'.1',PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS:'.01',PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:'.5',PERMITEXT_RESEARCH_PRICING_VERSION:'offline-test'});
const nativeFetch=globalThis.fetch;
let scenario,round,phases,packets,server,token,userID;
globalThis.fetch=async(url,options)=>{
 assert.equal(String(url),'https://api.openai.com/v1/responses','No external retrieval');
 const body=JSON.parse(options.body),review=body.text.format.name==='permitext_v2_review',input=JSON.parse(body.input),packet=input.evidence||input;
 phases.push(review?'review':round++?'repair':'draft');packets.push(packet);
 const source=packet.sources.find(s=>s.sectionID==='2152');assert(source);
 if(scenario==='partial')assert(!source.tables,'A prose selection cannot import an unselected grid');
 else {
  assert(source.tables?.length,'The real HTTP flow must deliver canonical selected table structure');
  const rows=source.tables.flatMap(t=>t.grids.flatMap(g=>g.rows));
  assert(rows.some(r=>r.cells[0].text.startsWith('Business areas')&&r.cells[1].text==='100 gross b, d'));
  const library=rows.find(r=>r.cells[0].text.startsWith('Library'));
  assert.deepEqual(library.cells.map(c=>c.lines),[['Library','Reading rooms','Stack area'],['','50 net','100 gross']]);
  const residential=rows.find(r=>r.cells[0].text.startsWith('Residential'));
  assert.equal(residential.cells[0].lines[2],'Rooftop and terrace accessory to Groups R-2 and R-3');
  assert.equal(residential.cells[1].lines[2],'200 gross b, c, d','Empty first line preserves the canonical subrow/marker alignment');
  assert(source.tableFootnotes.find(n=>n.marker==='c').quote.includes('R-2'));
  assert(!source.tableFootnotes.find(n=>n.marker==='d').quote.includes('R-2'));
 }
 let value;
 if(review)value={pass:true,issues:[]}; // Deliberately cannot overrule the mechanical guards.
 else {
  const bad=(scenario==='repair'&&round===1)||scenario==='rejected';
  const unknown=scenario==='identity'&&round===1;
  const answerText=bad?'Footnote d is limited to Group R-2. [S1]':scenario==='partial'?'The selected excerpt uses an occupant-load calculation. [S1]':'Business uses 100 gross with markers b and d; Library Reading rooms uses 50 net. Footnote c describes the residential rooftop context; footnote d states a separate rooftop-or-terrace threshold and certificate requirement. [S1]';
  value={questionTitle:'Table row and footnote comparison',answerText:unknown?answerText.replaceAll('S1','S999'):answerText,claims:[{text:bad?'Footnote d is limited to Group R-2.':scenario==='partial'?'The selected text refers to occupant-load calculation.':'Business has markers b and d; footnote c has a separate residential context.',sourceIDs:[unknown?'S999':source.id]}],missingSources:[],missingFacts:[]};
 }
 return Response.json({model:body.model,status:'completed',service_tier:'default',usage:{input_tokens:200,output_tokens:100},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
};
try{
 const {handleRequest,createFileStoreAdapter}=await import('../app.mjs');
 const {activeCodeSourceCatalog}=await import('../active-code-source-catalog.mjs');
 server=createServer(handleRequest);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const catalog=await activeCodeSourceCatalog(),scope=JSON.stringify({version:1,enabledSources:catalog});
 const get=async(q,extra={})=>{const url=new URL('/code/search',base);for(const[k,v]of Object.entries({q,version:'all',match:'words',grouped:'true',limit:'25',sourceScope:scope,...extra}))url.searchParams.set(k,v);const response=await nativeFetch(url);assert.equal(response.status,200);return response.json();};
 for(const[prefix,number]of [['BC','1004.1.3'],['PC','403.1'],['MC','403.1'],['FGC','401.1'],['BC','903.2']]){
  for(const query of [`${prefix} ${number}`,`${prefix.toLowerCase()} § ${number}`,`Section ${prefix} ${number}`]){
   const data=await get(query);assert.equal(data.query,query);assert(data.results.length,query);assert(data.results.every(r=>r.codePrefix===prefix));assert(data.results.some(r=>r.sectionNumber===number&&r.codeVersion.includes('2022')),query+JSON.stringify(data.results.slice(0,3)));
   const context=prepareLocalSearch(new URL(`/code/search?${new URLSearchParams({q:query,version:'all',match:'words'})}`,base),{codeSources:catalog});
   assert.equal(context.matchQuery,number);
   const result=data.results.find(r=>r.sectionNumber===number&&r.codeVersion.includes('2022'));
   const record={...result,plainText:'Exact selected section.',codeSectionID:result.codeSource?.categoryID};
   assert.equal(matchLocalSearch(record,context,{codeSources:catalog}).rank,0,'Downloaded matching uses the bare identifier');
   assert.equal(matchLocalSearch({...record,codePrefix:prefix==='BC'?'PC':'BC'},context,{codeSources:catalog}),null,'Downloaded scope cannot cross the named code');
  }
 }
 for(const query of ['BC fire separation','unrecognized 1004.1.3','"BC 1004.1.3"','1004.1.3'])assert.equal(searchCitationQuery(query).query,query,'Ordinary prose, quoted text and bare queries remain unchanged');
 assert.equal((await get('BC 1004.1.3',{codes:'PC'})).results.length,0,'Explicit conflicting code scope cannot be widened');
 assert.equal((await get('BC 1004.1.3',{sourceScope:JSON.stringify({version:1,enabledSources:catalog.filter(s=>s.codePrefix==='PC')})})).results.length,0,'Disabled codebooks stay disabled');
 const old=catalog.find(s=>s.codePrefix==='BC'&&s.canonicalEdition.includes('2014'));
 const oldResults=await get('BC 1004.1.3',{sourceScope:JSON.stringify({version:1,enabledSources:[old]})});assert(oldResults.results.length);assert(oldResults.results.every(r=>r.codeVersion===old.canonicalEdition));
 assert.equal((await get('BC § 1004.1.3',{match:'exact',codes:'BC'})).results[0].sectionNumber,'1004.1.3');
 const post=async(path,body={},bearer=token)=>{const response=await nativeFetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(bearer?{authorization:`Bearer ${bearer}`}:{})},body:JSON.stringify({auth:{accountUserID:userID},...body})});return{status:response.status,body:await response.json()};};
 const account=(await post('/account/sign-in',{credential:{provider:'web',providerUserID:randomUUID()}})).body.account;token=account.backendSessionToken;userID=account.appUserID;await post('/admin/lifetime-grants/grant',{userID},process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
 const version='CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1';
 const selection=(await post('/research/selections/review',{sectionID:'2152',codeVersion:version,reviewMode:'whole_section'})).body.selection;
 assert(selection?.selectedText.includes('100 gross b, d'));
 for(scenario of ['accepted','repair','rejected','identity','partial']){
  round=0;phases=[];packets=[];
  const selectedText=scenario==='partial'?'The number of occupants shall be computed at the rate of one occupant per unit of area as prescribed in Table 1004.1.3.':selection.selectedText;
  const c=(await post('/research/conversations/create',{analysisMode:'conversation_only',selections:[{...selection,selectedText}]})).body.conversation;assert(c?.id);
  const r=await post('/research/conversations/message',{conversationID:c.id,expectedRevision:c.revision,expectedEvidenceSetVersion:c.evidenceSetVersion,researchEngine:'v2',analysisMode:'conversation_only',question:'P6 TEST ONLY. Compare Business and Library reading-room factors; keep footnotes c and d separate.',requestID:randomUUID()});
  if(scenario==='rejected'){
   assert.equal(r.status,422,JSON.stringify(r.body));assert.equal(r.body.code,'V2_REVIEW_FAILED');assert.match(r.body.error,/table interpretation/);assert.doesNotMatch(r.body.error,/draft’s citations/);
  }else{
   assert.equal(r.status,200,JSON.stringify(r.body));const answer=r.body.conversation.messages.at(-1).answer;assert.equal(answer.verification.pass,true);assert.equal(answer.verification.attempts,['repair','identity'].includes(scenario)?2:1);
   const saved=(await post('/research/conversations/get',{conversationID:c.id})).body.conversation.messages.at(-1).answer;assert.equal(saved.answerText,answer.answerText);
  }
  assert.deepEqual(phases,['repair','rejected','identity'].includes(scenario)?['draft','review','repair','review']:['draft','review']);
  assert(packets.every(p=>p.sources[0].text===packets[0].sources[0].text),'Every fresh review uses the unchanged selected text');
 }
 const stored=await createFileStoreAdapter().read();assert.equal(stored.researchAnswersByUserID[userID].length,4,'Rejected text is never saved as a reviewed answer');
 assert.match(researchV2FailureMessage([{code:'unknown_citation'}]),/draft’s citations/,'Real citation failures retain their own explanation');
 const table={kind:'table',reference:'Synthetic table',text:'A | B',grids:[{rows:[{cells:[{text:'A'},{text:'B'}]}]}]};
 assert.equal(researchSelectedTables('A',[table]).length,0);assert.equal(researchSelectedTables('A | B',[{...table,grids:[{rows:[{cells:[{text:'UNSELECTED'}]}]}]}]).length,0);
 const wrongLines={...table,grids:[{rows:[{cells:[{text:'A',lines:['UNSELECTED']},{text:'B',lines:['B']}]}]}]};
 assert.equal(researchSelectedTables('A | B',[wrongLines])[0].grids[0].rows[0].cells[0].lines,undefined,'Line metadata cannot inject unselected text');
 console.log('Citation workflow fixes passed: 15 online/downloaded citation cases; exact, historical and disabled scope; five real HTTP Assistant flows, canonical table structure, fresh repair review, blocked wrong footnotes/unknown IDs, accurate failure copy, durable saved answers; zero live provider calls.');
}finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}globalThis.fetch=nativeFetch;await rm(scratch,{recursive:true,force:true});}
