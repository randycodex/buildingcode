import assert from 'node:assert/strict';
import {readerSearchMatch, snippetForMatch, searchReaderTextSections} from '../public/reader-search-match.js';
const opening='Use Group III consists of uses that provide educational, religious, health and other essential services';
const continuation='The provisions regulating uses classified in this Use Group apply to these facilities.';
const search=(text,query,{displayTitle='22-13 Use Group III',title='Use Group III'}={})=>searchReaderTextSections([
  {id:'section-1',sectionNumber:'22-13',title,displayTitle,blocks:[{blockID:'paragraph-1',text}]}
],query)[0];
{
  const result=search(`${opening}. ${continuation}`,'Use Group');
  assert.equal(result.heading,opening);
  assert.equal(result.snippet,continuation,'the repeated opening sentence is omitted from the preview');
  assert.equal(result.blockID,'paragraph-1');
  assert.equal(result.matchText,'Use Group','opening and highlight still target the original text');
}
{
  const result=search('HAZARDOUS MATERIALS. Those chemicals or substances that are physical hazards or health hazards.','harzadous materials',{displayTitle:'202 Definitions',title:'Definitions'});
  assert.equal(result.heading,'HAZARDOUS MATERIALS');
  assert.equal(result.snippet,'Those chemicals or substances that are physical hazards or health hazards.');
}
{
  const result=search('Water heaters shall be third-party certified.','water heaters');
  assert.equal(result.snippet,'','a heading-only block needs no duplicate preview');
}
for(const [heading,text,expected] of [
  ['General regulations.','GENERAL   REGULATIONS. Requirements follow.','Requirements follow.'],
  ['General regulations','General regulations: Requirements follow.','Requirements follow.'],
  ['General regulations','General regulations apply to this work.','General regulations apply to this work.'],
  ['Water','Waterproofing protects the building.','Waterproofing protects the building.'],
  ['5.1','5.1.3 Additional requirement.','5.1.3 Additional requirement.'],
  ['Scope','Other text. Scope. Additional text.','Other text. Scope. Additional text.'],
  ['Scope','Scope. Scope is repeated here as part of the actual requirement.','Scope is repeated here as part of the actual requirement.']
]) assert.equal(snippetForMatch(text,readerSearchMatch(text,'scope'),heading),expected);
console.log('Reader preview copy passed: repeated headings omitted, body-only continuations, definition labels, exact source targets and legitimate repeated text preserved.');
