import test from 'node:test';
import {parse} from 'parse5';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDefinitionMatcher} from '../public/definition-matcher.js';
import {definitionsForReader} from '../public/reader-definition-registry.js';
const registry=JSON.parse(readFileSync(new URL('../public/reader-definition-registry.json',import.meta.url)));

test('generated definitions retain unique identities and explicit source records',()=>{
 const entries=registry.books.flatMap(book=>book.entries);
 assert.equal(new Set(entries.map(entry=>entry.id)).size,entries.length);
 for(const entry of entries){assert.ok(entry.text.trim());assert.ok(entry.source.file);assert.ok(entry.source.bundle);}
});
test('1968 building lookup does not treat a qualifier as an acronym',()=>{
 const book=registry.books.find(book=>book.code==='1968 BUILDING CODE');
 const entries=definitionsForReader(registry,{bundle:book.bundle,codeSectionID:book.codeSectionID,chapterNumber:'1'});
 const match=createDefinitionMatcher(entries)('building')[0];
 assert.deepEqual(match.entries.map(entry=>entry.term),['BUILDING']);
 assert.equal(match.entries[0].source.sectionNumber,'27-232');
});
test('historical definitions without their own heading do not cite 201.4',()=>{
 const book=registry.books.find(book=>book.bundle==='2014-construction-codes'&&book.code==='BUILDING CODE');
 const entry=book.entries.find(entry=>entry.term==='ALTERATION');
 assert.equal(entry.source.sectionNumber,'');assert.equal(entry.source.chapter,'2');
});
test('2022 permit references resolve to that editions administrative source',()=>{
 const book=registry.books.find(book=>book.bundle==='2022-construction-codes'&&book.code==='BUILDING CODE');
 const entry=book.entries.find(entry=>entry.term==='PERMIT');
 assert.equal(entry.source.bundle,'2022-construction-codes');
 assert.equal(entry.source.code,'GENERAL ADMINISTRATIVE PROVISIONS');
 assert.equal(entry.source.sectionNumber,'28-101.5');
 assert.ok(entry.text.startsWith('An official document'));
});

test('web and iOS ship exactly the same definition registry',()=>{
 const web=readFileSync(new URL('../public/reader-definition-registry.json',import.meta.url));
 const ios=readFileSync(new URL('../../NYC CC APP/permitext/Resources/CodeContent/reader-definition-registry.json',import.meta.url));
 assert.ok(web.equals(ios));
});

// Compare every shipped body against its actual cited HTML, allowing only
// whitespace normalization across inline elements and paragraph boundaries.
test('every shipped definition body preserves its cited source wording',()=>{
 const sources=new Map();
 const text=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(text).join(' ');
 const normalize=value=>value.replace(/\s+/g,'');
 for(const book of registry.books) for(const entry of book.entries){
  if(!sources.has(entry.source.file)){
   const source=new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/'+entry.source.file,import.meta.url);
   sources.set(entry.source.file,normalize(text(parse(readFileSync(source,'utf8')))));
  }
  assert.ok(sources.get(entry.source.file).includes(normalize(entry.text)),`${book.bundle}: ${entry.term} must retain source wording`);
 }
});
test('published administrative reference chains retain their terminal section',()=>{
 const book=registry.books.find(book=>book.bundle==='2022-construction-codes'&&book.code==='BUILDING CODE');
 const entry=book.entries.find(entry=>entry.term==='SINGLE ROOM OCCUPANCY MULTIPLE DWELLING');
 assert.equal(entry.resolution,'resolved-reference');
 assert.equal(entry.source.sectionNumber,'28-107.2');
 assert.equal(entry.source.bundle,'2022-construction-codes');
 assert.equal(entry.source.code,'GENERAL ADMINISTRATIVE PROVISIONS');
 assert.ok(entry.text.startsWith('A single room occupancy multiple dwelling means:'));
});

