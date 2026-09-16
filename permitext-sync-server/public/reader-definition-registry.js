// The registry is shared with iOS. Selection is explicit: no default edition or
// similarly named code is allowed when a reader's source identity is missing.
export function definitionBundleID(codeVersion) {
  return String(codeVersion || '').match(/(?:^|\/)new-york-city\/([^/#]+)\/bundle\.json(?:#\d+)?$/)?.[1] || '';
}

export function definitionsForReader(registry, {bundle, codeSectionID, chapterNumber}) {
  if (!bundle || codeSectionID == null || chapterNumber == null) return [];
  const chapter = String(chapterNumber).toUpperCase();
  if (registry.books.some(book => book.bundle === bundle && String(book.codeSectionID) === String(codeSectionID)
    && String(book.definitionChapter).toUpperCase() === chapter)) return [];
  return registry.books.filter(book => book.bundle === bundle && String(book.codeSectionID) === String(codeSectionID)
    && (book.scope === 'general' || book.scope === chapter[0]
      || book.scope === `appendix-${chapter[0]}`))
    .flatMap(book => book.entries.filter(entry => entry.applicability === 'definition-chapter'));
}
