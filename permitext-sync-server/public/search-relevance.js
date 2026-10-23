import { searchWords, searchWordPattern } from './search-words.js?v=20261023-downloaded-library-v1295';

const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalized = value => searchWords(value).map(word => word.replace(/(?<!s)s$/, '')).join(' ');
export function prepareSearchRelevance(query) {
  const words = searchWords(query);
  return {raw: String(query).trim().toLowerCase(), words, patterns: words.map(searchWordPattern),
    needle: words.map(word => word.replace(/(?<!s)s$/, '')).join(' ')};
}
function preparedWordsMatch(values, prepared) {
  const text = (Array.isArray(values) ? values : [values]).filter(Boolean).join(' ');
  return prepared.patterns.length > 0 && prepared.patterns.every(pattern => pattern.test(text));
}
export function searchHeading(value, number = '') {
  let title = String(value || '').trim();
  if (number) title = title.replace(new RegExp(`^(?:SECTION\\s+)?(?:[A-Z]+\\s+)?${escape(String(number))}(?:[.:]\\s*|\\s+)`, 'i'), '');
  return title.replace(/[.:]+$/, '').trim();
}
export function isSearchDefinitionSection(section) {
  return /\bdefinitions?\b/i.test(`${section.title || ''} ${section.headingLine || ''}`);
}
export function matchingSearchDefinition(section, query, plainText = section.plainText || '', prepared = null) {
  if (!isSearchDefinitionSection(section)) return '';
  const needle = prepared?.needle ?? normalized(query);
  for (const match of String(plainText).matchAll(/(?:^|[.?!]\s+|\n)\s*[“"]?([A-Z][A-Z\d ()/,‐‑–—-]{1,100}?)[”"]?\s*\.\s+/g)) {
    const term = match[1].trim();
    if (!term) continue;
    const heading = normalized(term);
    if (heading === needle || (/^[a-z]{4,}$/i.test(query) && !heading.includes(' ') && heading.startsWith(needle))) return term;
  }
  return '';
}
// Ranking changes discovery order only. Matching and canonical source identities
// still come from the corpus and the existing exact/all-words checks.
export function searchRelevanceRank(section, query, matchMode = 'exact', plainText = section.plainText || '', prepared = null) {
  const number = String(section.sectionNumber || '').toLowerCase();
  const raw = prepared?.raw ?? String(query).trim().toLowerCase();
  if (number === raw) return 0;
  if (/^[a-z]?\d/i.test(raw) && number.startsWith(raw)) return 0.5;
  prepared ||= prepareSearchRelevance(query);
  const {words, needle, patterns} = prepared;
  const title = searchHeading(section.title, section.sectionNumber);
  const context = searchHeading(section.headingLine);
  const concise = title.length <= 120 && searchWords(title).length <= 16;
  const depth = (number.match(/\./g) || []).length;
  if (concise && normalized(context) === needle && preparedWordsMatch(title, prepared)) return 1 + Math.min(depth, 8) * 0.03;
  if (matchingSearchDefinition(section, query, plainText, prepared)) return 1.05;
  if (concise && normalized(title) === needle) return 1.3 + depth * 0.02;
  if (concise && preparedWordsMatch([title, context], prepared)) {
    const overlap = patterns.filter(pattern => pattern.test(title)).length / Math.max(1, words.length);
    return 2 - overlap * 0.4 + Math.min(depth, 8) * 0.03;
  }
  if (concise && (matchMode === 'words' ? preparedWordsMatch(title, prepared) : title.toLowerCase().includes(raw))) return 2.2;
  const overlap = concise ? patterns.filter(pattern => pattern.test(title)).length / Math.max(1, words.length) : 0;
  return 4 - overlap + Math.min(depth, 8) * 0.12;
}

// Share the initial preview budget across codebooks instead of multiplying it
// by every matching edition. Keep at least one result in each source.
export const initialSearchGroupLimit = (sourceCount, limit = 25) => Math.min(limit,
  sourceCount === 1 ? 12 : Math.min(8, Math.max(1, Math.floor(limit / Math.max(1, sourceCount)))));

export function searchVocabulary(sections) {
  const terms = new Set();
  for (const section of sections) for (const word of searchWords(`${section.title || ''} ${section.headingLine || ''}`)) {
    if (/^[a-z]{3,24}$/.test(word)) terms.add(word);
  }
  return terms;
}
function distance(left, right) {
  let previous = Array.from({length: right.length + 1}, (_, i) => i);
  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    for (let j = 1; j <= right.length; j++) current[j] = Math.min(current[j-1] + 1, previous[j] + 1, previous[j-1] + (left[i-1] === right[j-1] ? 0 : 1));
    previous = current;
  }
  return previous[right.length];
}
export function searchSpellingSuggestions(query, vocabulary) {
  const words = searchWords(query);
  // Do not rewrite identifiers, known words, or working word completions.
  if (words.some(word => /\d/.test(word))) return [];
  const unknown = words.filter(word => /^[a-z]{4,24}$/.test(word) && ![...vocabulary].some(term => term.startsWith(word)));
  if (unknown.length !== 1) return [];
  const word = unknown[0];
  const maximum = word.length >= 8 ? 2 : 1;
  const candidates = [...vocabulary].filter(term => term[0] === word[0] && Math.abs(term.length - word.length) <= maximum)
    .map(term => ({term, distance: distance(word, term)})).filter(item => item.distance <= maximum)
    .sort((a,b) => a.distance - b.distance || a.term.localeCompare(b.term));
  if (!candidates.length) return [];
  return candidates.filter(item => item.distance === candidates[0].distance).slice(0, 3)
    .map(({term}) => String(query).replace(new RegExp(`\\b${escape(word)}\\b`, 'i'), term));
}
