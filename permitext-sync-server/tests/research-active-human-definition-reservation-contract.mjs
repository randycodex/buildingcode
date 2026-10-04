import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { allSectionCatalogByID, researchBodyForCatalogSection } from '../app.mjs';
import { createResearchCorpusRegistry } from '../research-corpus-registry.mjs';
import { buildResearchPassageIndex } from '../research-passage-index.mjs';
import { discoverRelevantEvidence } from '../evidence-discovery.mjs';
import { assembleResearchEvidence, researchEvidenceRetrievalQuery } from '../research-evidence-assembly.mjs';
import { researchActiveHumanDefinitionMatch, researchRequestedDefinitionMatch,
  targetedDefinitionExcerpt } from '../research-definition-excerpts.mjs';

let providerCalls = 0;
globalThis.fetch = () => { providerCalls++; throw Error('No provider/network access in this contract.'); };
process.env.NODE_ENV = 'test';
const hash = value => createHash('sha256').update(value).digest('hex');
const identity = { corpusID:'synthetic-current', codeVersion:'synthetic-current-v1',
  codeEdition:'2022 NYC Codes', jurisdiction:'New York City' };
const homeRoot = 'New hypothetical, current NYC zoning outside special districts: I want a small business in my apartment, with supplies kept in boxes on the outdoor balcony. Is outdoor storage allowed as part of a home occupation?';
const homeFollow = 'Correction: the supplies would all be inside. Could customers line up outside my apartment while waiting for service?';
function section(prefix,id,number,title,text,authority=identity) {
  return { ...authority, id, sectionID:id, codePrefix:prefix, sectionNumber:number, title,
    text, canonicalText:text, body:{blocks:[{id:id+'-block',plainText:text}]} };
}
function dictionary(prefix,id,entries,authority=identity) {
  const heading = `Section ${prefix} 992: General Definitions`;
  const text = `Otherwise undefined terms retain ordinary meaning.\n${heading}\n${entries.join('\n')}`;
  const value = section(prefix,id,'991.4','Otherwise undefined terms',text,authority);
  value.body.blocks[0].html = `<p>Otherwise undefined terms retain ordinary meaning.</p><h6>${heading}</h6>` +
    entries.map(entry=>`<div class="Normal-Level">${entry}</div>`).join('');
  return value;
}
function runOptions(question,root) {
  const query = researchEvidenceRetrievalQuery({question,previousMessages:[{role:'user',question:root}],
    topicContext:{rootTopic:root,currentTopic:root,originalTopic:root}});
  return {query, context:{...query,currentQuestion:question,
    sourceSelectionRestricted:false, topicDecision:query.topicDecision}};
}
async function discoverFixture({target,incidental,root,question,modify, extra=[]}) {
  const authorities = [target,...incidental];
  const rules = Array.from({length:8},(_,i)=> {
    const anchor = authorities[i % authorities.length];
    // Responsive independent titles keep the real dictionaries supplemental,
    // so the existing two-slot priority risk is exercised rather than avoided
    // by accidental primary selection in this controlled shortlist.
    return section(anchor.codePrefix,'operative-'+i,'98'+i+'.1',question,
      'A separate arrangement for apartment services and pipe layout retains its full independent operative qualification. Customers can ask about these supplies and room locations.',anchor);
  });
  const catalog = [...rules,...incidental,target,...extra];
  if (modify) modify({target,incidental,rules,catalog});
  const index = await buildResearchPassageIndex(catalog,async source=>source.body);
  const {query,context} = runOptions(question,root);
  let reads=0; const readIDs=[];
  const semantic = {search:async()=>({hits:[...rules,...incidental,target,...extra].map((source,i)=>
    ({...index.passages.find(p=>p.sectionID===source.id),score:1-i/100})),metadata:{mockProvider:true}})};
  const discover = args => discoverRelevantEvidence({question:args?.question||query.retrievalQuery,catalog,
    passageIndex:index,invertedIndex:new Map(),semanticSearch:semantic,limit:6,
    retrievalContext:args?.retrievalContext||context,
    readSectionBody:async source=>{reads++;readIDs.push(source.id);return source.body;}});
  const result = await discover();
  return {target,incidental,rules,catalog,index,query,context,result,discover,
    reads:()=>reads,readIDs,resolve:async request=>catalog.find(s=>s.sectionID===request.sectionID)};
}
const registry=createResearchCorpusRegistry();
const rawCatalog=await allSectionCatalogByID();
const real=[];
for(const [prefix,number] of [['ZR','12-10'],['BC','202'],['BC','310.2']]) {
  const raw=[...rawCatalog.values()].find(s=>s.codePrefix===prefix&&s.sectionNumber===number&&
    (prefix==='ZR'||!s.codeVersion));
  assert(raw,'Current canonical source exists for the real priority counterexample.');
  const authority=registry.find(c=>c.id===(prefix==='ZR'?'nyc-zoning-resolution':'nyc-2022-construction-codes'));
  const body=await researchBodyForCatalogSection(raw);
  real.push({...raw,sectionID:String(raw.id),id:String(raw.id),body,corpusID:authority.id,
    codeVersion:authority.codeVersion,codeEdition:authority.codeEdition,jurisdiction:authority.jurisdiction});
}
const realBefore=structuredClone(real);
const realQuery=runOptions(homeFollow,homeRoot).query;
const oldPriority=real.map(value=>({id:value.id,match:researchRequestedDefinitionMatch(value,
  {question:homeFollow,humanContext:realQuery.definitionHumanContext})}))
  .sort((a,b)=>b.match.priority-a.match.priority);
