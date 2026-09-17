import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {parse} from 'parse5';
import {extractDefinitionEntries} from '../reader-definition-index.mjs';
import {bindHMCArticle14Definitions} from '../scripts/definition-sources/hmc-article14-definitions.mjs';
import {bindHMCMultipleDwelling} from '../scripts/definition-sources/bind-hmc-multiple-dwelling.mjs';
import {compileDefinitionRegistry} from '../scripts/build-reader-definition-registry.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';import {createDefinitionMatcher} from '../public/definition-matcher.js';
const sources=Object.fromEntries(await Promise.all([1,2,3,4,5].map(async c=>[c,await readFile(new URL(`../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/${30000076+c}.html`,import.meta.url),'utf8')])));
const terms=extractDefinitionEntries(sources[1],{definitionChapter:true,definitionSectionOnly:true,numberedLegalLabels:{sectionNumber:'27-2004',terms:{7:'Multiple dwelling'}}}).map(t=>({...t,applicability:'review-required',sourceFile:'2026-enacted-administrative-code/chapters/30000077.html',chapter:'1'}));
const original={bundle:'2026-enacted-administrative-code',codeSectionID:5,chapterID:30000077,chapter:'1',scope:'general',excludeWholeChapter:false,code:'HOUSING MAINTENANCE CODE',terms};
const paired=bindHMCArticle14Definitions(original,{generalSource:sources[1],article14Source:sources[2]});const bound=bindHMCMultipleDwelling(paired,sources);
const baseRegistry=JSON.parse(await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8'));
const compiled=compileDefinitionRegistry({books:[bound]}).books[0];
const registry={...baseRegistry,books:baseRegistry.books.map(b=>b.bundle===compiled.bundle&&b.codeSectionID===5&&b.chapterID===30000077&&b.scope==='general'?{...b,entries:[...b.entries.filter(e=>!compiled.entries.some(x=>x.id===e.id)),...compiled.entries]}:b)};
const select=(chapterNumber,sectionNumber)=>definitionsForReader(registry,{bundle:original.bundle,codeSectionID:5,chapterNumber,sectionNumber});
const matcher=(chapter,section)=>createDefinitionMatcher(select(chapter,section),{sectionNumber:section});
const paragraphs=[];
const tx=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(tx).join('');
for(const [chapter,html]of Object.entries(sources)){let section='';function walk(n){
 if(/^h[1-6]$/.test(n.tagName)){const m=tx(n).match(/^\s*(27-\d+(?:\.\d+)*)/);if(m)section=m[1];}
 if(n.tagName==='p')paragraphs.push({chapter,section,text:tx(n).replace(/\s+/g,' ').trim()});
 for(const c of n.childNodes||[])walk(c);
}walk(parse(html));}
const pairMatches=p=>matcher(p.chapter,p.section)(p.text).filter(m=>m.entries.some(e=>compiled.entries.some(x=>x.id===e.id)));
test('general meaning broadens while Article14 keeps exact additive identity and qualifications',()=>{
 const prior=compileDefinitionRegistry({books:[paired]}).books[0].entries;
 for(const e of compiled.entries){const p=prior.find(x=>x.id===e.id);assert.ok(p);assert.equal(e.text,p.text);assert.deepEqual(e.source,p.source);assert.deepEqual(e.aliases,p.aliases);}
 for(const [c,s,count]of [['2','27-2056.3',2],['3','27-2058',1],['4','27-2097',1],['5','27-2115',1],['2','27-2056.1',0],['2','27-2056.2',0]])assert.equal(select(c,s).filter(e=>e.term==='Multiple dwelling').length,count);
 assert.deepEqual(compiled.entries[0].excludedOccurrences,compiled.entries[1].excludedOccurrences);
});
test('actual paragraph blocks with full registry exclude compounds and declarations but retain ordinary and paired uses',()=>{
 const tx=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(tx).join('');let positive=0,negative=0;
 for(const [chapter,html]of Object.entries(sources)){let section='';function walk(n){if(/^h[1-6]$/.test(n.tagName)){const m=tx(n).match(/^\s*(27-\d+(?:\.\d+)*)/);if(m)section=m[1];}if(n.tagName==='p'){
 const text=tx(n).replace(/\s+/g,' ').trim();const matches=matcher(chapter,section)(text).filter(m=>m.entries.some(e=>compiled.entries.some(x=>x.id===e.id)));
 for(const m of matches){assert.ok(!text.slice(Math.max(0,m.start-30),m.end+4).includes('multiple dwelling law'));positive++;}
 for(const compound of text.matchAll(/\b(?:multiple dwelling law|(?:class [ab]|covered|single room occupancy|fireproof|non-fireproof) multiple dwelling)\b/gi)){
 const at=compound.index+compound[0].toLowerCase().lastIndexOf('multiple dwelling');assert.ok(!matches.some(m=>m.start===at),section+': '+compound[0]);negative++;}
 }for(const c of n.childNodes||[])walk(c);}walk(parse(html));}
 assert.equal(positive,261);assert.equal(negative,117);
 assert.equal(matcher('2','27-2056.3')('A multiple dwelling and another multiple dwelling.').filter(m=>m.entries.length===2).length,2);
 assert.equal(matcher('3','27-2074')('multiple dwelling law and multiple dwelling law').length,0);
});
test('short declaration contexts suppress only the intended term within an application block',()=>{
 for(const rule of compiled.entries[0].excludedOccurrences){
  for(const phrase of rule.phrases){
   const actual=paragraphs.filter(p=>p.section===rule.section&&p.text.includes(phrase.text));
   assert.ok(actual.length,rule.section+': '+phrase.text);
   for(const p of actual){
    for(const occurrence of p.text.matchAll(new RegExp(phrase.text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))){
     const target=occurrence.index+occurrence[0].toLowerCase().indexOf('multiple dwelling');
     assert.ok(!pairMatches(p).some(m=>m.start===target),p.section+': '+p.text);
    }
   }
   const chapter=actual[0].chapter;
   const prose=phrase.text+'; an ordinary multiple dwelling remains subject to requirements.';
   const matches=matcher(chapter,rule.section)(prose).filter(m=>m.entries.some(e=>compiled.entries.some(x=>x.id===e.id)));
   assert.ok(!matches.some(m=>m.start<phrase.text.length),rule.section+': '+phrase.text);
   if(select(chapter,rule.section).some(e=>e.id===compiled.entries[0].id))assert.equal(matches.length,1,rule.section+': '+phrase.text);
  }
 }
});
test('actual declaration inventory is exact and all declaration occurrences remain plain',()=>{
 const beginnings=['Amenity.','Covered dwelling.','Class A multiple dwelling.','f.As used in subdivisions a and e','a.For the purposes of this section, "harassment"','Pilot program building.','Pilot program list.'];
 const declarations=paragraphs.filter(p=>beginnings.some(prefix=>p.text.startsWith(prefix)));
 const counts=declarations.map(p=>({section:p.section,count:[...p.text.matchAll(/\bmultiple dwelling\b/gi)].length}));
 assert.deepEqual(counts,[{section:'27-2009.2',count:1},{section:'27-2030',count:2},{section:'27-2045',count:3},{section:'27-2074',count:1},{section:'27-2093',count:1},{section:'27-2093.1',count:1},{section:'27-2093.1',count:2}]);
 for(const p of declarations)assert.equal(pairMatches(p).length,0,p.section+': '+p.text);
 assert.equal(compiled.entries[0].excludedOccurrences.length,43);
 assert.equal(compiled.entries[0].excludedOccurrences.reduce((n,r)=>n+r.phrases.length,0),67);
});
test('Article15 anaphoric bare references retain covered-category boundary',()=>{
 const references=[['27-2056.22','title to such multiple dwelling'],['27-2056.23','The address of the multiple dwelling'],['27-2056.24','each such dwelling unit in such multiple dwelling']];
 for(const [section,phrase]of references){const actual=paragraphs.filter(p=>p.section===section&&p.text.includes(phrase));assert.equal(actual.length,1);assert.equal(pairMatches(actual[0]).length,0,section);}
 for(const section of ['27-2056.22','27-2056.23','27-2056.24'])for(const p of paragraphs.filter(p=>p.section===section))assert.equal(pairMatches(p).length,0,p.text);
});
test('source and companion changes fail closed' ,()=>{
 for(const c of ['1','2','3','4','5'])assert.throws(()=>bindHMCMultipleDwelling(paired,{...sources,[c]:sources[c]+' '}),/source changed/);
 for(const change of [{text:'changed'},{anchor:'changed'},{sourceFile:'changed'},{applicableSections:['27-2056.3']}])assert.throws(()=>bindHMCMultipleDwelling({...paired,terms:paired.terms.map(t=>t.sectionNumber==='27-2056.1'?{...t,...change}:t)},sources),/companion/);
});
