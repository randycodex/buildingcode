import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createConversationMemory,callWithAssistantContextRecovery} from '../assistant-conversation-memory.mjs';
import {runExperimentalAssistant} from '../assistant-experimental.mjs';
const history=Array.from({length:2000},(_,i)=>({role:i%2?'assistant':'user',content:`Unrelated ceiling coordination note ${i}. `+'coordination '.repeat(25)}));
history[10]={role:'user',content:'The entrance clear width is 39 inches, still an unverified assumption.'};
history[600]={role:'user',content:'Correction: the entrance clear width is confirmed at 42 inches; the 39-inch value was an assumption.'};
history[1200]={role:'user',content:'The cellar study may be abandoned; no final design decision yet.'};
history[1998]={role:'user',content:'Can both stairs be next to each other?'};history[1999]={role:'assistant',content:'We need to examine the separation rules and occupancy exceptions.'};
const sources=Array.from({length:2000},(_,i)=>({id:`R${i+1}`,sectionID:`section-${i}`,title:`Other source ${i}`,summary:'A past source.',searchText:'Full immutable source text. '+'content '.repeat(100),priorQuestion:'Old coordination topic'}));
sources[1700]={...sources[1700],title:'Earlier residents terrace accessibility provisions',searchText:'Complete resident terrace rule. Footnote: maintain a compliant accessible route.'};
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');const before=digest({history,sources});
const memory=createConversationMemory(history,sources),working=memory.context('What width did I confirm for the entrance?');
assert.equal(memory.totals.messages,2000);assert.equal(memory.totals.sources,2000);
assert(Buffer.byteLength(JSON.stringify(working))<50000);
assert(working.conversation.some(m=>m.content.includes('confirmed at 42')));
assert.equal(working.conversation.at(-1).content,history.at(-1).content);
const far=memory.search('cellar abandoned');assert(far.messages.some(m=>m.id==='H1201'));
assert(memory.read(['H11'])[0].text.includes('unverified assumption'));
assert(memory.search('resident terrace accessibility').sourceCandidates.some(s=>s.id==='R1701'));
const huge=createConversationMemory([{role:'user',content:'large-message-'.repeat(3000)}],[]);
const first=huge.read(['H1'])[0],second=huge.read(['H1'],first.nextOffset)[0];assert(first.nextOffset);assert.equal(first.text+second.text,('large-message-'.repeat(3000)).slice(0,24000));
assert.equal(digest({history,sources}),before,'Selecting/searching/reading never mutates the complete archive');
const message=text=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text}]}]});
const invoke=(name,args)=>({status:'completed',output:[{type:'function_call',call_id:name,name,arguments:JSON.stringify(args)}]});
let step=0,recalls=0;
const result=await runExperimentalAssistant({question:'But does this occupancy change that?',history:history.map(m=>({role:m.role,text:m.content})),priorEvidence:sources},{
 searchLibrary:()=>assert.fail('No forced new search'),recallEvidence:async ids=>{if(!ids.includes('R1701'))return {sources:[]};recalls++;return {sources:[{id:'S8',sectionID:'section-1700',text:sources[1700].searchText}]};},
 call:async(body,{phase})=>{
  if(phase==='experimental_intent'){assert(Buffer.byteLength(JSON.stringify(body))<100000);const ctx=JSON.parse(body.input);assert.equal(ctx.archive.messages,2000);assert(ctx.latestExchange.at(-1).content.includes('separation'));return message(JSON.stringify({question:'Does residential use affect stair separation?',subject:'Stair separation',reference:'latest',clarification:'',evidenceIDs:[]}));}
  step++;
  if(step===1)return invoke('search_conversation',{query:'resident terrace accessibility'});
  if(step===2){const r=JSON.parse(body.input.at(-1).output);assert(r.sourceCandidates.some(s=>s.id==='R1701'));return invoke('read_conversation',{messageIDs:['H601'],sourceIDs:['R1701'],offset:0});}
  const r=JSON.parse(body.input.at(-1).output);assert(r.messages[0].text.includes('confirmed at 42'));assert(JSON.parse(body.input[0].content).readEvidence[0].text.includes('Footnote'));return message('The saved evidence contains the complete route condition. [S8]');
 }});
