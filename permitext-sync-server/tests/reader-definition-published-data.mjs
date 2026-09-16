import test from 'node:test';
import {parse} from 'parse5';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDefinitionMatcher} from '../public/definition-matcher.js';
import {definitionsForReader} from '../public/reader-definition-registry.js';
const registry=JSON.parse(readFileSync(new URL('../public/reader-definition-registry.json',import.meta.url)));

test('2014 inline administrative reference ends before the following duties section',()=>{
 const book=registry.books.find(book=>book.bundle==='2014-construction-codes'&&book.code==='ADMINISTRATIVE PROVISIONS');
 const entry=book.entries.find(entry=>entry.term==='GREEN ROOF SYSTEM');
 assert.ok(entry.text.startsWith('See section 1502.1 of the New York city building code.'));
 assert.ok(entry.text.endsWith('This law has an effective date of September 16, 2019.'));
 assert.ok(!entry.text.includes('Duties of the office'));
 assert.equal(entry.source.sectionNumber,'28-103.33.1');
 assert.equal(entry.applicability,'review-required');
});

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

test('mixed administrative and electrical chapters remain eligible outside their definition sections',()=>{
 const mixed=registry.books.filter(b=>b.definitionChapter==='1' && /ADMINISTRATIVE|ELECTRICAL/.test(b.code));
 assert.equal(mixed.length,5);
 for(const book of mixed){
  assert.equal(book.excludeWholeChapter,false,book.code);
  const entries=definitionsForReader(registry,{bundle:book.bundle,codeSectionID:book.codeSectionID,chapterNumber:'1'});
  assert.ok(entries.length>0,book.code);
 }
});

test('ordinary EBC terms reach their MDL-cited definition without typing its source annotation',()=>{
 const book=registry.books.find(b=>b.code==='EXISTING BUILDING CODE'&&b.scope==='general');
 const entries=definitionsForReader(registry,{bundle:book.bundle,codeSectionID:book.codeSectionID,chapterNumber:'3'});
 const matches=createDefinitionMatcher(entries)('A basement with a fire escape.');
 assert.deepEqual(matches.map(m=>m.entries[0].term),['BASEMENT (MDL 4(38))','FIRE ESCAPE (MDL 4(42)(c))']);
 assert.ok(matches.every(m=>m.entries[0].source.chapter==='D2'));
});

test('EBC Appendix D occurrences do not repeat their general-reference definition',()=>{
 const book=registry.books.find(b=>b.code==='EXISTING BUILDING CODE'&&b.scope==='general');
 const entries=definitionsForReader(registry,{bundle:book.bundle,codeSectionID:book.codeSectionID,chapterNumber:'D3'});
 assert.equal(entries.filter(e=>e.term==='MDL').length,1);
 assert.equal(entries.filter(e=>e.term==='BASEMENT (MDL 4(38))').length,1);
});

test('Air Pollution Control definitions stay within Title 24 Chapter 1',()=>{
 const context={bundle:'2026-enacted-administrative-code',codeSectionID:1,chapterNumber:'1'};
 const entries=definitionsForReader(registry,context);
 assert.equal(entries.length,82);
 assert.ok(!entries.some(e=>['Board','Department'].includes(e.term)));
 const air=entries.find(e=>e.term==='Air');
 assert.ok(air.text.startsWith('all the respirable gaseous mixture'));
 assert.equal(air.source.sectionNumber,'24-104');
 assert.equal(air.source.anchor,'section-31000002');
 assert.ok(entries.every(e=>JSON.stringify(e.applicableChapters)==='["1"]'));
 assert.deepEqual(definitionsForReader(registry,{...context,chapterNumber:'2'}),[]);
 assert.deepEqual(definitionsForReader(registry,{...context,codeSectionID:2}),[]);
});

test('2014 Shotcrete follows its exact prose definition while external Deck remains unresolved',()=>{
 const book=registry.books.find(b=>b.bundle==='2014-construction-codes'&&b.code==='BUILDING CODE');
 const shotcrete=book.entries.find(e=>e.term==='SHOTCRETE');
 assert.equal(shotcrete.resolution,'resolved-reference');
 assert.equal(shotcrete.source.sectionNumber,'1913.1');
 assert.equal(shotcrete.source.chapter,'19');
 assert.equal(shotcrete.source.bundle,'2014-construction-codes');
 assert.ok(shotcrete.text.startsWith('Shotcrete is mortar or concrete that is pneumatically projected'));
 assert.equal(book.entries.find(e=>e.term==='DECK').resolution,'unresolved-reference');
});

