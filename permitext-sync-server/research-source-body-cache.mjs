// Only immutable, versioned public source bodies; never project or answer data.
export function createResearchSourceBodyReader(read, { maximumEntries = 256 } = {}) {
  const entries = new Map();
  return async section => {
    if (!section?.codeVersion || !section?.corpusID) return read(section);
    const key = JSON.stringify([section.corpusID, section.codeVersion, section.codeEdition,
      section.id ?? section.sectionID, section.webSectionID, section.title]);
    let task = entries.get(key);
    if (task) { entries.delete(key); entries.set(key, task); }
    else {
      task = Promise.resolve().then(() => read(section)).catch(error => {
        if (entries.get(key) === task) entries.delete(key);
        throw error;
      });
      entries.set(key, task);
      while (entries.size > maximumEntries) entries.delete(entries.keys().next().value);
    }
    // Assembly helpers may annotate a body. Each caller receives its own copy.
    return structuredClone(await task);
  };
}