assert.equal(oldPriority[2].id,real[0].id,'The original aggregate-priority order loses the actual active entry to two incidental current matches.');
const observed=await discoverFixture({target:real[0],incidental:real.slice(1),root:homeRoot,question:homeFollow});
const allCandidates=result=>[...result.candidates,...result.supplementalDefinitionCandidates];
const nominated=allCandidates(observed.result).find(c=>c.sectionID===real[0].id);
assert(nominated?.signals.activeHumanDefinitionReservation,'One existing supplemental slot must retain the uniquely aligned active-human entry.');
assert(observed.result.supplementalDefinitionCandidates.includes(nominated),'The real active dictionary must survive the supplemental two-slot competition.');
assert.equal(nominated.signals.activeHumanDefinitionReservation.alignment.wholeLabel,'home occupation');
assert(observed.result.supplementalDefinitionCandidates.length<=2);
assert(observed.reads()<=observed.catalog.length,'Nomination performs no additional canonical/index reads.');
assert.equal(new Set(observed.readIDs).size,observed.readIDs.length);
const packetOptions={question:homeFollow,previousMessages:[{role:'user',question:homeRoot}],
  topicContext:{rootTopic:homeRoot,currentTopic:homeRoot,originalTopic:homeRoot},
  discover:observed.discover,resolveSection:observed.resolve,
  limits:{maximumCandidates:6,maximumDiscovered:6,maximumTargetedDefinitions:2,
    maximumCrossReferences:2,maximumCharacters:16000,maximumCharactersPerSource:6000}};
const packet=await assembleResearchEvidence(packetOptions);
const supplied=packet.sources.find(s=>s.activeHumanDefinitionReservation);
const fullHome=targetedDefinitionExcerpt(real[0],'home occupation',{
  allowShortSection:true,completeDefinitionLabels:['home occupation'],maximumCharacters:6000});
assert.equal(supplied?.text,fullHome.text,'Actual writer data contains the entire canonical entry, including all closing conditions.');
assert.equal(supplied.targetedDefinition.completeDefinitionEntries,true);
assert.equal(supplied.evidencePriority.evidenceRole,'supporting');
assert.equal(supplied.evidencePriority.claimCoverageRequired,false,'A human-topic hint does not create exact-user authority or mandatory coverage.');
assert.equal(supplied.activeHumanDefinitionReservation.entryTextHash,hash(fullHome.passages[0]));
assert(packet.usage.characterCount<=16000&&packet.usage.targetedDefinitionCount<=2);
assert.equal(packet.sources.filter(s=>s.sectionID===real[0].id).length,1,'An already supplied entry is not duplicated.');
assert.deepEqual(real,realBefore,'Canonical source records remain immutable.');

