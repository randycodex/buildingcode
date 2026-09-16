import {createHash} from 'node:crypto';
import {parse} from 'parse5';

const digest = value => createHash('sha256').update(value).digest('hex');
const text = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join('');
const walk = (node, visit) => { visit(node); for (const child of node.childNodes || []) walk(child, visit); };

// Only these reviewed referrals may traverse the Title 28 -> Title 24 bridge.
// Preserve the printed referral and the terminal source's actual identity.
export function bindStormwaterDefinitions(book, binding, sourceHTML, bridgeHTML) {
  const bridge = binding.bridges.find(item => item.bundle === book.bundle);
  if (!bridge || !binding.targetCodes.includes(book.code) || book.scope !== binding.targetScope) return book.terms;
  if (digest(sourceHTML) !== binding.sourceSHA256 || digest(bridgeHTML) !== bridge.sha256)
    throw Error('Stormwater source changed; source review required');
  let section;
  walk(parse(sourceHTML), node => {
    if (node.attrs?.some(attr => attr.name === 'id' && attr.value === binding.sourceAnchor)) section = node;
  });
  if (!section) throw Error('Stormwater terminal section missing');
  const bridgeText = text(parse(bridgeHTML)).replace(/\s+/g, ' ');
  if (!bridgeText.includes('shall have the same definitions as such terms are defined in subchapter 1 of chapter 5-A of title 24'))
    throw Error('Stormwater reference bridge missing');
  const definitions = binding.definitions.map(definition => {
    const expected = `${definition.sourceTerm}. ${definition.text}`;
    const matches = (section.childNodes || []).filter(node => node.tagName === 'p' && text(node) === expected);
    if (matches.length !== 1) throw Error(`Stormwater definition requires review: ${definition.term}`);
    return {...definition, key:definition.term.toLowerCase(), referenceOnly:false,
      sourceFile:binding.sourceFile, sourceBundle:binding.sourceBundle, code:binding.sourceCode,
      chapter:binding.sourceChapter, anchor:binding.sourceAnchor, sectionNumber:binding.sourceSection,
      publication:binding.publication};
  });
  return book.terms.map(term => {
    if (term.resolution !== 'unresolved-reference' || !term.referenceOnly ||
        !/^See Section 28-104\.11\.1 of the Administrative Code\s*\./.test(term.text)) return term;
    const definition = definitions.find(candidate => candidate.term === term.term);
    return definition ? {...term, definition, referenceText:term.text, resolution:'resolved-reference'} : term;
  });
}
