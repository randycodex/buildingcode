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
    entries:book.terms.map(term => {
      const source=term.definition || term;
      return {id:definitionEntryID(`${book.bundle}|${book.codeSectionID}|${book.scope}`,term),
        term:term.term, text:source.text, resolution:term.resolution,
        referenceText:term.referenceText || null,
        source:{file:source.sourceFile,anchor:source.anchor,sectionNumber:source.sectionNumber,
          code:source.code || book.code,bundle:source.bundle || book.bundle}};
    }),
  }))};
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  const input=process.argv[2] || '/tmp/permitext-reader-definition-audit.json';
  const output=process.argv[3] || '/tmp/permitext-reader-definition-registry.json';
  const registry=compileDefinitionRegistry(JSON.parse(await readFile(input,'utf8')));
  await mkdir(path.dirname(output),{recursive:true});
  await writeFile(output,`${JSON.stringify(registry)}\n`);
  console.log(JSON.stringify({output,books:registry.books.length,entries:registry.books.reduce((n,b)=>n+b.entries.length,0)}));
}
