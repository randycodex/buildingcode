import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {researchDiscoveryQuery} from '../public/research-v2.js';
const scratch=await mkdtemp(join(tmpdir(),'research-v2-discovery-'));
for(const key of Object.keys(process.env))if(/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$|BLOB_)/.test(key))delete process.env[key];
Object.assign(process.env,{NODE_ENV:'test',PERMITEXT_SYNC_DATA_PATH:join(scratch,'store.json'),PERMITEXT_RESEARCH_V2:'1',PERMITEXT_RESEARCH_V2_BUDGET_PATH:join(scratch,'unused-budget.json'),PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:'discovery-test-grant'});
const {handleRequest,createFileStoreAdapter}=await import('../app.mjs');
const server=createServer(handleRequest);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,nativeFetch=globalThis.fetch;
globalThis.fetch=(url,options)=>{assert.equal(new URL(url).origin,base,'Discovery cannot call an external provider');return nativeFetch(url,options);};
let token;
async function post(path,body,status=200,bearer=token){const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(bearer?{authorization:`Bearer ${bearer}`}:{})},body:JSON.stringify({auth:{accountUserID:'apple:discovery-test'},...body})});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;}
const cases=[
  ['What affects corridor fire ratings?',['1020.1.1','1020.1.2']],
  ['What is the accessible ramp slope?',['1012.2']],
  ['Explain 1012.2',['1012.2']],
  ['What is the occupant load factor?',['1004.1.3']],
  ['What is the door clear width?',['1010.1.1.1']],
  ['Explain stair riser height',['1011.5.2']],
  ['What is the handrail height?',['1014.2']],
  ['What is ramp cross slope?',['1012.3']],
  ['What is the corridor sprinkler rating?',['1020.1.1','1020.1.2']],
  ['Explain the occupant load table',['1004.1.3']],
  ['Explain exhaust discharge',['501.3'],'MC'],
  ['Find the fire partition definition',['202']],
  ['Do hallway walls need a fire rating?',['1020.1.1','1020.1.2']]
];
try{
  await post('/admin/lifetime-grants/grant',{userID:'apple:discovery-test'},200,process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  token=(await post('/account/sign-in',{credential:{provider:'apple',providerUserID:'discovery-test',email:'discovery@example.test',displayName:'Discovery test'}})).account.backendSessionToken;
  const adapter=createFileStoreAdapter(),before=await adapter.read();
  for(const [question,expected,prefix='BC'] of cases){
    const query=researchDiscoveryQuery(question);
    const data=await post('/research/sources/discover',{question});
    const actual=data.candidates.filter(s=>s.codePrefix===prefix&&s.codeVersion.includes('/2022-')).map(s=>s.sectionNumber);
    for(const number of expected)assert(actual.includes(number),`${question}: missing ${number} in first 12 results: ${JSON.stringify(data.candidates.map(c=>[c.sectionNumber,c.kind,c.title]))}`);
    console.log(JSON.stringify({question,query,expected,actual,roles:data.coverage.roles,passed:true}));
    assert.equal(data.paidModelCall,false);assert.equal(data.generatedAnswer,false);
    assert(data.candidates.every(s=>data.sourceEditions.some(e=>s.codeVersion===e.codeVersion)));
    if(question.includes('fire partition definition')){const definition=data.candidates.find(c=>c.kind==='definition'&&c.definitionLabel==='FIRE PARTITION');assert(definition);assert(definition.suggestedText.includes('FIRE PARTITION'));}
    assert(!data.unresolvedReferences.some(c=>c.codePrefix==='MC'&&c.title.includes('903.3.1.1')),'Named Building Code references must not become Mechanical Code references.');
    if(question.includes('occupant load table')){
      const table=data.candidates.find(c=>c.kind==='table'&&c.codePrefix==='BC'&&c.sectionNumber==='1004.1.3');assert(table,'Find the requested table, not an incidental table.');
      const preview=(await post('/research/selections/review',{sectionID:table.sectionID,codeVersion:table.codeVersion,reviewMode:'whole_section'})).selection;
      assert.match(preview.selectedText,/To be used only when/,'Keep final footnote e.');
      assert.match(preview.selectedText,/28-117\.1/,'Keep the rooftop qualification and reference.');
      const partial=preview.selectedText.split(' ').slice(0,30).join(' ');
      const pinned=(await post('/research/conversations/create',{analysisMode:'conversation_only',selections:[{...preview,selectedText:partial}]},201)).conversation;
      const related=await post('/research/conversations/related',{conversationID:pinned.id,expectedRevision:pinned.revision,
        expectedEvidenceSetVersion:pinned.evidenceSetVersion,researchEngine:'v2',question});
      assert(related.candidates.some(c=>c.sectionID===table.sectionID),'An included excerpt must not hide unselected table notes from follow-up discovery.');
    }
  }
  const after=await adapter.read();
  assert.equal(Object.values(after.researchConversationsByUserID||{}).flat().length,1,'Only the explicit excerpt attachment creates a conversation. Discovery creates none.');
  assert.deepEqual(after.researchAnswersByUserID,before.researchAnswersByUserID);
  await post('/research/sources/discover',{question:'hi'},400);
  const historic=await post('/research/sources/discover',{question:'2014 BC ramp slope 1010.2'});
  assert(historic.candidates.length);assert(historic.candidates.every(c=>c.codeVersion.includes('/2014-')),'Explicit historic discovery retains its edition.');
  const unavailable=await post('/research/sources/discover',{question:'Explain BC Section 9999.99'});
  assert(unavailable.unresolvedReferences.some(c=>c.title==='BC § 9999.99'),'An unavailable exact requested citation remains explicit.');
  const focused=await post('/research/sources/discover',{question:'What is the ramp slope?',focus:'BC Section 1014.2 handrail height'});
  assert.equal(focused.candidates[0].sectionNumber,'1014.2','A missing source search follows the selected gap, not the old ramp topic.');
  assert.match(focused.searchQuery,/handrail/);assert(!focused.searchQuery.includes('ramp'));
  const naturalGap=await post('/research/sources/discover',{question:'What handrail height is required?',focus:'The applicable handrail-height code provision, including any scope or exceptions relevant to the ramp.'});
  assert.equal(naturalGap.searchQuery,'handrail height');assert(naturalGap.candidates.some(c=>c.codePrefix==='BC'&&c.sectionNumber==='1014.2'));
  const question='What affects corridor fire ratings?';
  let page=await post('/research/sources/discover',{question}),cursor=page.nextCursor;assert(cursor);
  const firstCursor=cursor,ids=new Set(page.candidates.map(c=>c.id));let pages=1;
  while(cursor){page=await post('/research/sources/discover',{question,cursor});pages++;
    for(const candidate of page.candidates){assert(!ids.has(candidate.id),'Pages do not repeat candidates.');ids.add(candidate.id);}cursor=page.nextCursor;
    assert(pages<12,'Pagination is bounded.');
  }
  assert(pages>1);assert.equal(ids.size,page.coverage.candidateCount);assert.equal(page.coverage.omittedCandidateCount,0);
  await post('/research/sources/discover',{question,focus:'A changed search',cursor:firstCursor},409);
  await post('/research/sources/discover',{question,cursor:'not-a-page'},400);
  await post('/research/sources/discover',{question,focus:{}},400);
  const final=await adapter.read();assert.deepEqual(final.researchConversationsByUserID,after.researchConversationsByUserID);assert.deepEqual(final.researchAnswersByUserID,after.researchAnswersByUserID);
  console.log('Discovery: 13 developer-authored known-target checks passed. This does not measure complete regulatory coverage. No paid calls.');
}finally{globalThis.fetch=nativeFetch;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
