import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {discoverDefinitionSections} from '../scripts/definition-section-discovery.mjs';

test('discovery uses headings and retains source anchors without treating prose as headings', () => {
  assert.deepEqual(discoverDefinitionSections('<section id="s"><h3>27-2004 <em>Definitions.</em></h3><p>See definitions elsewhere.</p><h4 id="t">Defined terms</h4></section><p>Definitions.</p>'), [
    {heading:'27-2004 Definitions.',anchor:'s'}, {heading:'Defined terms',anchor:'t'},
  ]);
});

test('published Housing Maintenance Code definition source is discovered', async () => {
  const html = await readFile(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/30000077.html', import.meta.url), 'utf8');
  assert.ok(discoverDefinitionSections(html).some(s => s.heading === '27-2004 Definitions.' && s.anchor === 'section-31001849'));
});

test('inline scoped definitions are discovered without a Definitions heading',()=>{
 const html='<section id="smoke"><h3>27-2045 Devices.</h3><p>a.As used in this section:</p><p>Private dwelling. The term "private dwelling" means a rented unit.</p></section><section id="lead"><h3>27-2056.1 Terminology.</h3><p>For the purposes of this article, the term "multiple dwelling" includes a private dwelling.</p></section>';
 assert.deepEqual(discoverDefinitionSections(html).map(s=>s.anchor),['smoke','lead']);
});

test('published Housing Maintenance inline exceptions are inventoried',async()=>{
 const html=await readFile(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/30000078.html',import.meta.url),'utf8');
 const discovered=discoverDefinitionSections(html);
 for(const section of ['27-2045','27-2056.1']) assert.ok(discovered.some(s=>s.heading.startsWith(section)),section);
});
