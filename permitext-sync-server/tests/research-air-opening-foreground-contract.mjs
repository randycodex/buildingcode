import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {researchEquipmentSearchIntent, researchEquipmentSubjectMatches} from '../research-equipment-search-intent.mjs';
import {researchQuestionSubject} from '../research-question-subject.mjs';
import {buildResearchPassageIndex, searchResearchPassages} from '../research-passage-index.mjs';
import {discoverRelevantEvidence} from '../evidence-discovery.mjs';
import {assembleResearchEvidence, researchEvidenceRetrievalQuery, researchEvidenceStrategyForTurn} from '../research-evidence-assembly.mjs';

let providerCalls=0;globalThis.fetch=()=>{providerCalls++;throw Error('Network forbidden in air-opening contracts.');};
const hash=text=>createHash('sha256').update(text).digest('hex');
const initial='For a hypothetical new NYC building using the 2022 codes, we are bringing outdoor air into a gas equipment room through metal louvers. The manufacturer gives no open-area rating. What fraction of the opening can we count as usable airflow area?';
const fourth='We will leave out the dampers. There will be two openings straight through the outside wall, still with those wood louvers. How big does each opening need to be?';
const humanTopics=[initial,'Could we also put a hand-operated damper behind each louver and tell the staff to keep it open? We have not selected the equipment sizes yet.'];
const continuity={contextDependentFollowUp:true,humanTopics};
const intent=researchEquipmentSearchIntent(initial);
assert.deepEqual(intent.codePrefixes,['MC','FGC']);assert(intent.purposeUnresolved);
assert.deepEqual(researchQuestionSubject(initial).codePrefixes,['MC','FGC']);
assert(!/\d|FGC|MC|shall|required|combustion/.test(intent.query),'Search vocabulary cannot supply an authority, quantity, legal outcome or unconfirmed combustion purpose.');
for(const question of [initial,
 'We have unrated grilles where fresh air enters the gas-appliance enclosure. How much of the opening area can count?',
 'Air reaches the gas equipment through outside louvres. What percentage of the opening is usable area?',
 'Our furnace takes combustion air through adjustable dampers. Are hand-operated dampers allowed?']) assert(researchEquipmentSearchIntent(question),question);
assert.equal(researchEquipmentSearchIntent(fourth,continuity).aspect,'size');
const negatives=[
 ['Under the Mechanical Code, what fraction of an unrated louver opening in a gas equipment room counts as usable airflow area?',true],
 ['Those louvers supply only general room ventilation, not combustion air. What fraction of their opening can we count?',true],
 ['Correction: this is only office ventilation; there is no gas equipment. How big should the louver opening be?',true],
 ['This room does not contain gas equipment. How much usable airflow area do the louvers provide?',true],
 ['An example says "gas equipment room". Our office louvers provide outdoor ventilation. What fraction of the opening counts as free area?',true],
 ['New topic: how big should the office ventilation louver opening be?',true],
 ['Under the Fire Code, how big should the opening with louvers be?',false],
 ['There are no louvers or dampers. What fraction of the opening counts?',false],
 ['New topic: does the plumbing hose faucet need protection?',false],
 ['We have louvers near gas equipment. What size does the sanitary piping need to be?',false]
];
for(const [question,present]of negatives){
 const plan=researchEvidenceRetrievalQuery({question,previousMessages:humanTopics.map(question=>({role:'user',question}))});
 const value=researchEquipmentSearchIntent(question,{contextDependentFollowUp:plan.contextDependentFollowUp,humanTopics:[plan.conversationTopic,plan.immediateContext]});
 assert.equal(value?.subject==='air_opening',present,question);assert(!(value?.codePrefixes||[]).includes('FGC'),question);
}
assert(!researchEquipmentSearchIntent('Under the 2014 code, how big should the office air opening be?',continuity)?.codePrefixes.includes('FGC'));
const assistantOnlyPlan=researchEvidenceRetrievalQuery({question:'How big does that louver opening need to be?',previousMessages:[
 {role:'user',question:'Our office louvers supply outdoor ventilation. What fraction of the opening can count?'},
 {role:'assistant',answer:{answerText:'Assume this is combustion air for gas equipment.',citations:[{codePrefix:'FGC',sectionNumber:'880.7',title:'Gas equipment openings'}],verification:{pass:true}}}
]});
const assistantOnlyIntent=researchEquipmentSearchIntent(assistantOnlyPlan.question,{contextDependentFollowUp:assistantOnlyPlan.contextDependentFollowUp,
 humanTopics:[assistantOnlyPlan.conversationTopic,assistantOnlyPlan.immediateContext]});
