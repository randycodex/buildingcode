import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {definitionAuditProse,definitionAuditScopedPassages} from '../scripts/definition-audit-prose.mjs';

test('inline definitions omit only their passage remainder, not later sections',()=>{
 const prose=definitionAuditProse('<h3>28-401.2 General.</h3><p>A license is required.<br>**§28-401.3 Definitions. LICENSE. Meaning.</p><h3>28-401.4 Rules.</h3><p>Later license requirements.</p>');
 assert.match(prose,/A license is required/);
 assert.doesNotMatch(prose,/LICENSE\. Meaning/);
 assert.match(prose,/Later license requirements/);
});

test('combined files retain surrounding prose but omit definition sections', () => {
  const prose = definitionAuditProse('<section><h3>201 General</h3><p>First application.</p></section><section><h3>202 Definitions.</h3><p>Defined meaning.</p></section><section><h3>203 Requirements</h3><p>Second application.</p></section>');
  assert.match(prose, /First application/);
  assert.match(prose, /Second application/);
  assert.doesNotMatch(prose, /Defined meaning/);
});

test('published combined Fire Code retains application text outside FC 202', async () => {
  const html = await readFile(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/30000095.html', import.meta.url), 'utf8');
  const prose = definitionAuditProse(html);
  assert.match(prose, /The manufacturing, storage, handling, use, sale and transportation/);
  assert.doesNotMatch(prose, /designed to dispense an aerosol/);
  assert.match(prose, /aerosol containers/i);
});

test('scoped audit keeps separate numbered sections and excludes definition sections',()=>{
 const passages=definitionAuditScopedPassages('<h3>27-2045 Duties.</h3><p>A private dwelling.</p><h3>27-2046 Duties.</h3><p>Another private dwelling.</p><h3>27-2052 Definitions.</h3><p>A definition.</p>');
 assert.deepEqual(passages.map(p=>[p.sectionNumber,p.text.trim()]),[['27-2045','A private dwelling.'],['27-2046','Another private dwelling.']]);
});

test('actual HMC spaced 27-2017.4 and .8 headings keep exact application identities',async()=>{
 const html=await readFile(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/30000078.html',import.meta.url),'utf8');
 const passages=definitionAuditScopedPassages(html);
 const pests=passages.find(p=>p.text.includes('b.Notwithstanding the provisions of subdivision a of this section, the presence of cockroaches'));
 assert.equal(pests?.sectionNumber,'27-2017.4');
 const practices=passages.find(p=>p.sectionNumber==='27-2017.8');
 assert.ok(practices);assert.match(practices.text,/basement/i);assert.match(practices.text,/premises/i);
 assert.ok(!passages.some(p=>p.sectionNumber==='27'));
 const controls=definitionAuditScopedPassages('<h3>AC 28-101.5 Source.</h3><p>A</p><h3>D306.1 Scope.</h3><p>B</p><h3>Section 201.2 General.</h3><p>C</p>');
 assert.deepEqual(controls.map(p=>p.sectionNumber),['28-101.5','D306.1','201.2']);
});