test('all published definition chapters suppress term decoration',()=>{
 for(const book of registry.books.filter(b=>b.excludeWholeChapter!==false)){
  assert.deepEqual(definitionsForReader(registry,{bundle:book.bundle,codeSectionID:book.codeSectionID,chapterNumber:book.definitionChapter}),[]);
 }
});

test('resolved published references identify their actual source chapters',()=>{
 const book=registry.books.find(b=>b.bundle==='2014-construction-codes'&&b.code==='BUILDING CODE');
 for(const [term,chapter,section] of [['FLOOD OR FLOODING','G','G201.2'],['ACCESSIBLE','11','1102.1']]){
  const entry=book.entries.find(e=>e.term===term);
  assert.equal(entry.resolution,'resolved-reference');
  assert.equal(entry.source.chapter,chapter);
  assert.equal(entry.source.sectionNumber,section);
 }
});

test('paired historical references resolve only after both targets are verified',()=>{
 const book=registry.books.find(b=>b.bundle==='2014-construction-codes'&&b.code==='BUILDING CODE');
 for(const term of ['LISTED','CERTIFICATE OF COMPLIANCE']){
  const entry=book.entries.find(e=>e.term===term);
  assert.equal(entry.resolution,'resolved-reference');
  assert.equal(entry.source.sectionNumber,'28-101.5');
 }
 for(const term of ['DESIGN STRENGTH','STRENGTH, NOMINAL','STRENGTH, REQUIRED']){
  const alternatives=book.entries.filter(e=>e.term===term);
  assert.equal(alternatives.length,2);
  assert.ok(alternatives.every(e=>e.resolution==='multiple-definitions'));
  assert.deepEqual(alternatives.map(e=>e.source.sectionNumber),['1602.1','2102.1']);
 }
});

test('Fire Code embedded section 202 is indexed without suppressing its whole container',()=>{
 const book=registry.books.find(b=>b.code==='FIRE CODE');
 assert.ok(book);
 assert.equal(book.excludeWholeChapter,false);
 assert.ok(book.entries.every(e=>e.source.sectionNumber==='202'));
 const entries=definitionsForReader(registry,{bundle:book.bundle,codeSectionID:book.codeSectionID,chapterNumber:'2'});
 const aerosol=entries.find(e=>e.term==='AEROSOL CONTAINER');
 assert.ok(aerosol?.text.includes('designed to dispense an aerosol'));
 assert.ok(aerosol.source.file.endsWith('/30000095.html'));
});

test('Existing Building Code explicit appendix references retain their actual source',()=>{
 const book=registry.books.find(b=>b.code==='EXISTING BUILDING CODE'&&b.scope==='general');
 const mdl=book.entries.find(e=>e.term==='MDL');
 assert.equal(mdl.resolution,'resolved-reference');
 assert.equal(mdl.text,'The New York State Multiple Dwelling Law.');
 assert.equal(mdl.source.chapter,'D2');
 assert.equal(mdl.source.bundle,book.bundle);
 const dwelling=book.entries.find(e=>e.term==='DWELLING UNIT');
 assert.equal(dwelling.resolution,'unresolved-reference');
});

test('named definition lists preserve every distinct source in the published registry',()=>{
 const book=registry.books.find(b=>b.bundle==='2014-construction-codes'&&b.code==='BUILDING CODE');
 const entries=book.entries.filter(e=>e.term==='DAMPER');
 assert.equal(entries.length,4);
 assert.equal(new Set(entries.map(e=>e.id)).size,4);
 assert.deepEqual(entries.map(e=>e.source.term),['CEILING RADIATION DAMPER','COMBINATION FIRE/SMOKE DAMPER','FIRE DAMPER','SMOKE DAMPER']);
 for(const bundle of ['2014-construction-codes','2022-construction-codes']){
  const plumbing=registry.books.find(b=>b.bundle===bundle&&b.code==='PLUMBING CODE');
  assert.deepEqual(plumbing.entries.filter(e=>e.term==='VENT PIPE').map(e=>e.source.term),['VENT SYSTEM','VENT SYSTEM (Methane and Radon)']);
 }
});
