import test from 'node:test';
import assert from 'node:assert/strict';
import {auditHMCSmallInventories} from '../scripts/audit-hmc-withheld-small-inventories.mjs';
const report=await auditHMCSmallInventories();
test('small withheld meanings retain complete singular plural lexical counts',()=>{
 assert.deepEqual(Object.fromEntries(Object.entries(report.terms).map(([k,v])=>[k,[v.definition,v.application]])),{'Rear yard':[5,0],'Side yard':[1,0],'Public part of a dwelling':[1,0],Hotel:[5,3],'Curb level':[7,4]});
});
test('hotel application inventory separates ordinary plural from compound and local category',()=>{
 const p=report.terms.Hotel.paragraphs.find(p=>p.section==='27-2041');assert.deepEqual(p.ranges.map(r=>p.text.slice(Math.max(0,r.start-10),r.end)),[' apply to hotels','apartment hotels']);
 assert.ok(report.terms.Hotel.paragraphs.find(p=>p.section==='27-2093.1').text.includes('exempt luxury hotel as defined by the department in rules'));
});
test('full registry Hotel proposal links only the ordinary plural application',async()=>{
 const {readFile}=await import('node:fs/promises');const {definitionsForReader}=await import('../public/reader-definition-registry.js');const {createDefinitionMatcher}=await import('../public/definition-matcher.js');
 const registry=JSON.parse(await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8'));const book=registry.books.find(b=>b.chapterID===30000077),original=book.entries.find(e=>e.term==='Hotel');
 assert.equal(original.text,'A hotel is an inn having thirty or more sleeping rooms.');assert.equal(original.id,'43ebeca3182a8fe2e536');assert.equal(original.applicability,'definition-chapter');
 book.entries=book.entries.map(e=>e===original?{...e,applicability:'definition-chapter',aliases:['hotels'],applicableChapters:['2'],applicableSections:['27-2041'],excludedOccurrences:[{section:'27-2041',phrases:[{text:'apartment hotels',occurrence:0}]}]}:e);
 let count=0;
 for(const p of report.terms.Hotel.paragraphs){const chapter=String(Number(p.file.match(/(\d+)\.html$/)[1])-30000076);const matches=createDefinitionMatcher(definitionsForReader(registry,{bundle:book.bundle,codeSectionID:5,chapterNumber:chapter,sectionNumber:p.section}),{sectionNumber:p.section})(p.text).filter(m=>m.entries.some(e=>e.id===original.id));count+=matches.length;if(p.section==='27-2041'){assert.equal(matches.length,1);assert.equal(matches[0].start,p.ranges[0].start);}else assert.equal(matches.length,0);}
 assert.equal(count,1);
});
