import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parse} from 'parse5';
import {definitionsForReader} from '../public/reader-definition-registry.js';
import {createDefinitionMatcher} from '../public/definition-matcher.js';
import {hmcGeneralSourceHashes, hmcGeneralSectionExclusions} from './definition-sources/bind-hmc-general-applicability.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const nodeText = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(nodeText).join('');
function descendants(node, tag, output = []) {
  if (node.tagName === tag) output.push(node);
  for (const child of node.childNodes || []) descendants(child, tag, output);
  return output;
}
const meanings = {
  Dwelling: {id: '89817273c7ae92933635', alias: 'dwellings', text: 'A dwelling is any building or structure or portion thereof which is occupied in whole or in part as the home, residence or sleeping place of one or more human beings.'},
  'Dwelling unit': {id: '7cb3a17fd6901e3446b7', alias: 'dwelling units', text: 'Dwelling unit shall mean any residential accommodation in a multiple dwelling or private dwelling.'},
};
const compoundPatterns = {
  multiple: /\b(?:(?:class\s+[ab]|covered|single\s+room\s+occupancy|sro)\s+)?multiple\s+dwellings?\b/gi,
  private: /\bprivate\s+dwellings?\b/gi,
  converted: /\bconverted\s+dwellings?\b/gi,
  covered: /\bcovered\s+dwelling(?:\s+units?|s)?\b/gi,
  sro: /\b(?:sro|single\s+room\s+occupancy)\s+dwelling\s+units?\b/gi,
  ancillary: /\bancillary\s+dwelling\s+units?\b/gi,
  unoccupied: /\bunoccupied\s+dwelling\s+units?\b/gi,
  adjective: /\bdwelling\s+purposes\b/gi,
  importedLaw: /\bmultiple\s+dwelling\s+law\b/gi,
};
// These are review flags, not activation decisions or legal classifications.
function hazards(paragraph, start, end) {
  return Object.entries(compoundPatterns).flatMap(([kind, pattern]) =>
    [...paragraph.matchAll(pattern)].filter(match => start >= match.index && end <= match.index + match[0].length)
      .map(match => ({kind, start: match.index, end: match.index + match[0].length, text: match[0]})));
}

// Only the returned hypothetical registry receives proposed metadata. Source and
// registry overrides allow negative tests; no product file is ever written.
export async function auditHMCDwelling({sources: overrides, registry: registryOverride} = {}) {
  const bytes = await readFile(new URL('../public/reader-definition-registry.json', import.meta.url));
  const registry = registryOverride ?? JSON.parse(bytes);
  const books = registry.books.filter(book => book.bundle === '2026-enacted-administrative-code' && book.chapterID === 30000077 && book.code === 'HOUSING MAINTENANCE CODE');
  if (books.length !== 1) throw Error('Dwelling source book identity changed');
  const book = books[0];
  const originals = Object.entries(meanings).map(([term, expected]) => {
    const entries = registry.books.flatMap(book => book.entries).filter(entry => entry.id === expected.id);
    const entry = entries[0];
    if (entries.length !== 1 || !book.entries.includes(entry) || entry.term !== term || entry.text !== expected.text || entry.source.file !== '2026-enacted-administrative-code/chapters/30000077.html' || entry.source.anchor !== 'section-31001849' || entry.source.sectionNumber !== '27-2004' || entry.source.bundle !== book.bundle || entry.source.code !== book.code) throw Error('Dwelling source identity or meaning changed: ' + term);
    if (entry.applicability !== 'review-required' || entry.aliases.length || Object.keys(entry).some(key => /^(applicable|excluded)/.test(key))) throw Error('Dwelling withheld metadata changed: ' + term);
    return entry;
  });
  const ids = new Set(originals.map(entry => entry.id));
  const hypothetical = {...registry, books: registry.books.map(b => b !== book ? b : {...b, entries: b.entries.map(entry => ids.has(entry.id) ? {...entry, aliases: [meanings[entry.term].alias], applicability: 'definition-chapter', applicableChapters: ['1','2','3','4','5'], ...hmcGeneralSectionExclusions()} : entry)})};
  const report = {status: 'Read-only preliminary candidates; semantic review unresolved; no activation', registrySHA256: digest(registryOverride ? JSON.stringify(registry) : bytes), offsetUnits: 'UTF-16 decoded paragraph; source ranges are UTF-16 HTML offsets', originals, sources: [], occurrences: [], counts: {}};
  for (const [chapter, expectedHash] of Object.entries(hmcGeneralSourceHashes)) {
    const file = `2026-enacted-administrative-code/chapters/${30000076 + Number(chapter)}.html`;
    const html = overrides?.[chapter] ?? await readFile(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/' + file, import.meta.url), 'utf8');
    if (digest(html) !== expectedHash) throw Error('Dwelling source changed: ' + chapter);
    report.sources.push({chapter, file, sha256: expectedHash});
    for (const sectionNode of descendants(parse(html, {sourceCodeLocationInfo: true}), 'section')) {
      const heading = nodeText(sectionNode.childNodes.find(node => node.tagName === 'h3') || {});
      const section = heading.match(/^27-\s*\d+(?:\.\d+)*/)?.[0].replace(/\s/g, '');
      const anchor = sectionNode.attrs.find(attribute => attribute.name === 'id')?.value;
      const matcher = createDefinitionMatcher(definitionsForReader(hypothetical, {bundle: book.bundle, codeSectionID: 5, chapterNumber: chapter, sectionNumber: section}), {sectionNumber: section});
      for (const [paragraphIndex, node] of descendants(sectionNode, 'p').entries()) {
        const text = nodeText(node), prospective = matcher(text);
        for (const [term, expected] of Object.entries(meanings)) {
          const pattern = new RegExp('(?<![\\w])(?:' + [expected.alias, term].map(label => label.replace(/ /g, '\\s+')).join('|') + ')(?![\\w])', 'gi');
          for (const match of text.matchAll(pattern)) {
            const start = match.index, end = start + match[0].length;
            report.occurrences.push({term, chapter, section, heading, anchor, paragraphIndex, paragraphSHA256: digest(text), sourceStart: node.sourceCodeLocation.startOffset, sourceEnd: node.sourceCodeLocation.endOffset, start, end, matchedText: match[0], text, hazards: hazards(text, start, end), prospectiveEntries: prospective.filter(range => range.start === start).flatMap(range => range.entries.map(entry => ({id: entry.id, term: entry.term}))), candidateEligible: prospective.some(range => range.start === start && range.end === end && range.entries.some(entry => entry.id === expected.id))});
          }
        }
      }
    }
  }
  for (const term of Object.keys(meanings)) {
    const rows = report.occurrences.filter(row => row.term === term), candidates = rows.filter(row => row.candidateEligible);
    report.counts[term] = {raw: rows.length, eligible: candidates.length, pluralEligible: candidates.filter(row => row.matchedText.toLowerCase() === meanings[term].alias).length};
  }
  report.candidateHazards = Object.fromEntries(Object.keys(compoundPatterns).map(kind => [kind, report.occurrences.filter(row => row.candidateEligible && row.hazards.some(hazard => hazard.kind === kind)).length]));
  return report;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await auditHMCDwelling();
  if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({status: report.status, registrySHA256: report.registrySHA256, counts: report.counts, candidateHazards: report.candidateHazards}, null, 2));
}
