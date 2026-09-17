import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {parse} from 'parse5';
import {definitionKey} from '../reader-definition-index.mjs';
import {bindHMCBuildingOccupancy,hmcBuildingOccupancyTerms} from '../scripts/definition-sources/bind-hmc-building-occupancy.mjs';
import {compileDefinitionRegistry} from '../scripts/build-reader-definition-registry.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';import {createDefinitionMatcher} from '../public/definition-matcher.js';
const sources=Object.fromEntries(await Promise.all([1,2,3,4,5].map(async c=>[c,await readFile(new URL(`../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/${30000076+c}.html`,import.meta.url),'utf8')])));
const registry=JSON.parse(await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8'));
const published=registry.books.find(b=>b.bundle==='2026-enacted-administrative-code'&&b.chapterID===30000077);
const book={...published,chapter:'1',terms:published.entries.map(e=>({...e,key:definitionKey(e.term),sourceFile:e.source.file,anchor:e.source.anchor,sectionNumber:e.source.sectionNumber,chapter:e.source.chapter}))};
const bound=bindHMCBuildingOccupancy(book,sources);const compiled=compileDefinitionRegistry({books:[bound]}).books[0];
const ids=new Set(published.entries.filter(e=>hmcBuildingOccupancyTerms.includes(e.term)).map(e=>e.id));
const updated={...registry,books:registry.books.map(b=>b===published?{...b,entries:b.entries.map(e=>ids.has(e.id)?compiled.entries.find(n=>n.id===e.id):e)}:b)};
const tx=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(tx).join('');const walk=(n,tag,out=[])=>{if(n.tagName===tag)out.push(n);for(const c of n.childNodes||[])walk(c,tag,out);return out};
test('eleven full original definitions retain IDs bodies citations and aliases',()=>{
 assert.equal(ids.size,11);for(const e of compiled.entries.filter(e=>ids.has(e.id))){const prior=published.entries.find(p=>p.id===e.id);assert.equal(e.text,prior.text);assert.deepEqual(e.source,prior.source);assert.deepEqual(e.aliases,prior.aliases);assert.equal(e.applicability,'definition-chapter');}
});
test('all actual paragraphs use full registry with exact reviewed occurrence counts',()=>{
 const counts=Object.fromEntries(hmcBuildingOccupancyTerms.map(t=>[t,0]));let hotel=0,alteration=0;
 for(const [chapter,html]of Object.entries(sources))for(const section of walk(parse(html),'section')){
  const number=tx(section.childNodes.find(n=>n.tagName==='h3')).match(/^27-\s*\d+(?:\.\d+)*/)?.[0].replace(/\s/g,'');assert.ok(number);
  const entries=definitionsForReader(updated,{bundle:published.bundle,codeSectionID:5,chapterNumber:chapter,sectionNumber:number});const matcher=createDefinitionMatcher(entries,{sectionNumber:number});
  for(const p of walk(section,'p')){const text=tx(p);const matches=matcher(text).filter(m=>m.entries.some(e=>ids.has(e.id)));for(const m of matches)for(const e of m.entries.filter(e=>ids.has(e.id)))counts[e.term]++;
   if(number==='27-2041'&&text.includes('apartment hotels')){hotel++;const at=text.indexOf('apartment hotels');assert.ok(!matches.some(m=>m.start===at));}
   if(number==='27-2074'&&text.startsWith('f.As used')){alteration++;assert.ok(!matches.some(m=>m.entries.some(e=>e.term==='Rooming unit')));}
  }
 }
 assert.deepEqual(counts,{'Class B multiple dwelling':8,'Converted dwelling':10,'Apartment':60,'Rooming unit':14,'Rooming house':7,'Lodging house':3,'Premises':82,'Structure':5,'Summer resort dwelling':3,'Self-closing door':6,'Unoccupied dwelling unit':5});assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),203);assert.equal(hotel,1);assert.equal(alteration,1);
});
test('wrong source identity content and aliases fail closed',()=>{
 for(const c of ['1','2','3','4','5'])assert.throws(()=>bindHMCBuildingOccupancy(book,{...sources,[c]:sources[c]+' '}),/source changed/);
 assert.throws(()=>bindHMCBuildingOccupancy({...book,chapterID:30000078},sources),/identity/);
 for(const change of [{text:'changed'},{aliases:['invented']},{anchor:'changed'}])assert.throws(()=>bindHMCBuildingOccupancy({...book,terms:book.terms.map(t=>t.term==='Apartment'?{...t,...change}:t)},sources),/original changed/);
});

test('chapter edition and exact definition boundaries stay fail closed',()=>{
 const scoped=(chapter,section,bundle=published.bundle)=>definitionsForReader(updated,{bundle,codeSectionID:5,chapterNumber:chapter,sectionNumber:section}).filter(e=>ids.has(e.id));
 for(const chapter of ['1','2','3','4','5'])assert.equal(scoped(chapter,'27-2017.1').length,11);
 for(const section of ['27-2004','27-2017','27-2020','27-2052','27-2056.1','27-2056.2','27-2056.21','27-2109.51','27-2150'])assert.equal(scoped('2',section).length,0,section);
 assert.equal(scoped('6','27-2005').length,0);assert.equal(scoped('2','27-2005','2014').length,0);
 for(const entry of published.entries.filter(e=>!ids.has(e.id)))assert.deepEqual(updated.books[registry.books.indexOf(published)].entries.find(e=>e.id===entry.id),entry);
 assert.throws(()=>bindHMCBuildingOccupancy({...book,terms:book.terms.filter(t=>t.term!=='Apartment')},sources),/original changed/);
 assert.throws(()=>bindHMCBuildingOccupancy({...book,terms:[...book.terms,book.terms.find(t=>t.term==='Apartment')]},sources),/original changed/);
});
