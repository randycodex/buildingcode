import test from 'node:test';
import assert from 'node:assert/strict';
import {definitionBundleID,definitionsForReader} from '../public/reader-definition-registry.js';
import {compileDefinitionRegistry} from '../scripts/build-reader-definition-registry.mjs';

test('registry selection isolates edition and code and requires reader identity',()=>{
 const registry={books:[{bundle:'2022',codeSectionID:1,scope:'general',entries:['a']},{bundle:'2014',codeSectionID:1,scope:'general',entries:['b']},{bundle:'2022',codeSectionID:2,scope:'general',entries:['c']}]};
 registry.books.forEach(book=>book.entries=book.entries.map(id=>({id,applicability:'definition-chapter'})));
 assert.deepEqual(definitionsForReader(registry,{bundle:'2022',codeSectionID:1,chapterNumber:'3'}).map(e=>e.id),['a']);
 assert.deepEqual(definitionsForReader(registry,{codeSectionID:1,chapterNumber:'3'}),[]);
});
test('energy and appendix definitions remain within their stated branch',()=>{
 const registry={books:['general','R','C','appendix-D'].map(scope=>({bundle:'x',codeSectionID:1,scope,entries:[{id:scope,applicability:'definition-chapter'}]}))};
 assert.deepEqual(definitionsForReader(registry,{bundle:'x',codeSectionID:1,chapterNumber:'R3'}).map(e=>e.id),['general','R']);
 assert.deepEqual(definitionsForReader(registry,{bundle:'x',codeSectionID:1,chapterNumber:'D4'}).map(e=>e.id),['general','appendix-D']);
 assert.deepEqual(definitionsForReader(registry,{bundle:'x',codeSectionID:1,chapterNumber:'4'}).map(e=>e.id),['general']);
});
test('canonical bundle identity is explicit',()=>{
 assert.equal(definitionBundleID('CodeContent/authored/new-york-city/2014-construction-codes/bundle.json#1'),'2014-construction-codes');
 assert.equal(definitionBundleID('unknown'),'');
});
test('compilation preserves a resolved source and unresolved reference wording',()=>{
 const book={bundle:'2022',code:'BC',codeSectionID:1,scope:'general',chapter:'2',terms:[
 {term:'EXIT',key:'exit',text:'See Section 1002.',resolution:'resolved-reference',referenceText:'See Section 1002.',definition:{text:'A way out.',sourceFile:'chapter10.html',anchor:'exit',sectionNumber:'1002'}},
 {term:'OTHER',key:'other',text:'See Section 999.',resolution:'unresolved-reference',sourceFile:'chapter2.html',anchor:'other',sectionNumber:'202'}]};
 const entries=compileDefinitionRegistry({books:[book]}).books[0].entries;
 assert.equal(entries[0].text,'A way out.');assert.equal(entries[0].source.file,'chapter10.html');
 assert.equal(entries[1].text,'See Section 999.');assert.equal(entries[1].resolution,'unresolved-reference');
 assert.notEqual(entries[0].id,entries[1].id);
});
test('definitions with unreviewed applicability are retained in data but not linked generally',()=>{
 const registry={books:[{bundle:'x',codeSectionID:1,scope:'general',entries:[{id:'a',applicability:'definition-chapter'},{id:'b',applicability:'review-required'}]}]};
 assert.deepEqual(definitionsForReader(registry,{bundle:'x',codeSectionID:1,chapterNumber:'3'}).map(e=>e.id),['a']);
});

test('definition chapters have no popups while other chapters retain them',()=>{
 const registry={books:[{bundle:'2022',codeSectionID:1,scope:'general',definitionChapter:'2',entries:[{id:'a',applicability:'definition-chapter'}]}]};
 assert.deepEqual(definitionsForReader(registry,{bundle:'2022',codeSectionID:1,chapterNumber:2}),[]);
 assert.equal(definitionsForReader(registry,{bundle:'2022',codeSectionID:1,chapterNumber:3}).length,1);
});

test('resolved source metadata never borrows the referring chapter',()=>{
 const term={term:'EXAMPLE',key:'example',text:'See Section G201.',resolution:'resolved-reference',definition:{text:'Meaning.',sourceFile:'G.html',anchor:'g',sectionNumber:'G201',chapter:'G'}};
 const book={bundle:'edition',code:'BC',codeSectionID:1,scope:'general',chapter:'2',terms:[term]};
 assert.equal(compileDefinitionRegistry({books:[book]}).books[0].entries[0].source.chapter,'G');
 delete term.definition.chapter;
 assert.equal(compileDefinitionRegistry({books:[book]}).books[0].entries[0].source.chapter,null);
});

test('explicit chapter and appendix wording limits entry selection',()=>{
 const book={bundle:'2022',code:'BC',codeSectionID:1,scope:'general',chapter:'2',terms:[{term:'CELL',key:'cell',text:'As used in Chapter 21, a void space.',applicability:'definition-chapter'},{term:'EXAMPLE',key:'example',text:'As used in Chapter 11 and Appendix E, a unit.',applicability:'definition-chapter'}]};
 const registry=compileDefinitionRegistry({books:[book]});
 const entries=chapterNumber=>definitionsForReader(registry,{bundle:'2022',codeSectionID:1,chapterNumber}).map(e=>e.term);
 assert.deepEqual(entries('3'),[]);
 assert.deepEqual(entries('21'),['CELL']);
 assert.deepEqual(entries('11'),['EXAMPLE']);
 assert.deepEqual(entries('E'),['EXAMPLE']);
});
