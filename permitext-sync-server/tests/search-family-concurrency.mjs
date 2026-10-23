import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
const start=source.indexOf('  const familySearches = [];');
const end=source.indexOf('  const definitionBodies =',start);
const pending=new Map(), started=[], candidates=[];
const families=['construction','historical2014','zoning','existingBuilding','enacted'];
const context={candidates, familyEnabled:()=>true,rememberSpellingSections(){},allowedIDs:()=>null,
 codeFilter:new Set(),queryTokens:[],normalizedQuery:'water',query:'water',matchMode:'words',
 timePublicCodePhase:(_name,fn)=>fn(),candidateSectionIDs:()=>new Set([1,2,3,4,5]),
 includeConstruction:true,includeHistorical2014:true,includeZoning:true,includeExistingBuilding:true,includeEnacted:true};
const catalogs=['sectionCatalog','historicalConstructionSectionCatalog','zoningSectionCatalog','existingBuildingSectionCatalog','enactedSectionCatalog'];
const indexes=['shippedSearchIndex','historicalConstructionSearchIndex','zoningSearchIndex','existingBuildingSearchIndex','enactedSearchIndex'];
families.forEach((family,i)=>{context[catalogs[i]]=()=>{started.push(family);return new Promise(resolve=>pending.set(family,()=>resolve([{id:i+1,codePrefix:'BC'}])));};context[indexes[i]]=async()=>new Map();});
const work=vm.runInNewContext(`(async()=>{${source.slice(start,end)}})()`,context);
assert.deepEqual(started,families,'Every enabled family starts before waiting for another catalog');
for(const family of [...families].reverse()) pending.get(family)();
await work;
assert.deepEqual(candidates.map(n=>n.id),[1,2,3,4,5],'Completion order cannot reorder candidates or alter tie-breaking');
started.length=0;candidates.length=0;context.familyEnabled=family=>family==='zoning';
const scoped=vm.runInNewContext(`(async()=>{${source.slice(start,end)}})()`,context);
assert.deepEqual(started,['zoning'],'Disabled families must not load or contribute results');pending.get('zoning')();await scoped;
assert.deepEqual(candidates.map(n=>n.id),[3]);
console.log('Search families load concurrently, merge deterministically, and honor disabled sources.');
