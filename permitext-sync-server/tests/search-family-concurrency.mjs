import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {initialSearchGroupLimit} from '../public/search-relevance.js';
const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
const start=source.indexOf('  const familySearches = [];');
const end=source.indexOf('  const definitionBodies =',start);
const pending=new Map(), started=[], candidates=[];
const families=['construction','historical2014','zoning','existingBuilding','enacted'];
const context={activeScope:null,candidates, familyEnabled:()=>true,rememberSpellingSections(){},allowedIDs:()=>null,
 preparedSearchRuntime:{index:(_family,loader)=>loader()},
 codeFilter:new Set(),queryTokens:[],normalizedQuery:'water',query:'water',matchMode:'words',
 timePublicCodePhase:(_name,fn)=>fn(),candidateSectionIDs:()=>new Set([1,2,3,4,5]),
 includeConstruction:true,includeHistorical2014:true,includeZoning:true,includeExistingBuilding:true,includeEnacted:true};
const catalogs=['sectionCatalog','historicalConstructionSectionCatalog','zoningSectionCatalog','existingBuildingSectionCatalog','enactedSectionCatalog'];
const indexStarts=[];
const indexes=['shippedSearchIndex','historicalConstructionSearchIndex','zoningSearchIndex','existingBuildingSearchIndex','enactedSearchIndex'];
families.forEach((family,i)=>{context[catalogs[i]]=()=>{started.push(family);return new Promise(resolve=>pending.set(family,()=>resolve([{id:i+1,codePrefix:'BC'}])));};context[indexes[i]]=async()=>{indexStarts.push(family);return new Map();};});
const work=vm.runInNewContext(`(async()=>{${source.slice(start,end)}})()`,context);
assert.deepEqual(indexStarts,families,'Independent index reads start before any catalog resolves');
assert.deepEqual(started,families,'Every enabled family starts before waiting for another catalog');
for(const family of [...families].reverse()) pending.get(family)();
await work;
assert.deepEqual(candidates.map(n=>n.id),[1,2,3,4,5],'Completion order cannot reorder candidates or alter tie-breaking');
started.length=0;candidates.length=0;context.familyEnabled=family=>family==='zoning';
const scoped=vm.runInNewContext(`(async()=>{${source.slice(start,end)}})()`,context);
assert.deepEqual(started,['zoning'],'Disabled families must not load or contribute results');pending.get('zoning')();await scoped;
assert.deepEqual(candidates.map(n=>n.id),[3]);
console.log('Search families load concurrently, merge deterministically, and honor disabled sources.');

indexStarts.length=0;context.activeScope={};context.allowedIDs=()=>new Set();
const empty=vm.runInNewContext(`(async()=>{${source.slice(start,end)}})()`,context);pending.get('zoning')();await empty;
assert.deepEqual(indexStarts,[],'An empty active-source scope cannot load an index');

const actual = name => {
  const begin = source.indexOf(`async function ${name}(`);
  return source.slice(begin, source.indexOf('\n}', begin) + 2);
};
for (const editionCount of [1, 2, 22]) {
  let active = 0, peak = 0;
  const hits = Array.from({length:editionCount}, (_, edition) =>
    Array.from({length:30}, (_, index) => ({section:{id:edition * 100 + index, codePrefix:`C${edition}`}}))).flat();
  const preview = vm.createContext({
    exactSearchConcurrency:8, initialSearchGroupLimit,
    codeSearchSectionVersion:()=>'2022',
    searchableSectionPlainText:async () => {
      peak = Math.max(peak, ++active);
      await new Promise(resolve => setImmediate(resolve));
      --active; return 'water';
    },
    matchesSearchWords:()=>true, searchTextMatchesExactQuery:()=>true,
    codeSearchResults:async matches=>matches.map(hit=>hit.section.id)
  });
  vm.runInContext(actual('exactSearchPage') + actual('groupedCodeSearchPage'), preview);
  const result = await preview.groupedCodeSearchPage(hits, 'water', 25, 'words');
  const limit = initialSearchGroupLimit(editionCount, 25);
  assert.deepEqual(Array.from(result.results), hits.filter(hit=>hit.section.id % 100 < limit).map(hit=>hit.section.id));
  assert.ok(peak <= 16, `Body reads must stay bounded, got ${peak}`);
  if (editionCount === 22) assert.equal(peak, 16, 'One-result previews should use the full bounded budget across editions');
  assert.equal(result.groups.length, editionCount);
  assert.ok(result.groups.every(group=>group.hasMore && group.nextCandidateOffset === limit));
}
console.log('Edition previews retain deterministic order and cursors with at most sixteen concurrent body reads.');
