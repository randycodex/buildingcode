import { searchWords } from './public/search-words.js';
import { normalizedSortedPostingList } from './search-postings.mjs';

// Legacy officialText postings omit some separately stored tables. Build the
// public-search projection from the same complete source text used to validate
// matches and generate snippets. This changes discovery, never enacted text.
export async function completeSearchTextIndex(catalog, sourceIndex, readText) {
  const postings = new Map([...sourceIndex].map(([word, ids]) => [word, new Set(ids)]));
  for (let start = 0; start < catalog.length; start += 16) {
    const sections = catalog.slice(start, start + 16);
    const texts = await Promise.all(sections.map(readText));
    sections.forEach((section, offset) => {
      for (const word of searchWords([section.sectionNumber, section.title, section.headingLine, texts[offset]].filter(Boolean).join(' '))) {
        if (word.length < 2) continue;
        if (!postings.has(word)) postings.set(word, new Set());
        postings.get(word).add(section.id);
      }
    });
  }
  return new Map([...postings].map(([word, ids]) => [word, normalizedSortedPostingList(ids)]));
}
