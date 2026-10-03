import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildResearchPassageIndex} from '../research-passage-index.mjs';
import {assembleResearchEvidence} from '../research-evidence-assembly.mjs';

// Invented own-table numbers test canonical scope, never a legal answer key.
const section={id:'fixture-own-table',sectionID:'fixture-own-table',codePrefix:'BC',sectionNumber:'990.3',
 title:'Equipment clearance schedule',corpusID:'synthetic-current-bc',codeVersion:'synthetic-v1',
 codeEdition:'2022',jurisdiction:'New York City'};
const intro='990.3 Equipment clearance. The equipment clearances shall comply with Table 990.3 only for indoor fixed equipment. Exception: An approved isolated enclosure may use its stated alternate clearance.';
const closing='Exceptions: 1. The approved maintenance opening may use a removable shield. 2. A sealed inspection assembly retains its listed clearance. This exception does not apply to exposed supply equipment.';
const tableText='Table 990.3 Equipment clearance schedule\nConfiguration | Clearance\nFixed equipment | Stated clearance\nIsolated enclosure | Approved alternate\nNote a: The clearance is measured from the equipment casing; retain the listed shield.';
const grids=[{rows:[
 {cells:[{text:'Configuration',rowSpan:1,columnSpan:1},{text:'Clearance',rowSpan:1,columnSpan:1}]},
 {cells:[{text:'Fixed equipment',rowSpan:1,columnSpan:1},{text:'Stated clearance',rowSpan:1,columnSpan:1}]},
 {cells:[{text:'Isolated enclosure',rowSpan:1,columnSpan:1},{text:'Approved alternate',rowSpan:1,columnSpan:1}]}
]}];
const rich={id:'fixture-own-grid',kind:'table',reference:'BC Table 990.3',text:tableText,rowCount:3,grids,
 contentHash:createHash('sha256').update(JSON.stringify({reference:'BC Table 990.3',text:tableText,grids})).digest('hex')};
