import {createHash} from 'node:crypto';
import {extractDefinitionEntries} from '../../reader-definition-index.mjs';

export async function bindCitationMismatches(book, bindings, readSource) {
  let terms = book.terms;
  for (const binding of bindings.filter(item => item.bundle === book.bundle && item.code === book.code && item.scope === book.scope)) {
    const targets = terms.filter(term => term.term === binding.term);
    if (targets.length !== 1 || targets[0].text !== binding.originalReference)
      throw Error(`Printed definition referral changed: ${binding.term}`);
    if (targets[0].resolution !== 'unresolved-reference') continue;
    for (const context of binding.contextSources || []) {
      const source = await readSource(context.file);
      if (createHash('sha256').update(source).digest('hex') !== context.sha256)
        throw Error(`Definition referral context changed: ${binding.term}`);
    }
    const html = await readSource(binding.sourceFile);
    if (createHash('sha256').update(html).digest('hex') !== binding.sourceSHA256)
      throw Error(`Definition mismatch source changed: ${binding.term}`);
    const definitions = extractDefinitionEntries(html).filter(entry => entry.term === (binding.sourceTerm || binding.term) &&
      entry.sectionNumber === binding.sectionNumber && !entry.referenceOnly);
    if (definitions.length !== 1) throw Error(`Exact definition target missing: ${binding.term}`);
    terms = terms.map(term => term !== targets[0] ? term : {...term,
      resolution:'resolved-reference', referenceText:term.text,
      ...(binding.applicableChapters ? {applicableChapters:binding.applicableChapters} : {}),
      ...(binding.applicableSections ? {applicableSections:binding.applicableSections} : {}),
      definition:{...definitions[0], bundle:book.bundle, sourceBundle:binding.sourceBundle || book.bundle, code:binding.sourceCode || book.code, chapter:binding.chapter,
        sourceFile:binding.sourceFile, publication:binding.publication}});
  }
  return terms;
}