// A second shared vocabulary concept and arbitrary carrier identity exercise
// per-entry alignment rather than a home term, section ID or legal answer.
const reliefRoot='The water heater has a relief valve and a discharge pipe. What should I check?';
const reliefFollow='Correction: could that pipe run into the room?';
const exact='DISCHARGE PIPING. A complete fictional entry keeps every stated condition. Exception: The alternate arrangement retains its closing restriction.';
const mixed=dictionary('PC','neutral-active',['ROOM. A separate room definition.',exact,
  'OTHER DEVICE. A separate device. '+ 'Unrelated complete context. '.repeat(900)]);
const neutral=await discoverFixture({target:mixed,incidental:[
  dictionary('PC','neutral-incidental-a',['PIPE. A separate pipe definition.','DEVICE. Another device.']),
  dictionary('PC','neutral-incidental-b',['ROOM. Another room definition.','LAYOUT. Another layout.'])],
  root:reliefRoot,question:reliefFollow});
const mixedCandidate=allCandidates(neutral.result).find(c=>c.sectionID===mixed.id);
assert.equal(mixedCandidate?.signals.requestedDefinitionCarrier.origin,'current','Aggregate current priority cannot prove the active entry itself was selected.');
assert.equal(mixedCandidate?.signals.activeHumanDefinitionReservation.label,'DISCHARGE PIPING');
const neutralOptions={...packetOptions,question:reliefFollow,
  previousMessages:[{role:'user',question:reliefRoot}],topicContext:{rootTopic:reliefRoot,currentTopic:reliefRoot},
  discover:async()=>neutral.result,resolveSection:neutral.resolve};
const neutralPacket=await assembleResearchEvidence(neutralOptions);
const neutralSource=neutralPacket.sources.find(s=>s.activeHumanDefinitionReservation);
assert.deepEqual(neutralSource?.targetedDefinition.labels,['DISCHARGE PIPING']);
assert(neutralSource.text.includes(exact)&&!neutralSource.text.includes('ROOM.'));
const otherCarrier=structuredClone(mixed);otherCarrier.id=otherCarrier.sectionID='second-aligned-carrier';
const duplicatePool=await discoverFixture({target:structuredClone(mixed),incidental:structuredClone(neutral.incidental),
  root:reliefRoot,question:reliefFollow,extra:[otherCarrier]});
assert(!allCandidates(duplicatePool.result).some(c=>c.signals.activeHumanDefinitionReservation),
  'Two separately eligible whole-label carriers are ambiguous, even when their entries agree.');
assert(duplicatePool.reads()<=duplicatePool.catalog.length);
for(const question of ['Under PC 991.4, could that pipe run into the room?',
  'Different issue: could that pipe run into the room?',
  'Based only on the selected passages, could that pipe run into the room?',
  'Could that pipe instead serve a boiler in the room?']) {
  const boundary=await discoverFixture({target:structuredClone(mixed),incidental:structuredClone(neutral.incidental),
    root:reliefRoot,question});
  assert(!allCandidates(boundary.result).some(c=>c.signals.activeHumanDefinitionReservation),question);
}

const matchOptions={question:homeFollow,humanTopics:[homeRoot],contextDependentFollowUp:true,topicDecision:'correction'};
const homeMatch=researchActiveHumanDefinitionMatch(real[0],matchOptions);
assert(homeMatch);
assert(researchActiveHumanDefinitionMatch(real[0],{...matchOptions,
  question:'Does that mean customers could wait outside my apartment?'}),'Ordinary mean wording is not a new definition request.');
assert(researchActiveHumanDefinitionMatch(real[0],{...matchOptions,
  question:'Under the Zoning Resolution, could customers wait outside my apartment?'}),'An explicitly retained same family is not a conflict.');
assert(researchActiveHumanDefinitionMatch(mixed,{question:'Under the 2022 Plumbing Code, could that pipe run into the room?',
  humanTopics:[reliefRoot],contextDependentFollowUp:true}),'An explicitly retained same family and edition stays eligible.');
assert(researchActiveHumanDefinitionMatch(real[0],{...matchOptions,
  question:'Could customers waiting outside my apartment create a new issue for these supplies?'}),'A phrase inside the continuing question is not an explicit topic reset.');
assert.equal(researchActiveHumanDefinitionMatch(real[0],{...matchOptions,
  question:'Could customers waiting outside my apartment create a new issue for this business?'}),null,
  'A positively named current business/apartment concept needs ordinary current priority, not a human-only reservation.');
