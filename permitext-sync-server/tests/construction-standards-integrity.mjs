import assert from 'node:assert/strict';
import {access, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {constructionChapterHTMLSource, constructionContentRoot} from '../construction-html-content.mjs';

const readJSON = async path => JSON.parse(await readFile(path, 'utf8'));
const prepared = join(constructionContentRoot, 'prepared');
const [compact, nativeIndex, manifest, ids, structural, textIndex, textBytes] = await Promise.all([
  readJSON(join(prepared, 'chapterCatalog.json')),
  readJSON(join(prepared, 'searchIndex.json')),
  readJSON(join(prepared, 'manifest.json')),
  readJSON(new URL('../config/canonical-section-ids.json', import.meta.url)),
  readJSON(join(prepared, 'structural-sections.json')),
  readJSON(join(prepared, 'searchTextIndex.json')),
  readFile(join(prepared, 'searchText.utf8'))
]);
const standards = [
  {codePrefix:'BC', chapterID:35, chapterNumber:'35', sectionNumber:'3502', id:6863, tables:74, rows:758, previousID:6862},
  {codePrefix:'FGC', chapterID:73, chapterNumber:'8', sectionNumber:'802', id:25652, tables:13, rows:118, previousID:8778},
  {codePrefix:'MC', chapterID:96, chapterNumber:'15', sectionNumber:'1502', id:25653, tables:30, rows:308},
  {codePrefix:'PC', chapterID:118, chapterNumber:'15', sectionNumber:'1502', id:25654, tables:29, rows:340}
];

// Compare complete raw tables, including nested cells, links, and footnotes.
// Counts alone would miss a truncated cell or replacement with an empty table.
function rawTables(html) {
  const stack = [], result = [];
  for (const match of html.matchAll(/<\/?table\b[^>]*>/gi)) {
    if (/^<table/i.test(match[0])) stack.push(match.index);
    else {
      const start = stack.pop();
      assert.notEqual(start, undefined, 'Unexpected table closing tag.');
      result.push(html.slice(start, match.index + match[0].length));
    }
  }
  assert.equal(stack.length, 0, 'An official table was truncated.');
  return result;
}
const tokens = text => new Set((text.toLowerCase().match(/[\p{L}\p{N}.-]+/gu) || []).filter(token => [...token].length >= 2));
function assertNativePostings(section, body) {
  const text = [section.sectionNumber, section.title, ...body.blocks.map(block => block.plainText || '')].join(' ');
  for (const token of tokens(text)) assert(nativeIndex.tokens[token]?.includes(section.id), `${section.id}: native search lost ${token}.`);
  const range = textIndex.sections[section.id];
  assert(range, `${section.id}: missing mapped native text.`);
  const mapped = textBytes.subarray(range[0], range[0] + range[1]).toString('utf8').replace(/\s+/g, ' ').trim();
  for (const block of body.blocks) {
    const text = (block.plainText || '').replace(/\s+/g, ' ').trim();
    assert(mapped.includes(text), `${section.id}: mapped native search text is incomplete.`);
  }
}
for (const spec of standards) {
  const key = `${spec.codePrefix}:${spec.chapterNumber}:${spec.sectionNumber}`;
  assert.equal(ids.byCodeChapterSection[key], spec.id, `${key}: stable canonical identity.`);
  const chapter = await readJSON(join(prepared, `chapters/${spec.chapterID}.json`));
  const sections = chapter.groups.flatMap(group => group.sections);
  const section = sections.find(section => section.id === spec.id);
  assert.equal(section?.sectionNumber, spec.sectionNumber, `${key}: missing chapter catalog entry.`);
  const compactSections = compact.chapters.find(entry => entry[0] === spec.chapterID)[1].flatMap(group => group[5]);
  assert.equal(compactSections.filter(entry => entry[0] === spec.id).length, 1, `${key}: compact catalog entry.`);
  assert.equal(manifest.chapters.find(chapter => chapter.chapterID === spec.chapterID).sectionCount, sections.length);
  const body = await readJSON(join(prepared, `sections/${spec.id}.json`));
  const html = body.blocks.map(block => block.html || '').join('');
  const source = await constructionChapterHTMLSource(spec.codePrefix, spec.chapterNumber);
  const officialTables = rawTables(source.html);
  assert.equal(officialTables.length, spec.tables, `${key}: official table count changed; review the source.`);
  assert.equal((html.match(/<tr\b/gi) || []).length, spec.rows, `${key}: standards row count.`);
  assert.deepEqual(rawTables(html), officialTables, `${key}: every official table must survive byte for byte.`);
  assertNativePostings(section, body);
  if (spec.previousID) {
    const previous = await readJSON(join(prepared, `sections/${spec.previousID}.json`));
    assert.equal(rawTables(previous.blocks.map(block => block.html || '').join('')).length, 0, `${key}: tables still spill into Applicability.`);
    const metadata = sections.find(section => section.id === spec.previousID);
    const expected = tokens([metadata.sectionNumber, metadata.title, ...previous.blocks.map(block => block.plainText || '')].join(' '));
    for (const [token, postings] of Object.entries(nativeIndex.tokens)) {
      if (postings.includes(spec.previousID)) assert(expected.has(token), `${key}: stale standards token ${token} still points to Applicability.`);
    }
  }
}
for (const id of [3674, 5341, 5606]) {
  const entry = compact.chapters.flatMap(([, groups]) => groups.flatMap(group => group[5])).find(section => section[0] === id);
  const body = await readJSON(join(prepared, `sections/${id}.json`));
  assert(body.blocks.some(block => block.plainText?.trim()), `${id}: recovered parent clause is empty.`);
  assertNativePostings({id, sectionNumber:entry[1], title:entry[2]}, body);
}
for (const id of [8725, 8742]) {
  await assert.rejects(access(join(prepared, `sections/${id}.json`)), {code:'ENOENT'}, 'Reserved headings cannot inherit the next section.');
  assert(structural.entries.some(entry => entry.sectionID === id), `${id}: retain its structural catalog entry.`);
}
console.log('Construction standards integrity passed: 146 complete tables, 1,524 rows, stable identities, native search postings, and recovered parent clauses.');
