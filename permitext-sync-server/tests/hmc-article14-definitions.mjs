import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractDefinitionEntries} from '../reader-definition-index.mjs';
import {bindHMCArticle14Definitions as bind,hmcArticle14Sources as sources,hmcArticle14ApplicationSections as sections} from '../scripts/definition-sources/hmc-article14-definitions.mjs';
import {compileDefinitionRegistry} from '../scripts/build-reader-definition-registry.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';
const read=source=>readFileSync(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/'+source.file,import.meta.url),'utf8');
const input={generalSource:read(sources.general),article14Source:read(sources.article14)};
const labels={1:'Department',3:'Dwelling',4:'Family',6:'Private dwelling',7:'Multiple dwelling',9:'Class B multiple dwelling',10:'Converted dwelling',11:'Tenement',12:'Hotel',13:'Dwelling unit',14:'Apartment',15:'Rooming unit',16:'Rooming house',17:'Single room occupancy',18:'Lodging house',19:'Public hall',20:'Public part of a dwelling',21:'Living room',22:'Floor area',23:'Dining space',24:'Foyer',25:'Kitchen',26:'Kitchenette',27:'Dormitory',28:'Premises',29:'Structure',30:'Alteration',32:'Fire-retarded',34:'Court',35:'Story',37:'Cellar',38:'Basement',39:'Shaft',40:'Stair',41:'Firestair',42:'Firetower',43:'Fire escape',45:'Owner',46:'Summer resort dwelling'};
const book={bundle:sources.bundle,codeSectionID:5,code:'HOUSING MAINTENANCE CODE',chapterID:30000077,chapter:'1',scope:'general',excludeWholeChapter:false,
 terms:extractDefinitionEntries(input.generalSource,{definitionChapter:true,definitionSectionOnly:true,numberedLegalLabels:{sectionNumber:'27-2004',terms:labels}}).map(term=>({...term,resolution:'direct',applicability:'review-required',sourceFile:sources.general.file,chapter:'1'}))};
const output=bind(book,input), registry=compileDefinitionRegistry({books:[output]});
const context={bundle:sources.bundle,codeSectionID:5,chapterNumber:'2'};
test('preserves all 39 general source records and original identity; adds exact complete terminology with separate provenance',()=>{
 assert.equal(book.terms.length,39);assert.equal(output.terms.length,40);
 for(let i=0;i<39;i++){
  assert.equal(output.terms[i].text,book.terms[i].text);
  if(book.terms[i].term!=='Multiple dwelling')assert.deepEqual(output.terms[i],book.terms[i]);
 }
 const before=compileDefinitionRegistry({books:[book]}).books[0].entries.find(e=>e.term==='Multiple dwelling');
 const pair=registry.books[0].entries.filter(e=>e.term==='Multiple dwelling');
 assert.equal(pair.length,2);assert.equal(pair[0].id,before.id);assert.notEqual(pair[0].id,pair[1].id);
 assert.deepEqual(pair[0].source,before.source);
 assert.equal(pair[1].source.file,sources.article14.file);assert.equal(pair[1].source.anchor,'section-31001929');assert.equal(pair[1].source.sectionNumber,'27-2056.1');assert.equal(pair[1].source.chapter,'2');
 assert.equal(pair[1].text,`For the purposes of this article, the term "multiple dwelling" includes a private dwelling where at least one dwelling unit within such dwelling is occupied by persons other than the owner of such dwelling or a member of such owner's family, provided, however, that the provisions of this article, other than section 27-2056.14, shall not apply to a dwelling unit that is occupied by such owner or a member of such owner's family.`);
 assert.equal(book.terms.find(t=>t.term==='Multiple dwelling').applicability,'review-required');
});
test('only both additive meanings are eligible in every enumerated application section; unknown and definition sections fail closed',()=>{
 assert.equal(sections.length,17);
 for(const sectionNumber of sections)assert.deepEqual(definitionsForReader(registry,{...context,sectionNumber}).map(e=>e.source.sectionNumber),['27-2004','27-2056.1']);
 for(const sectionNumber of [undefined,'','27-2004','27-2056.1','27-2056.2','27-2056.19','27-2056.21','27-2056.22','27-2074'])assert.deepEqual(definitionsForReader(registry,{...context,sectionNumber}),[]);
 for(const change of [{chapterNumber:'1'},{chapterNumber:'3'},{codeSectionID:4},{bundle:'2022-construction-codes'}])assert.deepEqual(definitionsForReader(registry,{...context,sectionNumber:'27-2056.3',...change}),[]);
 // Existing section scope semantics intentionally include subordinate passages.
 assert.equal(definitionsForReader(registry,{...context,sectionNumber:'27-2056.3.1'}).length,2);
 assert.equal(output.terms.find(t=>t.term==='Alteration').applicability,'review-required');
});
test('source drift and mistaken book/entry identity are rejected',()=>{
 for(const name of ['generalSource','article14Source'])assert.throws(()=>bind(book,{...input,[name]:input[name]+' '}),/source changed/);
 assert.throws(()=>bind({...book,chapterID:30000078},input),/identity changed/);
 assert.throws(()=>bind({...book,terms:book.terms.filter(t=>t.term!=='Multiple dwelling')},input),/original definition changed/);
 assert.throws(()=>bind({...book,terms:book.terms.map(t=>t.term==='Multiple dwelling'?{...t,text:t.text+' changed'}:t)},input),/original definition changed/);
});
