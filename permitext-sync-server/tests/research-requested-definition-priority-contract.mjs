import assert from 'node:assert/strict';
import { zoningSection } from '../zoning-content.mjs';
import { targetedDefinitionExcerpt } from '../research-definition-excerpts.mjs';
import {allSectionCatalogByID, researchBodyForCatalogSection} from '../app.mjs';
import {assembleResearchEvidence} from '../research-evidence-assembly.mjs';

globalThis.fetch = () => { throw Error('Network/provider access forbidden'); };
const zoning = {...await zoningSection('20018523'), codePrefix:'ZR'};
const home = targetedDefinitionExcerpt(zoning, 'home occupation', {completeDefinitionLabels:['home occupation']});
const context = 'home occupation rooming unit';
const exact = targetedDefinitionExcerpt(zoning, context, {
  preferredQuery:'Can I run a home business in my apartment?', maximumCharacters:home.text.length
});
assert.deepEqual(exact?.labels, ['home occupation'], 'The human-requested entry must precede incidental definitions within the same unchanged budget.');
assert.equal(exact.text, home.text, 'Every canonical qualification remains intact.');
assert.equal(targetedDefinitionExcerpt(zoning, context, {
  preferredQuery:'What is a home occupation?', maximumCharacters:2500
}), null, 'An oversized requested entry cannot be substituted with an unrelated smaller entry.');
const implicit = targetedDefinitionExcerpt(zoning, context, {
  preferredQuery:'Could one worker live elsewhere?', preferredHumanContext:'Can I run a home business in my apartment?',
  maximumCharacters:home.text.length
});
assert.deepEqual(implicit?.labels, ['home occupation']);
assert.equal(implicit.text, home.text);
const room = targetedDefinitionExcerpt(zoning, 'rooming unit', {completeDefinitionLabels:['rooming unit']});
for (const preferredQuery of ['Not home occupation. What does rooming unit mean?', 'Ignore the quoted example "home occupation". What does rooming unit mean?']) {
  const excerpt=targetedDefinitionExcerpt(zoning, context, {preferredQuery, preferredHumanContext:'home occupation', maximumCharacters:room.text.length});
  assert.deepEqual(excerpt?.labels,['rooming unit']);
}
const synthetic={sectionID:'priority-definition-202',codePrefix:'BC',sectionNumber:'202',title:'Definitions',
  canonicalText:'Definitions '+ 'filler '.repeat(3000),body:{blocks:[{html:[
    '<div class="Normal-Level">EQUIPMENT PLATFORM. Complete requested entry retaining every qualification.</div>',
    '<div class="Normal-Level">ACCESSIBLE MEANS OF EGRESS. Context.</div>'
  ].join('\n')}]}};
const platform=targetedDefinitionExcerpt(synthetic,'equipment platform',{completeDefinitionLabels:['equipment platform']});
const query='equipment platform accessible means of egress';
assert.deepEqual(targetedDefinitionExcerpt(synthetic,query,{preferredQuery:'What makes this an equipment platform?',maximumCharacters:platform.text.length})?.labels,['EQUIPMENT PLATFORM']);
assert.deepEqual(targetedDefinitionExcerpt(synthetic,query,{preferredQuery:'accessible means of egress',completeDefinitionLabels:['equipment platform'],maximumCharacters:platform.text.length})?.labels,['EQUIPMENT PLATFORM'], 'Explicit canonical dependency binding retains precedence.');
assert.equal(targetedDefinitionExcerpt({...synthetic,truncated:true},query,{preferredQuery:'equipment platform'}),null);
assert.deepEqual(targetedDefinitionExcerpt(synthetic,query,{maximumCharacters:platform.text.length})?.labels,['ACCESSIBLE MEANS OF EGRESS'], 'Unconfigured callers retain ordinary context selection.');

