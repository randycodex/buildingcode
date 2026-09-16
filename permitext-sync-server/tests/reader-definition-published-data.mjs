import test from 'node:test';
import {parse} from 'parse5';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDefinitionMatcher,definitionAppliesToSection} from '../public/definition-matcher.js';
import {definitionsForReader} from '../public/reader-definition-registry.js';
const registry=JSON.parse(readFileSync(new URL('../public/reader-definition-registry.json',import.meta.url)));

test('2014 inline administrative reference ends before the following duties section',()=>{
 const book=registry.books.find(book=>book.bundle==='2014-construction-codes'&&book.code==='ADMINISTRATIVE PROVISIONS');
 const entry=book.entries.find(entry=>entry.term==='GREEN ROOF SYSTEM');
 assert.ok(entry.referenceText.startsWith('See section 1502.1 of the New York city building code.'));
 assert.ok(entry.referenceText.endsWith('This law has an effective date of September 16, 2019.'));
 assert.ok(!entry.referenceText.includes('Duties of the office'));
 assert.equal(entry.source.sectionNumber,'1502.1');
 assert.equal(entry.resolution,'resolved-reference');
 assert.equal(entry.source.code,'BUILDING CODE');
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
 assert.equal(dwelling.resolution,'resolved-reference');
 assert.equal(dwelling.source.bundle,'2022-construction-codes');
 assert.equal(dwelling.source.sectionNumber,'202');
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
 assert.equal(roof.source.sectionNumber,'1502.1');
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
  const entry=book.entries.find(e=>e.term===term);
  assert.equal(entry.resolution,'resolved-reference');
  assert.equal(entry.referenceText,'See Section 308.2.1.');
  assert.equal(entry.source.sectionNumber,'308.2.2');
  assert.equal(entry.source.publication,'Chapter 2 cites §308.2.1; definition printed at §308.2.2');
 }
});

test('Housing Maintenance numbered definitions preserve full source paragraphs and remain pending scope review',()=>{
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
 assert.ok(book.entries.every(entry=>entry.applicability==='review-required'));
 assert.deepEqual(definitionsForReader(registry,{bundle:book.bundle,codeSectionID:book.codeSectionID,chapterNumber:'2'}),[]);
 assert.ok(!book.entries.some(entry=>entry.term==='Person'));
 const summer=book.entries.find(entry=>entry.term==='Summer resort dwelling');
 assert.ok(!summer.text.includes('This code shall mean'));
});

test('Housing Maintenance device-section private dwelling meaning stays in its section',()=>{
 const bundle='2026-enacted-administrative-code';
 const select=sectionNumber=>definitionsForReader(registry,{bundle,codeSectionID:5,chapterNumber:'2',sectionNumber});
 const entries=select('27-2045');
 assert.equal(entries.length,1);
 assert.equal(entries[0].term,'Private dwelling');
 assert.ok(entries[0].text.includes('occupied by a person or persons other than the owner'));
 assert.equal(entries[0].source.sectionNumber,'27-2045');
 assert.deepEqual(select('27-2046'),[]);
 assert.deepEqual(select(undefined),[]);
});

test('Fire Code spelled-out and acronym references share the exact printed meaning',()=>{
 const book=registry.books.find(b=>b.bundle==='2026-enacted-administrative-code'&&b.code==='FIRE CODE');
 const entry=book.entries.find(e=>e.term==='LOWER EXPLOSIVE LIMIT (LEL)');
 const target=book.entries.find(e=>e.term==='LOWER FLAMMABLE LIMIT (LFL)');
 assert.equal(entry.resolution,'resolved-reference');
 assert.equal(entry.text,target.text);
 assert.deepEqual(entry.source,target.source);
 const matches=createDefinitionMatcher([target])('lower flammable limit and LFL');
 assert.deepEqual(matches.map(m=>m.text),['lower flammable limit','LFL']);
 assert.equal(book.excludeWholeChapter,false); // Fire definitions are embedded in a mixed source chapter.
});

