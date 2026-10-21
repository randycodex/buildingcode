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
// Frozen pre-optimization scores cover title/context, definitions, plural and
// hyphen matching, partial overlap, numbered sections and long prose headings.
const snapshots = [
  ['accessible route',[1.03,4.24,4,4.12,4.24,4.12,4.12]],
  ['1004.1',[4.12,4.24,4,0,4.24,4.12,4.12]],
  ['occupant loads',[4.12,4.24,1.05,1.32,4.24,4.12,4.12]],
  ['fire-resistance rating',[4.12,4.24,1.05,4.12,3.9066666666666663,4.12,1.32]],
  ['fire',[4.12,4.24,4,4.12,1.6600000000000001,4.12,1.6300000000000001]],
  ['water supply',[4.12,4.24,4,4.12,1.6600000000000001,4.12,4.12]],
  ['dead end corridor',[4.12,4.24,4,4.12,4.24,3.4533333333333336,4.12]]
];
for (const [query,expected] of snapshots) {
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
console.log('Search ranking passed: frozen scores, exact/all-word parity, reusable regexes, definition labels and identical numeric/case-insensitive ordering.');
