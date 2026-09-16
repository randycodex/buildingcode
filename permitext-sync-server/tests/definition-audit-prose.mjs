import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {definitionAuditProse} from '../scripts/definition-audit-prose.mjs';

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
