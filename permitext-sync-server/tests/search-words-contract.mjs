import { searchRelevanceRank, matchingSearchDefinition } from "../public/search-relevance.js";
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { searchWords, matchesSearchWords, searchWordPosting, searchWordsSnippet } from '../public/search-words.js';
import { candidateSectionIDs, handleRequest, searchTextMatchesExactQuery } from '../app.mjs';
assert.deepEqual(searchWords('dead-end corridor'), ['dead', 'end', 'corridor']);
assert.deepEqual(searchWords('R-2 1020.4'), ['r-2', '1020.4']);
assert(matchesSearchWords('Corridors with dead ends', 'dead end corridor'));
assert(!matchesSearchWords('Corridors with dead ends', 'dead end corridor sprinkler'));
assert(matchesSearchWords('egression gas', 'egress'), 'All words accepts a word beginning');
assert(!matchesSearchWords('egression gas', 'gress'), 'Completion never matches the middle of a word');
assert(matchesSearchWords('Laundry facilities shall be provided.', 'Laundry Facilit'));
assert(matchesSearchWords('A laundry-facility is provided.', 'laund facilit'));
assert(!matchesSearchWords('Laundry facilities shall be provided.', 'laundry fa'), 'One- and two-letter terms retain whole-word matching');
assert(!matchesSearchWords('A laundry room is provided.', 'laundry facilit'), 'Every query term is still required');
assert(matchesSearchWords('Occupancy Group B', 'Group B'));
assert(!matchesSearchWords('Occupancy Group A', 'Group B'), 'Single-letter occupancy terms must not be discarded');
assert(!matchesSearchWords('Occupancy R-20, section 1020.40', 'R-2'));
assert(!matchesSearchWords('Section 1020.40', '1020.4'), 'Numeric identifiers do not expand as words');
assert(!searchTextMatchesExactQuery('Corridors with dead ends', 'dead end corridor'));
const index = new Map([['dead-end',[1]],['corridors',[1,2]],['dead',[2]],['ends',[2]]]);
assert.deepEqual(searchWordPosting(index,'dead'),[1,2]);
assert.deepEqual([...candidateSectionIDs(index,searchWords('dead end corridor'),'dead end corridor','dead end corridor',new Set([1]),'words')],[1]);
assert.deepEqual([...candidateSectionIDs(index,searchWords('dead end corridor'),'dead end corridor','dead end corridor',new Set(),'words')],[]);
const laundryIndex = new Map([['laundry-facilities',[4]],['laundry',[1,2,3]],['facilities',[1]],['facility',[2]],['xfacilities',[3]],['R-20',[5]]]);
assert.deepEqual(searchWordPosting(laundryIndex,'facilit'),[1,2,4], 'Prefix candidates include singular, plural and hyphen aliases');
assert.deepEqual(searchWordPosting(laundryIndex,'fa'),[], 'Short prefixes do not expand the index');
assert.deepEqual([...candidateSectionIDs(laundryIndex,searchWords('laundry facilit'),'laundry facilit','laundry facilit',new Set([1,4]),'words')],[1,4]);
assert.match(searchWordsSnippet('Unrelated opening. '.repeat(30)+'Corridors with dead ends require review.', 'dead end corridor'), /Corridors with dead ends/);
assert.match(searchWordsSnippet('Unrelated opening. '.repeat(30)+'Laundry facilities shall be provided.', 'laundry facilit'), /Laundry facilities/);
const server=createServer(handleRequest);
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const get=async params=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/code/search?${new URLSearchParams({version:'all',code:'BC',match:'words',grouped:'true',limit:'25',...params})}`);assert.equal(r.status,200);return r.json();};
try {
 for (const q of ['dead end corridor','dead-end corridors','corridor dead ends']) {
  const page=await get({q});
  assert.equal(page.results.find(r=>r.codeVersion.includes('/2022-')).sectionNumber, '1020.4', q+' must rank BC 2022 Dead ends first');
  assert(page.results.every(r=>r.codePrefix==='BC'));
  assert(page.groups.every(g=>page.results.filter(r=>r.codeVersion===g.codeVersion).length<=(page.groups.length===1?12:8)));
 }
 const exact=await get({q:'dead end corridor',match:'exact'});
 assert(!exact.results.some(r=>r.sectionNumber==='1020.4' && r.codeVersion.includes('/2022-')));
 const laundry=await get({q:'Laundry Facilit'});
 assert(laundry.results.length, 'The real indexed corpus returns unfinished laundry queries');
 const laundryBody=await get({q:'laundry facilities'});
 assert(laundryBody.results.length);
 const completeOnly=await get({q:'Laundry Facilit',match:'exact'});
 assert.equal(completeOnly.results.length,0, 'Exact phrase does not gain word completion');
 const numbered=await get({q:'1020.4'});
 assert(numbered.results.some(r=>r.sectionNumber==='1020.4'));
 const empty=await get({q:'dead end corridor',sourceScope:JSON.stringify({version:1,enabledSources:[]})});assert.equal(empty.results.length,0);
 const none=await get({q:'qzxvnonexistent corridor'});assert.equal(none.results.length,0);
 const initial=await get({q:'concrete'});
 const group=initial.groups.find(g=>g.codeVersion.includes('/2022-')&&g.hasMore);assert(group);
 const source=JSON.stringify({codePrefix:group.codePrefix,codeVersion:group.codeVersion});
 const next=await get({q:'concrete',resultSource:source,offset:String(group.nextOffset),candidateOffset:String(group.nextCandidateOffset)});
 const first=initial.results.filter(r=>r.codeVersion===group.codeVersion);
 assert(next.results.length);assert(next.results.every(r=>r.codeVersion===group.codeVersion));
 assert.equal(new Set([...first,...next.results].map(r=>r.id)).size,first.length+next.results.length);
 console.log('All-words Search passed: unfinished words, real laundry queries, phrase/hyphen/plural/section queries, missing terms, enabled-source guards and edition pagination.');
} finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}

// Exercise the actual offline cursor/filter, not a replacement search implementation.
const { readFile } = await import('node:fs/promises');
const vm = await import('node:vm');
const offline = await readFile(new URL('../public/offline-storage.js',import.meta.url),'utf8');
const begin = offline.indexOf('async function matchingOfflineSearchResults(');
const actual = offline.slice(begin,offline.indexOf('\n}',begin)+2);
const records = [
 {id:1,installID:'test',codePrefix:'BC',codeVersion:'2022',sectionNumber:'1020.4',title:'Dead ends',plainText:'The corridors shall have no dead-end exceeding the limit.',searchText:'dead-end corridors'},
 {id:2,installID:'test',codePrefix:'BC',codeVersion:'2014',sectionNumber:'1018.4',title:'Dead ends',plainText:'Corridors with dead ends.',searchText:'dead ends corridors'},
 {id:3,installID:'test',codePrefix:'BC',codeVersion:'2022',sectionNumber:'1',title:'Unrelated',plainText:'Dead corridor without the last word.',searchText:'dead corridor'},
 {id:4,installID:'test',codePrefix:'BC',codeVersion:'2022',sectionNumber:'2',title:'Laundry',plainText:'Laundry facilities shall be provided.',searchText:'laundry facilities'},
 {id:5,installID:'test',codePrefix:'BC',codeVersion:'2022',sectionNumber:'3',title:'Laundry',plainText:'A laundry room.',searchText:'laundry room'},
 {id:6,installID:'test',codePrefix:'PC',codeVersion:'2022',sectionNumber:'4',title:'Laundry',plainText:'Laundry facilities.',searchText:'laundry facilities'},
 {id:7,installID:'test',codePrefix:'BC',codeVersion:'2014',sectionNumber:'5',title:'Laundry',plainText:'Laundry facilities.',searchText:'laundry facilities'}
];
const db={close(){},transaction(){return {objectStore(){return {index(){return {openCursor(){
 const request={}; let i=0;
 const advance=()=>{request.result=i<records.length?{value:records[i++],continue:()=>queueMicrotask(advance)}:null;request.onsuccess();};
 queueMicrotask(advance);return request;
}};}};}};}};
const context=vm.createContext({searchRelevanceRank, matchingSearchDefinition,openDatabase:async()=>db,sectionsStoreName:'sections',IDBKeyRange:{only:x=>x},matchesSearchWords,searchWords,searchWordsSnippet,searchSnippet:searchWordsSnippet});
vm.runInContext(actual,context);
const offlineMatches=await context.matchingOfflineSearchResults('test',{codeFilter:new Set(['BC']),normalizedQuery:'dead-end corridor',query:'dead-end corridor',tokens:searchWords('dead-end corridor'),matchMode:'words',sourceScope:{permits:section=>section.codeVersion==='2022'}});
assert.deepEqual(Array.from(offlineMatches,x=>x.result.id),[1]);
assert.match(offlineMatches[0].result.snippet,/dead-end/);
const offlineLaundry=await context.matchingOfflineSearchResults('test',{codeFilter:new Set(['BC']),normalizedQuery:'laundry facilit',query:'Laundry Facilit',tokens:searchWords('Laundry Facilit'),matchMode:'words',sourceScope:{permits:section=>section.codeVersion==='2022'}});
assert.deepEqual(Array.from(offlineLaundry,x=>x.result.id),[4]);
assert.match(offlineLaundry[0].result.snippet,/Laundry facilities/);
console.log('Offline all-words Search passed: unfinished-word parity, actual cursor matching, hyphen/plural parity, missing-word rejection and edition scope.');