test('prior code building references retain the same-edition administrative definition and citation',()=>{
 const entries=registry.books.flatMap(book=>book.entries.filter(e=>e.term==='PRIOR CODE BUILDING').map(entry=>({book,entry})));
 const reviewed=entries.filter(({book})=>['2014-construction-codes','2022-construction-codes','2026-enacted-administrative-code'].includes(book.bundle));
 assert.equal(reviewed.length,7);
 for(const {book,entry} of reviewed) {
  assert.equal(entry.resolution,'resolved-reference');
  assert.equal(entry.source.bundle,book.bundle);
  assert.equal(entry.source.sectionNumber,'28-101.5');
  assert.ok(entry.text.includes('prior to July 1, 2008'));
  assert.ok(entry.text.includes('on or after July 1, 2008'));
  assert.ok(entry.text.includes('28-101.4.2'));
 }
});

test('reviewed section-label references retain exact published targets',()=>{
 for(const [bundle,term,section,phrase] of [
  ['2014-construction-codes','CONCRETE CARBONATE AGGREGATE','721.1.1','calcium or magnesium carbonate'],
  ['2014-construction-codes','SINGLE-POINT ADJUSTABLE SUSPENSION SCAFFOLD','3302.1','platform suspended by one rope'],
  ['2022-construction-codes','HIGH-PRESSURE BOILER','28-401.3','more than 15 psig'],
 ]) {
  const entry=registry.books.find(b=>b.bundle===bundle&&b.code==='BUILDING CODE').entries.find(e=>e.term===term);
  assert.equal(entry.resolution,'resolved-reference');
  assert.equal(entry.source.bundle,bundle);
  assert.equal(entry.source.sectionNumber,section);
  assert.ok(entry.text.includes(phrase));
 }
});

test('green roof references resolve within their own Building Code collection',()=>{
 for(const bundle of ['2014-construction-codes','2022-construction-codes']) {
  const book=registry.books.find(b=>b.bundle===bundle&&/ADMINISTRATIVE PROVISIONS/.test(b.code));
  const entry=book.entries.find(e=>e.term==='GREEN ROOF SYSTEM');
  assert.equal(entry.resolution,'resolved-reference');
  assert.equal(entry.source.bundle,bundle);
  assert.equal(entry.source.code,'BUILDING CODE');
  assert.ok(!entry.text.startsWith('See '));
  assert.ok(entry.referenceText.includes('New York city building code'));
 }
});

test('EBC administrative references use the reviewed LL42 wording and preserve its effective regime',()=>{
 const book=registry.books.find(b=>b.bundle==='2026-existing-building-code'&&b.scope==='general');
 const resolved=book.entries.filter(e=>e.source.publication?.startsWith('Local Law 42/2026'));
 assert.equal(resolved.length,65);
 for(const entry of resolved){
  assert.equal(entry.resolution,'resolved-reference');
  assert.equal(entry.source.sectionNumber,'28-101.5');
  assert.equal(entry.source.code,'ADMINISTRATIVE CODE');
  assert.equal(entry.source.bundle,'2026-existing-building-code');
  assert.equal(entry.source.publication,'Local Law 42/2026 §4 (effective with Existing Building Code)');
 }
 assert.equal(resolved.find(e=>e.term==='ADDITION').text,'An alteration to an existing building that results in the increase of its floor area, number of stories, or height.');
 assert.equal(resolved.find(e=>e.term==='HEREAFTER').text,'On or after the effective date of the New York city existing building code.');
 assert.equal(resolved.find(e=>e.term==='PRIOR CODE BUILDING OR STRUCTURE').text,'A building or structure erected in accordance with the building laws in effect prior to July 1, 2008.');
 for(const term of ['ACCEPTANCE OR ACCEPTED','WORK NOT CONSTITUTING MINOR ALTERATIONS OR ORDINARY REPAIRS'])
  assert.equal(book.entries.find(e=>e.term===term).resolution,'unresolved-reference',term);
 for(const other of registry.books.filter(b=>b!==book)) assert.ok(other.entries.every(e=>!e.source.publication?.startsWith('Local Law 42/2026')));
});

