import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bindHMCContextualDefinitions,extractHMCContextualOriginals} from '../scripts/definition-sources/bind-hmc-contextual-definitions.mjs';
import {compileDefinitionRegistry} from '../scripts/build-reader-definition-registry.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';
const sources=Object.fromEntries(await Promise.all(['1','2','3','4','5'].map(async chapter=>[chapter,await readFile(new URL(`../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/${30000076+Number(chapter)}.html`,import.meta.url),'utf8')])));
const book={bundle:'2026-enacted-administrative-code',codeSectionID:5,chapterID:30000077,chapter:'1',code:'HOUSING MAINTENANCE CODE',scope:'general',excludeWholeChapter:false,terms:extractHMCContextualOriginals(sources[1]).map(e=>({...e,applicability:'review-required',sourceFile:'2026-enacted-administrative-code/chapters/30000077.html',chapter:'1'}))};
test('contextual binding preserves exact identities complete meanings and sources',()=>{
 const before=compileDefinitionRegistry({books:[book]}),after=compileDefinitionRegistry({books:[bindHMCContextualDefinitions(book,sources)]});
 for(const e of after.books[0].entries){const old=before.books[0].entries.find(x=>x.id===e.id);assert.ok(old);assert.equal(e.text,old.text);assert.deepEqual(e.source,old.source);assert.deepEqual(e.aliases,e.term==='Court'?['courts']:e.term==='Alteration'?['alterations']:old.aliases);}
 const select=(chapter,section,bundle=book.bundle)=>definitionsForReader(after,{bundle,codeSectionID:5,chapterNumber:chapter,sectionNumber:section});
 assert.equal(select('3','27-2075').length,2);assert.equal(select('1','27-2004').length,0);assert.equal(select('6','27-2075').length,0);assert.equal(select('3','27-2075','2014-construction-codes').length,0);
 for(const section of ['27-2093','27-2093.1','27-2150','27-2151','27-2152','27-2140'])assert.equal(select('5',section).length,0);

});
test('contextual binding fails closed for every source and original input drift',()=>{
 for(const chapter of Object.keys(sources))assert.throws(()=>bindHMCContextualDefinitions(book,{...sources,[chapter]:sources[chapter]+' '}),/source changed/);
 assert.throws(()=>bindHMCContextualDefinitions({...book,chapterID:30000078},sources),/identity changed/);
 for(const change of [{text:'changed'},{aliases:['invented']},{anchor:'wrong'},{sourceFile:'wrong'}])assert.throws(()=>bindHMCContextualDefinitions({...book,terms:book.terms.map((e,i)=>i?e:{...e,...change})},sources),/original changed/);
 assert.throws(()=>bindHMCContextualDefinitions({...book,terms:book.terms.slice(1)},sources),/original changed/);
 assert.throws(()=>bindHMCContextualDefinitions({...book,terms:[...book.terms,book.terms[0]]},sources),/original changed/);
});

test('compiled binding matches all four complete source inventories without crossing reviewed boundaries',async()=>{
 const {createDefinitionMatcher}=await import('../public/definition-matcher.js');
 const {auditHMCCourtApplicability}=await import('../scripts/audit-hmc-court-applicability.mjs');
 const {auditHMCFloorArea}=await import('../scripts/audit-hmc-floor-area-applicability.mjs');
 const {auditHMCAlterationScope}=await import('../scripts/audit-hmc-alteration-scope.mjs');
 const current=JSON.parse(await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8'));
 const compiled=compileDefinitionRegistry({books:[bindHMCContextualDefinitions(book,sources)]}).books[0].entries;
 for(const e of compiled){const existing=current.books.find(b=>b.chapterID===30000077).entries.find(x=>x.term===e.term);assert.equal(e.id,existing.id);assert.equal(e.text,existing.text);assert.deepEqual(e.source,existing.source);}
 const registry={...current,books:current.books.map(b=>b.chapterID===30000077?{...b,entries:b.entries.map(e=>compiled.find(c=>c.id===e.id)||e)}:b)};
 const check=(term,section,chapter,text,ranges,classification)=>{
  const id=compiled.find(e=>e.term===term).id;
  const matches=createDefinitionMatcher(definitionsForReader(registry,{bundle:book.bundle,codeSectionID:5,chapterNumber:String(chapter),sectionNumber:section}),{sectionNumber:section})(text).filter(m=>m.entries.some(e=>e.id===id));
  for(const r of ranges)assert.equal(matches.some(m=>m.start===r.start&&m.end===r.end),r.classification===classification,`${term} ${section}: ${text}`);
 };
 const court=await auditHMCCourtApplicability();
 for(const p of court.occurrences)check('Court',p.section,p.chapter,p.text,[p],'architectural');
 const floor=await auditHMCFloorArea();
 for(const p of floor.paragraphs)check('Floor area',p.section,Number(p.source.match(/(\d+)\.html$/)[1])-30000076,p.paragraph,p.ranges,'roomSpace');
 const {auditHMCSROApplicability}=await import('../scripts/audit-hmc-sro-applicability.mjs');
 const sro=await auditHMCSROApplicability();
 for(const p of sro.paragraphs)check('Single room occupancy',p.section,p.chapter,p.text,p.occurrences.map(r=>({...r,classification:p.classification})),'ordinaryCandidate');
 const alteration=await auditHMCAlterationScope();
 for(const p of alteration.paragraphs)check('Alteration',p.section,Number(p.file.match(/(\d+)\.html$/)[1])-30000076,p.text,p.ranges,'ordinaryCandidate');
});
