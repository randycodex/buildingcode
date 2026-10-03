import assert from 'node:assert/strict';
import {buildResearchPassageIndex,searchResearchPassages} from '../research-passage-index.mjs';
import {discoverRelevantEvidence} from '../evidence-discovery.mjs';
import {assembleResearchEvidence} from '../research-evidence-assembly.mjs';

const authority={corpusID:'synthetic-current',codeVersion:'synthetic-current-v1',codeEdition:'2022',jurisdiction:'New York City'};
const fixture=(id,number,title,text,codePrefix='MC')=>({...authority,id,sectionID:id,sectionNumber:number,title,codePrefix,
 body:{blocks:[{id:id+'-block',plainText:text}]}});
const question='For a mechanical duct sleeve installation, how much shielding does the sleeve need when protective steel plates are absent?';
const target=fixture('sleeve-rule','990.2','Sleeve shielding',
 '990.2 Sleeve shielding. The duct sleeve shall retain its specified shielding. Protective steel plates are an approved alternative only when the stated overlap and attachment conditions are met. Exception: Listed isolated sleeves may use their approved shield.');
const semanticSections=[
 fixture('meaning-lead','991.1','Duct layout','991.1 Duct layout. Mechanical duct installations shall retain the specified general layout.'),
 fixture('meaning-other','992.1','Duct supports','992.1 Duct supports. Install the general mechanical duct support arrangement.'),
 fixture('meaning-third','993.1','Air distribution','993.1 Air distribution. The installation shall retain the stated circulation arrangement.')
];
const cross=fixture('plate-words','995.1','Steel plate protection','995.1 Steel plate protection. Protective steel plates at the sleeve installation shall retain the listed shielding. Steel plates at the sleeve shall be attached as specified.','PC');
async function setup(sections){
 const index=await buildResearchPassageIndex(sections,async s=>s.body);
 const hit=id=>index.passages.find(p=>p.sectionID===id);
 const run=async({q=question,limit=3,meaning=semanticSections.map(s=>s.id),alter=null,selectedOnly=false}={})=>discoverRelevantEvidence({
  question:q,retrievalContext:{currentQuestion:q,sourceQuery:q},catalog:sections,invertedIndex:new Map(),passageIndex:index,
  semanticSearch:{search:async()=>({hits:meaning.map((id,i)=>({...hit(id),score:.99-i*.01,similarity:.99-i*.01,passages:[hit(id)]})).map(h=>alter?alter(h):h),metadata:{enabled:true}})},
  readSectionBody:async s=>s.body,limit,availableCodePrefixes:['MC','PC'],
 });
 return {index,hit,run};
}
const base=await setup([...semanticSections,cross,target]);
const result=await base.run();
const reserved=result.candidates.find(c=>c.sectionID===target.id);
assert(reserved,'A strong omitted current-question lexical source survives semantic fusion under the same source cap.');
assert(reserved.signals.currentQuestionLexicalReservation);
assert(reserved.signals.currentQuestionLexicalReservation.rank<=5);
assert(reserved.signals.currentQuestionLexicalReservation.strength>=.7);
assert.equal(result.candidates[0].sectionID,semanticSections[0].id,'The semantic lead remains intact for ordinary-language recall.');
assert.equal(result.candidates.length,3);
assert(!result.candidates.some(c=>c.sectionID===cross.id),'Soft current mechanical discipline prefers the matching strong source over an omitted cross-book word match.');
const delivered=await assembleResearchEvidence({question,pinnedEvidence:[],discover:async()=>result,
 resolveSection:async request=>{const s=[...semanticSections,cross,target].find(s=>s.id===request.sectionID);return s?{...s,text:s.body.blocks[0].plainText}:null;},
 limits:{maximumCharacters:3000,maximumCharactersPerSource:1000,maximumDiscovered:3}});
const source=delivered.sources.find(s=>s.sectionID===target.id);assert(source);
assert.match(source.text,/approved alternative only when the stated overlap and attachment conditions/);
assert.match(source.text,/Exception: Listed isolated sleeves/);
assert(source.canonicalContextComplete&&source.indexedPassage.completeSection);
assert(delivered.usage.characterCount<=3000&&delivered.sources.every(s=>s.text.length<=1000));
// A shortlisted source can otherwise miss the writer's smaller discovery cap.
// The reservation must promote its complete text ahead of optional nominees.
const tightDelivery=await assembleResearchEvidence({question,pinnedEvidence:[],discover:async()=>result,
 resolveSection:async request=>{const s=[...semanticSections,cross,target].find(s=>s.id===request.sectionID);return s?{...s,text:s.body.blocks[0].plainText}:null;},
 limits:{maximumCharacters:3000,maximumCharactersPerSource:1000,maximumDiscovered:2}});
const tightSource=tightDelivery.sources.find(s=>s.sectionID===target.id);assert(tightSource,
 'The reserved source reaches the smaller writer discovery cap, not merely the larger candidate shortlist.');
assert.match(tightSource.text,/approved alternative only when the stated overlap and attachment conditions/);
assert.match(tightSource.text,/Exception: Listed isolated sleeves/);
assert(tightSource.canonicalContextComplete&&tightSource.indexedPassage.completeSection);
assert(tightDelivery.usage.characterCount<=3000&&tightDelivery.sources.every(s=>s.text.length<=1000));
assert.equal(result.candidates.filter(c=>c.signals.currentQuestionLexicalReservation).length,1);
const singleton=await base.run({limit:1});
assert.equal(singleton.candidates.length,1);assert.equal(singleton.candidates[0].sectionID,semanticSections[0].id);
assert(!singleton.candidates.some(c=>c.signals.currentQuestionLexicalReservation));

