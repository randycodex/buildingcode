import test from 'node:test';
import assert from 'node:assert/strict';
import {searchRequest,rankResults} from '../evals/typesafe-search.mjs';
const results=[{id:1,sectionNumber:'403.1',title:'Fixtures',snippet:'Exact text'},{id:2,sectionNumber:'410.1',title:'Other',snippet:'Other text'}];
test('exact section matches stay first despite model score; original objects preserved',()=>{const before=JSON.stringify(results);const sorted=rankResults('PC 403.1',results,{hit_0:{type:'noul',noul:0},hit_1:{type:'noul',noul:1}});assert.equal(sorted[0],results[0]);assert.equal(JSON.stringify(results),before);assert.deepEqual(new Set(sorted),new Set(results));});
test('semantic order is stable on ties and rejects invalid scores',()=>{assert.deepEqual(rankResults('fixtures',results,{hit_0:{type:'noul',noul:.2},hit_1:{type:'noul',noul:.9}}),[results[1],results[0]]);assert.deepEqual(rankResults('fixtures',results,{hit_0:{type:'noul',noul:.5},hit_1:{type:'noul',noul:.5}}),results);assert.throws(()=>rankResults('fixtures',results,{hit_0:{type:'noul',noul:2}}));});
test('batched request includes snippets but no evaluation labels',()=>{const p=searchRequest('fixtures',results.map(r=>({...r,targets:['secret label']})));assert.equal(Object.keys(p.questions).length,2);assert(!JSON.stringify(p).includes('secret label'));assert.equal(p.model,'jev-1.13.0');assert.throws(()=>searchRequest('x',[]));});
