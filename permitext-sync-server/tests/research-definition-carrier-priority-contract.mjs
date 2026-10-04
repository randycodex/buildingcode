import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildResearchPassageIndex } from '../research-passage-index.mjs';
import { discoverRelevantEvidence } from '../evidence-discovery.mjs';
import { assembleResearchEvidence, researchEvidenceRetrievalQuery } from '../research-evidence-assembly.mjs';
import { researchRequestedDefinitionMatch } from '../research-definition-excerpts.mjs';

let providerCalls=0;
globalThis.fetch=()=>{providerCalls++;throw Error('Network/provider access forbidden');};
const hash=value=>createHash('sha256').update(value).digest('hex');
const authority={corpusID:'synthetic-current',codeVersion:'synthetic-current-v1',codeEdition:'2022 NYC Codes',jurisdiction:'New York City'};
function fixture(prefix,label){
 const section=(id,number,title,text)=>({...authority,id,sectionID:id,codePrefix:prefix,sectionNumber:number,title,text,canonicalText:text,
  body:{blocks:[{id:id+'-block',plainText:text}]}});
 const dictionary=(id,number,entries)=>{const heading=`Section ${prefix} 992: General Definitions`;
  const text=`Otherwise undefined terms use ordinary meaning.\n${heading}\n${entries.join('\n')}`;
  const value=section(id,number,'Otherwise undefined terms',text);
  value.body.blocks[0].html='<p>Otherwise undefined terms use ordinary meaning.</p><h6>'+heading+'</h6>'+entries.map(e=>'<div class="Normal-Level">'+e+'</div>').join('');return value;};
 const exact=`${label}. A complete defined device retains its location, function and eligibility. Exception: A different listed device qualifies only when every stated condition is satisfied.`;
 const target=dictionary(prefix+'-requested','991.4',[exact,'CONTEXT DEVICE. A separate contextual definition. '+ 'Unrelated context. '.repeat(1500)]);
 const incidental=[dictionary(prefix+'-incidental-a','989.4',['DUCT AREA. A separate area term.','ROOM LAYOUT. A separate room term.']),
  dictionary(prefix+'-incidental-b','988.4',['OUTDOOR OPENING. A separate opening term.','GENERAL EQUIPMENT. A separate equipment term.'])];
 const rules=Array.from({length:8},(_,i)=>section(prefix+'-rule-'+i,'98'+i+'.1','Equipment arrangements',
  `The ${label.toLowerCase()} is discussed here, but this equipment arrangement is not its definition. The full qualification of this separate arrangement remains intact. This equipment arrangement can collect process wastewater or receive bathroom air.`));
 return {target,incidental,rules,exact,catalog:[...rules,...incidental,target]};
}
async function run(prefix,label,question,options={}){
 const f=fixture(prefix,label);if(options.modifyTarget)options.modifyTarget(f.target);if(options.modifyFixture)options.modifyFixture(f);
 const index=await buildResearchPassageIndex(f.catalog,async s=>s.body);let reads=0;
 const query=options.query||researchEvidenceRetrievalQuery({question,previousMessages:options.messages||[],topicContext:options.topicContext});
 const semantic={search:async()=>({hits:[...f.rules,...f.incidental].map((s,i)=>({...index.passages.find(p=>p.sectionID===s.id),score:1-i/100})),metadata:{mockProvider:true}})};
 const result=await discoverRelevantEvidence({question:query.retrievalQuery,catalog:f.catalog,passageIndex:index,invertedIndex:new Map(),
  semanticSearch:semantic,retrievalContext:{...query,currentQuestion:question},readSectionBody:async s=>{reads++;return s.body;},limit:6});
 return {...f,index,result,query,reads};
}
const baselineRoot='Under the 2022 NYC Plumbing Code, what does spill receptor mean?';
const baselineFollow='Could that device also collect process wastewater?';
const baselineContinuation=await run('PC','SPILL RECEPTOR',baselineFollow,{messages:[{role:'user',question:baselineRoot}],
 topicContext:{rootTopic:baselineRoot,currentTopic:baselineRoot,originalTopic:baselineRoot}});