test('reviewed EBC supplement and archived official PDF match their provenance hashes',async()=>{
 const {createHash}=await import('node:crypto');
 const base=new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-existing-building-code/references/',import.meta.url);
 const provenance=JSON.parse(readFileSync(new URL('ll42-2026-section4.provenance.json',base)));
 const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(digest(readFileSync(new URL('ll42-2026-section4.html',base))),provenance.htmlSHA256);
 assert.equal(digest(readFileSync(new URL('../../'+provenance.sourcePDF,import.meta.url))),provenance.sourcePDFSHA256);
 assert.equal(provenance.termCount,65);
 assert.match(provenance.effectiveProvision,/18 months after it becomes law/);
});

test('2014 continued flood and sewer definitions retain their final conditions',()=>{
 const bc=registry.books.find(b=>b.bundle==='2014-construction-codes'&&b.code==='BUILDING CODE');
 const flood=bc.entries.find(e=>e.term==='NONRESIDENTIAL (FOR FLOOD ZONE PURPOSES)');
 assert.equal(flood.resolution,'resolved-reference');
 assert.equal(flood.source.sectionNumber,'G201.2');
 assert.ok(flood.text.includes('2. Contains such space(s), but also contains space on the lowest floor'));
 assert.ok(!flood.text.includes('NORTH AMERICAN VERTICAL DATUM'));
 assert.ok(bc.entries.find(e=>e.term==='PREFIRM DEVELOPMENT').text.endsWith('a subsequent change to the FIRM.'));
 const pc=registry.books.find(b=>b.bundle==='2014-construction-codes'&&b.code==='PLUMBING CODE');
 const sewer=pc.entries.find(e=>e.term==='STORM SEWER');
 assert.equal(sewer.resolution,'resolved-reference');
 assert.ok(sewer.text.endsWith('Storm sewer. A sewer that conveys only storm water, groundwater and potable clear water waste.'));
});

test('reviewed references preserve original citations and both required-strength meanings',()=>{
 const bc=registry.books.find(b=>b.bundle==='2014-construction-codes'&&b.code==='BUILDING CODE');
 const floor=bc.entries.find(e=>e.term==='FLOOR SURFACE AREA');
 assert.equal(floor.referenceText,'See Section 101.4.5.2 of the Administrative Code.');
 assert.equal(floor.source.sectionNumber,'28-101.4.5.2');
 const strength=bc.entries.filter(e=>e.term==='REQUIRED STRENGTH');
 assert.equal(strength.length,2);
 assert.ok(strength.every(e=>e.resolution==='multiple-definitions'));
 assert.deepEqual(strength.map(e=>e.source.sectionNumber),['1602.1','2102.1']);
 const current=registry.books.find(b=>b.bundle==='2022-construction-codes'&&b.code==='BUILDING CODE');
 for(const term of ['MINOR ALTERATIONS','ORDINARY REPAIRS']){
  const entry=current.entries.find(e=>e.term===term);
  assert.equal(entry.resolution,'resolved-reference');
  assert.match(entry.referenceText,/correct reference should be Section 28-105\.4\.2/);
  assert.equal(entry.source.sectionNumber,'28-105.4.2.1');
 }
});


