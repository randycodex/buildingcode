import test from 'node:test';
import assert from 'node:assert/strict';
import {definitionAppliesToSection} from '../public/definition-matcher.js';
import {compileDefinitionRegistry} from '../scripts/build-reader-definition-registry.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';

test('exact positive scope excludes separately numbered descendants and unknown identity',()=>{
 const entry={applicableExactSections:[' 27-2045 ','a101']};
 for(const section of ['27-2045',' A101 '])assert.equal(definitionAppliesToSection(entry,section),true);
 for(const section of [undefined,null,'',' ','27-2045.1','27-20450','A101.1'])assert.equal(definitionAppliesToSection(entry,section),false);
 assert.equal(definitionAppliesToSection({applicableExactSections:[]},'27-2045'),false);
 assert.equal(definitionAppliesToSection({},undefined),true);
});

test('prefix and exact scopes form a union while exclusions override both',()=>{
 const entry={applicableSections:['27-2033.1'],applicableExactSections:['27-2045']};
 for(const section of ['27-2033.1','27-2033.1.2','27-2045'])assert.equal(definitionAppliesToSection(entry,section),true);
 for(const section of ['27-2033.10','27-2045.1','27-2046',''])assert.equal(definitionAppliesToSection(entry,section),false);
 assert.equal(definitionAppliesToSection({...entry,excludedSections:['27-2033']},'27-2033.1.2'),false);
 assert.equal(definitionAppliesToSection({...entry,excludedExactSections:['27-2045']},'27-2045'),false);
 assert.equal(definitionAppliesToSection({...entry,excludedExactSections:['27-2033.1']},'27-2033.1.2'),true);
});

test('compiler and reader selection preserve exact positive scope including an empty restriction',()=>{
 const term={term:'Example',key:'example',text:'Full source meaning.',sourceFile:'source.html',anchor:'source',applicability:'definition-chapter',applicableExactSections:['27-2045']};
 const book={bundle:'fixture',codeSectionID:5,scope:'general',chapter:'1',excludeWholeChapter:false,terms:[term]};
 const registry=compileDefinitionRegistry({books:[book]});
 assert.deepEqual(registry.books[0].entries[0].applicableExactSections,['27-2045']);
 const context={bundle:'fixture',codeSectionID:5,chapterNumber:'2'};
 assert.equal(definitionsForReader(registry,{...context,sectionNumber:'27-2045'}).length,1);
 for(const sectionNumber of [undefined,'27-2045.1','27-20450'])assert.equal(definitionsForReader(registry,{...context,sectionNumber}).length,0);
 const empty=compileDefinitionRegistry({books:[{...book,terms:[{...term,applicableExactSections:[]}]}]});
 assert.deepEqual(empty.books[0].entries[0].applicableExactSections,[]);
 assert.equal(definitionsForReader(empty,{...context,sectionNumber:'27-2045'}).length,0);
});
