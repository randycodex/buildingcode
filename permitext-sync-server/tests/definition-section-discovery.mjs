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
