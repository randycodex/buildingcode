// Workspace-owned navigation state. Notes and their content use the existing
// versioned Notebook API. These records only remember a destination and place.
export function normalizeNoteResearch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const text = (value, limit) => typeof value === 'string' ? value.slice(0, limit) : '';
  return Object.fromEntries(Object.entries(value).slice(-100).flatMap(([projectID, context]) => {
    if (!projectID || !context?.selected?.id) return [];
    const resumes = Object.fromEntries(Object.entries(context.resumes || {}).slice(-100).flatMap(([id, resume]) => {
      if (!id || !resume) return [];
      if (resume.kind === 'conversation' && typeof resume.conversationID === 'string') {
        return [[id, {kind:'conversation', conversationID:text(resume.conversationID,256)}]];
      }
      if (resume.kind !== 'reader' || !resume.source?.sectionID) return [];
      const source = Object.fromEntries(['sectionID','codeVersion','codePrefix','chapterID','chapterNumber','sectionNumber','title','blockID',
        'sourceID','sectionTitle','codeEdition','sourceLibraryVersion'].filter(key => typeof resume.source[key] === 'string')
        .map(key => [key,text(resume.source[key],1000)]));
      return [[id, {kind:'reader',source,exact:text(resume.exact,2000)}]];
    }));
    return [[projectID, {selected:{id:text(context.selected.id,256),title:text(context.selected.title,300)},resumes}]];
  }));
}