test('Energy Code referrals retain the actual reviewed Title 28 source identity',()=>{
 const books=registry.books.filter(b=>b.bundle==='2025-specialty-codes'&&b.code==='2025 ENERGY CONSERVATION CODE');
 const entries=books.flatMap(b=>b.entries.filter(e=>e.source.publication));
 assert.equal(entries.length,10);
 for(const entry of entries){
  assert.equal(entry.resolution,'resolved-reference');
  assert.equal(entry.source.bundle,'2026-enacted-administrative-code');
  assert.equal(entry.source.code,'ADMINISTRATIVE CODE TITLE 28');
  assert.equal(entry.source.sectionNumber,'28-101.5');
  assert.equal(entry.source.file,'2026-enacted-administrative-code/chapters/30000082.html');
  assert.equal(entry.source.publication,'Title 28 — source current through July 25, 2026');
  assert.match(entry.referenceText,/28-101\.5 of the Administrative Code/);
 }
 assert.equal(books.find(b=>b.scope==='R').entries.find(e=>e.term==='APPROVED').text,books.find(b=>b.scope==='C').entries.find(e=>e.term==='APPROVAL OR APPROVED').text);
 const plan=books.find(b=>b.scope==='C').entries.find(e=>e.term==='COMMISSIONING PLAN');
 assert.equal(plan.resolution,'resolved-reference');
 assert.equal(plan.source.sectionNumber,'C408.2.1');
 assert.equal(plan.source.bundle,'2025-specialty-codes');
 assert.ok(plan.text.startsWith('A commissioning plan shall be developed'));
 assert.ok(plan.text.endsWith('5. Measurable criteria for performance.'));
 assert.ok(!plan.text.includes('Systems adjusting and balancing'));
});

test('stormwater referrals traverse Title 28 to the reviewed Title 24 meanings',()=>{
 const entries=registry.books.flatMap(book=>book.entries.filter(entry=>entry.source.publication?.startsWith('Title 24 —')).map(entry=>({book,entry})));
 assert.equal(entries.length,12);
 for(const {book,entry} of entries){
  assert.ok(['2014-construction-codes','2022-construction-codes'].includes(book.bundle));
  assert.ok(['BUILDING CODE','PLUMBING CODE'].includes(book.code));
  assert.equal(entry.resolution,'resolved-reference');
  assert.match(entry.referenceText,/28-104\.11\.1 of the Administrative Code/);
  assert.equal(entry.source.sectionNumber,'24-541');
  assert.equal(entry.source.code,'ADMINISTRATIVE CODE TITLE 24');
  assert.equal(entry.source.bundle,'2026-enacted-administrative-code');
  if(entry.term==='COVERED DEVELOPMENT PROJECT'){
   assert.ok(!entry.text.includes('within the MS4 area'));
   assert.ok(entry.text.includes('larger common plan of development or sale'));
  }
  if(entry.term.startsWith('POST-CONSTRUCTION')) assert.ok(entry.text.endsWith('detention systems and retention systems.'));
  if(entry.term.endsWith('OR SWPPP')) assert.ok(entry.text.includes('(ii) when used in connection with an industrial stormwater source'));
 }
});

test('stormwater source binding rejects drift and does not resolve other editions or references',async()=>{
 const {bindStormwaterDefinitions}=await import('../scripts/definition-sources/bind-stormwater-definitions.mjs');
 const {createHash}=await import('node:crypto');
 const binding=JSON.parse(readFileSync(new URL('../scripts/definition-sources/stormwater-definition-binding.json',import.meta.url)));
 const root=new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/',import.meta.url);
 const html=readFileSync(new URL(binding.sourceFile,root),'utf8');
 const bridge=readFileSync(new URL(binding.bridges[0].file,root),'utf8');
 for(const evidence of binding.evidence) assert.equal(createHash('sha256').update(readFileSync(new URL('../../'+evidence.file,import.meta.url))).digest('hex'),evidence.sha256);
 const term={term:'COVERED DEVELOPMENT PROJECT',text:'See Section 28-104.11.1 of the Administrative Code.',referenceOnly:true,resolution:'unresolved-reference'};
 const book={bundle:'2014-construction-codes',code:'BUILDING CODE',scope:'general',terms:[term]};
 assert.equal(bindStormwaterDefinitions(book,binding,html,bridge)[0].resolution,'resolved-reference');
 assert.throws(()=>bindStormwaterDefinitions(book,binding,html+' ',bridge),/source changed/);
 assert.throws(()=>bindStormwaterDefinitions(book,binding,html,bridge+' '),/source changed/);
 for(const change of [{bundle:'2026-existing-building-code'},{scope:'appendix-D'},{code:'MECHANICAL CODE'}])
  assert.equal(bindStormwaterDefinitions({...book,...change},binding,html,bridge)[0],term);
 for(const change of [{text:'See Section 28-101.5 of the Administrative Code.'},{term:'DEPARTMENT'},{resolution:'direct'}]){
  const other={...term,...change};
  assert.equal(bindStormwaterDefinitions({...book,terms:[other]},binding,html,bridge)[0],other);
 }
});