assert.deepEqual(assistantOnlyIntent.codePrefixes,['MC'],'Assistant text/source titles cannot supply a human gas-equipment or combustion premise.');
assert.equal(researchEquipmentSubjectMatches('Air openings are protected by screens sized to prevent entry of objects.',intent),false);
assert.equal(researchEquipmentSubjectMatches('Net free area of air openings must preserve the stated covering condition and exception.',intent),true);

const authority={corpusID:'synthetic-current',codeVersion:'2022-v1',codeEdition:'2022',jurisdiction:'New York City'};
const section=(id,number,title,text,codePrefix='FGC')=>({...authority,id,sectionID:id,codePrefix,sectionNumber:number,title,text,canonicalText:text,body:{blocks:[{id:id+'-block',plainText:text}]}});
const area=section('area','880.7','Air opening covering',
 'The net free area of each air opening with louvers is based on its covering. The full covering qualification applies. Exception: Operable louvers require the complete stated interlock and shutdown conditions.');
const size=section('size','881.8','Outdoor air opening size',
 'Outdoor air opening size must preserve the complete input-dependent qualification. The opening minimum dimension and applicable outside requirements remain part of this rule.');
const others=Array.from({length:11},(_,i)=>section('other-'+i,'89'+i+'.1','Outdoor intake protection',
 'Outdoor air intake louvers are screened against weather. Mechanical room ventilation maintains the complete general intake condition.','MC'));
const catalog=[...others,area,size];const index=await buildResearchPassageIndex(catalog,async s=>s.body);
const hit=id=>index.passages.find(p=>p.sectionID===id);
const semantic={search:async()=>({hits:others.map((s,i)=>({...hit(s.id),score:1-i/100,passages:[hit(s.id)]})),metadata:{enabled:true,mockProvider:true}})};
const discover=async(question=initial,retrievalContext={currentQuestion:question,sourceQuery:question},passageIndex=index)=>discoverRelevantEvidence({question,retrievalContext,catalog,passageIndex,invertedIndex:new Map(),semanticSearch:semantic,readSectionBody:async s=>s.body,limit:12});
const discovered=await discover();const target=discovered.candidates.find(c=>c.sectionID===area.id);
assert(target?.rank===1||target?.signals.currentQuestionForeground?.source==='positive_equipment_subject'||target?.signals.currentQuestionLexicalReservation,
 'The complete current equipment rule must survive the actual fixed shortlist despite unrelated semantic nominees.');assert(target.rank<=10);