for(const [reason, options] of [
  ['inactive topic',{contextDependentFollowUp:false}], ['comparison',{relevanceComparison:true}],
  ['topic switch',{topicDecision:'topic_switch'}], ['return to original',{topicDecision:{decision:'continuation',signals:{returnToOriginal:true}}}],
  ['selected sources',{sourceSelectionRestricted:true}],
  ['explicit current family',{question:'Under the Building Code, could customers wait outside my apartment?'}],
  ['explicit current edition',{question:'For the 2014 codes, could customers wait outside my apartment?'}],
  ['explicit current reference',{question:'Under ZR 99-99, could customers wait outside my apartment?'}],
  ['explicit current definition',{question:'Define apartment for these customers.'}],
  ['explicit new topic',{question:'Different issue: could customers wait outside my apartment?'}],
  ['quoted subject',{question:'The example says "home occupation". Could customers wait outside my apartment?'}],
  ['negated subject',{question:'Not a home occupation. Could customers wait outside my apartment?'}],
  ['competing requested object',{question:'Could customers wait beside the guardrail around this apartment?'}],
  ['assistant-only subject',{humanTopics:[]}],
  ['multiple active concepts',{question:'Could the customers wait beside that discharge pipe?',humanTopics:[homeRoot,reliefRoot]}]
]) assert.equal(researchActiveHumanDefinitionMatch(real[0],{...matchOptions,...options}),null,reason);
for(const [reason,change] of [
  ['ineligible section',s=>{s.researchClaimEligible=false;}], ['truncated section',s=>{s.truncated=true;}],
  ['truncated block',s=>{s.body.blocks[0].truncated=true;}], ['incomplete body',s=>{s.body.textComplete=false;}],
  ['missing authority',s=>{delete s.corpusID;}], ['wrong family',s=>{s.codePrefix='MC';}],
  ['wrong human jurisdiction',s=>{s.jurisdiction='Other City';}],
  ['empty fresh body',s=>{s.body.blocks=[];}],
  ['stale catalog/HTML entry',s=>{s.body.blocks=s.body.blocks.map(b=>({...b,plainText:b.plainText.replace(/home occupation/gi,'different occupation')}));}]
]) {const value=structuredClone(real[0]);change(value);assert.equal(researchActiveHumanDefinitionMatch(value,matchOptions),null,reason);}
assert.equal(researchActiveHumanDefinitionMatch(real[0],{...matchOptions,maximumCharacters:2500}),null,'Whole-entry capacity remains binding.');
assert.equal(researchActiveHumanDefinitionMatch(mixed,{question:reliefFollow,
  humanTopics:['Under the 2014 Plumbing Code, the water heater has a relief valve and a discharge pipe.'],
  contextDependentFollowUp:true}),null,'A named human edition cannot nominate a different source edition.');
const ambiguous=dictionary('PC','ambiguous',['DISCHARGE PIPING. A complete definition.','AIR GAP. Another complete definition.']);
assert.equal(researchActiveHumanDefinitionMatch(ambiguous,{question:reliefFollow,humanTopics:[reliefRoot],contextDependentFollowUp:true}),null,
  'Two aligned labels within one concept cannot choose a governing definition.');
const mention=dictionary('PC','mention',['OTHER PIPE. Mentions discharge piping but does not define that whole label.','OTHER DEVICE. Another device.']);
assert.equal(researchActiveHumanDefinitionMatch(mention,{question:reliefFollow,humanTopics:[reliefRoot],contextDependentFollowUp:true}),null,
  'Body mention and generic label overlap are not exact entry alignment.');

