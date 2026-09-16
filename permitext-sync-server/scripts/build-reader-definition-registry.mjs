import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { definitionEntryID } from '../reader-definition-index.mjs';

// Build from an explicit audit snapshot; this never publishes or overwrites
// source HTML. Unresolved references remain references, not invented text.
export function compileDefinitionRegistry(audit) {
  return {schemaVersion:1, books:audit.books.map(book => ({
    bundle:book.bundle, code:book.code, codeSectionID:book.codeSectionID,
    scope:book.scope, definitionChapter:book.chapter, chapterID:book.chapterID,
    sourceSHA256:book.sourceSHA256,
    entries:[...new Map(book.terms.flatMap(term => (term.definitions || [term.definition || term]).map(source => {
      const chapterScope=source.text.match(/^(?:As used in|For) Chapter (\d+)(?: and Appendix ([A-Z]))?,/);
      const id=definitionEntryID(`${book.bundle}|${book.codeSectionID}|${book.scope}${term.definitions ? `|${source.sourceFile}|${source.sectionNumber}` : ''}`,term);
      return [id,{id,
        term:term.term, aliases:term.aliases || [], text:source.text, resolution:term.resolution, applicability:term.applicability || 'review-required',
        referenceText:term.referenceText || null,
        ...(chapterScope ? {applicableChapters:[chapterScope[1], ...(chapterScope[2] ? [chapterScope[2]] : [])]} : {}),
        source:{file:source.sourceFile,anchor:source.anchor,sectionNumber:source.sectionNumber,chapter:source.chapter || (term.definition ? null : book.chapter),
          code:source.code || book.code,bundle:source.bundle || book.bundle}}];
    }))).values()],
  }))};
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  const input=process.argv[2] || '/tmp/permitext-reader-definition-audit.json';
  const output=process.argv[3] || '/tmp/permitext-reader-definition-registry.json';
  const registry=compileDefinitionRegistry(JSON.parse(await readFile(input,'utf8')));
  await mkdir(path.dirname(output),{recursive:true});
  const serialized=`${JSON.stringify(registry)}\n`;
  await writeFile(output,serialized);
  if(process.argv.includes('--sync-ios')) {
    await writeFile(new URL('../../NYC CC APP/permitext/Resources/CodeContent/reader-definition-registry.json',import.meta.url),serialized);
  }
  console.log(JSON.stringify({output,books:registry.books.length,entries:registry.books.reduce((n,b)=>n+b.entries.length,0)}));
}