assert.equal(recalls,1);assert.match(result.text,/\[S8\]/);assert(result.trace.some(t=>t.tool==='search_conversation'));
let attempts=0;const body={input:JSON.stringify({earlierConversation:history,priorEvidence:sources})};
const recovered=await callWithAssistantContextRecovery(async next=>{if(++attempts===1)throw Object.assign(new Error('provider context'),{providerCause:'context_length_exceeded'});assert(Buffer.byteLength(JSON.stringify(next))<30000);return 'recovered';},body,{});
assert.equal(recovered,'recovered');assert.equal(attempts,2);
await assert.rejects(callWithAssistantContextRecovery(async()=>{throw {providerCause:'context_length_exceeded'};},body,{}),e=>e.code==='ASSISTANT_CONTEXT_CAPACITY'&&/complete conversation and sources are saved/.test(e.message)&&!/approved Luna/.test(e.message));
let budgetAttempts=0;await assert.rejects(callWithAssistantContextRecovery(async()=>{budgetAttempts++;throw Object.assign(new Error('budget'),{code:'V2_BUDGET_EXHAUSTED'});},body,{}),{code:'V2_BUDGET_EXHAUSTED'});assert.equal(budgetAttempts,1);
console.log('Long chat: 2,000 messages/2,000 sources, distant corrections, complete archive retrieval/paging, source recall, latest topic, context recovery and preserved budget checks passed.');
const repeatedLatest=history.map(m=>({...m}));repeatedLatest[1998]={role:'user',content:'What about the ceiling coordination layouts?'};repeatedLatest[1999]={role:'assistant',content:'The ceiling coordination layouts still need discussion.'};
assert(createConversationMemory(repeatedLatest,sources).context('What entrance width did I confirm?').conversation.some(m=>m.content.includes('confirmed at 42')),'Explicit return must outrank repetitive recent-topic vocabulary');
const page=memory.search('source');assert(page.nextOffset);const next=memory.search('source',page.nextOffset);assert.notEqual(page.sourceCandidates[0].id,next.sourceCandidates[0].id);
console.log('Long chat: explicit subject priority and paginated archive search passed.');
const webMemory=createConversationMemory([],[{id:'Rweb',url:'https://www.nyc.gov/example',title:'An earlier official document',summary:'Historical web reference'}]);
assert.equal(webMemory.search('official document').sourceCandidates[0].url,'https://www.nyc.gov/example');
const historicalReference=await runExperimentalAssistant({question:'Which official document did we use?',history:[{role:'user',text:'We used the official document.'},{role:'assistant',text:'It was an earlier web source.'}],priorEvidence:[{id:'Rweb',url:'https://www.nyc.gov/example',title:'Earlier document'}]},{
 recallEvidence:async()=>({sources:[],references:[{id:'Rweb',url:'https://www.nyc.gov/example',status:'historical_reference_not_reverified'}]}),
 call:async(body)=>{assert.equal(JSON.parse(body.input[0].content).earlierReferences[0].status,'historical_reference_not_reverified');return message('The saved document was https://www.nyc.gov/example .');}
});
assert.match(historicalReference.text,/www.nyc.gov/);
console.log('Long chat: historical web identities preserved distinctly from freshly verified source text.');
const state={};let repeated=0;
const provider=async next=>{if(++repeated===1)throw {providerCause:'context_length_exceeded'};assert(Buffer.byteLength(JSON.stringify(next))<30000);return 'ok';};
await callWithAssistantContextRecovery(provider,body,{},state);
await callWithAssistantContextRecovery(provider,body,{},state);
assert.equal(repeated,3,'Following research calls retain the smaller working request after recovery');
console.log('Long chat: capacity recovery stays active for the rest of the current answer.');
let capacityAttempt=0;
await callWithAssistantContextRecovery(async next=>{
 if(!capacityAttempt++)throw {providerCause:'context_length_exceeded'};
 assert(next.input.some(m=>m.role==='assistant'&&m.content==='The current subject is stair separation.'));
 return 'ok';
},{input:[{role:'user',content:JSON.stringify({question:'But does this occupancy change that?'})},{role:'user',content:'Can both stairs be adjacent?'},{role:'assistant',content:'The current subject is stair separation.'},{role:'user',content:'But does this occupancy change that?'}]},{});
console.log('Capacity recovery preserves the latest exchange as well as the current question.');
