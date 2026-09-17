import test from 'node:test';
import assert from 'node:assert/strict';
import {definitionAppliesToSection} from '../public/definition-matcher.js';
import {compileDefinitionRegistry} from '../scripts/build-reader-definition-registry.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';
import {hmcGeneralSectionExclusions,hmcGeneralExcludedSections} from '../scripts/definition-sources/bind-hmc-general-applicability.mjs';
test('exact exclusions normalize identity, fail closed without section and leave descendants eligible',()=>{
 const entry={excludedExactSections:[' 27-2017 ', 'a101']};
 for(const section of [undefined,null,'','  ','27-2017',' A101 '])assert.equal(definitionAppliesToSection(entry,section),false);
 for(const section of ['27-2017.1','27-2017.10','27-20170','A101.1'])assert.equal(definitionAppliesToSection(entry,section),true);
 assert.equal(definitionAppliesToSection({},undefined),true);
 assert.equal(definitionAppliesToSection({excludedSections:['27-2017']},'27-2017.1'),false);
 assert.equal(definitionAppliesToSection({applicableSections:['27-2017'],excludedExactSections:['27-2017']},'27-2017.1'),true);
 assert.equal(definitionAppliesToSection({applicableSections:['27-2017'],excludedExactSections:['27-2017']},'27-2018'),false);
});
test('compiler and registry retain exact section exclusions',()=>{
 const registry=compileDefinitionRegistry({books:[{bundle:'fixture',codeSectionID:5,scope:'general',chapter:'1',excludeWholeChapter:false,terms:[{term:'Dwelling',key:'dwelling',text:'Meaning',sourceFile:'fixture',anchor:'source',applicability:'definition-chapter',excludedExactSections:['27-2017']}]}]});
 assert.deepEqual(registry.books[0].entries[0].excludedExactSections,['27-2017']);
 const context={bundle:'fixture',codeSectionID:5,chapterNumber:'2'};
 assert.equal(definitionsForReader(registry,{...context,sectionNumber:'27-2017'}).length,0);
 assert.equal(definitionsForReader(registry,{...context,sectionNumber:'27-2017.1'}).length,1);
 assert.equal(definitionsForReader(registry,context).length,0);
});
test('HMC moves only 27-2017 to exact exclusion and retains authoritative nine-section inventory',()=>{
 assert.equal(hmcGeneralExcludedSections.length,9);
 const scope=hmcGeneralSectionExclusions();assert.equal(scope.excludedSections.length,8);assert.deepEqual(scope.excludedExactSections,['27-2017']);
 for(const section of hmcGeneralExcludedSections){assert.equal(definitionAppliesToSection(scope,section),false);assert.equal(definitionAppliesToSection(scope,section+'.1'),section==='27-2017');}
 scope.excludedSections.length=0;assert.equal(hmcGeneralSectionExclusions().excludedSections.length,8);
});
