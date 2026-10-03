import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildResearchPassageIndex} from '../research-passage-index.mjs';
import {assembleResearchEvidence} from '../research-evidence-assembly.mjs';

// Invented Plumbing Code numbers exercise structural recovery, not a legal key.
const authority={codePrefix:'PC',corpusID:'synthetic-pc-current',codeVersion:'synthetic-v1',codeEdition:'2022',jurisdiction:'New York City'};
const section={...authority,id:'fixture-drainage',sectionID:'fixture-drainage',sectionNumber:'991',title:'Equipment drainage'};
const text=[
 '991.1 General.\nThese requirements apply only to indoor fixed drainage equipment. Exception: Approved sealed-loop equipment is exempt.',
 '991.2 Drainage access.\nThe following access rules apply to the stated drainage equipment only.',
 '991.2.1 Drainage access path.\nMaintain the drainage access path at the stated width. The collector discharge shall be protected in accordance with PC 991.4.1. Exception: The approved alternate path arrangement is permitted.',
 '991.2.2 Drainage maintenance aisle.\nRetain the maintenance aisle at the equipment connection. Exception: An approved remote maintenance arrangement is permitted.',
 '991.3 Other installations.\n'+'Unrelated drainage installation conditions remain in this chapter. '.repeat(170),
 '991.4 Collector conditions.\nThese collector conditions apply only to exposed discharge piping. Exception: An approved enclosed receiver is exempt.',
 '991.4.1 Collector discharge protection.\nThe collector shall retain its stated shielding and the specified discharge clearance. Such protection shall include:\n1. Keep the shield attached to the collector.\n2. Keep the discharge clearance unobstructed.\nException: The qualified sheltered collector may use the approved alternate protection.',
 '991.4.2 Unreferenced collector outlet.\nAn unrelated collector outlet has its own stated clearance and exception.',
 '991.5 Similar words.\nThe collector discharge protection and drainage access path have unrelated provisions in another branch.'
].join('\n\n');
const body={blocks:[{id:'fixture-drainage-block',plainText:text}]};
const index=await buildResearchPassageIndex([section],async()=>body);
const child=number=>index.passages.find(p=>p.subsectionNumber===number);
const primary=child('991.2.1'),companion={...child('991.2.2'),jurisdiction:authority.jurisdiction};
const dependency={...primary.sameSectionReferences.find(p=>p.subsectionNumber==='991.4.1'),jurisdiction:authority.jurisdiction};
assert(dependency&&dependency.scopeComplete&&dependency.contextTexts.some(t=>/only to exposed discharge piping/.test(t)));
const candidate={...section,rank:1,selectedText:primary.text,indexedPassage:{...primary,
 alternatives:[child('991.4.2'),child('991.5')],companion,sameSectionReferences:[dependency]},signals:{useSelectedPassageOnly:false}};
const question='How must the collector discharge be protected for the drainage access path?';
const resolveSection=async request=>String(request.sectionID||request.id||'')===section.id||request.sectionNumber===section.sectionNumber
 ? {...section,body,text}:null;
const assemble=(value=candidate,maximum=1800,selectionQuestion=question)=>assembleResearchEvidence({question:selectionQuestion,pinnedEvidence:[],
 discover:async()=>({candidates:[value]}),resolveSection,
 limits:{maximumCharacters:maximum,maximumCharactersPerSource:maximum,maximumDiscovered:1}});
const baseline=await assemble({...candidate,indexedPassage:{...candidate.indexedPassage,sameSectionReferences:[]}});
const packet=await assemble();
const source=packet.sources.find(s=>s.sectionID===section.id);
assert(source,'The primary canonical source remains delivered.');
assert.match(source.text,/Maintain the drainage access path/);
assert.match(source.text,/Retain the maintenance aisle/,'The existing one sibling stays intact.');
assert.match(source.text,/only to indoor fixed drainage equipment/);
assert.match(source.text,/Approved sealed-loop equipment is exempt/);
assert.match(source.text,/991\.4\.1 Collector discharge protection/);
assert.match(source.text,/only to exposed discharge piping/,'The referenced child retains its complete parent scope.');
assert.match(source.text,/approved enclosed receiver is exempt/);
assert.match(source.text,/Keep the shield attached/);
assert.match(source.text,/Keep the discharge clearance unobstructed/);
assert.match(source.text,/qualified sheltered collector/);
assert.doesNotMatch(source.text,/991\.4\.2 Unreferenced collector outlet|991\.5 Similar words/,'Lexical resemblance cannot invent a dependency.');
assert.equal(source.truncated,false);
assert.equal(source.canonicalContextComplete,false);
assert(source.text.length<=1800&&packet.usage.characterCount<=1800);
const sourceHash=createHash('sha256').update(text).digest('hex');
const locator=source.indexedPassage.companions.find(p=>p.relationship==='same_section_reference');
assert(locator,'The source records the complete dependency separately from the existing sibling.');
assert.equal(locator.subsectionNumber,'991.4.1');
assert.equal(locator.completeSubsection,true);
assert.equal(locator.sourceTextHash,sourceHash);
assert.deepEqual(locator.sourceOffsets,dependency.sourceOffsets);
assert.equal(text.slice(locator.sourceOffsets.start,locator.sourceOffsets.end),dependency.text);
assert.equal(source.indexedPassage.companions.filter(p=>p.relationship==='same_section_reference').length,1);
assert.equal(source.indexedPassage.sourceTextHash,sourceHash);
assert.deepEqual(source.indexedPassage.sourceOffsets,primary.sourceOffsets);
assert.equal(text.slice(primary.sourceOffsets.start,primary.sourceOffsets.end),primary.text);
for(const slice of [...dependency.contextTexts,dependency.completeSubsectionText])assert(source.text.replace(/\s+/g,' ').includes(slice.replace(/\s+/g,' ').trim()));

