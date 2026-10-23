import assert from 'node:assert/strict';
const base='http://127.0.0.1:8793';
for(const [path,method,expected]of [['/code/search','POST',403],['/prototype/source/notebook/cards/list','GET',403],['/fixture/start','GET',403],['/prototype/app-entry.js?entry=https://example.invalid/app.js','GET',400]]){
 const r=await fetch(base+path,{method});assert.equal(r.status,expected,path);
}
const prototype=await fetch(base+'/workspace'),html=await prototype.text();
assert.equal(prototype.status,200);assert.match(html,/\/prototype\/app-entry\.js\?entry=/);
assert.equal(prototype.headers.get('x-frame-options'),'SAMEORIGIN');
const normal=await fetch('http://127.0.0.1:8788/workspace');assert.equal(normal.status,200);assert.equal(normal.headers.get('x-frame-options'),'DENY');
const [network,local]=await Promise.all(['/code/revision','/prototype/source/code/revision'].map(path=>fetch(base+path).then(r=>r.json())));
assert.equal(network.corpusRevision,local.corpusRevision);assert.equal(network.assetRevision,local.assetRevision);
assert.equal((await fetch('http://127.0.0.1:8795/prototype')).status,200);
console.log('Prototype HTTP: matching corpus/assets, separate baseline origin, normal local preservation, synthetic-only controls and public GET boundaries passed.');