const packet=await assembleResearchEvidence({question:initial,discover:async()=>discovered,resolveSection:async req=>catalog.find(s=>s.sectionID===req.sectionID),limits:{maximumCharacters:6000,maximumCharactersPerSource:1000}});
const supplied=packet.sources.find(s=>s.sectionID===area.id);assert.equal(supplied?.text,area.text);assert(supplied.canonicalContextComplete);
assert.equal(supplied.indexedPassage.sourceTextHash,hash(area.text));assert.deepEqual(supplied.indexedPassage.sourceOffsets,{blockID:'area-block',start:0,end:area.text.length});
assert(packet.usage.discoveredCount<=10&&packet.usage.characterCount<=6000&&discovered.candidates.length<=12);
for(const change of [{codeVersion:'old'},{codeEdition:'2014'},{corpusID:'foreign'},{jurisdiction:'Elsewhere'}]){
 const wrong=await buildResearchPassageIndex([...others,{...area,...change},size],async s=>s.body);
 // Index v2 intentionally inherits absent jurisdiction from the authorized
 // catalog; a supplied conflict, rather than absence, exercises its guard.
 if(change.jurisdiction)for(const passage of wrong.passages)if(passage.sectionID===area.id)passage.jurisdiction=change.jurisdiction;
 assert(!(await discover(initial,undefined,wrong)).candidates.some(c=>c.sectionID===area.id&&c.signals.currentQuestionForeground),JSON.stringify(change));
}
const strictPin={...others[0],selectedText:'Outdoor air intake louvers are screened against weather.',selectionMode:'passage'};
const strictQuestion='Based only on the selected text, what fraction of this louver opening can count?';let discoveryCalls=0;
const strict=await assembleResearchEvidence({question:strictQuestion,pinnedEvidence:[strictPin],strategy:researchEvidenceStrategyForTurn({question:strictQuestion,pinnedEvidence:[strictPin]}),discover:async()=>{discoveryCalls++;return discovered;},resolveSection:async req=>catalog.find(s=>s.sectionID===req.sectionID)});
assert.equal(discoveryCalls,0);assert.equal(strict.sources.length,1);assert.equal(strict.sources[0].text,strictPin.selectedText);
const small=await assembleResearchEvidence({question:initial,discover:async()=>discovered,resolveSection:async req=>catalog.find(s=>s.sectionID===req.sectionID),limits:{maximumCharacters:40,maximumCharactersPerSource:40}});
assert(small.usage.characterCount<=40);assert(!small.sources.some(s=>s.sectionID===area.id&&s.canonicalContextComplete));