const omittedJurisdiction={...dependency};delete omittedJurisdiction.jurisdiction;
const inheritedIdentity=await assemble({...candidate,indexedPassage:{...candidate.indexedPassage,sameSectionReferences:[omittedJurisdiction]}});
assert.equal(inheritedIdentity.sources[0].text,source.text,'Index-v2 nested references inherit registered jurisdiction only when no conflicting label is supplied.');

const limited=await assemble(candidate,baseline.sources[0].text.length+5);
assert.equal(limited.sources[0].text,baseline.sources[0].text,'A referenced child that cannot fit is omitted whole, leaving primary and existing sibling unchanged.');
for(const mutate of [
 p=>({...p,sourceTextHash:'0'.repeat(64)}),
 p=>({...p,sourceOffsets:{...p.sourceOffsets,start:p.sourceOffsets.start+1}}),
 p=>({...p,text:p.text.replace('shielding','unrestricted shielding')}),
 p=>({...p,contextTexts:['These collector exceptions never apply.']}),
 p=>({...p,codePrefix:'MC'}),
 p=>({...p,codeVersion:'stale-v0'}),
 p=>({...p,codeEdition:'2014'}),
 p=>({...p,jurisdiction:'Another City'}),
 p=>({...p,corpusID:'unauthorized-corpus'}),
 p=>({...p,sectionID:'another-canonical-section'}),
 p=>({...p,scopeComplete:false,completeSubsectionText:null})
]){
 const invalid=await assemble({...candidate,indexedPassage:{...candidate.indexedPassage,sameSectionReferences:[mutate(dependency)]}});
 assert.equal(invalid.sources[0].text,baseline.sources[0].text,'Invalid or incomplete reference scope cannot expand canonical evidence.');
}
const notActuallyReferenced=await assemble({...candidate,indexedPassage:{...candidate.indexedPassage,sameSectionReferences:[child('991.4.2')]}});
assert.equal(notActuallyReferenced.sources[0].text,baseline.sources[0].text,'Only a literal reference in the selected operative text admits the complete child.');
const selectedOnly=await assemble({...candidate,signals:{useSelectedPassageOnly:true},selectedText:primary.text});
assert.equal(selectedOnly.sources[0].text,primary.text.trim());
assert.doesNotMatch(selectedOnly.sources[0].text,/991\.4\.1 Collector discharge protection|Retain the maintenance aisle/);
const exactPinned=await assembleResearchEvidence({question:'Based only on this selected passage, explain what it says.',
 pinnedEvidence:[{...section,selectedText:primary.text,text:primary.text}],strategy:{mode:'pinned_first',reason:'question_explicitly_bounded_to_selected_evidence'},
 discover:async()=>{throw Error('Strict selected evidence must not run discovery');},resolveSection,limits:{maximumCharacters:1800,maximumCharactersPerSource:1800}});
assert.equal(exactPinned.sources[0].text,primary.text.trim());
assert.doesNotMatch(exactPinned.sources[0].text,/991\.4\.1 Collector discharge protection/);
// A reference can originate in the one complete sibling already appended to
// the selected packet. Unselected sibling references cannot broaden it.
const companionText=text.replace('The collector discharge shall be protected in accordance with PC 991.4.1.',
 'The collector discharge retains the stated approved arrangement.')
 .replace('Retain the maintenance aisle at the equipment connection.',
 'Retain the maintenance aisle at the equipment connection. The collector discharge shall be protected in accordance with PC 991.4.1.');
const companionBody={blocks:[{id:'companion-origin-block',plainText:companionText}]};
const companionIndex=await buildResearchPassageIndex([section],async()=>companionBody);
const companionChild=number=>companionIndex.passages.find(p=>p.subsectionNumber===number);
const nestedSibling={...companionChild('991.2.2'),jurisdiction:authority.jurisdiction};
assert(nestedSibling.sameSectionReferences.some(p=>p.subsectionNumber==='991.4.1'));
const nestedCandidate={...candidate,selectedText:companionChild('991.2.1').text,
 indexedPassage:{...companionChild('991.2.1'),companion:nestedSibling,alternatives:[],sameSectionReferences:[]}};
