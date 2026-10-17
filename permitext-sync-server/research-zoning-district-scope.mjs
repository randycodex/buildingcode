import { createResearchCorpusRegistry } from './research-corpus-registry.mjs';
import { researchPositiveSearchText } from './research-search-vocabulary.mjs';

const zoning = createResearchCorpusRegistry({ zoningResearchEligibility: true })
  .find(corpus => corpus.id === 'nyc-zoning-resolution');
const compact = value => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

// A supplied district name nominates its published chapter's qualifications.
// It does not prove a boundary, select a subarea, or establish permitted uses.
// No district-to-section-number list: the authorized catalog owns that link.
export function nominateZoningDistrictScope({ question, scopeText, catalog = [], restricted = false } = {}) {
  if (restricted || !/\b(?:use groups?|(?:permitted|allowed|allowable) uses?|use (?:regulations|allowances|classification))\b/i.test(question || '')) return [];
  const positive = compact(researchPositiveSearchText(scopeText));
  const groups = new Map();
  for (const section of catalog) {
    if (!String(section.id || '') || !String(section.chapterNumber || '') || section.codePrefix !== 'ZR' || !['corpusID', 'codeVersion', 'codeEdition', 'jurisdiction'].every(field =>
      String(section[field] || '') === String(field === 'corpusID' ? zoning.id : zoning[field]))) continue;
    const labels = `${section.headingLine || ''}\n${section.chapterTitle || ''}`;
    const district = labels.match(/\b(Special\s+[^\n—()]+?\s+District)\b/i)?.[1];
    if (!district || !positive.includes(compact(district))) continue;
    const title = compact(section.title);
    const kind = /^(?:general provisions|general regulations|scope|applicability)\b/.test(title) ? 'general'
      : /^(?:special\s+)?use (?:regulations|provisions)\b/.test(title) ? 'use' : null;
    if (!kind) continue;
    const key = JSON.stringify([section.corpusID, section.codeVersion, section.codeEdition, section.chapterNumber]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ section, kind, district });
  }
  return [...groups.values()].flatMap(group => ['general', 'use'].flatMap(kind =>
    group.filter(item => item.kind === kind).slice(0, 1))).slice(0, 4);
}
