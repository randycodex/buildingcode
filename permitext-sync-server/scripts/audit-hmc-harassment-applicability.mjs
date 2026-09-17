import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parse} from 'parse5';
import {extractDefinitionEntries} from '../reader-definition-index.mjs';
import {hmcGeneralSourceHashes} from './definition-sources/bind-hmc-general-applicability.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const text = node => node?.nodeName === '#text' ? node.value : (node?.childNodes || []).map(text).join('');
function nodes(node, tag, result = []) {
 if (node.tagName === tag) result.push(node);
 for (const child of node.childNodes || []) nodes(child, tag, result);
 return result;
}
const originalID = 'e7eabb36ef1f70ffd848';
const bodySHA256 = '3c926c779378f57def8911099e20fd710e9c1a384e0ca512aff2db98277ae415';
const expectedCounts = {generalDefinition:1, localDefinition:1, localMeaning:33, nestedDefinition:11, certificationCompound:35, taskForceCompound:1, unresolvedRecordedFinding:1, unresolvedMixedScope:4, candidate:38};

// This is a source inventory, not a binding or a count of rendered links.
// Dependencies can be injected only to prove that source/identity drift is rejected.
export async function auditHMCHarassment({read = readFile} = {}) {
 const registry = JSON.parse(await read(new URL('../public/reader-definition-registry.json', import.meta.url), 'utf8'));
 const book = registry.books.find(b => b.chapterID === 30000077);
 const originals = book?.entries.filter(e => e.term === 'Harassment') || [];
 const original = originals[0];
 if (originals.length !== 1 || original.id !== originalID || hash(original.text) !== bodySHA256 || original.text.length !== 11330 || original.text.split('\n\n').length !== 45 || original.aliases.length !== 0 || original.source.sectionNumber !== '27-2004' || original.source.anchor !== 'section-31001849' || original.source.file !== '2026-enacted-administrative-code/chapters/30000077.html') throw Error('Harassment source identity/body changed');
 const report = {status:'Source-only candidates; no activation or matcher acceptance', original, bodySHA256, sources:[], counts:Object.fromEntries(Object.keys(expectedCounts).map(k => [k, 0])), paragraphs:[], occurrences:[]};
 for (let chapter = 1; chapter <= 5; chapter++) {
  const file = `2026-enacted-administrative-code/chapters/${30000076 + chapter}.html`;
  const html = await read(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/' + file, import.meta.url), 'utf8');
  const sourceSHA256 = hash(html);
  if (sourceSHA256 !== hmcGeneralSourceHashes[chapter]) throw Error('HMC source changed: chapter ' + chapter);
  report.sources.push({chapter, file, sourceSHA256});
  if (chapter === 1) {
   const extracted = extractDefinitionEntries(html, {definitionChapter:true, definitionSectionOnly:true, numberedLegalLabels:{sectionNumber:'27-2004', terms:{48:'Harassment'}}});
   if (extracted.length !== 1 || extracted[0].text !== original.text) throw Error('Harassment source extraction changed');
  }
  for (const section of nodes(parse(html, {sourceCodeLocationInfo:true}), 'section')) {
   const heading = text(section.childNodes.find(n => n.tagName === 'h3'));
   const number = heading.match(/^27-\s*\d+(?:\.\d+)*/)?.[0].replace(/\s/g, '');
   if (!number) throw Error('Unmapped HMC section');
   const anchor = section.attrs.find(a => a.name === 'id')?.value;
   for (const [paragraphIndex, p] of section.childNodes.filter(n => n.tagName === 'p').entries()) {
    const body = text(p), ranges = [];
    for (const match of body.matchAll(/(?<![\p{L}\p{N}_])harassment(?![\p{L}\p{N}_])/giu)) {
     const before = body.slice(0, match.index), after = body.slice(match.index + match[0].length);
     let classification;
     if (number === '27-2004') classification = 'generalDefinition';
     else if (number === '27-2093') classification = paragraphIndex === 0 ? 'localDefinition' : 'localMeaning';
     else if (number === '27-2093.1') {
      // Entire subdivision (a), including nested list items, is defining prose.
      if (paragraphIndex <= 22) classification = 'nestedDefinition';
      else if (/(?:certification|certificate) of no\s+$/i.test(before)) classification = 'certificationCompound';
      else if (/tenant\s+$/i.test(before) && /^\s+prevention task force/i.test(after)) classification = 'taskForceCompound';
      else classification = 'candidate';
     } else if (number === '27-2109.2') classification = 'unresolvedRecordedFinding';
     else if (number === '27-2109.52') classification = 'certificationCompound';
     else if (number === '27-2115') classification = paragraphIndex === 67 ? 'unresolvedMixedScope' : 'candidate';
     else if (number === '27-2120') classification = 'candidate';
     else throw Error('Unreviewed Harassment section: ' + number);
     report.counts[classification]++;
     ranges.push({start:match.index, end:match.index + match[0].length, classification});
    }
    if (!ranges.length) continue;
    const paragraph = {chapter, file, sourceSHA256, section:number, anchor, heading, paragraphIndex, sourceStart:p.sourceCodeLocation.startOffset, text:body, paragraphSHA256:hash(body), ranges};
    report.paragraphs.push(paragraph);
    for (const range of ranges) report.occurrences.push({...paragraph, ranges:undefined, ...range});
   }
  }
 }
 if (JSON.stringify(report.counts) !== JSON.stringify(expectedCounts) || report.occurrences.length !== 125) throw Error('Harassment reviewed inventory changed: ' + JSON.stringify(report.counts));
 return report;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
 if (!process.argv[2]) throw Error('Pass output path');
 const report = await auditHMCHarassment();
 await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n');
 console.log(JSON.stringify({counts:report.counts, occurrences:report.occurrences.length, paragraphs:report.paragraphs.length}));
}
