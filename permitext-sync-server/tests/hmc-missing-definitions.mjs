import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseFragment} from 'parse5';
import {compileDefinitionRegistry} from '../scripts/build-reader-definition-registry.mjs';
import {extractHMCMissingDefinitions as extract} from '../scripts/definition-sources/hmc-missing-definitions.mjs';
const source=readFileSync(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/30000077.html',import.meta.url),'utf8');
const entries=extract(source),byTerm=Object.fromEntries(entries.map(e=>[e.term,e]));
const expected=[
 ['Person',1,'033cc844e670f930aa01368baed0b07bdeb47453251d4994430d2a5b594a4f51'],
 ['Class A multiple dwelling',10,'908b2a9330d178e6355da5b6ae43ff9c8109d06579618c14e0174c816a1a6673'],
 ['Fireproof',1,'69a09ce9db2863c98226507a591fe3cfe3d1dcef355e8b2caf4cb8963148e272'],
 ['Nonfireproof',1,'69a09ce9db2863c98226507a591fe3cfe3d1dcef355e8b2caf4cb8963148e272'],
 ['Rear yard',1,'1f4912e47fa20b7ac3e46e27f718470dce124a42d4fee55ffe4a28bedf6fdaec'],
 ['Side yard',1,'1f4912e47fa20b7ac3e46e27f718470dce124a42d4fee55ffe4a28bedf6fdaec'],
 ['Curb level',1,'3695949e96b45a0ad6a1e0f0ae884c5229d34d621e47f11c30fb56eaac735c4e'],
 ['This code',1,'81250e23c081b1df8eefb6acf7e48ce939d5fb6a44ed839b2ebccace46cbc059'],
 ['Harassment',45,'3c926c779378f57def8911099e20fd710e9c1a384e0ca512aff2db98277ae415'],
 ['Self-closing door',1,'52fae93110a0dd598631bddc640144b7960e134ec3135418fa3ecf7170ea61b8'],
 ['Unoccupied dwelling unit',1,'7f81a0bfbaa6753cdd0cbef1b6f28bee64653b0ef9cafd3f5640364fcdd7a61a'],
];
test('extracts eleven missing labels with frozen complete source-group hashes and provenance',()=>{
 assert.deepEqual(entries.map(e=>e.term),expected.map(e=>e[0]));
 for(const [term,count,hash] of expected){const e=byTerm[term];assert.equal(e.text.split('\n\n').length,count,term);assert.equal(createHash('sha256').update(e.text).digest('hex'),hash,term);
  assert.equal(e.applicability,'review-required');assert.equal(e.sourceFile,'2026-enacted-administrative-code/chapters/30000077.html');assert.equal(e.sectionNumber,'27-2004');assert.equal(e.anchor,'section-31001849');assert.equal(e.chapter,'1');assert.deepEqual(e.aliases,[]);
 }
});
test('preserves composite predicates, child numerals, long qualifications and terminal boundaries',()=>{
 const a=byTerm['Class A multiple dwelling'].text;
 assert.ok(a.startsWith('(a)A class A multiple dwelling'));assert.ok(a.includes('(1)(A)occupancy'));assert.ok(a.includes('(2)In a class A'));assert.ok(a.includes('(b)A garden-type maisonette'));assert.ok(a.endsWith('provide three or more apartments.'));assert.ok(!a.includes('9.A class B'));
 const h=byTerm.Harassment.text;
 assert.ok(h.includes('(8)that additional factors'));assert.ok(h.includes('f-7.threatening'));assert.ok(h.includes('(v)such person became primarily responsible'));assert.ok(h.endsWith('h.any conduct in violation of section 26-521.'));assert.ok(!h.includes('self-closing door'));
 assert.deepEqual(byTerm.Fireproof.inventorySource,{paragraph:'27-2004(a)(31)',form:'qualified-predicate'});
 assert.deepEqual(byTerm.Nonfireproof.inventorySource,byTerm.Fireproof.inventorySource);
 assert.equal(byTerm.Fireproof.text,byTerm.Nonfireproof.text);assert.ok(byTerm.Fireproof.text.includes('Any other multiple dwelling is nonfireproof.'));
 assert.equal(byTerm['Rear yard'].text,byTerm['Side yard'].text);
 assert.equal(byTerm['Unoccupied dwelling unit'].text,'The term “unoccupied dwelling unit” means a dwelling unit that is not occupied for permanent residence or temporary residence purposes.');
 for(const e of entries){assert.ok(!e.text.includes('(Am. L.L.'));assert.ok(!e.text.includes('b.Except as otherwise provided herein'));}
});
test('fails closed on source changes and cannot modify the existing 39 records',()=>{
 assert.throws(()=>extract(source+'\n'),/source changed/);
 assert.throws(()=>extract(source.replace('50.The term','51.The term')),/source changed/);
 const registry=JSON.parse(readFileSync(new URL('../public/reader-definition-registry.json',import.meta.url)));
 const original=registry.books.find(b=>b.code==='HOUSING MAINTENANCE CODE'&&b.definitionChapter==='1').entries.filter(e=>e.source.sectionNumber==='27-2004'&&!expected.some(([term])=>term===e.term));
 assert.equal(original.length,39);const snapshot=JSON.stringify(original);
 const combined=[...original,...extract(source)];assert.equal(combined.length,50);assert.equal(JSON.stringify(original),snapshot);
 assert.equal(new Set(combined.map(e=>e.term.toLowerCase())).size,50);
});

test('full groups 8 and 48 independently match raw source paragraph slices',()=>{
 const nodeText=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(nodeText).join('');
 for(const [number,term] of [[8,'Class A multiple dwelling'],[48,'Harassment']]){
  const start=source.indexOf(`<p>${number}.`),end=source.indexOf(`<p>${number+1}.`,start);
  assert.ok(start>0&&end>start);
  const paragraphs=[...source.slice(start,end).matchAll(/<p>([\s\S]*?)<\/p>/g)].map(match=>nodeText(parseFragment(match[1])).replace(/\s+/g,' ').trim());
  paragraphs[0]=paragraphs[0].slice(String(number).length+1);
  assert.equal(byTerm[term].text,paragraphs.join('\n\n'),term);
 }
});
test('compiler preserves predicate provenance without enabling inventory labels',()=>{
 const registry=compileDefinitionRegistry({books:[{bundle:'2026-enacted-administrative-code',code:'HOUSING MAINTENANCE CODE',codeSectionID:5,scope:'general',chapter:'1',chapterID:30000077,excludeWholeChapter:false,terms:entries}]});
 for(const term of ['Fireproof','Nonfireproof']){
  const entry=registry.books[0].entries.find(e=>e.term===term);
  assert.deepEqual(entry.inventorySource,{paragraph:'27-2004(a)(31)',form:'qualified-predicate'});
  assert.equal(entry.text,byTerm[term].text);assert.equal(entry.applicability,'review-required');
 }
});
