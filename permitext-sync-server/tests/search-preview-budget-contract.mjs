import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {initialSearchGroupLimit} from '../public/search-relevance.js';

for(const count of [1,2,3,4,8,21,40]) {
 const limit=initialSearchGroupLimit(count,25);
 assert.ok(limit>=1);
 assert.ok(count*limit<=Math.max(count,25),'The initial preview budget must not multiply by every codebook.');
}
assert.equal(initialSearchGroupLimit(1),12);
assert.equal(initialSearchGroupLimit(3),8);
assert.equal(initialSearchGroupLimit(21),1);
const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
const start=source.indexOf('async function exactSearchPage(');
const actual=source.slice(start,source.indexOf('\n}',start)+2);
let reads=0,active=0,peak=0,fail=false;
const c=vm.createContext({exactSearchConcurrency:8,
 async searchableSectionPlainText(section){reads++;active++;peak=Math.max(peak,active);await Promise.resolve();active--;if(fail)throw Error('Unavailable');return section.text;},
 matchesSearchWords:values=>values.at(-1)==='match',searchTextMatchesExactQuery:values=>values.at(-1)==='match'});
vm.runInContext(actual,c);
for(const mode of ['exact','words']) for(const pattern of [1,3,11,100]) for(const limit of [1,2,8,12,25]) {
 const hits=Array.from({length:90},(_,i)=>({section:{id:i,text:i%pattern===0?'match':'other'}}));
 let offset=0;const seen=[];
 do {
  const expected=hits.map((hit,i)=>({hit,i})).filter(row=>row.i>=offset&&row.hit.section.text==='match');
  const page=await c.exactSearchPage(hits,'query',offset,limit,mode);
  assert.deepEqual(Array.from(page.hits,hit=>hit.section.id),expected.slice(0,limit).map(row=>row.i));
  assert.equal(page.hasMore,expected.length>limit);
  assert.equal(page.nextCandidateOffset,expected.length>limit?expected[limit].i:hits.length);
  seen.push(...page.hits.map(hit=>hit.section.id));offset=page.nextCandidateOffset;
  if(!page.hasMore)break;
 }while(offset<hits.length);
 assert.deepEqual(seen,hits.filter(hit=>hit.section.text==='match').map(hit=>hit.section.id),'Every matching result remains reachable exactly once.');
}
reads=0;
await c.exactSearchPage(Array.from({length:90},(_,i)=>({section:{id:i,text:'match'}})),'query',0,1);
assert.equal(reads,2,'A one-result preview reads only its result and lookahead.');
assert.ok(peak<=8,'Content read concurrency stays bounded.');
fail=true;await assert.rejects(c.exactSearchPage([{section:{text:'match'}}],'query',0,1),/Unavailable/);
console.log('Search preview budget passed: all source groups visible, bounded initial rows/reads, exact and words parity, complete pagination, no skips/duplicates and preserved failures.');