const mechanicalCatalog=(await allSectionCatalogByID()).get('10280');
const mechanical={...mechanicalCatalog,sectionID:mechanicalCatalog.id,body:await researchBodyForCatalogSection(mechanicalCatalog)};
const direct=targetedDefinitionExcerpt(mechanical,'direct-vent appliances',{completeDefinitionLabels:['DIRECT-VENT APPLIANCES']});
const shorthand='If a heater sends its fumes outdoors but takes combustion air from the room, is that enough to call it direct-vent?';
const requested=targetedDefinitionExcerpt(mechanical,shorthand,{preferredQuery:shorthand});
assert(requested.labels.includes('DIRECT-VENT APPLIANCES'));
assert.equal(requested.passages[requested.labels.indexOf('DIRECT-VENT APPLIANCES')],direct.passages[0]);
assert(requested.canonicalEntryBindings.some(binding=>binding.label==='DIRECT-VENT APPLIANCES'));
const ambiguous={...synthetic,body:{blocks:[{html:[
  '<div class="Normal-Level">DIRECT-VENT APPLIANCES. Complete first definition.</div>',
  '<div class="Normal-Level">DIRECT-VENT EQUIPMENT. Complete different definition.</div>'
].join('\n')}]}};
assert.equal(targetedDefinitionExcerpt(ambiguous,'What does direct-vent mean?',{preferredQuery:'What does direct-vent mean?'}),null,
  'A shared modifier cannot choose between distinct canonical definitions.');
assert.equal(targetedDefinitionExcerpt(mechanical,'Unrelated context',{preferredQuery:'Not direct-vent. What is unrelated?',preferredHumanContext:'direct-vent'}),null);
assert.equal(targetedDefinitionExcerpt(mechanical,'Unrelated context',{preferredQuery:'The example says "direct-vent". What is unrelated?'}),null);

const authority={codePrefix:'ZR',corpusID:'canonical-zoning-priority-test',codeEdition:'current',
  codeVersion:'NYC Zoning Resolution',jurisdiction:'New York City'};
const definitions={...zoning,...authority,sectionID:'20018523',body:{blocks:zoning.blocks}};
const operative=Array.from({length:6},(_,i)=>({...authority,sectionID:`reserved-rule-${i}`,sectionNumber:`999.${i+1}`,
  title:`Independent operative rule ${i}`,canonicalText:`Complete operative condition ${i}. ${'Applicable qualification. '.repeat(45)}`}));
const carrier={...authority,sectionID:definitions.sectionID,sectionNumber:'12-10',title:'DEFINITIONS',rank:7,
  evidencePriority:{primaryFunction:'definition',functions:['definition'],claimCoverageRequired:false}};
const question='Under current NYC zoning, can I run a home business in my apartment?';
const discover=async()=>({candidates:operative,supplementalDefinitionCandidates:[carrier]});
const resolveSection=async request=>request.sectionID===definitions.sectionID?definitions:operative.find(x=>x.sectionID===request.sectionID)||null;
const limits={maximumCandidates:6,maximumDiscovered:6,maximumTargetedDefinitions:1,maximumCrossReferences:2,
  maximumCharacters:8000,maximumSupplementalCharacters:6000,maximumCharactersPerSource:4000};
const assembled=await assembleResearchEvidence({question,discover,resolveSection,limits});
const reserved=assembled.sources.find(s=>s.requestedDefinitionReservation);
assert(reserved?.targetedDefinition.labels.includes('home occupation'),'A complete requested entry survives an otherwise-full production-sized evidence package.');
assert.equal(reserved.text,home.text);
assert.equal(reserved.truncated,false);
assert(assembled.usage.characterCount<=limits.maximumCharacters);
assert.equal(assembled.usage.targetedDefinitionCount,1);
assert(assembled.sources.some(s=>s.sectionID==='reserved-rule-0'),'Requested definitions leave room for other operative sources.');
const selected=await assembleResearchEvidence({question,pinnedEvidence:[operative[0]],discover,resolveSection,limits,
  strategy:{mode:'pinned_first',reason:'question_explicitly_bounded_to_selected_evidence'}});
assert(!selected.sources.some(s=>s.requestedDefinitionReservation),'Selected-evidence boundaries forbid automatic dictionary admission.');
console.log('Requested definitions precede contextual terms; exact entries, human continuations, exclusions, canonical dependency binding and budget limits passed.');