const nestedAssemble=(maximum=1800)=>assembleResearchEvidence({question,pinnedEvidence:[],
 discover:async()=>({candidates:[nestedCandidate]}),resolveSection:async request=>
 String(request.sectionID||request.id||'')===section.id||request.sectionNumber===section.sectionNumber
 ? {...section,body:companionBody,text:companionText}:null,
 limits:{maximumCharacters:maximum,maximumCharactersPerSource:maximum,maximumDiscovered:1}});
const nestedPacket=await nestedAssemble();
const nestedSource=nestedPacket.sources[0];
assert.match(nestedSource.text,/Retain the maintenance aisle/);
assert.match(nestedSource.text,/991\.4\.1 Collector discharge protection/,'A referenced complete child of the actually appended sibling is available under the same bound authority.');
assert.match(nestedSource.text,/only to exposed discharge piping/);
assert.match(nestedSource.text,/qualified sheltered collector/);
assert.equal(nestedSource.indexedPassage.companions.filter(p=>p.relationship==='same_section_reference').length,1);
const primaryBudget=baseline.sources[0].text.indexOf('991.2.2 Drainage maintenance aisle')-2;
const unappended=await nestedAssemble(primaryBudget+20);
assert.doesNotMatch(unappended.sources[0].text,/991\.4\.1 Collector discharge protection/,'A sibling that cannot fit contributes no unseen reference.');

// Two explicitly referenced child scopes still reserve only one complete child.
const multipleText=text.replace('The collector discharge shall be protected in accordance with PC 991.4.1.',
 'The collector discharge shall be protected in accordance with PC 991.4.1 and PC 991.4.2.');
const multipleBody={blocks:[{id:'multiple-reference-block',plainText:multipleText}]};
const multipleIndex=await buildResearchPassageIndex([section],async()=>multipleBody);
const multiplePrimary=multipleIndex.passages.find(p=>p.subsectionNumber==='991.2.1');
assert.equal(multiplePrimary.sameSectionReferences.length,2);
const multiplePacket=await assembleResearchEvidence({question,pinnedEvidence:[],
 discover:async()=>({candidates:[{...candidate,selectedText:multiplePrimary.text,
 indexedPassage:{...multiplePrimary,companion:null,alternatives:[]}}]}),
 resolveSection:async request=>String(request.sectionID||request.id||'')===section.id||request.sectionNumber===section.sectionNumber
 ? {...section,body:multipleBody,text:multipleText}:null,
 limits:{maximumCharacters:1800,maximumCharactersPerSource:1800,maximumDiscovered:1}});
assert.equal(multiplePacket.sources[0].indexedPassage.companions.filter(p=>p.relationship==='same_section_reference').length,1);
assert(multiplePacket.usage.characterCount<=1800);

// The exact requested component in a child's own heading outranks a broad
// sibling whose prose repeats that component among unrelated conditions.
const priorityText=multipleText
 .replace('991.4.1 Collector discharge protection.', '991.4.1 Equipment protection.')
 .replace('The collector shall retain its stated shielding and the specified discharge clearance.',
  'The valve cap shield requires its stated protection, drain inspection and discharge clearance.')
 .replace('991.4.2 Unreferenced collector outlet.', '991.4.2 Valve cap shield.')
 .replace('An unrelated collector outlet has its own stated clearance and exception.',
  'Valve caps shall retain the specified shield. Exception: The approved sealed cap is exempt.');
const priorityBody={blocks:[{id:'priority-block',plainText:priorityText}]};
const priorityIndex=await buildResearchPassageIndex([section],async()=>priorityBody);
const priorityPrimary=priorityIndex.passages.find(p=>p.subsectionNumber==='991.2.1');
const priorityPacket=await assembleResearchEvidence({question:'Does the valve cap need a shield?',pinnedEvidence:[],
 discover:async()=>({candidates:[{...candidate,selectedText:priorityPrimary.text,
 indexedPassage:{...priorityPrimary,companion:null,alternatives:[]}}]}),
 resolveSection:async request=>String(request.sectionID||request.id||'')===section.id||request.sectionNumber===section.sectionNumber
 ? {...section,body:priorityBody,text:priorityText}:null,
 limits:{maximumCharacters:1800,maximumCharactersPerSource:1800,maximumDiscovered:1}});
assert.equal(priorityPacket.sources[0].indexedPassage.companions.find(p=>p.relationship==='same_section_reference').subsectionNumber,'991.4.2',
 'A directly referenced child naming the current component wins over generic sibling prose and shared parent scope.');
assert.match(priorityPacket.sources[0].text,/approved sealed cap is exempt/);

console.log('Indexed reference dependency contract passed.');
