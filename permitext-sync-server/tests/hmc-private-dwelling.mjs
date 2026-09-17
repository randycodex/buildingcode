import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {extractDefinitionEntries} from '../reader-definition-index.mjs';
import {bindHMCPrivateDwelling} from '../scripts/definition-sources/bind-hmc-private-dwelling.mjs';
import {hmcGeneralExcludedSections} from '../scripts/definition-sources/bind-hmc-general-applicability.mjs';
import {compileDefinitionRegistry} from '../scripts/build-reader-definition-registry.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';
import {createDefinitionMatcher} from '../public/definition-matcher.js';
const sources=Object.fromEntries(await Promise.all([1,2,3,4,5].map(async chapter=>[chapter,await readFile(new URL(`../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/${30000076+chapter}.html`,import.meta.url),'utf8')])));
const terms=extractDefinitionEntries(sources[1],{definitionChapter:true,definitionSectionOnly:true,numberedLegalLabels:{sectionNumber:'27-2004',terms:{6:'Private dwelling'}}}).map(t=>({...t,applicability:'review-required',sourceFile:'2026-enacted-administrative-code/chapters/30000077.html',chapter:'1'}));
const book={bundle:'2026-enacted-administrative-code',codeSectionID:5,chapterID:30000077,chapter:'1',scope:'general',excludeWholeChapter:false,code:'HOUSING MAINTENANCE CODE',terms};
const bound=bindHMCPrivateDwelling(book,sources);
const registry=compileDefinitionRegistry({books:[bound]});
const select=(chapterNumber,sectionNumber,bundle=book.bundle)=>definitionsForReader(registry,{bundle,codeSectionID:5,chapterNumber,sectionNumber});
test('general private dwelling preserves exact original body/source and only activates outside replacement/declarations',()=>{
 const before=compileDefinitionRegistry({books:[book]}).books[0].entries[0],after=registry.books[0].entries[0];
 assert.equal(after.id,before.id);assert.equal(after.text,before.text);assert.deepEqual(after.source,before.source);assert.deepEqual(after.aliases,before.aliases);
 for(const [chapter,section]of [['1','27-2005'],['2','27-2065'],['3','27-2078'],['4','27-2097'],['5','27-2115']])assert.equal(select(chapter,section).length,1);
 for(const section of [...hmcGeneralExcludedSections,'27-2045','27-2045.1'])assert.equal(select('2',section).length,0);
 assert.equal(select('2',undefined).length,0);assert.equal(select('6','27-2115').length,0);assert.equal(select('2','27-2065','2022-construction-codes').length,0);
});
test('actual application and local replacement remain distinct',()=>{
 assert.match(sources[3],/living rooms in a private dwelling/);
 assert.equal(createDefinitionMatcher(select('3','27-2078'))('A family may rent one or more living rooms in a private dwelling').length,1);
 const replacement={...terms[0],sectionNumber:'27-2045',text:'Local replacement sentinel'};
 const result=bindHMCPrivateDwelling({...book,terms:[...terms,replacement]},sources);
 assert.equal(result.terms[1],replacement);
});
test('all source hashes and original identity fail closed',()=>{
 for(const chapter of ['1','2','3','4','5'])assert.throws(()=>bindHMCPrivateDwelling(book,{...sources,[chapter]:sources[chapter]+' '}),/source changed/);
 assert.throws(()=>bindHMCPrivateDwelling({...book,codeSectionID:4},sources),/identity/);
 assert.throws(()=>bindHMCPrivateDwelling({...book,terms:terms.map(t=>({...t,text:t.text+'x'}))},sources),/original changed/);
});
test('actual local replacement wins only in its source section',()=>{
 const localTerms=extractDefinitionEntries(sources[2],{sentenceDefinitionTargets:[{term:'Private dwelling',sectionNumber:'27-2045'}]}).filter(t=>t.term==='Private dwelling'&&t.sectionNumber==='27-2045');
 assert.equal(localTerms.length,1);
 const localBook={...book,chapter:'2',chapterID:30000078,terms:localTerms.map(t=>({...t,sourceFile:'2026-enacted-administrative-code/chapters/30000078.html',chapter:'2',resolution:'direct',applicability:'definition-chapter',applicableChapters:['2'],applicableSections:['27-2045']}))};
 const combined=compileDefinitionRegistry({books:[bound,localBook]});
 const choose=sectionNumber=>definitionsForReader(combined,{bundle:book.bundle,codeSectionID:5,chapterNumber:'2',sectionNumber}).filter(t=>t.term==='Private dwelling');
 assert.equal(choose('27-2045').length,1);
 assert.equal(choose('27-2045')[0].text,localTerms[0].text);
 assert.equal(choose('27-2045')[0].source.sectionNumber,'27-2045');
 assert.equal(choose('27-2046').length,1);
 assert.equal(choose('27-2046')[0].text,terms[0].text);
 assert.equal(choose('27-2046')[0].source.sectionNumber,'27-2004');
});
