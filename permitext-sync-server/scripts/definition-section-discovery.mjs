import {parse} from 'parse5';

// Locate explicit headings and inline scope declarations; ordinary references
// to definitions elsewhere are not definition-source declarations.
// Discovery does not infer the legal scope or make any term eligible for links.
export function discoverDefinitionSections(html) {
  const result = [];
  let sectionHeading = "";
  const text = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join('');
  const attribute = (node, name) => node.attrs?.find(a => a.name === name)?.value;
  function walk(node, anchor = '') {
    const currentAnchor = attribute(node, 'id') || anchor;
    if (/^h[1-6]$/.test(node.tagName || '')) {
      const heading = text(node).replace(/\s+/g, ' ').trim();
      sectionHeading = heading;
      if (/\b(?:definitions|defined terms)\b/i.test(heading)) {
        result.push({heading, anchor: currentAnchor});
      }
    }
    if (node.tagName === 'p') {
      const prose = text(node).replace(/\s+/g, ' ').trim();
      const declaration = /^(?:[a-z]\.|\([a-z]\))?\s*(?:Definitions\.\s*)?(?:As used in|For (?:the )?purposes of|Whenever used in)\b/i.test(prose)
        || /(?:^|\.\s+)The term [“"][^”"]+[”"] (?:shall )?means?\b/i.test(prose);
      if (declaration && !result.some(item => item.anchor === currentAnchor)) {
        result.push({heading:`${sectionHeading} — ${prose.slice(0,180)}`, anchor:currentAnchor});
      }
    }
    for (const child of node.childNodes || []) walk(child, currentAnchor);
  }
  walk(parse(html));
  return result;
}
