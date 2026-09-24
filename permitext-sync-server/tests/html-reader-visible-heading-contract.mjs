import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the actual injected Reader resolver, not a rewritten approximation.
const source = await readFile(new URL('../../NYC CC APP/permitext/Views/ChapterHTMLWebView.swift', import.meta.url), 'utf8');
const start = source.indexOf('              function anchorIDForHeading(heading) {');
const end = source.indexOf('              function reportVisibleAnchor()', start);
assert.ok(start >= 0 && end > start);
const resolver = source.slice(start, end);
function heading(id, top, options = {}) {
  const { rendered = true, visibility = 'visible', width = 300, height = 26 } = options;
  return {
    id, parentElement: null, visibility,
    getClientRects: () => rendered ? [{}] : [],
    getBoundingClientRect: () => rendered ? { top, width, height } : { top: 0, width: 0, height: 0 },
    querySelector: () => null,
  };
}
function visible(headings, scrollY = 0, innerHeight = 800) {
  const context = vm.createContext({
    document: { querySelectorAll: () => headings },
    window: { scrollY, innerHeight, getComputedStyle: node => ({ visibility: node.visibility }) },
  });
  vm.runInContext(resolver, context);
  return vm.runInContext('visibleAnchorID()', context);
}
const first = heading('401.1', 80);
const second = heading('402.1', 500);
const lastHidden = heading('425.5.3', 0, { rendered: false });
assert.equal(visible([first, second]), '401.1');
assert.equal(visible([heading('401.1', -500), heading('402.1', 100)], 580), '402.1');
// When no upcoming rendered heading stops the scan, a hidden tail must not win.
assert.equal(visible([first, lastHidden]), '401.1');
assert.equal(visible([lastHidden, first]), '401.1');
assert.equal(visible([lastHidden]), null);
assert.equal(visible([first, heading('hidden', 0, { visibility: 'hidden' })]), '401.1');
assert.equal(visible([first, heading('collapsed', 0, { visibility: 'collapse' })]), '401.1');
assert.equal(visible([first, heading('zero-height', 0, { height: 0 })]), '401.1');
assert.equal(visible([first, heading('invalid', NaN)]), '401.1');
assert.equal(visible([first], 0, 0), null);
assert.equal(visible([]), null);
// Preserve the preexisting 18-point upcoming-heading tolerance.
assert.equal(visible([first, heading('402.1', 270)]), '402.1');
assert.equal(visible([first, heading('402.1', 275)]), '401.1');
// Long chapters stop at the first upcoming rendered heading. Do not measure
// or compute styles for the hundreds of later headings on every scroll event.
const untouchedTail = Array.from({ length: 1211 }, (_, index) => ({
  getClientRects() { throw new Error(`Unexpected geometry read in tail ${index}`); },
}));
assert.equal(visible([first, second, ...untouchedTail]), '401.1');
// Authored section IDs take precedence over heading-local IDs.
const authored = heading('heading-local', 80);
authored.parentElement = { tagName: 'SECTION', id: 'nyc-2014-41000958' };
assert.equal(visible([authored]), 'nyc-2014-41000958');
console.log('PASS: actual HTML Reader resolver ignores nonrendered/hidden/invalid geometry, preserves scrolling and authored IDs');
