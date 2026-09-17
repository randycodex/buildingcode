import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditZoningApplicability,sourceURL,expectedSourceSHA256} from '../scripts/audit-zoning-definition-applicability.mjs';
const source=await readFile(sourceURL,'utf8');
const report=auditZoningApplicability(source);
test('actual Zoning inventory preserves every applicability container including unlabeled scopes',()=>{
 assert.deepEqual(report.counts,{containers:484,termContainers:446,global:279,chapter:174,section:26,unknown:5,excluded:48,emptyBodies:0});
 assert.equal(report.sourceSHA256,expectedSourceSHA256);
 assert.equal(report.definitions.length,484);
 assert.equal(new Set(report.definitions.map(d=>d.index)).size,484);
 assert.equal(report.competingVariants.length,33);
 assert.ok(report.definitions.every(d=>d.sourceLine>0&&d.anchor.startsWith('term-')&&d.bodies.length));
});
test('actual general meaning and local override keep different scopes and source flags',()=>{
 const ratio=report.definitions.find(d=>d.term==='floor area ratio');
 assert.equal(ratio.scopeType,'global');assert.deepEqual(ratio.applicability,['General Definition']);
 const development=report.definitions.find(d=>d.term==='development');
 assert.equal(development.scopeType,'chapter');assert.equal(development.excludedBySourceClass,true);
 assert.deepEqual(development.applicability,['Applicable to Article VIII - Chapter 2']);
 assert.ok(development.bodies[0].text.startsWith('For purposes of this Chapter'));
 const variants=report.competingVariants.find(d=>d.term==='development, or to develop');
 assert.equal(variants.definitionIndices.length,5);
 assert.ok(report.definitions.some(d=>d.scopeType==='section'&&d.applicability.some(s=>s.includes('117-50 to 117-57'))));
 assert.equal(report.definitions.filter(d=>d.scopeType==='global'&&d.excludedBySourceClass).length,2);
});
test('source change and lost authored italic policy fail closed',()=>{
 assert.throws(()=>auditZoningApplicability(source+' '),/SHA changed/);
 assert.throws(()=>auditZoningApplicability('<html></html>',{expectedSHA256:null}),/italic applicability policy missing/);
});
test('same term repeated containers retain separate bodies, scope labels and inline markup',()=>{
 const html=`<p>${report.italicPolicy}</p><article class="defined-term" id="term-example"><div class="defined-term__variants">examples</div><div class="definition applicability-type--global"><h2 class="definition__title">Example</h2><div class="definition__applicability">General Definition</div><div class="definition__definition">An <em>example</em> with <a href="#source">source</a>.</div></div><div class="definition applicability-type--section definition--exclude"><div class="definition__applicability">Applicable from 81-60 to 81-676</div><div class="definition__definition">A different local meaning.</div></div></article>`;
 const fixture=auditZoningApplicability(html,{expectedSHA256:null});
 assert.equal(fixture.definitions.length,2);assert.equal(fixture.competingVariants.length,1);
 assert.match(fixture.definitions[0].bodies[0].html,/<em>example<\/em>/);
 assert.match(fixture.definitions[0].bodies[0].html,/<a href="#source">source<\/a>/);
 assert.deepEqual(fixture.definitions[1].variants,['examples']);assert.equal(fixture.definitions[1].excludedBySourceClass,true);
 assert.notEqual(fixture.definitions[0].bodies[0].text,fixture.definitions[1].bodies[0].text);
});
