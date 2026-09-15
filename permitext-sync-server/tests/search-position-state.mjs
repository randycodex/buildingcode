import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const extract=name=>{const start=source.indexOf(`function ${name}(`);assert.ok(start>=0);return source.slice(start,source.indexOf('\n}',start)+2);};
const c=vm.createContext({repeatableUtilityKeys:new Set(['search']),normalizeSearchCodeFilters:x=>Array.isArray(x)?x:[],normalizeSearchHistorySplitRatio:x=>x});
vm.runInContext(['newUtilityInstance','normalizeUtilityInstances','searchPositionState','searchResultPositionKey'].map(extract).join('\n'),c);
const original={id:'search-a',key:'search',query:'concrete',codeFilters:['BC'],historyScrollTop:275};
const pos=c.searchPositionState(original);pos.loadedPages=3;pos.scrollTop=4500;pos.selectedResult='edition:section:paragraph';
const restored=c.normalizeUtilityInstances(JSON.parse(JSON.stringify({utilityInstances:[original]})))[0];
assert.equal(restored.historyScrollTop,275);
assert.equal(c.searchPositionState(restored).loadedPages,3);assert.equal(restored.searchPosition.scrollTop,4500);assert.equal(restored.searchPosition.selectedResult,pos.selectedResult);
restored.query='steel';assert.equal(restored.historyScrollTop,275);assert.equal(c.searchPositionState(restored).scrollTop,0);assert.equal(restored.searchPosition.loadedPages,1);assert.equal(restored.searchPosition.selectedResult,'');
restored.searchPosition.scrollTop=10;restored.codeFilters=['MC'];assert.equal(c.searchPositionState(restored).scrollTop,0);
assert.notEqual(c.searchResultPositionKey({id:1,codeVersion:'2014'}),c.searchResultPositionKey({id:1,codeVersion:'2022'}));
assert.notEqual(c.searchResultPositionKey({id:1,blockID:'a'}),c.searchResultPositionKey({id:1,blockID:'b'}));
console.log('Search position survives application normalization and resets on query/filter changes; result identity includes edition and paragraph.');

// Failed restoration retains the desired count; retry counts rendered pages.
{
  let fail = true;
  const results={dataset:{searchRenderToken:'current',loadedSearchPages:'1',restoringSearch:'true'},querySelector:()=>null,querySelectorAll:()=>[{},{}],append(){}};
  const instance={query:'concrete',codeFilters:[],searchPosition:{key:JSON.stringify(['concrete',[]]),loadedPages:3,scrollTop:250,selectedResult:''}};
  const pageContext=vm.createContext({
    document:{createElement:()=>({append(){},addEventListener(){},remove(){},disabled:false})},
    api:async()=>{if(fail)throw new Error('Offline');return {results:[{id:'next'}],hasMore:false};},
    normalizeSearchCodeFilters:x=>x,searchResultPageSize:25,
    searchResultMatchesExactQuery:()=>true,appendSearchResultGroups(){},updateSearchDock(){},saveWorkspaceState(){},
  });
  vm.runInContext(extract('searchPositionState')+'\n'+extract('appendSearchLoadMore'),pageContext);
  pageContext.appendSearchLoadMore(results,{query:'concrete',selectedPrefixes:[],searchInstance:instance,renderToken:'current',nextOffset:25,candidateOffset:25,totalResults:50,hasMore:true,panel:{}});
  const retry=results.searchLoadMore;
  assert.equal(await retry(),false);assert.equal(instance.searchPosition.loadedPages,3);
  fail=false;assert.equal(await retry(),true);assert.equal(instance.searchPosition.loadedPages,2);
  assert.equal(results.searchLoadMore,null);
  pageContext.appendSearchLoadMore(results,{query:'concrete',selectedPrefixes:[],searchInstance:instance,renderToken:'stale',nextOffset:25,candidateOffset:25,totalResults:50,hasMore:true,panel:{}});
  assert.equal(await results.searchLoadMore(),false);assert.equal(instance.searchPosition.loadedPages,2);
}
console.log('Search pagination retry counts rendered pages and rejects stale render tokens.');
