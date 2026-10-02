import assert from 'node:assert/strict';
import { discoverRelevantEvidence } from '../evidence-discovery.mjs';

// Simulate a project inventory filling the lexical top 160 before a rare
// technical compound reaches full-text scoring. No source-number answer route.
const inventoryWords = ['building', 'area', 'retail', 'residential', 'community', 'facility', 'stories', 'units', 'district', 'overlay', 'bronx'];
const catalog = Array.from({length: 170}, (_,i) => ({id:String(i),codePrefix:'PC',sectionNumber:`900.${i}`,title:'Project inventory'}));
catalog.push({id:'named',codePrefix:'PC',sectionNumber:'777.1',title:'Special components'});
catalog.push({id:'other',codePrefix:'PC',sectionNumber:'777.2',title:'Other components'});
const ids = catalog.slice(0,170).map(s=>s.id);
const index = new Map(inventoryWords.map(word=>[word,ids]));
index.set('trap',['named','other']);
index.set('traps',['named','other']);
for (const [letter, other] of [['S','P'],['U','V']]) {
  let reads=0;
  const result = await discoverRelevantEvidence({
    question:`Are ${letter}-traps permitted? Project facts: ${inventoryWords.join(' ')}.`,
    retrievalContext:{currentQuestion:`Are ${letter}-traps permitted?`,sourceQuery:`Are ${letter}-traps permitted?`},
    catalog,invertedIndex:index,availableCodePrefixes:['PC'],limit:3,
    readSectionBody:async(section)=>{reads++;return {blocks:[{id:`b-${section.id}`,plainText:section.id==='named'?`Traps: "${letter}" traps are prohibited.`:section.id==='other'?`Traps: "${other}" traps are permitted.`:inventoryWords.join(' ')}]};}
  });
  assert(result.candidates.some(s=>s.sectionID==='named'),'The actual named compound must survive project inventory shortlist pressure');
  const correct=result.candidates.find(s=>s.sectionID==='named');
  const unrelated=result.candidates.find(s=>s.sectionID==='other');
  assert(!unrelated||result.candidates.indexOf(correct)<result.candidates.indexOf(unrelated),'Sharing the substantive word is not a named-phrase match');
  assert(reads<=240,'Named-compound recall must remain bounded');
}
console.log('Named compound recall survives project inventory pressure; full-text identity and bounded reads preserved.');
