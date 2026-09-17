import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {extractDefinitionEntries} from '../reader-definition-index.mjs';
import {auditZoningApplicability,sourceURL} from '../scripts/audit-zoning-definition-applicability.mjs';
import {bindZoningApplicability} from '../scripts/definition-sources/bind-zoning-applicability.mjs';
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
test('enables only the reviewed FAR meaning in II-3 with explicit italic and plural rules',()=>{
 const enabled=definitionsForReader(registry,{bundle:book.bundle,codeSectionID:1,chapterNumber:'II-3'});
 assert.equal(enabled.length,1);assert.equal(enabled[0].term,'floor area ratio');
 assert.equal(enabled[0].requiresItalic,true);assert.deepEqual(enabled[0].aliases,['floor area ratios']);
 assert.equal(enabled[0].source.sectionNumber,'12-10');assert.equal(enabled[0].source.anchor,'term-floor area ratio');
 for(const chapterNumber of ['I-2','II-2','III-3','VIII-2'])assert.deepEqual(definitionsForReader(registry,{bundle:book.bundle,codeSectionID:1,chapterNumber}),[]);
 assert.deepEqual(definitionsForReader(registry,{bundle:'2022-construction-codes',codeSectionID:1,chapterNumber:'II-3'}),[]);
 assert.equal(terms.filter(term=>term.applicability==='definition-chapter').length,1);
});
test('changed definition or application source fails closed before enabling any meaning',()=>{
 assert.throws(()=>bindZoningApplicability(book,definitionHTML+' ',applicationHTML),/SHA changed/);
 assert.throws(()=>bindZoningApplicability(book,definitionHTML,applicationHTML+' '),/application source changed/);
 assert.throws(()=>bindZoningApplicability({...book,terms:book.terms.filter(t=>t.term!=='floor area ratio')},definitionHTML,applicationHTML),/omitted/);
});
