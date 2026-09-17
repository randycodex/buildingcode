import {createHash} from 'node:crypto';
import {extractDefinitionEntries} from '../../reader-definition-index.mjs';

export function bindEarthquakeDefinition(book, binding, html) {
  if (book.bundle !== binding.bundle || book.code !== binding.code || book.scope !== binding.scope) return book.terms;
  const targets = book.terms.filter(term => term.term === binding.term);
  if (targets.length !== 1 || targets[0].text !== binding.originalReference)
    throw Error('Earthquake definition referral changed; review required');
  if (createHash('sha256').update(html).digest('hex') !== binding.sourceSHA256)
    throw Error('Earthquake definition source changed; review required');
  const entries = extractDefinitionEntries(html);
  const sources = binding.sourceTerms.map(label => {
    const matches = entries.filter(e => e.term === label && e.sectionNumber === binding.sectionNumber && !e.referenceOnly);
    if (matches.length !== 1) throw Error(`Earthquake definition boundary changed: ${label}`);
    return matches[0];
  });
  // The introductory meaning explicitly depends on the following two meanings.
  const text = sources[0].text + '\n\n' + sources.slice(1).map(e => `${e.term}. ${e.text}`).join('\n\n');
  return book.terms.map(term => term !== targets[0] ? term : {...term,
    aliases:[...(term.aliases || []), sources[0].term], applicableSections:binding.applicableSections,
    resolution:'resolved-reference', referenceText:term.text,
    definition:{...sources[0], text, bundle:book.bundle, code:book.code, chapter:binding.chapter,
      sourceFile:binding.sourceFile, publication:binding.publication}});
}

// These already-resolved meanings inherit their source introduction's scope.
// Never infer the scope merely from a similarly numbered source in another code.
export function bindSeismicDefinitionScopes(book, binding, html) {
  if (book.bundle !== binding.bundle || book.code !== binding.code || book.scope !== binding.scope) return book.terms;
  if (createHash('sha256').update(html).digest('hex') !== binding.sourceSHA256)
    throw Error('Seismic definition scope source changed; review required');
  if (!html.includes('The following words and terms shall, for the purposes of this section, have the meanings shown herein.'))
    throw Error('Seismic definition scope introduction changed; review required');
  const targets = book.terms.filter(term => term.definition?.sourceFile === binding.sourceFile && term.definition?.sectionNumber === binding.sectionNumber);
  if (targets.length !== binding.terms.length || binding.terms.some(label => targets.filter(term => term.term === label && term.resolution === 'resolved-reference').length !== 1))
    throw Error('Seismic definition scope targets changed; review required');
  return book.terms.map(term => targets.includes(term) ? {...term, applicableSections: [...binding.applicableSections]} : term);
}
