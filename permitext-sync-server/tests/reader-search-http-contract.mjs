import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { performance } from 'node:perf_hooks';
import { gzipSync } from 'node:zlib';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createReaderSearchProjection } from '../scripts/reader-search-projection.mjs';
import { searchReaderTextSections } from '../public/reader-search-match.js';

const temporary = await mkdtemp(join(tmpdir(), 'permitext-reader-search-http-'));
Object.assign(process.env, { NODE_ENV: 'test', VERCEL: '', VERCEL_ENV: '', PERMITEXT_SYNC_DATA_PATH: join(temporary, 'sync.json'), PERMITEXT_TEST_RESEARCH_MOCK: '1' });
for (const key of ['DATABASE_URL', 'PERMITEXT_SYNC_DATABASE_URL', 'POSTGRES_URL', 'NEON_DATABASE_URL', 'STORAGE_URL']) delete process.env[key];
const { handleRequest } = await import('../app.mjs');
const server = createServer(handleRequest);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
async function get(path) {
  const start = performance.now();
  const response = await fetch(base + path);
  const text = await response.text();
  const milliseconds = performance.now() - start;
  assert.equal(response.status, 200, `${path}: ${text.slice(0, 500)}`);
  return { value: JSON.parse(text), bytes: Buffer.byteLength(text), gzipBytes: gzipSync(text).length, milliseconds };
}
try {
  const projector = await createReaderSearchProjection();
  const current = (await get('/code/chapters')).value.chapters;
  const historical = (await get(`/code/chapters?version=${encodeURIComponent('CodeContent/authored/new-york-city/2014-construction-codes/bundle.json#1')}`)).value.chapters;
  const examples = new Map();
  for (const chapter of [...current, ...historical]) {
    const key = `${chapter.codePrefix}:${chapter.codeVersion || chapter.syncCodeVersion || '2022'}`;
    if (!examples.has(key) && chapter.sectionCount > 2) examples.set(key, chapter);
  }
  assert.equal(examples.size, 22, 'All 22 prefix/edition combinations must be exercised');
  examples.set('large-chapter-33', current.find(chapter => String(chapter.id) === '33'));
  const measurements = [];
  const families = new Set();
  for (const [family, entry] of examples) {
    assert.ok(entry);
    const path = `/code/chapters/${encodeURIComponent(entry.id)}`;
    const legacy = await get(`${path}?include=body`);
    const chapter = legacy.value.chapter;
    const summary = (await get(`${path}?bodyContract=2`)).value.chapter;
    families.add(summary.codeVersion.match(/new-york-city\/([^/]+)\//)?.[1]);
    assert.equal(chapter.sections.length, summary.sections.length);
    assert.ok(chapter.sections.every(section => Array.isArray(section.blocks)), 'Legacy reference must contain every rich body');
    const sections = chapter.sections.map(section => ({ id: section.id, sectionNumber: section.sectionNumber || '', title: section.title || '',
      displayTitle: projector.displayTitle(section), blocks: projector.projectSection(section) }));
    const phraseBlock = sections.flatMap(section => section.blocks).find(block => block.text.split(/\s+/).length >= 6);
    const phrase = phraseBlock?.text.split(/\s+/).slice(1, 6).join(' ') || sections[0].displayTitle;
    const queries = [...new Set(['concrete', phrase, 'harzadous materials', 'zzzxqvnonexistentzzzxqv', sections[0].displayTitle, ''])];
    const searches = [];
    for (const query of queries) {
      const response = await get(`${path}?bodyContract=2&readerSearch=${encodeURIComponent(query)}`);
      assert.deepEqual(Object.keys(response.value), ['readerSearch'], 'Search must not return a rich chapter');
      const result = response.value.readerSearch;
      assert.equal(String(result.chapterID), String(entry.id));
      assert.equal(result.codeVersion, summary.codeVersion);
      assert.equal(result.corpusRevision, summary.corpusRevision);
      assert.equal(result.query, query.trim());
      const expected = searchReaderTextSections(sections, query);
      assert.deepEqual(result.results, expected, `${family}: exact legacy projection parity for ${JSON.stringify(query)}`);
      assert.equal(result.total, expected.length);
      for (const item of result.results) {
        assert.equal('blocks' in item, false);
        assert.equal('html' in item, false);
        assert.equal('plainText' in item, false);
      }
      searches.push({ query, total: result.total, decodedJSONBytes: response.bytes, estimatedGzipBytes: response.gzipBytes, localhostMilliseconds: response.milliseconds });
    }
    const forced = (await get(`${path}?include=body&bodyContract=2&readerSearch=%20concrete%20`)).value;
    assert.deepEqual(forced.readerSearch.results, searchReaderTextSections(sections, 'concrete'));
    assert.equal(forced.readerSearch.query, 'concrete');
    assert.equal('chapter' in forced, false, 'include=body cannot force rich bodies into search response');
    measurements.push({ family, chapterID: entry.id, sections: sections.length, legacy: { decodedJSONBytes: legacy.bytes, estimatedGzipBytes: legacy.gzipBytes, localhostMilliseconds: legacy.milliseconds }, searches });
  }
  assert.equal(families.size, 6, 'All six source edition families must be exercised');
  const report = { passed: true, scope: 'Isolated localhost HTTP, full rich-body projection parity. Timings are single local samples, not browser rendering, production, or device performance. Gzip sizes are estimates.', prefixEditionCombinations: examples.size - 1, sourceEditionFamilies: families.size, measurements };
  if (process.env.PERMITEXT_READER_SEARCH_HTTP_EVIDENCE) await writeFile(process.env.PERMITEXT_READER_SEARCH_HTTP_EVIDENCE, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await new Promise(resolve => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
