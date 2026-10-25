import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { handleRequest } from '../app.mjs';
import { activeCodeSourceCatalog } from '../active-code-source-catalog.mjs';
import { codeSourceIdentity } from '../public/active-code-sources.js';
import { searchRelevanceRank, searchSpellingSuggestions, searchVocabulary } from '../public/search-relevance.js';
const query = 'accessible route';
assert(searchRelevanceRank({sectionNumber:'1104.1',title:'1104.1 Accessible route.',headingLine:'ACCESSIBLE ROUTES'},query) <
  searchRelevanceRank({sectionNumber:'404.2.3',title:'An accessible route shall connect all spaces, including exceptions to this requirement and every associated entrance in this building.'},query));
assert.equal(searchRelevanceRank({sectionNumber:'1104.1',title:'Accessible routes'},'1104.1'),0);
assert(searchRelevanceRank({sectionNumber:'1004.1.3',title:'Areas without fixed seating',headingLine:'OCCUPANT LOAD'},'occupant load business','Business areas 100 gross') <
  searchRelevanceRank({sectionNumber:'202',title:'Definitions',headingLine:'DEFINITIONS'},'occupant load business','Incidental occupant load and business definitions.'));
const vocabulary = searchVocabulary([{title:'Fire separation distance'},{title:'Corridor walls'}]);
assert.deepEqual(searchSpellingSuggestions('fire seperation',vocabulary),['fire separation']);
assert.deepEqual(searchSpellingSuggestions('corrid',vocabulary),[]);
assert.deepEqual(searchSpellingSuggestions('1104.1',vocabulary),[]);
const server=createServer(handleRequest);
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try {
  const source=(await activeCodeSourceCatalog()).find(s=>s.codePrefix==='BC'&&s.canonicalEdition.includes('2022-construction'));
  assert(source);
  const scope=JSON.stringify({version:1,enabledSources:[codeSourceIdentity(source)]});
  const rows=[];
  for (const q of ['dead end corridor','1005.3.2','occupant load','laundry room','corrid','fire seperation']) {
    const params=new URLSearchParams({q,version:'all',match:'words',grouped:'true',limit:'25',sourceScope:scope});
    const response=await fetch(`http://127.0.0.1:${server.address().port}/code/search?${params}`);
    assert.equal(response.status,200);
    const payload=await response.json();
    assert(payload.results.every(r=>r.codePrefix==='BC'&&r.codeVersion===source.canonicalEdition));
    if(q==='1005.3.2') assert.equal(payload.results[0].sectionNumber,q);
    if(q==='dead end corridor') assert.equal(payload.results[0].sectionNumber,'1020.4');
    if(q==='occupant load') {
      assert(payload.results.findIndex(r=>r.sectionNumber==='1004.1')<3,'The general rule must be among the first three matches.');
      assert(payload.results.slice(0,4).some(r=>r.definitionTerm==='OCCUPANT LOAD'),'The matching definition must be visible initially.');
      assert.equal(payload.results.length,12);
    }
    if(q==='corrid') assert(payload.results.length>0,'Word completion must still work.');
    if(q==='fire seperation') { assert.equal(payload.results.length,0); assert(payload.suggestions.includes('fire separation')); }
    rows.push({query:q,results:payload.results.slice(0,5).map(r=>({number:r.sectionNumber,title:r.definitionTerm||r.title})),shown:payload.results.length,suggestions:payload.suggestions||[]});
  }
  const disabled = new URLSearchParams({q:'fire seperation',version:'all',match:'words',grouped:'true',sourceScope:JSON.stringify({version:1,enabledSources:[]})});
  const empty = await (await fetch(`http://127.0.0.1:${server.address().port}/code/search?${disabled}`)).json();
  assert.equal(empty.results.length,0);
  assert.equal((empty.suggestions || []).length,0,'Disabled sources must not contribute spelling terms.');
  console.log(JSON.stringify(rows,null,2));
} finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