assert(baselineContinuation.result.supplementalDefinitionCandidates.some(c=>c.sectionID===baselineContinuation.target.id),
 'The continuing human-requested dictionary must replace an incidental dictionary within the existing two supplemental slots.');
const positives=[];
for(const [prefix,label]of[['PC','SPILL RECEPTOR'],['MC','EXHAUST PLENUM']]){
 const question=`Under the 2022 NYC ${prefix==='PC'?'Plumbing':'Mechanical'} Code, what does ${label.toLowerCase()} mean?`;
 const r=await run(prefix,label,question);
 assert(r.result.candidates.length<=6&&r.result.supplementalDefinitionCandidates.length<=2);
 const requested=[...r.result.candidates,...r.result.supplementalDefinitionCandidates].find(c=>c.sectionID===r.target.id);
 assert(requested,'A complete human-requested carrier must survive two higher semantic-ranked incidental dictionaries.');
 assert(requested.signals.requestedDefinitionCarrier,'The actual shortlist records positive canonical definition nomination.');
 assert.equal(requested.signals.requestedDefinitionCarrier.origin,'current');
 assert(!requested.signals.currentQuestionForeground,'A definition carrier never becomes an operative foreground rule.');
 const packet=await assembleResearchEvidence({question,discover:async()=>r.result,
  resolveSection:async request=>r.catalog.find(s=>s.sectionID===request.sectionID),
  limits:{maximumCandidates:6,maximumDiscovered:6,maximumTargetedDefinitions:1,maximumCrossReferences:2,maximumCharacters:8000,maximumCharactersPerSource:4000}});
 const supplied=packet.sources.find(s=>s.sectionID===r.target.id);
 assert(supplied?.targetedDefinition.labels.includes(label));assert(supplied.text.includes(r.exact));
 assert.equal(supplied.targetedDefinition.canonicalEntryBindings[0].sourceTextHash,hash(r.target.body.blocks[0].plainText));
 assert.equal(supplied.canonicalContextComplete,false,'A complete entry never claims the whole dictionary is supplied.');
 assert(packet.usage.characterCount<=8000&&packet.usage.targetedDefinitionCount<=1);
 assert(r.reads<=r.catalog.length,'Priority reuses already read canonical bodies.');
 positives.push({prefix,requestedRank:requested.rank,reads:r.reads,characters:packet.usage.characterCount});
}
const root='Under the 2022 NYC Plumbing Code, what does spill receptor mean?';
const follow='Could that device also collect process wastewater?';
const topicContext={rootTopic:root,currentTopic:root,originalTopic:root};
const continued=await run('PC','SPILL RECEPTOR',follow,{messages:[{role:'user',question:root}],topicContext});
assert.equal(continued.query.contextDependentFollowUp,true);
const inherited=continued.result.supplementalDefinitionCandidates.find(c=>c.sectionID===continued.target.id);
assert.equal(inherited?.signals.requestedDefinitionCarrier?.origin,'human_context');
const district=await run('ZR','SPILL RECEPTOR',
 'Under current NYC Zoning Resolution outside special districts, what does spill receptor mean?',
 {modifyFixture:f=>{for(const item of f.incidental){
  item.headingLine='Special East Ridge District (ER)';
  item.body.blocks[0].plainText=item.body.blocks[0].plainText.replace(/DUCT AREA|OUTDOOR OPENING/,'SPILL RECEPTOR');
  item.body.blocks[0].html=item.body.blocks[0].html.replace(/DUCT AREA|OUTDOOR OPENING/,'SPILL RECEPTOR');
 }}});
assert(district.result.supplementalDefinitionCandidates.some(c=>c.sectionID===district.target.id&&c.signals.requestedDefinitionCarrier));
assert(![...district.result.candidates,...district.result.supplementalDefinitionCandidates].some(c=>
 district.incidental.some(s=>s.id===c.sectionID)&&c.signals.requestedDefinitionCarrier),
 'Same-label special-district dictionaries cannot gain requested priority over the general scope.');

