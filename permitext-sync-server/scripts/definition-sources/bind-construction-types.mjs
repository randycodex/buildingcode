import {createHash} from 'node:crypto';
import {parse} from 'parse5';

const text = node => node.nodeName === '#text' ? node.value : node.tagName === 'br' ? '\n' : (node.childNodes || []).map(text).join('');
const walk = (node, visit) => { visit(node); for (const child of node.childNodes || []) walk(child, visit); };

export function bindConstructionTypes(book, binding, html) {
  if (book.bundle !== binding.bundle || book.code !== binding.code || book.scope !== binding.scope) return book.terms;
  const targets = book.terms.filter(term => term.term === binding.term);
  if (targets.length !== 1 || targets[0].text !== binding.originalReference)
    throw Error('Construction type reference changed; review required');
  if (createHash('sha256').update(html).digest('hex') !== binding.sourceSHA256)
    throw Error('Construction type source changed; review required');
  const document = parse(html);
  const definitions = binding.sections.map(source => {
    const sections = [];
    walk(document, node => {
      if (node.tagName === 'section' && node.attrs?.some(attr => attr.name === 'id' && attr.value === source.anchor)) sections.push(node);
    });
    const section = sections[0];
    const heading = section?.childNodes.find(node => node.tagName === 'h3');
    const paragraph = section?.childNodes.find(node => node.tagName === 'p');
    if (sections.length !== 1 || !heading || !paragraph || text(heading) !== `BC ${source.sectionNumber} ${source.heading}`)
      throw Error(`Construction type boundary changed: ${source.sectionNumber}`);
    return {term:source.heading.replace(/\.$/,''), key:source.heading.toLowerCase(), text:text(paragraph).trim(),
      referenceOnly:false, sectionNumber:source.sectionNumber, anchor:source.anchor,
      sourceFile:binding.sourceFile, bundle:book.bundle, code:book.code, chapter:binding.chapter,
      publication:binding.publication};
  });
  return book.terms.map(term => term !== targets[0] ? term : {...term, resolution:'multiple-definitions', definitions, referenceText:term.text});
}
