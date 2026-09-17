import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {parse} from 'parse5';
import {definitionKey,extractDefinitionEntries} from '../reader-definition-index.mjs';
import {extractHMCMissingDefinitions} from '../scripts/definition-sources/hmc-missing-definitions.mjs';
import {bindHMCPhysicalDefinitions,hmcPhysicalAliases} from '../scripts/definition-sources/bind-hmc-physical-definitions.mjs';
import {compileDefinitionRegistry} from '../scripts/build-reader-definition-registry.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';import {createDefinitionMatcher} from '../public/definition-matcher.js';
const hmcBuildingOccupancyTerms=Object.keys(hmcPhysicalAliases);
const sources=Object.fromEntries(await Promise.all([1,2,3,4,5].map(async c=>[c,await readFile(new URL(`../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/${30000076+c}.html`,import.meta.url),'utf8')])));
const registry=JSON.parse(await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8'));
const published=registry.books.find(b=>b.bundle==='2026-enacted-administrative-code'&&b.chapterID===30000077);
// Reconstruct importer input from enacted source, not already-bound published aliases.
const rawPhysical=[...extractDefinitionEntries(sources[1],{definitionChapter:true,definitionSectionOnly:true,numberedLegalLabels:{sectionNumber:'27-2004',terms:{25:'Kitchen',35:'Story',41:'Firestair',42:'Firetower'}}}),...extractHMCMissingDefinitions(sources[1]).filter(e=>['Fireproof','Nonfireproof'].includes(e.term))];
assert.equal(rawPhysical.length,6);
const book={...published,chapter:'1',terms:published.entries.map(e=>{
 const raw=rawPhysical.find(t=>t.term===e.term);
 return raw?{...raw,applicability:'review-required',sourceFile:'2026-enacted-administrative-code/chapters/30000077.html',chapter:'1'}:{...e,key:definitionKey(e.term),sourceFile:e.source.file,anchor:e.source.anchor,sectionNumber:e.source.sectionNumber,chapter:e.source.chapter};
})};
const bound=bindHMCPhysicalDefinitions(book,sources);const compiled=compileDefinitionRegistry({books:[bound]}).books[0];
const ids=new Set(published.entries.filter(e=>hmcBuildingOccupancyTerms.includes(e.term)).map(e=>e.id));
const updated={...registry,books:registry.books.map(b=>b===published?{...b,entries:b.entries.map(e=>ids.has(e.id)?compiled.entries.find(n=>n.id===e.id):e)}:b)};
const tx=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(tx).join('');const walk=(n,tag,out=[])=>{if(n.tagName===tag)out.push(n);for(const c of n.childNodes||[])walk(c,tag,out);return out};
test('six complete physical definitions preserve IDs bodies citations with reviewed aliases',()=>{
 assert.equal(ids.size,6);for(const e of compiled.entries.filter(e=>ids.has(e.id))){const prior=published.entries.find(p=>p.id===e.id);assert.equal(e.text,prior.text);assert.deepEqual(e.source,prior.source);assert.deepEqual(e.aliases,hmcPhysicalAliases[e.term]);assert.equal(e.applicability,'definition-chapter');}
});
test('all actual paragraphs use full registry with exact reviewed occurrence counts',()=>{
 const counts=Object.fromEntries(hmcBuildingOccupancyTerms.map(t=>[t,0]));let declaration=0,roof=0,dwelling=0,fireStair=0;
 for(const [chapter,html]of Object.entries(sources))for(const section of walk(parse(html),'section')){
  const number=tx(section.childNodes.find(n=>n.tagName==='h3')).match(/^27-\s*\d+(?:\.\d+)*/)?.[0].replace(/\s/g,'');assert.ok(number);
  const entries=definitionsForReader(updated,{bundle:published.bundle,codeSectionID:5,chapterNumber:chapter,sectionNumber:number});const matcher=createDefinitionMatcher(entries,{sectionNumber:number});
  for(const p of walk(section,'p')){const text=tx(p);const matches=matcher(text).filter(m=>m.entries.some(e=>ids.has(e.id)));for(const m of matches)for(const e of m.entries.filter(e=>ids.has(e.id)))counts[e.term]++;
   if(number==='27-2058'&&text.includes('A living room does not include a kitchen')){declaration++;assert.ok(!matches.some(m=>m.entries.some(e=>e.term==='Kitchen')));}
   if(number==='27-2058'&&text.includes('non-fireproof roof')){roof++;const at=text.indexOf('non-fireproof roof');assert.ok(!matches.some(m=>m.start>=at&&m.start<at+'non-fireproof'.length));assert.equal(matches.filter(m=>m.entries.some(e=>e.term==='Fireproof')).length,1);}
   if(number==='27-2058'&&text.includes('non-fireproof multiple dwelling')){dwelling++;const at=text.indexOf('non-fireproof');assert.ok(matches.some(m=>m.start===at&&m.entries.some(e=>e.term==='Nonfireproof')));assert.ok(!matches.some(m=>m.start===at+4));}
   if(number==='27-2038'&&/fire stairs?/.test(text)){fireStair++;const at=text.indexOf('fire stair');assert.ok(matches.some(m=>m.start===at&&m.entries.some(e=>e.term==='Firestair')));assert.ok(!matcher(text).some(m=>m.start===at+5));}

  }
 }
 assert.deepEqual(counts,{Kitchen:18,Story:31,Fireproof:11,Nonfireproof:3,Firestair:2,Firetower:2});assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),67);assert.equal(declaration,1);assert.equal(roof,1);assert.equal(dwelling,1);assert.equal(fireStair,2);
});
test('wrong source identity content and aliases fail closed',()=>{
 for(const c of ['1','2','3','4','5'])assert.throws(()=>bindHMCPhysicalDefinitions(book,{...sources,[c]:sources[c]+' '}),/source changed/);
 assert.throws(()=>bindHMCPhysicalDefinitions({...book,chapterID:30000078},sources),/identity/);
 for(const change of [{text:'changed'},{aliases:['invented']},{anchor:'changed'}])assert.throws(()=>bindHMCPhysicalDefinitions({...book,terms:book.terms.map(t=>t.term==='Kitchen'?{...t,...change}:t)},sources),/original changed/);
});

