import {createDefinitionMatcher} from '../public/definition-matcher.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {extractDefinitionEntries} from '../reader-definition-index.mjs';
import {auditZoningApplicability,sourceURL} from '../scripts/audit-zoning-definition-applicability.mjs';
import {bindZoningApplicability,reviewedZoningTerms} from '../scripts/definition-sources/bind-zoning-applicability.mjs';
import {compileDefinitionRegistry} from '../scripts/build-reader-definition-registry.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';
const definitionHTML=await readFile(sourceURL,'utf8');
const applicationHTML=await readFile(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-zoning-resolution/chapters/II-3.html',import.meta.url),'utf8');
const book={bundle:'2026-zoning-resolution',code:'ZONING RESOLUTION',codeSectionID:1,scope:'general',chapter:'I-2',
 terms:extractDefinitionEntries(definitionHTML,{definitionChapter:true}).map(term=>({...term,
  applicability:'review-required',resolution:'direct',sourceFile:'2026-zoning-resolution/chapters/I-2.html',chapter:'I-2'}))};
const terms=bindZoningApplicability(book,definitionHTML,applicationHTML);
const registry=compileDefinitionRegistry({books:[{...book,terms}]});
test('retains all authored scope containers without changing definition wording or identity',()=>{
 const prior=compileDefinitionRegistry({books:[book]}).books[0].entries;
 assert.equal(terms.length,book.terms.length);
 assert.equal(new Set(terms.flatMap(term=>term.sourceApplicability.map(s=>s.containerIndex))).size,484);
 for(const entry of registry.books[0].entries){
  const original=prior.find(candidate=>candidate.id===entry.id);
  assert.ok(original);assert.equal(entry.text,original.text);assert.deepEqual(entry.source,original.source);
 }
 const audit=auditZoningApplicability(definitionHTML);
 for(const term of terms)for(const scope of term.sourceApplicability){
  const source=audit.definitions[scope.containerIndex];
  assert.equal(scope.scopeType,source.scopeType);assert.deepEqual(scope.labels,source.applicability);
  assert.equal(scope.excludedBySourceClass,source.excludedBySourceClass);
 }
});
test('enables only the reviewed bulk and dimensional meanings in II-3 with explicit italic and plural rules',()=>{
 const enabled=definitionsForReader(registry,{bundle:book.bundle,codeSectionID:1,chapterNumber:'II-3'});
 assert.equal(enabled.length,13);
 assert.deepEqual(enabled.map(e=>e.term).sort(),Object.keys(reviewedZoningTerms).sort());
 for(const entry of enabled){
  assert.equal(entry.requiresItalic,true);assert.deepEqual(entry.aliases,reviewedZoningTerms[entry.term]);
  assert.equal(entry.source.sectionNumber,'12-10');assert.equal(entry.source.anchor,'term-'+entry.term);
 }
 for(const chapterNumber of ['I-2','II-2','III-3','VIII-2'])assert.deepEqual(definitionsForReader(registry,{bundle:book.bundle,codeSectionID:1,chapterNumber}),[]);
 assert.deepEqual(definitionsForReader(registry,{bundle:'2022-construction-codes',codeSectionID:1,chapterNumber:'II-3'}),[]);
 assert.equal(terms.filter(term=>term.applicability==='definition-chapter').length,13);
});
test('changed definition or application source fails closed before enabling any meaning',()=>{
 for(const changed of [{...book,bundle:'2022-construction-codes'},{...book,chapter:'II-3'},{...book,codeSectionID:2}])assert.throws(()=>bindZoningApplicability(changed,definitionHTML,applicationHTML),/source identity/);
 assert.throws(()=>bindZoningApplicability(book,definitionHTML+' ',applicationHTML),/SHA changed/);
 assert.throws(()=>bindZoningApplicability(book,definitionHTML,applicationHTML+' '),/application source changed/);
 assert.throws(()=>bindZoningApplicability({...book,terms:book.terms.filter(t=>t.term!=='floor area ratio')},definitionHTML,applicationHTML),/omitted/);
});

 test('reviewed plural aliases are explicitly attested as authored italic source text',()=>{
  const italic=[...applicationHTML.matchAll(/<(?:em|i)\b[^>]*>([\s\S]*?)<\/(?:em|i)>/gi)].map(m=>m[1].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().toLowerCase());
  for(const [term,aliases] of Object.entries(reviewedZoningTerms)){
   assert.ok(italic.includes(term),term);
   for(const alias of aliases)assert.ok(italic.includes(alias),alias);
  }
 });

test('reviewed labels prefer complete phrases over shorter constituent meanings',()=>{
 const enabled=definitionsForReader(registry,{bundle:book.bundle,codeSectionID:1,chapterNumber:'II-3'});
 const matches=createDefinitionMatcher(enabled)('building or other structure; buildings or other structures; building; stories; street walls');
 assert.deepEqual(matches.map(m=>m.entries.map(e=>e.term)),[['building or other structure'],['building or other structure'],['building'],['story'],['street wall']]);
});
test('full enacted conditional qualifications remain in enabled definition bodies',()=>{
 const text=label=>terms.find(t=>t.term===label).text;
 for(const [term,fragments] of Object.entries({
  building:['February 2, 2011','shall not include'],
  'lot coverage':['height factor','23-341','balcony'],
  'street line':['street setback line supersedes'],
  story:['cellar','attic space'],
  'base plane':['100 feet','June 30, 1989','five percent'],
  'curb level':['rear yard equivalent','For the purposes of determining a base plane'],
  'dwelling unit':['rooming units','unless specifically stated']
 }))for(const fragment of fragments)assert.ok(text(term).includes(fragment),term+': '+fragment);
});

test('all attested simple plurals of the reviewed labels are retained',()=>{
 const italic=[...applicationHTML.matchAll(/<(?:em|i)\b[^>]*>([\s\S]*?)<\/(?:em|i)>/gi)].map(m=>m[1].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().toLowerCase());
 const plurals={'building':'buildings','building or other structure':'buildings or other structures','lot area':'lot areas','lot width':'lot widths','lot coverage':'lot coverages','street wall':'street walls','street line':'street lines','story':'stories','yard':'yards','base plane':'base planes','curb level':'curb levels','dwelling unit':'dwelling units','floor area ratio':'floor area ratios'};
 for(const [term,plural] of Object.entries(plurals))assert.equal(reviewedZoningTerms[term].includes(plural),italic.includes(plural),plural);
 assert.equal(italic.filter(t=>t==='lot coverages').length,2);
});
