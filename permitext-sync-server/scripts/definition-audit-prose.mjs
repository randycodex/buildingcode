import {parse} from 'parse5';

// Mirror the Reader's definition-section boundary while retaining other prose
// from combined chapter files. Never exclude an entire file just because it
// also contains a definition source.
export function definitionAuditProse(html) {
  const excluded = new Set(['script', 'style', 'head', 'annotationdrawer', 'codeoptions']);
  let inDefinitions = false;
  const text = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join('');
  function walk(node) {
    if (excluded.has(node.tagName)) return '';
    if (/^h[1-6]$/.test(node.tagName || '')) {
      inDefinitions = /\bdefinitions[.:]?\s*$/i.test(text(node).trim());
      return '\n';
    }
    if (node.nodeName === '#text') return inDefinitions ? '' : node.value;
    return (node.childNodes || []).map(walk).join(['p', 'li', 'td', 'th', 'div', 'section'].includes(node.tagName) ? '\n' : '');
  }
  return walk(parse(html));
}