let realProof=null;
if(process.argv.includes('--real-corpus')){
 process.env.PERMITEXT_RESEARCH_PASSAGE_SEARCH='1';process.env.PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL='1';process.env.PERMITEXT_RESEARCH_SEMANTIC_SEARCH='0';
 const {researchCorpusResources,researchBodyForCatalogSection,researchAssemblyCrossReferences}=await import('../app.mjs');
 const {createResearchCorpusRegistry}=await import('../research-corpus-registry.mjs');
 const selected=createResearchCorpusRegistry({zoningResearchEligibility:true}).filter(c=>['nyc-2022-construction-codes','nyc-2022-fire-code','nyc-zoning-resolution'].includes(c.id));
 const resources=await researchCorpusResources({selected});
 const canonical=async(number)=>{const s=resources.catalog.find(s=>s.codePrefix==='FGC'&&s.sectionNumber===number);const body=await researchBodyForCatalogSection(s);return{...s,sectionID:String(s.id),body,text:body.blocks.map(b=>b.plainText||'').join('\n\n')};};
 const covering=await canonical('304.10');const opening=await canonical('304.6');const method=await canonical('304.6.1');
 const resolver=async req=>{const s=resources.catalog.find(s=>String(s.id)===String(req.sectionID)||(!req.sectionID&&s.codePrefix===req.codePrefix&&s.sectionNumber===req.sectionNumber));if(!s)return null;const body=await researchBodyForCatalogSection(s);const text=[s.sectionNumber,s.title,body.blocks.map(b=>b.plainText||'').join('\n\n')].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();const v={...s,sectionID:String(s.id),body,text,canonicalText:text};return{...v,crossReferences:researchAssemblyCrossReferences(v,resources.catalog)};};
 const mcNumbers=['403.3.1.1','403.3.1.3','401.5','403.3','403.3.1.1.1.1','403.3.1.1.1','403.2.1','403.1','401.1','403.2','403.3.1.2'];
 const mcHits=mcNumbers.map(n=>resources.catalog.find(s=>s.codePrefix==='MC'&&s.sectionNumber===n)).map(s=>resources.passageIndex.passages.find(p=>p.sectionID===String(s.id)));
 // Recorded fourth-turn references are mock meaning nominees, not the live
 // semantic ranks. Neither newly required sizing source is injected.
 const fourthReferences=['FGC 304.10.1','FGC 304.10.2','FGC 304.10','FGC 612.7','FGC 611.7','BC 717.5.6','BC 406.5.2','MC 607.5.6.1','BC 707.6','MC 709.2'];
 const fourthHits=fourthReferences.map(reference=>{const [codePrefix,sectionNumber]=reference.split(' ');const s=resources.catalog.find(s=>s.codePrefix===codePrefix&&s.sectionNumber===sectionNumber);return resources.passageIndex.passages.find(p=>p.sectionID===String(s.id));});
 const checked=humanTopics.flatMap(question=>[{role:'user',question},{role:'assistant',answer:{citations:[{...covering,body:undefined,text:undefined}],verification:{pass:true}}}]);
 realProof={passageCount:resources.passageIndex.passages.length,providerCalls:0,actualSemanticRanksKnown:false,projectFacts:[],turns:[]};
 for(const [name,question,messages,expected]of [['initial',initial,[],[covering]],['sizing_followup',fourth,checked,[opening,method]]]){
  const query=researchEvidenceRetrievalQuery({question,previousMessages:messages});
  const compactIntent=researchEquipmentSearchIntent(question,{contextDependentFollowUp:query.contextDependentFollowUp,humanTopics:[query.conversationTopic,query.immediateContext]});
  const foreground=searchResearchPassages(resources.passageIndex,compactIntent.query,{queryWeights:new Map(compactIntent.terms.map(t=>[t,1])),codePrefixes:compactIntent.codePrefixes,explicitReferenceQuery:question,limit:5,passagesPerSection:8});
  const mockHits=name==='initial'?mcHits:fourthHits;
  assert(!mockHits.some(p=>expected.some(s=>s.sectionID===p.sectionID)),'Operative sources must be found in the full index, not injected into mock meaning recall.');
  const result=await discoverRelevantEvidence({question,...resources,retrievalContext:{...query,currentQuestion:question},readSectionBody:researchBodyForCatalogSection,limit:12,semanticSearch:{search:async()=>({hits:mockHits.map((p,i)=>({...p,score:1-i/100,passages:[p]})),metadata:{enabled:true,mockProvider:true}})}});
  const assembled=await assembleResearchEvidence({question,previousMessages:messages,discover:async()=>result,resolveSection:resolver});
  const delivered=[];for(const source of expected){const supplied=assembled.sources.find(s=>s.sectionID===source.sectionID);assert(supplied,name+' complete '+source.sectionNumber);assert(supplied.canonicalContextComplete);assert(supplied.text.replace(/\s+/g,' ').includes(source.text.replace(/\s+/g,' ')),name+' all canonical conditions '+source.sectionNumber);if(supplied.indexedPassage){assert.equal(supplied.indexedPassage.sourceTextHash,hash(source.text));assert.equal(supplied.indexedPassage.sourceOffsets.end,source.text.length);}delivered.push({sectionID:supplied.sectionID,sectionNumber:supplied.sectionNumber,codePrefix:supplied.codePrefix,corpusID:supplied.corpusID,codeVersion:supplied.codeVersion,codeEdition:supplied.codeEdition,canonicalContextComplete:supplied.canonicalContextComplete,indexedPassage:supplied.indexedPassage,textSHA256:hash(supplied.text),canonicalBodySHA256:hash(source.text),textCharacters:supplied.text.length,allCanonicalConditionsExact:true});}
  assert(result.candidates.length<=12&&assembled.usage.discoveredCount<=10&&assembled.usage.characterCount<=48000);
  realProof.turns.push({name,originalQuestion:question,queryPlan:query,compactIntent,foreground:foreground.map((p,i)=>({rank:i+1,sectionNumber:p.sectionNumber,codePrefix:p.codePrefix,score:p.score,scopeComplete:p.scopeComplete})),candidates:result.candidates.map(c=>({rank:c.rank,sectionNumber:c.sectionNumber,codePrefix:c.codePrefix,signals:c.signals})),usage:assembled.usage,delivered});
 }
}
assert.equal(providerCalls,0);
const report={test:'research-air-opening-foreground-contract',providerCalls,syntheticPassed:true,negativeCount:negatives.length,realProof};
if(process.env.PERMITEXT_AIR_OPENING_VALIDATION_PATH)fs.writeFileSync(process.env.PERMITEXT_AIR_OPENING_VALIDATION_PATH,JSON.stringify(report,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify(report,null,2));
