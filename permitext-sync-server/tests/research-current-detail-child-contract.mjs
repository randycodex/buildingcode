import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildResearchPassageIndex } from '../research-passage-index.mjs';
import { discoverRelevantEvidence } from '../evidence-discovery.mjs';
import { assembleResearchEvidence } from '../research-evidence-assembly.mjs';

const authority = {codePrefix:'MC',corpusID:'synthetic-current',codeVersion:'synthetic-v1',codeEdition:'2022',jurisdiction:'New York City'};
const section = {...authority,id:'detail-chapter',sectionNumber:'991',title:'Equipment access and drainage'};
const text = [
 '991.1 General equipment.\nEquipment shall be installed in accordance with this chapter. Exception: The approved alternate arrangement is allowed.',
 '991.2 Equipment maintenance.\nThe following requirements apply only to fixed equipment. Exception: Movable equipment is excluded.',
 '991.2.1 Perimeter and service passage protection.\nEquipment passage protection shall comply with the stated access conditions.',
 '991.2.2 Equipment service passage.\nThe equipment service passage must be 4 feet wide and 7 feet high. Such passage shall comply with the following:\n1. Keep the approach unobstructed.\n2. Do not obstruct the equipment disconnect.\nException: An approved alternate arrangement is permitted.',
 '991.2.3 Equipment service passage barriers.\nEquipment service passage barriers shall be installed at the edge. Exception: Approved edge protection is permitted.',
 '991.2.4 Perimeter and passage access.\nPassage access shall be provided around the equipment perimeter. Exception: The approved alternate perimeter access arrangement is allowed.',
 '991.3 Horizontal drainage piping.\nDrainage piping shall have the stated fall and the specified drainage protection. Exception: The approved alternate routing is permitted.',
 '991.4 Drainage slope.\nThe drainage slope has the stated conditions.',
 '991.5 Other conditions.\n'+'Unrelated equipment conditions are included in the remainder of the chapter. '.repeat(180)
].join('\n\n');
const body = {blocks:[{id:'detail-block',plainText:text}]};
const index = await buildResearchPassageIndex([section],async()=>body);
const child = number => index.passages.find(p=>p.subsectionNumber===number);
const semantic = (number,alter={}) => ({search:async()=>({hits:[{...child(number),...alter,score:.9,passages:[{...child(number),...alter},child('991.2.2'),child('991.2.1')]}],metadata:{}})});
const question='How wide and high must the equipment service passage be?';
const discover = (q=question, meaning=semantic('991.1'), current=q) => discoverRelevantEvidence({question:q,
 retrievalContext:{currentQuestion:current,sourceQuery:q},catalog:[section],invertedIndex:new Map(),passageIndex:index,
 semanticSearch:meaning,readSectionBody:async()=>body,availableCodePrefixes:['MC'],limit:3});
const result = await discover();
const candidate = result.candidates[0];
assert.equal(candidate.indexedPassage.subsectionNumber,'991.2.2','A generic semantic child cannot displace the exact current subject already in the authorized lexical/semantic pool.');
assert(candidate.indexedPassage.alternatives.some(p=>p.subsectionNumber==='991.1'),'The generic hit is retained as an alternative, not treated as inapplicable legal text.');
const packet = await assembleResearchEvidence({question,pinnedEvidence:[],discover:async()=>result,
 resolveSection:async()=>({...section,body,text}),limits:{maximumCharacters:2400,maximumCharactersPerSource:1200,maximumDiscovered:1}});
const delivered=packet.sources[0];
assert.equal(delivered.indexedPassage.subsectionNumber,'991.2.2');
assert.match(delivered.text,/4 feet wide and 7 feet high/);
assert.match(delivered.text,/only to fixed equipment/);
assert.match(delivered.text,/Movable equipment is excluded/);
assert.match(delivered.text,/Do not obstruct the equipment disconnect/);
assert.match(delivered.text,/approved alternate arrangement is permitted/);
assert.equal(delivered.truncated,false);
assert(delivered.text.length<=1200 && packet.usage.characterCount<=2400);
assert.equal(delivered.indexedPassage.sourceTextHash,createHash('sha256').update(text).digest('hex'));
assert.equal(text.slice(delivered.indexedPassage.sourceOffsets.start,delivered.indexedPassage.sourceOffsets.end),child('991.2.2').text);

const dependent='The passage has a low pipe crossing above it; is firefighter access still possible?';
const dependentResult=await discover(dependent,semantic('991.2.2'));
assert.equal(dependentResult.candidates[0].indexedPassage.subsectionNumber,'991.2.2','Generic access plus one literal subject word must not replace the semantic subject in a dependent follow-up.');

const semanticSpecific = await discover(question,semantic('991.2.2'));
assert.equal(semanticSpecific.candidates[0].indexedPassage.subsectionNumber,'991.2.2');
const direct = await discover('Under MC 991.1, what are the general equipment requirements?',semantic('991.2.2'));
assert.equal(direct.candidates[0].indexedPassage.subsectionNumber,'991.1','Explicit current references retain precedence.');
assert.equal(direct.candidates[0].signals.exactReference,true);

const ordinary='If water backs up, how much slant does the pipe need?';
const ordinaryResult=await discover(ordinary,semantic('991.3'));
assert.equal(ordinaryResult.candidates[0].indexedPassage.subsectionNumber,'991.3','Meaning recall remains primary when ordinary words do not literally match two child-heading terms.');
const changed='How steep is the drainage slope?';
const context=changed+'\nPrevious topic: equipment service passage';
const changedResult=await discover(context,semantic('991.1'),changed);
assert.equal(changedResult.candidates[0].indexedPassage.subsectionNumber,'991.4','Inherited wording cannot protect the previous subject over current detail.');

const forged=await discover(question,semantic('991.1',{passageTitle:'Equipment service passage'}));
assert.equal(forged.candidates[0].indexedPassage.subsectionNumber,'991.2.2','Rank protection uses the canonical heading rather than provider-supplied altered metadata.');
const stale=await discover(question,semantic('991.1',{jurisdiction:'Another City'}));
const lexicalOnly=await discover(question,null);
assert.equal(stale.candidates[0].indexedPassage.id,lexicalOnly.candidates[0].indexedPassage.id,'A wrong-jurisdiction primary cannot nominate a child or change the authorized lexical outcome.');
const tooSmall=await assembleResearchEvidence({question,pinnedEvidence:[],discover:async()=>result,
 resolveSection:async()=>({...section,body,text}),limits:{maximumCharacters:260,maximumCharactersPerSource:260,maximumDiscovered:1}});
assert(!tooSmall.sources.some(s=>s.indexedPassage?.subsectionNumber==='991.2.2'&&s.indexedPassage.completeSubsection),'Oversized complete subject cannot be silently truncated and declared complete.');
console.log('Current-detail child selection contract passed.');
