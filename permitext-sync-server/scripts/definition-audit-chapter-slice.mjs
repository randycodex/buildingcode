import {parse} from 'parse5';

// Shared appendix files must be bounded by published chapter headings. A missing
// or duplicate heading is an unmapped chapter, never permission to count all.
export function sharedChapterSlice(html, chapterNumber) {
  const headings = [];
  const text = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join('');
  function visit(node) {
    if (/^h[1-6]$/.test(node.tagName || '')) {
      const match = text(node).trim().match(/^(Appendix|Chapter)\s+([A-Z]+\d*)\s*:/i);
      if (match) headings.push({kind: match[1].toLowerCase(), number: match[2].toUpperCase(), offset: node.sourceCodeLocation.startOffset});
    }
    for (const child of node.childNodes || []) visit(child);
  }
  visit(parse(html, {sourceCodeLocationInfo: true}));
  const number = String(chapterNumber).toUpperCase();
  const kind = /\d/.test(number) ? 'chapter' : 'appendix';
  const peers = headings.filter(h => h.kind === kind);
  const matches = peers.filter(h => h.number === number);
  if (matches.length !== 1) return null;
  const index = peers.indexOf(matches[0]);
  return html.slice(matches[0].offset, peers[index + 1]?.offset ?? html.length);
}
