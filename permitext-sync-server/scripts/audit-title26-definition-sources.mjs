import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {discoverDefinitionSections} from './definition-section-discovery.mjs';

const base = new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/', import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const duplicates = (rows, key) => [...Map.groupBy(rows, key)]
  .filter(([, members]) => members.length > 1)
  .map(([identity, members]) => ({identity, members}));

// Discovery only: a declaration candidate is not an extracted meaning or an
// approved legal scope. Keep physical file identity when printed numbers repeat.
export async function auditTitle26DefinitionSources() {
  const bundleBytes = await readFile(new URL('bundle.json', base));
  const bundle = JSON.parse(bundleBytes);
  const chapters = [];
  for (const chapter of bundle.chapters.filter(c => c.codeSectionID === 3)) {
    const file = `chapters/${chapter.id}.html`;
    const bytes = await readFile(new URL(file, base));
    chapters.push({chapterID: chapter.id, chapterNumber: chapter.chapterNumber,
      title: chapter.title, file, sourceSHA256: sha(bytes),
      candidates: discoverDefinitionSections(bytes.toString()).map(candidate => ({
        ...candidate, sectionNumber: candidate.heading.match(/^26-\d+(?:\.\d+)*/)?.[0] ?? null,
      }))});
  }
  const candidates = chapters.flatMap(c => c.candidates.map(s => ({...s,
    chapterID: c.chapterID, chapterNumber: c.chapterNumber, file: c.file})));
  return {status: 'Discovery only; no extraction, activation or semantic acceptance',
    bundleSHA256: sha(bundleBytes), chapterCount: chapters.length,
    candidateCount: candidates.length, chapters,
    repeatedChapterNumbers: duplicates(chapters, c => c.chapterNumber).map(({identity,members}) => ({identity, chapterIDs: members.map(c => c.chapterID)})),
    repeatedCandidateSections: duplicates(candidates.filter(s => s.sectionNumber), s => s.sectionNumber)};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await auditTitle26DefinitionSources();
  if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({status: report.status, chapterCount: report.chapterCount,
    candidateCount: report.candidateCount, repeatedChapterNumbers: report.repeatedChapterNumbers,
    repeatedCandidateSections: report.repeatedCandidateSections}, null, 2));
}
