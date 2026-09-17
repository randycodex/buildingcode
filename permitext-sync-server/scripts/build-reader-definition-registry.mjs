import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { definitionEntryID } from '../reader-definition-index.mjs';

// 2022 BC 201.2 expressly makes singular and plural interchangeable. Keep
// reviewed forms explicit: no stemming, qualifier removal, or cross-edition aliases.
const reviewed2022BuildingPlurals = new Map(Object.entries({
  BUILDING:'BUILDINGS', STRUCTURE:'STRUCTURES', STORY:'STORIES',
  'DWELLING UNIT':'DWELLING UNITS', AISLE:'AISLES', CORRIDOR:'CORRIDORS',
  STAIR:'STAIRS', STAIRWAY:'STAIRWAYS', EXIT:'EXITS', DWELLING:'DWELLINGS',
}));
function compiledAliases(book, term) {
  const aliases = [...(term.aliases || [])];
  if (book.bundle !== '2022-construction-codes' || book.code !== 'BUILDING CODE'
      || book.scope !== 'general') return aliases;
  const plural = reviewed2022BuildingPlurals.get(term.term.toUpperCase());
  // An authored label always wins over a generated grammatical form.
  if (plural && !book.terms.some(other => other !== term &&
      [other.term, ...(other.aliases || [])].some(label => label.toUpperCase() === plural))
      && !aliases.some(label => label.toUpperCase() === plural)) aliases.push(plural);
  return aliases;
}

// Build from an explicit audit snapshot; this never publishes or overwrites
// source HTML. Unresolved references remain references, not invented text.
export function compileDefinitionRegistry(audit) {
  return {schemaVersion:1, books:audit.books.map(book => ({
    bundle:book.bundle, code:book.code, codeSectionID:book.codeSectionID,
    scope:book.scope, definitionChapter:book.chapter, chapterID:book.chapterID,
    excludeWholeChapter:book.excludeWholeChapter !== false,
    sourceSHA256:book.sourceSHA256,
    entries:[...new Map(book.terms.flatMap(term => (term.definitions || [term.definition || term]).map(source => {
      const chapterScope=source.text.match(/^(?:As used in|For) Chapter (\d+)(?: and Appendix ([A-Z]))?,/);
      const id=definitionEntryID(`${book.bundle}|${book.codeSectionID}|${book.scope}${term.definitions ? `|${source.sourceFile}|${source.sectionNumber}|${source.key}` : ''}`,term);
      return [id,{id,
        term:term.term, aliases:compiledAliases(book, term), text:source.text, resolution:term.resolution, applicability:term.applicability || 'review-required',
        referenceText:term.referenceText || null,
        ...(term.inventorySource ? {inventorySource:term.inventorySource} : {}),
        ...(term.requiresItalic ? {requiresItalic:true} : {}),
        ...(term.sourceApplicability ? {sourceApplicability:term.sourceApplicability} : {}),
        ...(term.applicableExactSections ? {applicableExactSections:term.applicableExactSections} : {}),
        ...(term.applicableSections ? {applicableSections:term.applicableSections} : {}),
        ...(term.excludedSections ? {excludedSections:term.excludedSections} : {}),
        ...(term.excludedExactSections ? {excludedExactSections:term.excludedExactSections} : {}),
        ...(term.excludedOccurrences ? {excludedOccurrences:term.excludedOccurrences} : {}),
        ...(term.applicableChapters ? {applicableChapters:term.applicableChapters}
          : chapterScope ? {applicableChapters:[chapterScope[1], ...(chapterScope[2] ? [chapterScope[2]] : [])]} : {}),
        source:{...(term.definitions ? {term:source.term} : {}),file:source.sourceFile,anchor:source.anchor,sectionNumber:source.sectionNumber,chapter:source.chapter || (term.definition ? null : book.chapter),
          code:source.code || book.code,bundle:source.sourceBundle || source.bundle || book.bundle, ...(source.publication ? {publication:source.publication} : {})}}];
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