test('special-use platform replaces the work-platform meaning only within section 410',()=>{
 const book=registry.books.find(b=>b.bundle==='2022-construction-codes'&&b.code==='BUILDING CODE');
 const special=book.entries.find(e=>e.term==='PLATFORM (SPECIAL USE)');
 const work=book.entries.find(e=>e.term==='PLATFORM');
 assert.equal(special.resolution,'resolved-reference');
 assert.equal(special.source.sectionNumber,'410.2.2');
 assert.equal(special.referenceText,'See Section 410.2.2.');
 assert.ok(special.text.startsWith('A raised area within a building used for worship'));
 assert.ok(special.text.endsWith('A temporary platform is one installed for not more than 30 days.'));
 assert.deepEqual(special.applicableSections,['410']);
 assert.ok(special.aliases.includes('PLATFORM'));
 assert.deepEqual(work.excludedSections,['410']);
 assert.ok(work.text.startsWith('A work surface elevated above lower levels.'));
 const matchAt=section=>createDefinitionMatcher([special,work].filter(e=>definitionAppliesToSection(e,section)))('platform');
 const inside=matchAt('410.3');
 assert.equal(inside.length,1);
 assert.equal(inside[0].entries[0].id,special.id);
 const outside=matchAt('3302.1');
 assert.equal(outside.length,1);
 assert.equal(outside[0].entries[0].id,work.id);
});

test('named 2026 Building Code referrals keep the reviewed 2022 source and appendix chain',()=>{
 const books=registry.books.filter(b=>b.bundle==='2026-existing-building-code');
 const general=books.find(b=>b.scope==='general');
 const appendix=books.find(b=>b.scope==='appendix-D');
 const building=registry.books.find(b=>b.bundle==='2022-construction-codes'&&b.code==='BUILDING CODE');
 for(const term of ['FLOOD HAZARD AREA','SUBSTANTIAL DAMAGE','SUBSTANTIAL IMPROVEMENT','APARTMENT','DWELLING UNIT']){
  const entry=(term==='APARTMENT'?appendix:general).entries.find(e=>e.term===term);
  assert.equal(entry.resolution,'resolved-reference');
  assert.equal(entry.text,building.entries.find(e=>e.term===term).text);
  assert.equal(entry.source.bundle,'2022-construction-codes');
  assert.equal(entry.source.code,'BUILDING CODE');
  assert.equal(entry.source.sectionNumber,'202');
  assert.equal(entry.source.publication,'2022 Building Code Chapter 2 — reviewed for EBC enacted 2026');
 }
 assert.equal(general.entries.find(e=>e.term==='DWELLING UNIT').referenceText,'See Appendix D.');
 assert.deepEqual(general.entries.find(e=>e.term==='DWELLING UNIT').source,appendix.entries.find(e=>e.term==='DWELLING UNIT').source);
 for(const book of books) assert.equal(book.entries.find(e=>e.term==='DWELLING (MDL 4(4))').resolution,'unresolved-reference');
 const admin=registry.books.find(b=>b.bundle==='2026-enacted-administrative-code'&&b.code==='ADMINISTRATIVE CODE TITLE 28');
 const green=admin.entries.find(e=>e.term==='GREEN ROOF SYSTEM');
 assert.equal(green.resolution,'resolved-reference');
 assert.equal(green.text,building.entries.find(e=>e.term==='GREEN ROOF SYSTEM').text);
 assert.equal(green.source.bundle,'2022-construction-codes');
 assert.match(green.referenceText,/See chapter 2 of the New York city building code/);
});