const assemblyNegatives=[];
for(const [reason,change] of [
  ['fresh hash changed',s=>{s.body.blocks[0].plainText+='\nFresh changed source.';}],
  ['fresh missing closing condition',s=>{s.body.blocks[0].plainText=s.body.blocks[0].plainText.replace('Exception: The alternate arrangement retains its closing restriction.','');}],
  ['fresh corpus changed',s=>{s.corpusID='other-corpus';}], ['fresh edition changed',s=>{s.codeEdition='2014 NYC Codes';}],
  ['fresh authority missing',s=>{delete s.codeVersion;}], ['fresh identity missing',s=>{delete s.id;delete s.sectionID;}],
  ['fresh jurisdiction changed',s=>{s.jurisdiction='Other City';}], ['fresh eligibility changed',s=>{s.researchClaimEligible=false;}],
  ['fresh truncation changed',s=>{s.truncated=true;}]
]) {
  const fresh=structuredClone(mixed);change(fresh);
  const p=await assembleResearchEvidence({...neutralOptions,
    resolveSection:async request=>request.sectionID===mixed.id?fresh:neutral.resolve(request)});
  assert(!p.sources.some(s=>s.activeHumanDefinitionReservation),reason);
  assemblyNegatives.push(reason);
}
const forged=structuredClone(neutral.result);
allCandidates(forged).find(c=>c.sectionID===mixed.id).signals.activeHumanDefinitionReservation.alignment.wholeLabel='ROOM';
const forgedPacket=await assembleResearchEvidence({...neutralOptions,discover:async()=>forged});
assert(!forgedPacket.sources.some(s=>s.activeHumanDefinitionReservation),'Unbound nomination metadata cannot change the exact admitted entry.');
const forgedPriority=structuredClone(neutral.result);
allCandidates(forgedPriority).find(c=>c.sectionID===mixed.id).evidencePriority={
  primaryFunction:'controlling_rule',evidenceRole:'governing',claimCoverageRequired:true};
const boundPriority=await assembleResearchEvidence({...neutralOptions,discover:async()=>forgedPriority});
const safePriority=boundPriority.sources.find(s=>s.activeHumanDefinitionReservation)?.evidencePriority;
assert.equal(safePriority?.evidenceRole,'supporting');assert.equal(safePriority?.claimCoverageRequired,false,
  'Supplied candidate priority cannot turn a fresh optional definition into governing authority.');
const small=await assembleResearchEvidence({...packetOptions,discover:async()=>observed.result,limits:{...packetOptions.limits,maximumCharactersPerSource:2500}});
assert(!small.sources.some(s=>s.activeHumanDefinitionReservation),'No clipped active entry can acquire a reservation.');
const globalSmall=await assembleResearchEvidence({...packetOptions,discover:async()=>observed.result,
  limits:{...packetOptions.limits,maximumCharacters:2000}});
assert(!globalSmall.sources.some(s=>s.activeHumanDefinitionReservation)&&globalSmall.usage.characterCount<=2000,
  'The existing total package allowance remains binding.');
const oneSlot=await assembleResearchEvidence({...packetOptions,discover:async()=>observed.result,
  limits:{...packetOptions.limits,maximumTargetedDefinitions:1}});
assert.equal(oneSlot.usage.targetedDefinitionCount,1);assert(oneSlot.sources.some(s=>s.activeHumanDefinitionReservation));
const primaryObserved=await discoverFixture({target:structuredClone(real[0]),incidental:structuredClone(real.slice(1)),
  root:homeRoot,question:homeFollow,modify:f=>{f.rules.forEach(rule=>{rule.title='Independent arrangement';});}});
assert(primaryObserved.result.candidates.some(c=>c.sectionID===real[0].id));
const primaryPacket=await assembleResearchEvidence({...packetOptions,discover:async()=>primaryObserved.result,
  resolveSection:primaryObserved.resolve});
assert.equal(primaryPacket.sources.filter(s=>s.sectionID===real[0].id).length,1,
  'An already selected active definition never receives a duplicate source or supplemental slot.');
let strictDiscoveryCalls=0;
const strict=await assembleResearchEvidence({...packetOptions,pinnedEvidence:[observed.rules[0]],
  strategy:{mode:'pinned_first',reason:'question_explicitly_bounded_to_selected_evidence'},
  discover:async()=>{strictDiscoveryCalls++;return observed.result;}});
