import assert from 'node:assert/strict';
import { buildResearchPassageIndex } from '../research-passage-index.mjs';
import { discoverRelevantEvidence } from '../evidence-discovery.mjs';
const section = {id:'rule', codePrefix:'MC', sectionNumber:'504.4', title:'Exhaust installation'};
const body = {blocks:[{id:'text',plainText:'Clothes-dryer exhaust ducts shall terminate outside the building. Screens shall not be installed at the duct termination.'}]};
const passageIndex = await buildResearchPassageIndex([section], async () => body);
const args = {question:'May an insect screen cover the clothes dryer exhaust termination?', catalog:[section],
  invertedIndex:new Map([['exhaust',['rule']]]), passageIndex, readSectionBody:async () => structuredClone(body), limit:1};
const baseline = await discoverRelevantEvidence(args);
let started = false, inspected = false;
const watched = {...section};
Object.defineProperty(watched,'title',{enumerable:true,get(){assert(started,'Semantic request should start before lexical title scanning');inspected=true;return section.title;}});
const candidate = await discoverRelevantEvidence({...args,catalog:[watched], semanticSearch:{search:async (_index,query,options)=>{
  assert.equal(query,args.question);assert.deepEqual(options,{limit:100});started=true;
  await new Promise(resolve=>setImmediate(resolve));return {hits:[],metadata:{enabled:true}};
}}});
assert(inspected);
const {semanticSearch,...rest}=candidate;
assert.deepEqual(rest,baseline,'Scheduling must preserve full discovery output when semantic hits are unchanged.');
let reads=0;
await assert.rejects(discoverRelevantEvidence({...args,readSectionBody:async()=>{reads++;return body;},
  semanticSearch:{search:async()=>{throw Object.assign(new Error('reservation denied'),{researchReservationFailure:true});}}}),/reservation denied/);
assert.equal(reads,0,'Reservation failure must stop before admitting canonical bodies.');
console.log('Retrieval scheduling preserves query, full output and reservation failure while overlapping semantic startup with lexical work.');
