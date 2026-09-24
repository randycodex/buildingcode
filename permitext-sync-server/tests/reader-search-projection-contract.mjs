import assert from 'node:assert/strict';
import { createReaderSearchProjection } from '../scripts/reader-search-projection.mjs';

const { projectSection, projectionRevision, displayTitle } = await createReaderSearchProjection();
assert.match(projectionRevision, /^[a-f0-9]{64}$/);
assert.equal(displayTitle({ sectionNumber: '403.2', title: '§ 403.2 Concrete' }), '403.2 Concrete');
assert.equal(displayTitle({ sectionNumber: '403.2', title: 'Concrete' }), '403.2 Concrete');
assert.equal(displayTitle({ sectionNumber: 'A', title: 'Appendix A' }), 'Appendix A');
const project = (blocks, extra = {}) => projectSection({ id: 1, codePrefix: 'BC', blocks, ...extra });
const html = (value, extra = {}) => ({ kind: 'html', html: value, ...extra });
assert.deepEqual(project([html('<p>rein<strong>forced</strong> concrete &amp; masonry</p>')]), [
  { blockID: 'block-1', text: 'reinforced concrete & masonry' }
]);
assert.deepEqual(project([html('<ul><li>A <b>nested</b><ul><li>list</li></ul></li></ul>')]), [
  { blockID: 'block-1', text: 'A nestedlist' }
]);
assert.deepEqual(project([html('<table><tr><td>one</td><td>two</td></tr></table>', { tableID: 'tbl' })]), [
  { blockID: 'tbl', text: 'onetwo' }
]);
assert.deepEqual(project([html('<p class="rbox" id="ignored">outside</p><div class="Normal-Level" id="n">A <em>phrase</em></div><div class="Normal-Level" id="empty"> </div>')]), [
  { blockID: 'n', text: 'A phrase' }
]);
assert.deepEqual(project([html('<p class="rbox" id="r">A<br>B</p><p class="rbox" id="image"><img src="a"></p>')]), [
  { blockID: 'r', text: 'AB' }, { blockID: 'image', text: '' }
]);
assert.deepEqual(project([html('<b>HTML</b>', { id: ' x ', plainText: ' Authored\n text ' })]), [
  { blockID: 'x', text: 'Authored text' }
]);
assert.deepEqual(project([{ kind: 'image', imageID: 'img' }, html('<p> </p>')], { codePrefix: 'ZR' }), [
  { blockID: 'img', text: '' }
]);
assert.deepEqual(project([html('<p>unused</p>', { id: 'source', plainText: 'Preamble\n101.1 General. First requirement.\n101.2 Scope. Second requirement.' })], { codePrefix: 'ECC', sectionNumber: '101' }), [
  { blockID: 'source-preamble', text: 'Preamble' },
  { blockID: 'source-provision-1', text: '101.1 General. First requirement.' },
  { blockID: 'source-provision-2', text: '101.2 Scope. Second requirement.' }
]);
assert.deepEqual(project([html('<p>unused</p>', { plainText: '(A) General. Requirement.' })], { codePrefix: 'EC', sectionNumber: '101' }), [
  { blockID: 'specialty-1-provision-1', text: '(A) General. Requirement.' }
]);
const rawSpecialtySection = { id: 1, sectionNumber: '101', title: 'Scope', blocks: [html('<p>unused</p>', {
  id: 'source', plainText: '101.1 General. First requirement.\n101.2 Scope. Second requirement.'
})] };
assert.deepEqual(projectSection(rawSpecialtySection), [
  { blockID: 'source', text: '101.1 General. First requirement. 101.2 Scope. Second requirement.' }
], 'Missing section prefix intentionally preserves the unsplit legacy search block');
assert.deepEqual(projectSection({ ...rawSpecialtySection, codePrefix: 'ECC' }), [
  { blockID: 'source-provision-1', text: '101.1 General. First requirement.' },
  { blockID: 'source-provision-2', text: '101.2 Scope. Second requirement.' }
], 'An explicitly authored section prefix still enables specialty splitting');
assert.deepEqual(project([html('<Link hash: "#JD_403.2">403.<b>2</b></Link>')]), [
  { blockID: 'block-1', text: '403.2' }
]);
console.log('Reader search projection: formatting, list/table, paragraph IDs, specialty, zoning fixtures passed.');
