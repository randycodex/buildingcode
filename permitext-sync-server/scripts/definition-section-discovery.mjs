import {parse} from 'parse5';

// Locate explicit source headings, not occurrences of the word in prose.
// Discovery does not infer the legal scope or make any term eligible for links.
export function discoverDefinitionSections(html) {
  const result = [];
  const text = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join('');
  const attribute = (node, name) => node.attrs?.find(a => a.name === name)?.value;
  function walk(node, anchor = '') {
    const currentAnchor = attribute(node, 'id') || anchor;
    if (/^h[1-6]$/.test(node.tagName || '')) {
      const heading = text(node).replace(/\s+/g, ' ').trim();
      if (/\b(?:definitions|defined terms)\b/i.test(heading)) {
        result.push({heading, anchor: currentAnchor});
      }
    }
    for (const child of node.childNodes || []) walk(child, currentAnchor);
  }
  walk(parse(html));
  return result;
}