test('EBC onward administrative referrals preserve terminal statutes and every SRO exception',async()=>{
 const book=registry.books.find(b=>b.bundle==='2026-existing-building-code'&&b.scope==='general');
 const company=book.entries.find(e=>e.term==='UTILITY COMPANY OR PUBLIC UTILITY COMPANY');
 const corporation=book.entries.find(e=>e.term==='UTILITY CORPORATION OR PUBLIC UTILITY CORPORATION');
 for(const [entry,section] of [[company,'2(23)'],[corporation,'2(24)']]){
  assert.equal(entry.resolution,'resolved-reference');
  assert.equal(entry.referenceText,'The following terms are defined in Section 28-101.5 of the Administrative Code:');
  assert.equal(entry.source.bundle,'new-york-state-public-service-law');
  assert.equal(entry.source.code,'NEW YORK STATE PUBLIC SERVICE LAW');
  assert.equal(entry.source.sectionNumber,section);
  assert.equal(entry.source.publication,'Revision December 23, 2022');
 }
 assert.ok(company.text.includes('other than article 11'));
 assert.ok(company.text.endsWith('such term being so used only as a general term descriptive of such a person or corporation.'));
 assert.equal(corporation.text,'The term "utility corporation" or "public utility corporation" is an incorporated utility company.');
 const sro=book.entries.find(e=>e.term==='SINGLE ROOM OCCUPANCY MULTIPLE DWELLING');
 assert.equal(sro.resolution,'resolved-reference');
 assert.equal(sro.source.sectionNumber,'28-107.2');
 assert.equal(sro.source.bundle,'2026-enacted-administrative-code');
 assert.ok(sro.text.includes('3.A "class B multiple dwelling."'));
 assert.ok(sro.text.includes('Exception: The term single room occupancy multiple dwelling shall not include:'));
 for(let n=1;n<=9;n++) assert.ok(sro.text.includes(`\n\n${n}.`),`SRO exception ${n}`);
 assert.ok(sro.text.includes('9.Any building lawfully altered pursuant to the provisions of this article after May 5, 1983'));
 const {createHash}=await import('node:crypto');
 const binding=JSON.parse(readFileSync(new URL('../scripts/definition-sources/ebc-onward-definition-bindings.json',import.meta.url)));
 for(const source of binding.sources){
  const bytes=readFileSync(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/'+source.file,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256);
 }
 for(const other of registry.books.filter(b=>b!==book))assert.ok(other.entries.every(e=>e.source.bundle!=='new-york-state-public-service-law'));
});

test('reviewed citation mismatches retain both citations and the exact source scope',()=>{
 const building=bundle=>registry.books.find(b=>b.bundle===bundle&&b.code==='BUILDING CODE');
 for(const [bundle,term,original,target,section] of [
  ['2014-construction-codes','LABORATORY CHEMICAL','419.4','424.4',null],
  ['2014-construction-codes','STRIPPING OPERATIONS','3303.2','3302.1',null],
  ['2022-construction-codes','CHILD CARE FACILITIES','308.2.1','308.2.2','308'],
  ['2022-construction-codes','DETOXIFICATION FACILITIES','308.2.1','308.2.2','308']]){
  const entry=building(bundle).entries.find(e=>e.term===term);
  assert.equal(entry.resolution,'resolved-reference');
  assert.equal(entry.source.bundle,bundle);
  assert.equal(entry.source.sectionNumber,target);
  assert.equal(entry.referenceText,`See Section ${original}.`);
  assert.equal(entry.source.publication,`Chapter 2 cites §${original}; definition printed at §${target}`);
  if(section){
   assert.deepEqual(entry.applicableSections,[section]);
   assert.ok(definitionAppliesToSection(entry,'308.3'));
   assert.ok(!definitionAppliesToSection(entry,'310.1'));
   assert.ok(!definitionAppliesToSection(entry,null));
  }
 }
 assert.deepEqual(building('2014-construction-codes').entries.find(e=>e.term==='STRIPPING OPERATIONS').applicableChapters,['33']);
 assert.equal(building('2014-construction-codes').entries.find(e=>e.term==='LABORATORY CHEMICAL').applicableChapters,undefined);
});

test('citation mismatch bindings reject source drift, wrong labels, and unreviewed editions',async()=>{
 const {bindCitationMismatches}=await import('../scripts/definition-sources/bind-citation-mismatches.mjs');
 const manifest=JSON.parse(readFileSync(new URL('../scripts/definition-sources/reviewed-citation-mismatches.json',import.meta.url)));
 const binding=manifest.bindings[0];
 const html=readFileSync(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/'+binding.sourceFile,import.meta.url),'utf8');
 const term={term:binding.term,text:binding.originalReference,referenceOnly:true,resolution:'unresolved-reference'};
 const book={bundle:binding.bundle,code:binding.code,scope:binding.scope,terms:[term]};
 const result=await bindCitationMismatches(book,[binding],async()=>html);
 assert.equal(result[0].resolution,'resolved-reference');
 await assert.rejects(()=>bindCitationMismatches(book,[binding],async()=>html+' '),/source changed/);
 await assert.rejects(()=>bindCitationMismatches(book,[{...binding,sectionNumber:'419.4'}],async()=>html),/target missing/);
 await assert.rejects(()=>bindCitationMismatches({...book,terms:[{...term,text:'See Section 419.5.'}]},[binding],async()=>html),/referral changed/);
 const other=await bindCitationMismatches({...book,bundle:'2022-construction-codes'},[binding],async()=>{throw Error('must not load')});
 assert.equal(other[0],term);
});

test('construction types preserve classification context and all five types with exceptions',()=>{
 const entries=registry.books.find(b=>b.bundle==='2014-construction-codes'&&b.code==='BUILDING CODE').entries.filter(e=>e.term==='CONSTRUCTION TYPES');
 assert.deepEqual(entries.map(e=>e.source.sectionNumber),['602.1','602.1.1','602.2','602.3','602.4','602.5']);
 for(const e of entries){
  assert.equal(e.resolution,'multiple-definitions');
  assert.ok(e.referenceText.includes('Type V. See Section 602.5.'));
  assert.equal(e.source.bundle,'2014-construction-codes');
  assert.ok(e.source.publication.includes('detailed construction requirements remain'));
  assert.ok(!e.text.endsWith('CONSTRUCTION'));
 }
 assert.ok(entries[1].text.includes('cantilever over an adjacent building'));
 assert.ok(entries[2].text.startsWith('Types I and II construction'));
 for(const e of entries.slice(3,5))for(let n=1;n<=4;n++)assert.ok(e.text.includes(`\n${n}.`));
 assert.ok(entries[5].text.includes('shall not be permitted inside the fire district'));
 assert.ok(entries[5].text.includes('Exception: In Group F'));
});

test('construction classification binding rejects drift and incorrect boundaries',async()=>{
 const {bindConstructionTypes}=await import('../scripts/definition-sources/bind-construction-types.mjs');
 const binding=JSON.parse(readFileSync(new URL('../scripts/definition-sources/construction-type-binding.json',import.meta.url)));
 const html=readFileSync(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/'+binding.sourceFile,import.meta.url),'utf8');
 const term={term:binding.term,text:binding.originalReference};
 const book={bundle:binding.bundle,code:binding.code,scope:binding.scope,terms:[term]};
 assert.equal(bindConstructionTypes(book,binding,html)[0].definitions.length,6);
 assert.throws(()=>bindConstructionTypes(book,binding,html+' '),/source changed/);
 assert.throws(()=>bindConstructionTypes({...book,terms:[{...term,text:'See Section 602.'}]},binding,html),/reference changed/);
 assert.throws(()=>bindConstructionTypes(book,{...binding,sections:[{...binding.sections[0],heading:'Incorrect'}]},html),/boundary changed/);
 assert.equal(bindConstructionTypes({...book,bundle:'2022-construction-codes'},binding,'')[0],term);
});
