import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const extract=name=>{const start=source.indexOf(`function ${name}(`);assert.ok(start>=0,name);return source.slice(start,source.indexOf('\n}',start)+2);};
const c=vm.createContext({defaultSyncCodeVersion:'2022',repeatableUtilityKeys:new Set(['search']),
  normalizeSearchCodeFilters:value=>Array.isArray(value)?value:[],normalizeSearchHistorySplitRatio:value=>value});
vm.runInContext(['normalizeSearchResultSources','newUtilityInstance','normalizeUtilityInstances','normalizeSearchInstance',
  'searchPositionState','applyInitialSearchGroupExpansion','searchResultChapter'].map(extract).join('\n'),c);
const all={querySuffix:''};
const matches=[{codePrefix:'MC',codeVersion:'2022'},{codePrefix:'BC',codeVersion:'2014'},{codePrefix:'BC',codeVersion:'2022'}];
const make=()=>c.newUtilityInstance('search',{id:'test',query:'concrete',expandedResultSources:['BC|2014']});
const instance=make(),before=JSON.stringify(matches);
assert.equal(c.applyInitialSearchGroupExpansion(instance,matches,all),true);
assert.equal(instance.defaultExpandedResultSource,'MC|2022','The first ranked source exposes matches immediately');
assert.deepEqual(Array.from(instance.expandedResultSources),['BC|2014'],'Manual source choices survive');
instance.searchPosition.chapterExpansion={'MC|2022|10':false};
instance.defaultExpandedResultSource='';
assert.equal(c.applyInitialSearchGroupExpansion(instance,matches.slice(1),all),false,'Pagination never reopens groups');
assert.equal(instance.defaultExpandedResultSource,'');
const restored=c.normalizeUtilityInstances(JSON.parse(JSON.stringify({utilityInstances:[instance]})))[0];
assert.equal(c.applyInitialSearchGroupExpansion(restored,matches,all),false);
assert.equal(restored.defaultExpandedResultSource,'','Closing the preview survives reload');
assert.equal(restored.searchPosition.chapterExpansion['MC|2022|10'],false);
for(const change of [()=>restored.query='steel',()=>restored.matchMode='exact',()=>restored.searchEdition='2014']){
 change();assert.equal(c.applyInitialSearchGroupExpansion(restored,matches,all),true);
 assert.equal(restored.defaultExpandedResultSource,'MC|2022');assert.deepEqual(Object.keys(restored.searchPosition.chapterExpansion),[]);
}
restored.searchPosition.chapterExpansion={old:false};
assert.equal(c.applyInitialSearchGroupExpansion(restored,matches,{querySuffix:'&sourceScope=other'}),true);
assert.deepEqual(Object.keys(restored.searchPosition.chapterExpansion),[],'Source-scope changes reset query-specific chapter choices');
assert.equal(JSON.stringify(matches),before,'Presentation never changes result ranking or source records');
const empty=make();assert.equal(c.applyInitialSearchGroupExpansion(empty,[],all),false);
assert.equal(c.applyInitialSearchGroupExpansion(empty,matches,all),true);
const chapter=result=>JSON.parse(JSON.stringify(c.searchResultChapter(result)));
assert.deepEqual(chapter({chapterID:7,chapterNumber:'7',chapterTitle:'Fire and Smoke Protection Features'}),{key:'7',label:'Chapter 7: Fire and Smoke Protection Features'});
assert.equal(chapter({navigationChapterID:'k',chapterID:'k2',navigationChapterNumber:'K',chapterNumber:'K2',chapterTitle:'Appendix K: Modified Industry Standards'}).label,'Appendix K: Modified Industry Standards');
assert.equal(chapter({chapterID:'zoning-12',chapterNumber:'12',chapterTitle:'Chapter 2: Construction of Language and Definitions'}).label,'Chapter 2: Construction of Language and Definitions');
assert.equal(chapter({chapterID:'2014-7',chapterNumber:'7',chapterTitle:'BC CHAPTER 7 - FIRE AND SMOKE PROTECTION FEATURES'}).label,'Chapter 7: FIRE AND SMOKE PROTECTION FEATURES','Historical metadata never repeats the chapter number');
assert.equal(chapter({chapterID:'opaque',chapterNumber:'',chapterTitle:''}).label,'Other matching provisions','Missing metadata never invents a chapter');
assert.notEqual(chapter({chapterID:'a"b'}).key,chapter({chapterID:'a/b'}).key);
const presentation=vm.createContext({researchCodeEdition:()=> '2022'});
vm.runInContext(['escapeRegExp','stripLeadingSectionNumber','searchResultPresentation'].map(extract).join('\n'),presentation);
const paragraph={codePrefix:'BC',sectionNumber:'2.1.',headerLine:'SECTION BC 403',title:'Stairs shall comply. '.repeat(20),headingLine:'SHALL APPLY TO ALL WALLS. '.repeat(15),snippet:'Stairs shall comply. '.repeat(20)};
const compact=presentation.searchResultPresentation(paragraph,'stairs');
assert.equal(compact.heading,'Code passage','A full legal paragraph never becomes a giant result heading');
assert.equal(compact.scope,'');assert.equal(compact.number,'2.1.');assert.match(compact.excerpt,/Stairs/);
console.log('Search expansion passed: strongest source preview, manual closure/reload, query/scope changes, ranked-result preservation, canonical chapter labels and missing-metadata fallbacks.');