assert.equal(strictDiscoveryCalls,0);assert(!strict.sources.some(s=>s.activeHumanDefinitionReservation));
const broadPinned=await assembleResearchEvidence({...packetOptions,pinnedEvidence:[observed.rules[0]],discover:async()=>observed.result});
assert(!broadPinned.sources.some(s=>s.activeHumanDefinitionReservation),'Existing pins also suppress this optional reservation.');
const duplicate=structuredClone(neutral.result);
const active=allCandidates(duplicate).find(c=>c.sectionID===mixed.id);
duplicate.supplementalDefinitionCandidates.push({...active,sectionID:'other-carrier',signals:structuredClone(active.signals)});
const ambiguousPacket=await assembleResearchEvidence({...neutralOptions,discover:async()=>duplicate});
assert(!ambiguousPacket.sources.some(s=>s.activeHumanDefinitionReservation),'Multiple carrier nominations never consume an active reservation.');
// Supplemental nominees have no legacy priority metadata. Ambiguous/disabled
// hints cannot move them into early requested-definition admission or cause
// an additional canonical read before the unchanged optional fallback.
const rawHome=structuredClone(nominated);
delete rawHome.evidencePriority;delete rawHome.signals.canonicalEmbeddedDefinitions;
const rawHome2=structuredClone(rawHome);rawHome2.sectionID='second-home-carrier';
const home2={...structuredClone(real[0]),id:rawHome2.sectionID,sectionID:rawHome2.sectionID};
const ambiguousRaw={candidates:observed.result.candidates,
  supplementalDefinitionCandidates:[rawHome,rawHome2]};
const ordinaryRaw=structuredClone(ambiguousRaw);
ordinaryRaw.supplementalDefinitionCandidates.forEach(c=>{delete c.signals.activeHumanDefinitionReservation;});
async function fallbackPacket(discovery) {
  const reads=[];
  const p=await assembleResearchEvidence({...packetOptions,discover:async()=>discovery,
    resolveSection:async request=>{reads.push(request.sectionID);return request.sectionID===home2.sectionID?home2:observed.resolve(request);}});
  return {packet:p,reads};
}
const ambiguousFallback=await fallbackPacket(ambiguousRaw);
const ordinaryFallback=await fallbackPacket(ordinaryRaw);
assert.deepEqual(ambiguousFallback.reads,ordinaryFallback.reads,
  'Ambiguous nomination metadata adds no canonical reads or early reservation.');
assert(!ambiguousFallback.packet.sources.some(s=>s.requestedDefinitionReservation&&
  [rawHome.sectionID,rawHome2.sectionID].includes(s.sectionID)));
assert.deepEqual(ambiguousFallback.packet.sources.map(s=>[s.sectionID,s.text]),
  ordinaryFallback.packet.sources.map(s=>[s.sectionID,s.text]),'Ambiguous hints preserve ordinary source fallback exactly.');
const disabledHint={candidates:observed.result.candidates,supplementalDefinitionCandidates:[rawHome]};
const disabledOrdinary=structuredClone(disabledHint);delete disabledOrdinary.supplementalDefinitionCandidates[0].signals.activeHumanDefinitionReservation;
const disabledOptions={...packetOptions,question:'Under ZR 98-99, could customers wait outside my apartment?'};
const disabledReads=[];
const disabledPacket=await assembleResearchEvidence({...disabledOptions,discover:async()=>disabledHint,
  resolveSection:async request=>{disabledReads.push(request.sectionID);return observed.resolve(request);}});
const ordinaryReads=[];
const disabledBaseline=await assembleResearchEvidence({...disabledOptions,discover:async()=>disabledOrdinary,
  resolveSection:async request=>{ordinaryReads.push(request.sectionID);return observed.resolve(request);}});
assert.deepEqual(disabledReads,ordinaryReads,'A disabled forged hint adds no reads when a current source is explicit.');
assert.deepEqual(disabledPacket.sources.map(s=>[s.sectionID,s.text]),disabledBaseline.sources.map(s=>[s.sectionID,s.text]));
assert(!disabledPacket.sources.some(s=>s.requestedDefinitionReservation&&s.sectionID===rawHome.sectionID));
assert.equal(providerCalls,0);
console.log(JSON.stringify({realCanonicalPriorityRisk:true,completeHomeEntryCharacters:fullHome.text.length,
  neutralMixedCarrier:true,assemblyFreshBindingNegatives:assemblyNegatives,
  slots:observed.result.supplementalDefinitionCandidates.length,characterCount:packet.usage.characterCount,
  targetedDefinitions:packet.usage.targetedDefinitionCount,providerCalls}));
