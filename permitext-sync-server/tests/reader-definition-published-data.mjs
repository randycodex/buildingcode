import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDefinitionMatcher} from '../public/definition-matcher.js';
import {definitionsForReader} from '../public/reader-definition-registry.js';
const registry=JSON.parse(readFileSync(new URL('../public/reader-definition-registry.json',import.meta.url)));

test('generated definitions retain unique identities and explicit source records',()=>{
 const entries=registry.books.flatMap(book=>book.entries);
 assert.equal(new Set(entries.map(entry=>entry.id)).size,entries.length);
 for(const entry of entries){assert.ok(entry.text.trim());assert.ok(entry.source.file);assert.ok(entry.source.bundle);}
});
test('1968 building lookup does not treat a qualifier as an acronym',()=>{
 const book=registry.books.find(book=>book.code==='1968 BUILDING CODE');
 const entries=definitionsForReader(registry,{bundle:book.bundle,codeSectionID:book.codeSectionID,chapterNumber:'1'});
 const match=createDefinitionMatcher(entries)('building')[0];
 assert.deepEqual(match.entries.map(entry=>entry.term),['BUILDING']);
 assert.equal(match.entries[0].source.sectionNumber,'27-232');
});
test('historical definitions without their own heading do not cite 201.4',()=>{
 const book=registry.books.find(book=>book.bundle==='2014-construction-codes'&&book.code==='BUILDING CODE');
 const entry=book.entries.find(entry=>entry.term==='ALTERATION');
 assert.equal(entry.source.sectionNumber,'');assert.equal(entry.source.chapter,'2');
});
test('2022 permit references resolve to that editions administrative source',()=>{
 const book=registry.books.find(book=>book.bundle==='2022-construction-codes'&&book.code==='BUILDING CODE');
 const entry=book.entries.find(entry=>entry.term==='PERMIT');
 assert.equal(entry.source.bundle,'2022-construction-codes');
 assert.equal(entry.source.code,'GENERAL ADMINISTRATIVE PROVISIONS');
 assert.equal(entry.source.sectionNumber,'28-101.5');
 assert.ok(entry.text.startsWith('An official document'));
});