// Current explicit authorities remain ahead of the recall reservation.
const direct=await base.run({q:'Under MC 991.1 and MC 992.1, what shielding must the duct sleeve have?',limit:2});
assert.deepEqual(direct.candidates.map(c=>c.sectionID),semanticSections.slice(0,2).map(s=>s.id));
assert(direct.candidates.every(c=>c.signals.exactReference));
assert(!direct.candidates.some(c=>c.signals.currentQuestionLexicalReservation));

// No selectable current candidate can acquire stale edition/provider metadata.
const stale=await base.run({alter:h=>h.sectionID===semanticSections[2].id?{...h,codeEdition:'2014',codeVersion:'historical',corpusID:'unauthorized-history'}:h});
assert(stale.candidates.every(c=>c.codeEdition==='2022'&&c.codeVersion===authority.codeVersion&&c.corpusID===authority.corpusID));

// A cross-discipline meaning lead must remain usable when ordinary wording
// differs from the canonical title; a lexical reservation is supplementary.
const otherMeaning=fixture('cross-meaning','997.1','Flow continuation','997.1 Flow continuation. Retain the listed circulation conditions.','PC');
const crossSetup=await setup([...semanticSections,target,cross,otherMeaning]);
const crossResult=await crossSetup.run({meaning:[otherMeaning.id]});
assert.equal(crossResult.candidates[0].sectionID,otherMeaning.id);
assert(crossResult.candidates.some(c=>c.sectionID===target.id));


// Every strong current hit outside the top five stays outside the new recall
// reservation; it is not made authoritative just because it shares words.
const strongOthers=Array.from({length:6},(_,i)=>fixture('current-top-'+i,'960.'+(i+1),
 'Duct sleeve shielding steel plates','Duct sleeve shielding steel plates. Mechanical duct sleeve installation shall retain protective steel plates and specified sleeve shielding.'));
const outside=await setup([...semanticSections,...strongOthers,target]);
const outsideRanking=searchResearchPassages(outside.index,question,{limit:20});
assert(outsideRanking.findIndex(h=>h.sectionID===target.id)>=5,'The test target genuinely falls outside the current shortlist.');
const outsideResult=await outside.run({meaning:strongOthers.map(s=>s.id),limit:3});
assert(!outsideResult.candidates.some(c=>c.sectionID===target.id));
assert(outsideResult.candidates.filter(c=>c.signals.currentQuestionLexicalReservation).length<=1);

const weakQuestion='For a mechanical duct sleeve assembly, how should shielding retain its weatherproof cover, inspection opening and protective steel plate attachment?';
const veryStrong=fixture('strong-current','970.1','Duct sleeve assembly shielding cover inspection protective steel plate attachment',
 'Duct sleeve assembly shielding cover inspection protective steel plate attachment. Retain mechanical duct sleeve assembly shielding, weatherproof cover, inspection opening, protective steel plate attachment.');
const weakTarget=fixture('weak-current','975.1','Equipment shielding','Equipment shielding. The duct shall retain its shield.');
const weakOther=fixture('weak-semantic-other','980.1','Circulation arrangement','Circulation arrangement. Equipment uses the stated general arrangement.');
const weak=await setup([veryStrong,weakOther,weakTarget]);
const weakRanking=searchResearchPassages(weak.index,weakQuestion,{limit:10});
assert(weakRanking.find(h=>h.sectionID===weakTarget.id).score/weakRanking[0].score<.7,'The omission fixture is genuinely weak relative to the best current match.');
const weakResult=await weak.run({q:weakQuestion,meaning:[veryStrong.id,weakOther.id],limit:2});
assert(!weakResult.candidates.some(c=>c.sectionID===weakTarget.id));
assert(!weakResult.candidates.some(c=>c.signals.currentQuestionLexicalReservation));

const sibling=fixture('protected-companion','991.2','Duct shielding conditions','991.2 Duct shielding conditions. Mechanical duct shielding retains its stated qualified arrangement. Exception: The approved alternate arrangement is allowed.');
const withSibling=await setup([...semanticSections,sibling,target]);
const siblingResult=await withSibling.run({limit:2});
assert.equal(siblingResult.candidates[0].sectionID,semanticSections[0].id);
assert.equal(siblingResult.candidates[1].sectionID,sibling.id);
assert(siblingResult.candidates[1].signals.completeSiblingCompanionOf);
assert(!siblingResult.candidates.some(c=>c.signals.currentQuestionLexicalReservation),'The one existing complete companion cannot be displaced by an optional reservation.');

// Hyphenated ordinary compound wording uses the same existing soft discipline
// signal as its spaced form, without a section-specific legal route.
const gasTarget=fixture('hyphen-subject','985.2','Sleeve shielding',target.body.blocks[0].plainText,'FGC');
const hyphen=await setup([...semanticSections,cross,gasTarget]);
const gasQuestion='For a gas-piping sleeve installation, how much shielding does the sleeve need when protective steel plates are absent?';
const hyphenResult=await hyphen.run({q:gasQuestion});
const spacedResult=await hyphen.run({q:gasQuestion.replace('gas-piping','gas piping')});
assert(hyphenResult.candidates.some(c=>c.sectionID===gasTarget.id));
assert.equal(hyphenResult.candidates.find(c=>c.signals.currentQuestionLexicalReservation)?.sectionID,
 spacedResult.candidates.find(c=>c.signals.currentQuestionLexicalReservation)?.sectionID);
console.log('Current lexical reservation passed: one strong current top-five source, soft discipline, unchanged cap, weak/outside-five rejection, direct/edition/complete-companion guards and cross-discipline meaning recall.');