test('chapter edition and exact definition boundaries stay fail closed',()=>{
 const scoped=(chapter,section,bundle=published.bundle)=>definitionsForReader(updated,{bundle,codeSectionID:5,chapterNumber:chapter,sectionNumber:section}).filter(e=>ids.has(e.id));
 for(const chapter of ['1','2','3','4','5'])assert.equal(scoped(chapter,'27-2017.1').length,6);
 for(const section of ['27-2004','27-2017','27-2020','27-2052','27-2056.1','27-2056.2','27-2056.21','27-2109.51','27-2150'])assert.equal(scoped('2',section).length,0,section);
 assert.equal(scoped('6','27-2005').length,0);assert.equal(scoped('2','27-2005','2014').length,0);
 for(const entry of published.entries.filter(e=>!ids.has(e.id)))assert.deepEqual(updated.books[registry.books.indexOf(published)].entries.find(e=>e.id===entry.id),entry);
 assert.throws(()=>bindHMCPhysicalDefinitions({...book,terms:book.terms.filter(t=>t.term!=='Kitchen')},sources),/original changed/);
 assert.throws(()=>bindHMCPhysicalDefinitions({...book,terms:[...book.terms,book.terms.find(t=>t.term==='Kitchen')]},sources),/original changed/);
});

test('unreviewed rear and side yard remain withheld',()=>{for(const term of ['Rear yard','Side yard']){const before=book.terms.find(e=>e.term===term);assert.equal(before.applicability,'review-required');assert.deepEqual(bound.terms.find(e=>e.term===term),before);}});