const normalize=value=>String(value||'').replace(/\s+/g,' ').trim();
async function fixture({large=false,tableWhitespace=false}={}){
 const sourceText=[intro+(large?' The introductory scope retains every approved condition.'.repeat(30):''),
 tableWhitespace?tableText.replaceAll('\n','\n\n  '):tableText,closing].join('\n\n');
 const body={blocks:[{id:'fixture-table-block',plainText:sourceText}]};
 const index=await buildResearchPassageIndex([section],async()=>body);
 const primary=index.passages.find(p=>p.text.includes('only for indoor fixed equipment'));
 assert(primary);
 const candidate={...section,rank:1,score:10,selectedText:primary.text,indexedPassage:primary,signals:{}};
 const resolved={...section,body,text:sourceText,richSources:[rich],crossReferences:[]};
 const run=({maximum=3000,selectedOnly=false,selection=primary.text}={})=>assembleResearchEvidence({
  question:'What equipment clearances and enclosure exceptions apply?',pinnedEvidence:[],
  discover:async()=>({candidates:[{...candidate,selectedText:selection,signals:{useSelectedPassageOnly:selectedOnly}}]}),
  resolveSection:async()=>resolved,
  limits:{maximumCharacters:maximum,maximumCharactersPerSource:maximum,maximumDiscovered:1}});
 return {sourceText,body,index,primary,candidate,resolved,run};
}
function bounded(packet,maximum){
 assert(packet.usage.characterCount<=maximum);
 assert(packet.sources.every(source=>source.text.length<=maximum));
 assert.equal(packet.usage.characterCount,packet.sources.reduce((sum,source)=>sum+source.text.length,0));
}
for(const tableWhitespace of [false,true]){
 const f=await fixture({tableWhitespace});const packet=await f.run();const source=packet.sources[0];
 assert.equal(normalize(source.text),normalize(f.sourceText),'A complete canonical own-table section retains its intro, table, trailing exceptions and conditions.');
 assert.match(source.text,/only for indoor fixed equipment/);
 assert.match(source.text,/approved isolated enclosure/);
 assert.match(source.text,/removable shield/);
 assert.match(source.text,/does not apply to exposed supply equipment/);
 assert.equal(source.canonicalContextComplete,true);
 assert.equal(source.truncated,false);
 assert.equal(source.indexedPassage.completeSection,true);
 assert.equal(source.indexedPassage.sourceTextHash,createHash('sha256').update(f.sourceText).digest('hex'));
 const loc=source.indexedPassage.sourceOffsets;
 assert.equal(f.sourceText.slice(loc.start,loc.end),f.primary.text);
 assert.equal(source.richSourceID,rich.id);
 assert.equal(source.richSourceContentHash,rich.contentHash);
 assert.equal(source.richSourceText,tableText);
 assert.deepEqual(source.richSourceGrids,grids);
 assert.equal(source.richSourceRowCount,3);
 bounded(packet,3000);
}
const large=await fixture({large:true});
const tableBudget=tableText.length+25;
const tableOnly=await large.run({maximum:tableBudget});const tableSource=tableOnly.sources[0];
assert.equal(tableSource.text,tableText,'When complete prose cannot fit, the whole canonical table is a scoped fallback.');
assert.equal(tableSource.canonicalContextComplete,false,'Complete table text does not imply complete section scope.');
assert.equal(tableSource.indexedPassage,undefined,'A table-only replacement must not retain a prose locator or whole-child/section completeness metadata.');
assert.equal(tableSource.truncated,false);
assert.deepEqual(tableSource.richSourceGrids,grids);
assert.equal(tableSource.richSourceText,tableText);
assert.match(tableSource.text,/Note a:.*listed shield/);
bounded(tableOnly,tableBudget);
const insufficient=await large.run({maximum:80});bounded(insufficient,80);
for(const source of insufficient.sources){
 assert.equal(source.canonicalContextComplete,false);
 assert(!source.indexedPassage?.completeSection);
 assert(!source.richSourceID,'A complete grid that exceeds the cap cannot be attached as supplied evidence.');
}
const selected='The approved maintenance opening may use a removable shield.';
const exact=await assembleResearchEvidence({question:'Based only on this selected passage, explain this condition.',
 pinnedEvidence:[{...section,text:selected,selectedText:selected}],
 strategy:{mode:'pinned_first',reason:'question_explicitly_bounded_to_selected_evidence'},
 discover:async()=>{throw Error('Strict selected-only must not discover a table or expand context');},
 resolveSection:async()=>large.resolved,
 limits:{maximumCharacters:3000,maximumCharactersPerSource:3000}});
assert.equal(exact.sources.length,1);assert.equal(exact.sources[0].text,selected);
assert.equal(normalize(exact.sources[0].canonicalContextText),normalize(large.sourceText),'Pinned context completeness is backed by the separate complete canonical text, while the user selection remains exact.');
assert.equal(exact.sources[0].canonicalContextComplete,true);
assert.equal(exact.sources[0].indexedPassage,undefined);
assert(!exact.sources[0].richSourceID,'Strict selected prose cannot import an unselected grid.');
bounded(exact,3000);
const short=await fixture();
const selectedCandidate=await short.run({selectedOnly:true,selection:intro});
assert.equal(selectedCandidate.sources[0].text,intro,'Discovered selected-only evidence remains precisely its supplied canonical selection.');
assert.equal(selectedCandidate.sources[0].canonicalContextComplete,false);
assert.equal(selectedCandidate.sources[0].indexedPassage,undefined,'A locator for expanded full context cannot survive replacement with only the selected prose.');
bounded(selectedCandidate,3000);
console.log('Structured-table context passed: full own-table prose/exceptions/grid preserved, whitespace-equivalent grid bound, truthful table-only fallback without wrong locators, small budgets and strict selection exact.');