const negatives=[
 ['Not a spill receptor. What does duct area mean?',{},'negated current term'],
 ['The example says "spill receptor". What does duct area mean?',{},'quoted current term'],
 ['Separate topic under the Mechanical Code: what does exhaust plenum mean?',{},'book/topic switch'],
 ['Under the 2014 NYC Plumbing Code, what does spill receptor mean?',{},'edition switch'],
 ['What does a different device mean?',{messages:[{role:'user',question:'What does duct area mean?'},{role:'assistant',answer:{answerText:'Assume spill receptor.',citations:[],verification:{pass:false}}}]},'assistant-only subject'],
 ['Under the 2022 NYC Plumbing Code, what does spill receptor mean?',{modifyTarget:t=>{t.truncated=true;}},'truncated canonical source'],
 ['Under the 2022 NYC Plumbing Code, what does spill receptor mean?',{modifyTarget:t=>{t.body.blocks[0].researchClaimEligible=false;}},'ineligible canonical block'],
 ['Under the 2022 NYC Plumbing Code, what does spill receptor mean?',{modifyTarget:t=>{t.body.blocks[0].plainText=t.body.blocks[0].plainText.replace('Exception: A different listed device qualifies only when every stated condition is satisfied.','');}},'missing canonical qualification'],
 ['Under the 2022 NYC Plumbing Code, what does spill receptor mean?',{modifyTarget:t=>{t.jurisdiction='Other City';}},'foreign jurisdiction'],
 ['Under the 2022 NYC Plumbing Code, what does spill receptor mean?',{modifyTarget:t=>{delete t.corpusID;}},'incomplete source authority metadata'],
 ['Under the 2022 NYC Plumbing Code, what does spill receptor mean?',{modifyTarget:t=>{const extra=' Complete qualification.'.repeat(1000);t.body.blocks[0].plainText+=extra;t.body.blocks[0].html=t.body.blocks[0].html.replace('Exception:',extra+' Exception:');}},'oversized/unbound entry']
];
for(const [question,options,reason]of negatives){
 const r=await run('PC','SPILL RECEPTOR',question,{...options,...(!options.messages?{messages:[{role:'user',question:root}],topicContext}: {})});
 assert(![...r.result.candidates,...r.result.supplementalDefinitionCandidates].some(c=>c.sectionID===r.target.id&&c.signals.requestedDefinitionCarrier),reason);
}
const stale=fixture('PC','SPILL RECEPTOR').target;
stale.body.blocks[0].plainText=stale.body.blocks[0].plainText.replace('SPILL RECEPTOR.','DIFFERENT DEVICE.');
stale.body.blocks[0].html=stale.body.blocks[0].html.replace('SPILL RECEPTOR.','DIFFERENT DEVICE.');
assert.equal(researchRequestedDefinitionMatch(stale,{question:root}),null,
 'Stale catalog canonicalText cannot nominate a definition absent from the freshly read body.');
assert.equal(researchRequestedDefinitionMatch({...stale,body:{blocks:[]}}, {question:root}),null,
 'An empty fresh body cannot fall back to stale catalog text.');
let strictDiscoveryCalls=0;
const selected=await assembleResearchEvidence({question:root,pinnedEvidence:[continued.rules[0]],
 strategy:{mode:'pinned_first',reason:'question_explicitly_bounded_to_selected_evidence'},
 discover:async()=>{strictDiscoveryCalls++;return continued.result;},resolveSection:async request=>continued.catalog.find(s=>s.sectionID===request.sectionID)});
assert.equal(strictDiscoveryCalls,0);assert(!selected.sources.some(s=>s.sectionID===continued.target.id));assert.equal(providerCalls,0);
console.log(JSON.stringify({positives,continuation:true,districtScope:true,freshBodyAuthority:true,negatives:negatives.length,strictPinnedBoundary:true,providerCalls}));
