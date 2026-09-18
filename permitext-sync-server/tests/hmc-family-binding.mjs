import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bindHMCFamily,extractHMCFamilyOriginal} from '../scripts/definition-sources/bind-hmc-family-applicability.mjs';
import {compileDefinitionRegistry} from '../scripts/build-reader-definition-registry.mjs';
import {auditHMCFamily} from '../scripts/audit-hmc-family-applicability.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';
const sources=Object.fromEntries(await Promise.all(['1','2','3','4','5'].map(async chapter=>[chapter,await readFile(new URL(`../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/${30000076+Number(chapter)}.html`,import.meta.url),'utf8')])));
const book={bundle:'2026-enacted-administrative-code',codeSectionID:5,chapterID:30000077,chapter:'1',code:'HOUSING MAINTENANCE CODE',scope:'general',excludeWholeChapter:false,terms:extractHMCFamilyOriginal(sources[1]).map(e=>({...e,applicability:'review-required',sourceFile:'2026-enacted-administrative-code/chapters/30000077.html',chapter:'1'}))};
const compiled=compileDefinitionRegistry({books:[bindHMCFamily(book,sources)]});
const entry=compiled.books[0].entries[0];
test('Family binding preserves complete body source identity and unrelated terms',()=>{
 const old=compileDefinitionRegistry({books:[book]}).books[0].entries[0];
 assert.equal(entry.id,'89e60949d0b76dbdfcfe');assert.equal(entry.text,old.text);assert.deepEqual(entry.source,old.source);assert.deepEqual(entry.aliases,['families']);
 const unrelated={term:'unrelated',text:'unchanged'};assert.strictEqual(bindHMCFamily({...book,terms:[...book.terms,unrelated]},sources).terms[1],unrelated);
 for(const [bundle,codeSectionID,section]of [[book.bundle,5,'27-2004'],[book.bundle,5,'27-2087'],[book.bundle,5,'27-2076.1'],['2014-construction-codes',5,'27-2076'],[book.bundle,4,'27-2076']])assert.equal(definitionsForReader(compiled,{bundle,codeSectionID,chapterNumber:'3',sectionNumber:section}).length,0);
});
test('Family binding fails closed on source and identity drift',()=>{
 for(const chapter of Object.keys(sources))assert.throws(()=>bindHMCFamily(book,{...sources,[chapter]:sources[chapter]+' '}),/source changed/);
 for(const change of [{chapterID:1},{bundle:'wrong'},{code:'wrong'}])assert.throws(()=>bindHMCFamily({...book,...change},sources),/identity changed/);
 for(const change of [{text:'changed'},{key:'wrong'},{aliases:['invented']},{anchor:'wrong'},{sourceFile:'wrong'}])assert.throws(()=>bindHMCFamily({...book,terms:[{...book.terms[0],...change}]},sources),/original changed/);
 for(const terms of [[],[...book.terms,...book.terms]])assert.throws(()=>bindHMCFamily({...book,terms},sources),/original changed/);
});
test('actual compiled binding agrees with all84 reviewed ranges and rejects widened activation',async()=>{
 const registry=JSON.parse(await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8'));
 for(const b of registry.books)b.entries=b.entries.map(e=>e.id===entry.id?entry:e);
 assert.equal((await auditHMCFamily({registry})).prospectiveMatches,8);
 const widened=structuredClone(registry);widened.books.flatMap(b=>b.entries).find(e=>e.id===entry.id).applicableSections=['27-2076'];
 await assert.rejects(auditHMCFamily({registry:widened}),/activated scope changed/);
});
