import assert from 'node:assert/strict';
import {previewNYCPropertyRefresh, applyNYCPropertyRefresh} from '../public/nyc-property-facts.js';
import {lookupNYCPropertyContext} from '../nyc-property-context.mjs';
const date = '2026-10-04T12:00:00.000Z';
const old = [
  {key:'area',label:'Area',value:'5000',source:'nyc-planning',status:'sourced'},
  {key:'height',label:'Height',value:'40',source:'user',status:'stated'},
  {key:'stories',label:'Stories',value:'4',source:'nyc-planning',status:'confirmed'},
  {key:'lost',label:'Lost',value:'Prior value',source:'nyc-planning',status:'sourced'},
  {key:'unavailable',label:'Unavailable',value:'Known before',source:'nyc-planning',status:'sourced'}
];
const fresh = [
  {key:'area',label:'Area',value:'5100',source:'nyc-planning',status:'sourced',updatedAt:date},
  {key:'height',label:'Height',value:'45',source:'nyc-planning',status:'sourced'},
  {key:'stories',label:'Stories',value:'5',source:'nyc-planning',status:'sourced'},
  {key:'new',label:'New',value:'New fact',source:'nyc-planning',status:'sourced'},
  {key:'unavailable',label:'Unavailable',value:'Unknown',source:'nyc-planning',status:'unknown'}
];
const snapshot = JSON.stringify(old);
const preview = previewNYCPropertyRefresh(old,fresh,date);
assert.equal(JSON.stringify(old),snapshot,'Preview must not mutate the project');
assert.equal(preview.find(r=>r.key==='area').kind,'changed');
assert.equal(preview.find(r=>r.key==='new').kind,'new');
for(const key of ['height','stories']) assert.equal(preview.find(r=>r.key===key).selected,false);
const applied = applyNYCPropertyRefresh(old,preview,new Set(preview.filter(r=>r.selected).map(r=>r.key)));
assert.equal(applied.find(f=>f.key==='height').value,'40');
assert.equal(applied.find(f=>f.key==='stories').status,'confirmed');
for(const key of ['lost','unavailable']) {
  assert.equal(applied.find(f=>f.key===key).value,old.find(f=>f.key===key).value);
  assert.equal(applied.find(f=>f.key===key).status,'unknown');
  assert.match(applied.find(f=>f.key===key).sourceText,/retained previous value/);
}
assert.deepEqual(applyNYCPropertyRefresh(old,preview,new Set()),old);
assert.equal(applyNYCPropertyRefresh(old,preview,new Set(['height'])).find(f=>f.key==='height').value,'45','An explicitly selected conflict can be replaced');
let searched = false;
const property = await lookupNYCPropertyContext('45 Cooper Street', {bbl:'1022410001',now:()=>new Date(date),fetchImpl:async input=>{
  const url = new URL(input);
  if(url.hostname.includes('heroku')) {searched=true;throw new Error('Address search should not run');}
  const sql=url.searchParams.get('q')||'';
  return {ok:true,json:async()=>({rows:sql.includes('FROM dcp_mappluto')?[{bbl:'1022410001',address:'45 COOPER STREET',borocode:'1',lotarea:5000}]:[]})};
}});
assert.equal(searched,false);
assert.equal(property.bbl,'1022410001');
console.log('NYC property refresh contract passed');