test('2014 hyphenated reference labels retain exact cited source sections',()=>{
 const book=registry.books.find(b=>b.bundle==='2014-construction-codes'&&b.code==='BUILDING CODE');
 for(const [term,section,chapter] of [
  ['PREFIRM DEVELOPMENT','G201.2','G'],['PREFIRM STRUCTURE','G201.2','G'],
  ['POSTFIRM DEVELOPMENT','G201.2','G'],['POSTFIRM STRUCTURE','G201.2','G'],
  ['POSTFIRE SMOKE PURGE SYSTEM','902.1','9'],['DWELLING UNIT OR SLEEPING UNIT, MULTI-STORY','1102.1','11'],
 ]){
  const entry=book.entries.find(e=>e.term===term);
  assert.equal(entry.resolution,'resolved-reference',term);
  assert.equal(entry.source.sectionNumber,section,term);
  assert.equal(entry.source.chapter,chapter,term);
  assert.equal(entry.source.bundle,'2014-construction-codes',term);
 }
});

test('2014 licensing references retain inline section identity and scoped terms remain withheld',()=>{
 const book=registry.books.find(b=>b.bundle==='2014-construction-codes'&&b.code==='BUILDING CODE');
 for(const term of ['DIRECT AND CONTINUING SUPERVISION','DIRECT EMPLOY','HIGH-PRESSURE BOILER']){
  const entry=book.entries.find(e=>e.term===term);
  assert.equal(entry.resolution,'resolved-reference',term);
  assert.equal(entry.source.sectionNumber,'28-401.3');
  assert.equal(entry.source.code,'ADMINISTRATIVE PROVISIONS');
  assert.equal(entry.source.bundle,'2014-construction-codes');
 }
 const admin=registry.books.find(b=>b.bundle==='2014-construction-codes'&&b.code==='ADMINISTRATIVE PROVISIONS');
 const roof=admin.entries.find(e=>e.term==='GREEN ROOF SYSTEM');
 assert.equal(roof.source.sectionNumber,'28-103.33.1');
 assert.equal(roof.applicability,'review-required');
});

test('2022 qualified flood references preserve their labels and cited appendix source',()=>{
 const book=registry.books.find(b=>b.bundle==='2022-construction-codes'&&b.code==='BUILDING CODE');
 for(const term of ['EXISTING CONSTRUCTION (FOR FLOOD ZONE PURPOSES)','EXISTING STRUCTURE (FOR FLOOD ZONE PURPOSES)','HISTORIC STRUCTURE (FLOOD-RESISTANT CONSTRUCTION)']) {
  const e=book.entries.find(e=>e.term===term);
  assert.equal(e.resolution,'resolved-reference');
  assert.equal(e.source.sectionNumber,'G201.1.2');
  assert.ok(e.source.file.endsWith('/G.html'));
  assert.equal(e.referenceText,'See Section G201.1.2.');
  assert.deepEqual(e.aliases,[]);
 }
 for(const term of ['CHILD CARE FACILITIES','DETOXIFICATION FACILITIES']) {
  assert.equal(book.entries.find(e=>e.term===term).resolution,'unresolved-reference');
 }
});

test('Housing Maintenance general definitions preserve full source paragraphs and stay within their code',()=>{
 const book=registry.books.find(book=>book.code==='HOUSING MAINTENANCE CODE');
 assert.equal(book.entries.length,39);
 assert.equal(book.excludeWholeChapter,false);
 const family=book.entries.find(entry=>entry.term==='Family');
 assert.ok(family.text.startsWith('A family is:'));
 assert.ok(family.text.includes('(iv)The dwelling unit complies'));
 assert.ok(family.text.endsWith('no common household exists.'));
 assert.ok(!family.text.includes('"Person,"'));
 assert.equal(family.source.anchor,'section-31001849');
 assert.equal(family.source.sectionNumber,'27-2004');
 assert.ok(book.entries.every(entry=>entry.applicability==='definition-chapter'));
 for(const chapterNumber of ['1','2','3','4','5']) assert.equal(definitionsForReader(registry,{bundle:book.bundle,codeSectionID:book.codeSectionID,chapterNumber}).length,39);
 assert.deepEqual(definitionsForReader(registry,{bundle:book.bundle,codeSectionID:book.codeSectionID,chapterNumber:'6'}),[]);
 const other=definitionsForReader(registry,{bundle:book.bundle,codeSectionID:3,chapterNumber:'3'});
 assert.ok(!other.some(entry=>entry.source.code==='HOUSING MAINTENANCE CODE'));
 const match=createDefinitionMatcher(definitionsForReader(registry,{bundle:book.bundle,codeSectionID:book.codeSectionID,chapterNumber:'2'}));
 assert.equal(match('The dwelling unit contains a kitchen.').find(m=>m.text==='dwelling unit').entries[0].term,'Dwelling unit');
 assert.ok(!book.entries.some(entry=>entry.term==='Person'));
 const summer=book.entries.find(entry=>entry.term==='Summer resort dwelling');
 assert.ok(!summer.text.includes('This code shall mean'));
});
