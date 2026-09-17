import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deedRestrictionSource as binding,isDeedRestrictionChapter,extractDeedRestrictionDefinitions} from '../scripts/definition-sources/deed-restriction-definitions.mjs';
import {compileDefinitionRegistry} from '../scripts/build-reader-definition-registry.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';
import {createDefinitionMatcher} from '../public/definition-matcher.js';
import {definitionAuditProse,definitionAuditScopedPassages} from '../scripts/definition-audit-prose.mjs';
const source=readFileSync(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/'+binding.file,import.meta.url),'utf8');
const terms=extractDeedRestrictionDefinitions(source);
const book={bundle:binding.bundle,code:'ADMINISTRATIVE CODE TITLE 25',codeSectionID:2,scope:'general',
 chapter:'8',chapterID:binding.chapterID,excludeWholeChapter:false,sourceSHA256:binding.sha256,
 terms:terms.map(term=>({...term,sourceFile:binding.file,bundle:binding.bundle,code:'ADMINISTRATIVE CODE TITLE 25',chapter:'8'}))};
const registry=compileDefinitionRegistry({books:[book]});
const context={bundle:binding.bundle,codeSectionID:2,chapterNumber:'8'};

test('extracts all three exact enacted definitions without merging adjacent labels',()=>{
 assert.deepEqual(terms.map(t=>t.term),['Commissioner','Deed restriction','Department']);
 assert.deepEqual(terms.map(t=>t.text),[
  'Commissioner. The term "commissioner" means the commissioner of citywide administrative services.',
  'Deed restriction. The term "deed restriction" means a covenant set forth in a deed, lease that is for a term of 49 years or longer, or easement that limits the use of property located in the city and is imposed by the city when such property is sold or otherwise disposed of by the city.',
  'Department. The term "department" means the department of citywide administrative services.'
 ]);
 for(const term of terms){assert.equal(term.anchor,binding.anchor);assert.equal(term.sectionNumber,'25-801');assert.deepEqual(term.applicableChapters,['8']);assert.equal(term.referenceOnly,false);}
 assert.equal(terms.find(t=>t.term==='Department').applicability,'review-required');
});
test('chapter selector and source hash reject neighboring and changed sources',()=>{
 const chapter={id:30000019,codeSectionID:2,chapterNumber:'8'};
 assert.equal(isDeedRestrictionChapter(binding.bundle,chapter),true);
 assert.equal(isDeedRestrictionChapter('2014-construction-codes',chapter),false);
 for(const changed of [{...chapter,id:30000018},{...chapter,codeSectionID:1},{...chapter,chapterNumber:'7'}])assert.equal(isDeedRestrictionChapter(binding.bundle,changed),false);
 assert.throws(()=>extractDeedRestrictionDefinitions(source.replace('49 years','48 years')),/source changed/);
});
test('compiled meanings retain exact provenance and chapter-only matching',()=>{
 const entries=definitionsForReader(registry,context);
 assert.deepEqual(entries.map(e=>e.term),['Commissioner','Deed restriction']);
 for(const entry of entries){assert.equal(entry.source.file,binding.file);assert.equal(entry.source.anchor,binding.anchor);assert.equal(entry.source.sectionNumber,'25-801');assert.equal(entry.source.chapter,'8');assert.equal(entry.source.bundle,binding.bundle);}
 for(const chapterNumber of ['1','3','7','9'])assert.deepEqual(definitionsForReader(registry,{...context,chapterNumber}),[]);
 assert.deepEqual(definitionsForReader(registry,{...context,bundle:'2022-construction-codes'}),[]);
 assert.deepEqual(definitionsForReader(registry,{...context,codeSectionID:3}),[]);
});
test('actual application prose links deed restrictions and commissioner but not other departments',()=>{
 const entries=definitionsForReader(registry,context);
 const prose=definitionAuditProse(source), matches=createDefinitionMatcher(entries)(prose);
 assert.equal(matches.filter(m=>m.entries.some(e=>e.term==='Deed restriction')).length,27);
 assert.equal(matches.filter(m=>m.entries.some(e=>e.term==='Commissioner')).length,1);
 assert.equal(matches.some(m=>m.entries.some(e=>e.term==='Department')),false);
 assert.match(prose,/department of city planning/i);
 assert.match(prose,/department of buildings/i);
 const passages=definitionAuditScopedPassages(source);
 assert.ok(!passages.some(p=>p.sectionNumber==='25-801'));
 const application=passages.find(p=>p.sectionNumber==='25-802');
 assert.ok(createDefinitionMatcher(entries)(application.text).some(m=>m.text==='deed restriction'));
 // The declaration itself is also excluded by the installed matcher's guard.
 for(const term of terms)assert.deepEqual(createDefinitionMatcher(entries)(term.text),[]);
});
