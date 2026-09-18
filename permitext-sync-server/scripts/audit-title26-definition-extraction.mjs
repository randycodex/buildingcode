import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parse, serialize} from 'parse5';
import {auditTitle26DefinitionSources} from './audit-title26-definition-sources.mjs';
import {extractDefinitionEntries} from '../reader-definition-index.mjs';

const base = new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/', import.meta.url);
const sha = value => createHash('sha256').update(value).digest('hex');
const text = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join('');
const clean = value => value.replace(/\s+/g, ' ').trim();
const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
const visit = (node, fn) => { fn(node); for (const child of node.childNodes || []) visit(child, fn); };

// Audit-only lexical candidates. No consumer imports this inventory into the
// registry. Source paragraphs remain intact, including continuations and caveats.
export function inspectTitle26Section(section) {
  const paragraphs = [];
  visit(section, node => { if (node.tagName === 'p') paragraphs.push(clean(text(node))); });
  const labels = [];
  for (const [index, value] of paragraphs.entries()) {
    const labelled = value.match(/^(?:\([a-z0-9]+\)|[a-z](?:-\d+)?\.)?\s*[“"]([^”"]+)[”"](?:\s+or\s+[“"]([^”"]+)[”"])?\s*(.*)$/i);
    const sentence = value.match(/^([^.!?]{1,100})\.\s+The term\s+(?:[“"][^”"]+[”"]|[^.]+?)\s+(?:means|shall mean|shall have|has|includes)\b/i);
    const inline = value.match(/^(?:(?:[a-z]\.\s*)?(?:Definitions\.\s*)?(?:As used in|For (?:the )?purposes of)[\s\S]*?,?\s*)the term [“"]([^”"]+)[”"]\s+(?:means|shall mean|has)\b/i);
    const match = labelled || sentence || inline;
    if (match) labels.push({term: match[1].replace(/\.$/, ''), aliases: labelled?.[2] ? [labelled[2]] : [], paragraphIndex: index,
      format: labelled ? 'quoted' : sentence ? 'sentence-label' : 'inline-scope'});
  }
  const scopeDeclarations = paragraphs.filter(p => /(?:As used in|For (?:the )?purposes of|Unless otherwise indicated|Whenever used in)/i.test(p));
  const candidates = labels.map((label, i) => {
    const end = labels[i + 1]?.paragraphIndex ?? paragraphs.length;
    const group = paragraphs.slice(label.paragraphIndex, end);
    // Do not silently absorb a later operative subdivision or history note.
    const boundary = group.findIndex((p, j) => j > 0 && (/^\((?:L\.L\.|\d{4} N\.Y\.)/.test(p) || /^[b-z]\.\s*[^“"]/.test(p)));
    const sourceParagraphs = boundary < 0 ? group : group.slice(0, boundary);
    return {...label, untrimmedParagraphGroup:group, excludedBoundaryParagraphs:boundary < 0 ? [] : group.slice(boundary), sourceParagraphs, sourceText: sourceParagraphs.join('\n\n'),
      sourceTextSHA256: sha(sourceParagraphs.join('\n\n')),
      boundary: boundary < 0 ? 'next label or section end' : 'operative subdivision or legislative history',
      caveats: [ /has (?:the|a|same)|as defined|meaning ascribed/i.test(sourceParagraphs.join(' ')) ? 'cross-reference requires resolution' : null,
        /except|provided|shall not|does not/i.test(sourceParagraphs.join(' ')) ? 'qualifications retained' : null,
        'Applicability and effective dates not accepted by extraction audit'].filter(Boolean)};
  });
  const parserEntries = extractDefinitionEntries(serialize(section), {definitionSectionOnly:true, quotedLegalLabels:true});
  for (const candidate of candidates) {
    candidate.existingParserEntries = parserEntries.filter(entry => entry.term.toLowerCase() === candidate.term.toLowerCase());
    candidate.parserStatus = candidate.existingParserEntries.length === 1 ? 'parser label matched; body requires review' : 'additional parser or reviewed source adapter required';
  }
  const owned = new Set(candidates.flatMap(c => c.sourceParagraphs));
  return {paragraphs, scopeDeclarations, candidates, parserEntries,
    unclassifiedParagraphs: paragraphs.map((value,index) => ({index,value})).filter(p => !owned.has(p.value)),
    status:'Candidate extraction only; no activation or legal scope acceptance'};
}

export async function auditTitle26DefinitionExtraction() {
  const discovery = await auditTitle26DefinitionSources();
  const chapters = [];
  for (const chapter of discovery.chapters) {
    const html = await readFile(new URL(chapter.file, base), 'utf8');
    const nodes = new Map();
    visit(parse(html), node => { if(node.tagName === 'section') nodes.set(attr(node,'id'),node); });
    const sections = chapter.candidates.map(candidate => {
      const node = nodes.get(candidate.anchor);
      if (!node) throw Error(`Missing discovered source ${chapter.file}#${candidate.anchor}`);
      return {...candidate, ...inspectTitle26Section(node), sourceSectionSHA256:sha(serialize(node))};
    });
    chapters.push({...chapter, sections});
  }
  const candidates = chapters.flatMap(c => c.sections.flatMap(s => s.candidates));
  return {status:'Audit only; discovery is not exhaustive and candidates are not activated',
    bundleSHA256:discovery.bundleSHA256, chapterCount:chapters.length, sectionCount:chapters.reduce((n,c)=>n+c.sections.length,0),
    candidateCount:candidates.length, parserLabelMatches:candidates.filter(c=>c.existingParserEntries.length===1).length, chapters};
}
if(process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await auditTitle26DefinitionExtraction();
  if(process.argv[2]) await writeFile(process.argv[2], JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,chapterCount:report.chapterCount,sectionCount:report.sectionCount,candidateCount:report.candidateCount,parserLabelMatches:report.parserLabelMatches},null,2));
}
