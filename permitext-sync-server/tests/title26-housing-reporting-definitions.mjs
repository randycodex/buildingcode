import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {title26HousingReportingSources as bindings,affordableHousingReferralSource as referral,title26HousingReportingSource,extractTitle26HousingReportingDefinitions} from '../scripts/definition-sources/title26-housing-reporting-definitions.mjs';
import {resolveDefinitionReferences} from '../reader-definition-index.mjs';
import {compileDefinitionRegistry} from '../scripts/build-reader-definition-registry.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';
import {createDefinitionMatcher} from '../public/definition-matcher.js';
import {definitionAuditScopedPassages} from '../scripts/definition-audit-prose.mjs';
const read=b=>readFileSync(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/'+b.file,import.meta.url),'utf8');
const sources=bindings.map(read),referralSource=read(referral);
const extracted=bindings.map((b,i)=>extractTitle26HousingReportingDefinitions(sources[i],b,{referralSource}));
const expected=[
 ['As used in this chapter, the term "certification of correction" means the paper or electronic document filed with the department of buildings or the department of housing preservation and development by a property owner or managing agent to affirm that the violating conditions cited on a notice of violation have been corrected within the required timeframe.'],
 ['Affordable housing unit. The term "affordable housing unit" means "affordable housing unit" as defined in section 26-2201.',
 'Area median income. The term "area median income" means the income limits as defined annually by the United States department of housing and urban development (HUD) for the New York, NY HUD Metro FMR Area (HMFA), as established in section 3 of the housing act of 1937, as amended.',
 'Department. The term "department" means the department of housing preservation and development.',
 'Extremely low income household. The term "extremely low income household" means a household that has an income of no more than 30 percent of the area median income, adjusted for the size of the household.',
 'Low income household. The term "low income household" means a household that has an income of more than 50 percent of the area median income but no more than 80 percent of the area median income, adjusted for the size of the household.',
 'Middle income household. The term "middle income household" means a household that has an income of more than 120 percent of the area median income but no more than 165 percent of the area median income, adjusted for the size of the household.',
 'Moderate income household. The term "moderate income household" means a household that has an income of more than 80 percent of the area median income but no more than 120 percent of the area median income, adjusted for the size of the household.',
 'Very low income household. The term "very low income household" means a household that has an income of more than 30 percent of the area median income but no more than 50 percent of the area median income, adjusted for the size of the household.'],
 ['Department. The term "department" means the department of housing preservation and development.',
 'Mitchell-Lama development. The term "Mitchell-Lama development" means a housing development organized pursuant to article two of the private housing finance law and supervised by the department.',
 'Waiting list. The term "waiting list" means a list of applicants from which the managing agent of a Mitchell-Lama development is required to process potential tenants or shareholders as applicable for subsequent occupancies of such development.']
];
test('twelve definitions preserve exact complete declaration bodies with reviewed application scopes',()=>{
 assert.deepEqual(extracted.map(terms=>terms.map(t=>t.text)),expected);
 assert.deepEqual(extracted.map(t=>t.length),[1,8,3]);
 for(const [i,terms] of extracted.entries())for(const term of terms){
  assert.equal(term.applicability,term.term==='Area median income'?'review-required':'definition-chapter');assert.equal(term.anchor,bindings[i].anchor);
  assert.equal(term.sectionNumber,bindings[i].section);assert.deepEqual(term.applicableChapterIDs,[bindings[i].chapterID]);
  assert.doesNotMatch(term.text,/\(L\.L\./);
 }
});
test('full-source and exact chapter guards reject drift and neighboring identities',()=>{
 for(const [i,b] of bindings.entries()){
  const c={id:b.chapterID,codeSectionID:3,chapterNumber:b.chapter};
  assert.equal(title26HousingReportingSource(b.bundle,c),b);
  for(const delta of [{id:0},{codeSectionID:2},{chapterNumber:'24'}])assert.equal(title26HousingReportingSource(b.bundle,{...c,...delta}),undefined);
  assert.equal(title26HousingReportingSource('2022-construction-codes',c),undefined);
  assert.throws(()=>extractTitle26HousingReportingDefinitions(sources[i]+' ',b,{referralSource}),/source changed/);
 }
 assert.throws(()=>extractTitle26HousingReportingDefinitions(sources[1],bindings[1]),/requires its exact/);
 assert.throws(()=>extractTitle26HousingReportingDefinitions(sources[1],bindings[1],{referralSource:referralSource.replace('and (ii)','or (ii)')}),/source changed/);
});
test('incorporated affordable housing definition preserves both conditions and actual source through compilation',()=>{
 const terms=resolveDefinitionReferences(extracted[1],extracted[1]);
 const entry=terms[0];assert.equal(entry.resolution,'resolved-reference');
 assert.equal(entry.referenceText,expected[1][0]);
 assert.equal(entry.definition.text,'Affordable housing unit. The term "affordable housing unit" means a dwelling unit that is (i) required, pursuant to a federal, state or local law, rule or program administered by the city or an agreement with the city or a person acting on the city\'s behalf, to be affordable for an extremely low income household, a very low income household, a low income household, a moderate income household or a middle income household and (ii) operates pursuant to an agreement administered by the department.');
 const registry=compileDefinitionRegistry({books:[{bundle:bindings[1].bundle,code:'ADMINISTRATIVE CODE TITLE 26',codeSectionID:3,chapter:'26',chapterID:30000044,scope:'general',excludeWholeChapter:false,terms}]});
 const compiled=registry.books[0].entries[0];assert.equal(compiled.source.file,referral.file);assert.equal(compiled.source.anchor,referral.anchor);assert.equal(compiled.source.sectionNumber,'26-2201');assert.equal(compiled.referenceText,expected[1][0]);assert.equal(compiled.text,entry.definition.text);
 assert.equal(definitionsForReader(registry,{bundle:bindings[1].bundle,codeSectionID:3,chapterNumber:'26',chapterID:30000044,sectionNumber:'26-2602'}).length,7);
});
// Measure all actual source prose with the reviewed aliases.
test('reviewed aliases cover all 35 applications without low-income suffix collisions',()=>{
 const aliases={'Certification of correction':['certifications of correction'],'Affordable housing unit':['affordable housing units'],'Extremely low income household':['extremely low income households'],'Very low income household':['very low income households'],'Low income household':['low income households'],'Moderate income household':['moderate income households'],'Middle income household':['middle income households'],'Mitchell-Lama development':['Mitchell-Lama developments'],'Waiting list':['waiting lists']};
 const totals=[];
 for(const [i,terms] of extracted.entries()){
  const counts={};const matcher=createDefinitionMatcher(terms.map((t,n)=>({...t,id:String(n),aliases:aliases[t.term]||[]})));
  for(const passage of definitionAuditScopedPassages(sources[i]))for(const match of matcher(passage.text))for(const e of match.entries)counts[e.term]=(counts[e.term]||0)+1;
  totals.push(counts);
 }
 assert.deepEqual(totals,[{'Certification of correction':7},{Department:3,'Affordable housing unit':9,'Extremely low income household':1,'Very low income household':1,'Low income household':1,'Moderate income household':1,'Middle income household':1},{Department:1,'Waiting list':8,'Mitchell-Lama development':2}]);
 assert.equal(totals.flatMap(Object.values).reduce((a,b)=>a+b,0),35);
});
test('published web and native indexes preserve twelve entries with bounded application selection with exact source provenance',()=>{
 const web=readFileSync(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8');
 const native=readFileSync(new URL('../../NYC CC APP/permitext/Resources/CodeContent/reader-definition-registry.json',import.meta.url),'utf8');
 assert.equal(web,native);const registry=JSON.parse(web);
 for(const [i,b] of bindings.entries()){
  const book=registry.books.find(book=>book.bundle===b.bundle&&book.codeSectionID===3&&book.chapterID===b.chapterID);
  assert.ok(book);assert.equal(book.sourceSHA256,b.sha256);assert.equal(book.excludeWholeChapter,false);
  assert.deepEqual(book.entries.map(e=>e.term),b.labels);
  for(const [j,e] of book.entries.entries()){
   assert.equal(e.applicability,e.term==='Area median income'?'review-required':'definition-chapter');assert.deepEqual(e.applicableChapterIDs,[b.chapterID]);
   assert.equal(e.text,extracted[i][j].definition?.text||expected[i][j]);
   assert.equal(e.source.file,j===0&&i===1?referral.file:b.file);
   assert.equal(e.source.anchor,j===0&&i===1?referral.anchor:b.anchor);
  }
  const ids=new Set(book.entries.map(e=>e.id));
  for(const sectionNumber of [b.section,`26-${b.chapter}02.1`,undefined])assert.ok(definitionsForReader(registry,{bundle:b.bundle,codeSectionID:3,chapterID:b.chapterID,chapterNumber:b.chapter,sectionNumber}).every(e=>!ids.has(e.id)));
 }
});

test('compiled activation confines all 35 ranges to exact source sections and identities',()=>{
 const sections=[['26-2502','26-2503'],['26-2602'],['26-2702']];
 const proposal=compileDefinitionRegistry({books:bindings.map((b,i)=>({bundle:b.bundle,code:'ADMINISTRATIVE CODE TITLE 26',codeSectionID:3,chapter:b.chapter,chapterID:b.chapterID,scope:'general',excludeWholeChapter:false,terms:resolveDefinitionReferences(extracted[i],extracted[i])}))});
 let total=0;
 for(const [i,b] of bindings.entries()){
  const context={bundle:b.bundle,codeSectionID:3,chapterID:b.chapterID,chapterNumber:b.chapter};
  const expectedTerms=b.labels.filter(t=>t!=='Area median income');
  for(const sectionNumber of sections[i]){
   const selected=definitionsForReader(proposal,{...context,sectionNumber});
   assert.deepEqual(selected.map(e=>e.term),expectedTerms);
   for(const e of selected){
    const original=extracted[i].find(t=>t.term===e.term);
    assert.equal(e.text,original.definition?.text||original.text);
    assert.deepEqual(e.applicableSections,[]);
   }
  }
  for(const sectionNumber of [b.section,undefined,'',...sections[i].map(s=>s+'.1'),'26-9999'])assert.deepEqual(definitionsForReader(proposal,{...context,sectionNumber}),[]);
  for(const delta of [{chapterID:undefined},{chapterID:0},{chapterID:b.chapterID+1},{chapterNumber:'24'},{codeSectionID:2},{bundle:'2022-construction-codes'}])assert.deepEqual(definitionsForReader(proposal,{...context,sectionNumber:sections[i][0],...delta}),[]);
  for(const passage of definitionAuditScopedPassages(sources[i])){
   const selected=definitionsForReader(proposal,{...context,sectionNumber:passage.sectionNumber});
   total+=createDefinitionMatcher(selected)(passage.text).length;
  }
 }
 assert.equal(total,35);
});
