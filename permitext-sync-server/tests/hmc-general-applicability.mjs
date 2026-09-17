import {parse} from 'parse5';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {extractDefinitionEntries} from '../reader-definition-index.mjs';
import {bindHMCGeneralApplicability,hmcReviewedGeneralTerms,hmcGeneralExcludedSections} from '../scripts/definition-sources/bind-hmc-general-applicability.mjs';
import {compileDefinitionRegistry} from '../scripts/build-reader-definition-registry.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';
import {createDefinitionMatcher} from '../public/definition-matcher.js';
const sources=Object.fromEntries(await Promise.all([1,2,3,4,5].map(async chapter=>[chapter,await readFile(new URL(`../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/${30000076+chapter}.html`,import.meta.url),'utf8')])));
const terms=extractDefinitionEntries(sources[1],{definitionChapter:true,definitionSectionOnly:true,numberedLegalLabels:{sectionNumber:'27-2004',terms:hmcReviewedGeneralTerms}}).map(t=>({...t,applicability:'review-required',sourceFile:'2026-enacted-administrative-code/chapters/30000077.html',chapter:'1'}));
const book={bundle:'2026-enacted-administrative-code',codeSectionID:5,chapterID:30000077,chapter:'1',scope:'general',excludeWholeChapter:false,code:'HOUSING MAINTENANCE CODE',terms};
const bound=bindHMCGeneralApplicability(book,sources);
const registry=compileDefinitionRegistry({books:[bound]});
const select=(chapterNumber,sectionNumber,bundle=book.bundle)=>definitionsForReader(registry,{bundle,codeSectionID:5,chapterNumber,sectionNumber});
test('eleven complete source meanings preserve identity and text without unreviewed aliases',()=>{
 const before=compileDefinitionRegistry({books:[book]}).books[0].entries;
 assert.equal(registry.books[0].entries.length,11);
 for(const entry of registry.books[0].entries){const old=before.find(e=>e.id===entry.id);assert.ok(old);assert.equal(entry.text,old.text);assert.deepEqual(entry.source,old.source);assert.deepEqual(entry.aliases,old.aliases);assert.equal(entry.source.sectionNumber,'27-2004');}
});
test('all five HMC subchapters eligible, unknown context and definition prose withheld',()=>{
 for(const [chapter,section]of [['1','27-2005'],['2','27-2038'],['3','27-2074'],['4','27-2093.1'],['5','27-2115']])assert.equal(select(chapter,section).length,11);
 for(const section of hmcGeneralExcludedSections)assert.equal(select('2',section).length,0);
 assert.equal(select('2','27-2017.1').length,11);
 assert.equal(select('2',undefined).length,0);assert.equal(select('6','27-2115').length,0);assert.equal(select('2','27-2038','2022-construction-codes').length,0);
});
test('actual subchapter three contains matching room and circulation application labels',()=>{
 const prose=sources[3].replace(/<[^>]+>/g,' ');
 const matches=createDefinitionMatcher(select('3','27-2074'))(prose);
 for(const term of ['Living room','Dining space','Foyer','Kitchenette','Cellar','Basement','Shaft','Fire-retarded'])assert.ok(matches.some(m=>m.entries.some(e=>e.term===term)),term);
});
test('all five source hashes and exact original body/identity are guarded',()=>{
 for(const chapter of ['1','2','3','4','5'])assert.throws(()=>bindHMCGeneralApplicability(book,{...sources,[chapter]:sources[chapter]+' '}),/source changed/);
 assert.throws(()=>bindHMCGeneralApplicability({...book,codeSectionID:4},sources),/identity/);
 assert.throws(()=>bindHMCGeneralApplicability({...book,terms:terms.map((t,i)=>i? t:{...t,text:t.text+' Changed'})},sources),/original meaning/);
});

test('actual mixed Living room declaration remains plain while three applications keep full-registry links',async()=>{
 const published=JSON.parse(await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8'));
 const compiled=registry.books[0].entries;
 const full={...published,books:published.books.map(b=>b.bundle===book.bundle&&b.chapterID===30000077?{...b,entries:b.entries.map(e=>compiled.find(c=>c.id===e.id)||e)}:b)};
 const walk=(n,tag,out=[])=>{if(n.tagName===tag)out.push(n);for(const c of n.childNodes||[])walk(c,tag,out);return out};
 const text=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join('');
 const section=walk(parse(sources[3]),'section').find(n=>n.attrs.some(a=>a.name==='id'&&a.value==='section-31001953'));
 assert.ok(section);
 const matcher=createDefinitionMatcher(definitionsForReader(full,{bundle:book.bundle,codeSectionID:5,chapterNumber:'3',sectionNumber:'27-2058'}),{sectionNumber:'27-2058'});
 const counts=walk(section,'p').map(p=>matcher(text(p)).filter(m=>m.entries.some(e=>e.term==='Living room')).length);
 assert.equal(text(walk(section,'p')[4]).includes('A living room does not include a kitchen under this paragraph'),true);
 assert.equal(counts[4],0);
 assert.deepEqual(counts.map((n,i)=>n?i:null).filter(i=>i!==null),[0,5,12]);
 assert.equal(counts.reduce((a,b)=>a+b,0),3);
});
