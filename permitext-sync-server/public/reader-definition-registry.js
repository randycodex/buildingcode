import { definitionAppliesToSection } from './definition-matcher.js?v=20260916-definitions-v67';
// The registry is shared with iOS. Selection is explicit: no default edition or
// similarly named code is allowed when a reader's source identity is missing.
export function definitionBundleID(codeVersion) {
  return String(codeVersion || '').match(/(?:^|\/)new-york-city\/([^/#]+)\/bundle\.json(?:#\d+)?$/)?.[1] || '';
}

export function definitionSourceIdentity(entry) {
  if (!entry.source?.file) return null;
  const s=entry.source;
  return JSON.stringify([entry.term,entry.text,[...(entry.aliases||[])].sort(),s.file,s.anchor,s.sectionNumber,s.chapter,s.code,s.bundle,s.term]);
}

export function definitionsForReader(registry, {bundle, codeSectionID, chapterNumber, sectionNumber, includeSectionScoped = false}) {
  if (!bundle || codeSectionID == null || chapterNumber == null) return [];
  const chapter = String(chapterNumber).toUpperCase();
  if (registry.books.some(book => book.excludeWholeChapter !== false && book.bundle === bundle && String(book.codeSectionID) === String(codeSectionID)
    && String(book.definitionChapter).toUpperCase() === chapter)) return [];
  const selected = registry.books.filter(book => book.bundle === bundle && String(book.codeSectionID) === String(codeSectionID)
    && (book.scope === 'general' || book.scope === chapter[0]
      || book.scope === `appendix-${chapter[0]}`))
    .flatMap(book => book.entries.filter(entry => entry.applicability === 'definition-chapter'
      && (!entry.applicableChapters || entry.applicableChapters.includes(chapter))
      && (includeSectionScoped || definitionAppliesToSection(entry,sectionNumber))));
  const seen = new Set();
  return selected.filter(entry => {
    const identity=definitionSourceIdentity(entry);
    if (!identity) return true;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}
