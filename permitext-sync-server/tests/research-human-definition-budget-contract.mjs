import assert from 'node:assert/strict';
import { zoningSection } from '../zoning-content.mjs';
import { targetedDefinitionExcerpt } from '../research-definition-excerpts.mjs';
import { assembleResearchEvidence, researchEvidenceAssemblyLimits } from '../research-evidence-assembly.mjs';

globalThis.fetch = () => { throw Error('Provider/network access forbidden'); };
const authority = {codePrefix:'ZR', corpusID:'canonical-zoning-test', codeEdition:'current',
  codeVersion:'NYC Zoning Resolution', jurisdiction:'New York City'};
const section = await zoningSection('20018523');
const definitions = {...section, ...authority, sectionID:'20018523', body:{blocks:section.blocks}};
const full = targetedDefinitionExcerpt(definitions, 'home occupation', {
  maximumCharacters:12000, completeDefinitionLabels:['home occupation']});
assert(full && full.text.length > 2500 && full.text.length <= 12000);
const alias = targetedDefinitionExcerpt(definitions, 'May I run a home-based business in my apartment?');
assert.deepEqual(alias.labels, ['home occupation']);
assert.equal(alias.text, full.text, 'The ordinary alias selects the entire canonical entry, including special-scope variants.');
assert.equal(targetedDefinitionExcerpt(definitions, 'home business', {maximumCharacters:2500}), null,
  'Insufficient remaining capacity must not clip a complete entry to force it into evidence.');

const rules = Array.from({length:10}, (_,i) => ({...authority, sectionID:`synthetic-rule-${i}`,
  sectionNumber:`999.${i+1}`, title:`Independent operative source ${i}`,
  canonicalText:`Complete independent operative source ${i}. Its closing qualification is retained.`,
  body:{blocks:[{plainText:`Complete independent operative source ${i}. Its closing qualification is retained.`}]}}));
const candidate = {...authority, sectionID:String(definitions.sectionID), sectionNumber:'12-10', title:'DEFINITIONS', rank:11};
const original = 'Under current NYC zoning, may I run a home business in my apartment?';
const correction = 'Could I employ one person who lives elsewhere? I have not specified the kind of business.';
const assemble = extra => assembleResearchEvidence({question:correction, previousTopic:original,
  previousMessages:[{role:'user', content:original}], topicContext:{rootTopic:original,currentTopic:original},
  discover:async () => ({candidates:rules, supplementalDefinitionCandidates:[candidate]}),
  resolveSection:async request => String(request.sectionID) === String(definitions.sectionID)
    ? definitions : rules.find(rule=>rule.sectionID===request.sectionID) || null, ...extra});
const packet = await assemble();
const delivered = packet.sources.find(source => source.targetedDefinition?.labels?.includes('home occupation'));
assert(delivered, 'A short human follow-up keeps its root subject for optional definition selection.');
assert.equal(delivered.text, full.text);
assert.equal(delivered.truncated, false);
assert.equal(packet.usage.discoveredCount, researchEvidenceAssemblyLimits.maximumDiscovered,
  'The separate definition entry does not raise the primary discovered-source count.');
assert(packet.usage.targetedDefinitionCount <= researchEvidenceAssemblyLimits.maximumTargetedDefinitions);
assert(packet.usage.characterCount <= researchEvidenceAssemblyLimits.maximumCharacters);
assert(delivered.text.length <= researchEvidenceAssemblyLimits.maximumCharactersPerSource);

const small = await assemble({limits:{maximumCharactersPerSource:2500}});
assert(!small.sources.some(source=>source.targetedDefinition?.labels?.includes('home occupation')),
  'The existing per-source ceiling remains binding.');
const foreign = await assemble({resolveSection:async request => String(request.sectionID) === String(definitions.sectionID)
  ? {...definitions, codeVersion:'A different authority version'} : rules.find(rule=>rule.sectionID===request.sectionID) || null});
assert(!foreign.sources.some(source=>source.targetedDefinition?.labels?.includes('home occupation')),
  'Matching vocabulary cannot admit a definition from a different canonical authority.');
console.log('Complete optional definitions, human continuity, global budgets and foreign-authority guards passed.');
