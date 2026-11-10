import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {prepareSearchRelevance, searchRelevanceRank, matchingSearchDefinition} from '../public/search-relevance.js';

const sections = [
  {sectionNumber:'1104.1',title:'1104.1 Accessible route.',headingLine:'ACCESSIBLE ROUTES'},
  {sectionNumber:'404.2.3',title:'An accessible route shall connect all spaces, including exceptions to this requirement and every associated entrance in this building.'},
  {sectionNumber:'202',title:'Definitions',plainText:'OCCUPANT LOAD. The number of occupants.\nFIRE-RESISTANCE RATING. A tested duration.'},
  {sectionNumber:'1004.1',title:'Occupant load'},
  {sectionNumber:'403.3.2',title:'Water supply to required fire pumps.'},
  {sectionNumber:'1020.4',title:'Dead ends.'},
  {sectionNumber:'A102.1',title:'Fire-resistance rating'}
];
// Preparing a query must preserve the shared online/offline ranking policy,
// including reusable regexes across repeated calls and match modes.
const queries = ['accessible route','1004.1','occupant loads','fire-resistance rating','fire','water supply','dead end corridor'];
for (const query of queries) {
  const expected = sections.map(section=>searchRelevanceRank(section,query));
  const prepared=prepareSearchRelevance(query), patterns=[...prepared.patterns];
  for (const mode of ['exact','words']) for (let repeat=0;repeat<3;repeat++) {
    assert.deepEqual(sections.map(section=>searchRelevanceRank(section,query,mode,section.plainText,prepared)),expected);
    assert.deepEqual(sections.map(section=>searchRelevanceRank(section,query,mode)),expected,'Offline/default callers keep the same scores.');
  }
  assert.deepEqual(prepared.patterns,patterns,'Ranking reuses the same compiled word patterns.');
  assert.ok(prepared.patterns.every(pattern=>!pattern.global&&!pattern.sticky&&pattern.lastIndex===0));
}
assert.equal(matchingSearchDefinition(sections[2],'occupant loads',sections[2].plainText,prepareSearchRelevance('occupant loads')),'OCCUPANT LOAD');
assert.equal(matchingSearchDefinition(sections[2],'fire-resistance rating',sections[2].plainText,prepareSearchRelevance('fire-resistance rating')),'FIRE-RESISTANCE RATING');

const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
const actual=name=>{const begin=source.indexOf(`function ${name}(`);assert.ok(begin>=0);return source.slice(begin,source.indexOf('\n}',begin)+2);};
const c=vm.createContext({});vm.runInContext(actual('normalizeChapterNumber')+actual('compareChapterNumbers'),c);
const collator=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
const numbers=['','1','2','10','10.1','10.01','10.2','100','A1','A2','A10','a10','BC 101','K','K1','K10','II'];
for (const left of numbers) for (const right of numbers) {
  assert.equal(Math.sign(c.compareChapterNumbers(left,right,collator)),Math.sign(c.compareChapterNumbers(left,right)));
  assert.equal(Math.sign(collator.compare(left,right)),Math.sign(left.localeCompare(right,undefined,{numeric:true,sensitivity:'base'})));
}
console.log('Search ranking passed: prepared/default scores, exact/all-word parity, reusable regexes, definition labels and identical numeric/case-insensitive ordering.');
