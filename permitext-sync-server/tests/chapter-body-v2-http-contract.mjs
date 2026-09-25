import assert from "node:assert/strict";
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { performance } from "node:perf_hooks";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporary = await mkdtemp(join(tmpdir(), "permitext-chapter-v2-"));
Object.assign(process.env, { NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "",
  PERMITEXT_SYNC_DATA_PATH: join(temporary, "sync.json") });
for (const key of ["DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL"]) delete process.env[key];
const { handleRequest } = await import("../app.mjs");
const server = createServer(handleRequest);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
async function get(path) {
  const response = await fetch(`${base}${path}`);
  const text = await response.text();
  assert.equal(response.status, 200, `${path}: ${text}`);
  return { value: JSON.parse(text), bytes: Buffer.byteLength(text), text };
}
try {
  const current = (await get('/code/chapters')).value.chapters;
  const historical = (await get('/code/chapters?version=CodeContent%2Fauthored%2Fnew-york-city%2F2014-construction-codes%2Fbundle.json%231')).value.chapters;
  const examples = new Map();
  for (const entry of [...current, ...historical]) {
    const key = `${entry.codePrefix}:${entry.codeVersion || entry.syncCodeVersion || '2022'}`;
    if (!examples.has(key) && entry.sectionCount > 2) examples.set(key, entry);
    if (entry.sourceChapterIDs?.length > 1) examples.set(`assembled:${entry.id}`, entry);
  }
  assert([...examples.keys()].some((key) => key.includes('2014-construction')), 'Historical edition must actually be requested');
  assert(examples.size >= 10, 'Cover all edition families and assembled navigation');
  const measurements = [];
  for (const [family, entry] of examples) {
    const path = `/code/chapters/${entry.id}`;
    const legacySummary = (await get(path)).value.chapter;
    const summary = (await get(`${path}?bodyContract=2`)).value.chapter;
    assert.equal(legacySummary.bodyContract, undefined);
    assert.equal(summary.bodyContract, 2);
    assert.match(summary.corpusRevision, /^[a-f0-9]{64}$/);
    assert.deepEqual(summary.sections, legacySummary.sections);
    assert.deepEqual(summary.groups, legacySummary.groups);
    if (family === 'BC:2022') {
      const fullLegacy = (await get(`${path}?include=body`)).value.chapter;
      const full = (await get(`${path}?include=body&bodyContract=2`)).value.chapter;
      assert.deepEqual(full.sections, fullLegacy.sections, 'Full reader search preserves section metadata');
      assert.deepEqual(full.groups, fullLegacy.groups);
      assert.equal(full.corpusRevision, summary.corpusRevision);
      const capped = (await get(`${path}?include=body&bodyLimit=999&bodyContract=2`)).value.chapter;
      assert.equal(capped.sections.length, Math.min(50, summary.sections.length));
    }
    const start = Math.min(1, summary.sections.length);
    const suffix = `include=body&bodyStart=${start}&bodyLimit=2`;
    const legacy = await get(`${path}?${suffix}`);
    const compact = await get(`${path}?${suffix}&bodyContract=2`);
    const body = compact.value.chapter;
    assert.deepEqual(Object.keys(body).sort(), ['assetRevision','bodyContract','bodyRange','codePrefix','codeVersion','corpusRevision','id','sections'].sort());
    assert.match(body.assetRevision, /^[a-f0-9]{64}$/);
    assert.equal(body.corpusRevision, summary.corpusRevision);
    assert.equal(body.codeVersion, summary.codeVersion);
    assert.equal(body.id, summary.id);
    assert.deepEqual(body.bodyRange, legacy.value.chapter.bodyRange);
    assert.deepEqual(body.sections, legacy.value.chapter.sections.slice(start, start + 2).map(({id,blocks}) => ({id,blocks})));
    const empty = (await get(`${path}?include=body&bodyStart=999999&bodyLimit=2&bodyContract=2`)).value.chapter;
    assert.equal(empty.sections.length, 0);
    assert.equal(empty.bodyRange.start, summary.sections.length);
    assert.equal(empty.corpusRevision, summary.corpusRevision);
    measurements.push({ family, id: entry.id, sections: summary.sections.length, legacyBytes: legacy.bytes, compactBytes: compact.bytes });
  }
  const largeSummary = (await get('/code/chapters/33?bodyContract=2')).value.chapter;
  const legacyFive = await get('/code/chapters/33?include=body&bodyStart=0&bodyLimit=5');
  const compactFive = await get('/code/chapters/33?include=body&bodyStart=0&bodyLimit=5&bodyContract=2');
  assert.deepEqual(compactFive.value.chapter.sections, legacyFive.value.chapter.sections.slice(0,5).map(({id,blocks}) => ({id,blocks})));
  function parseMedian(text) {
    for (let i = 0; i < 30; i++) JSON.parse(text);
    const samples = [];
    for (let i = 0; i < 200; i++) {
      const start = performance.now();
      JSON.parse(text);
      samples.push(performance.now() - start);
    }
    samples.sort((a,b) => a-b);
    return (samples[99]+samples[100])/2;
  }
  const allIDs = [];
  for (let start = 0; start < largeSummary.sections.length; start += 50) {
    const suffix = `include=body&bodyStart=${start}&bodyLimit=50`;
    const legacy = (await get(`/code/chapters/33?${suffix}`)).value.chapter;
    const window = (await get(`/code/chapters/33?${suffix}&bodyContract=2`)).value.chapter;
    assert.equal(window.corpusRevision,largeSummary.corpusRevision);
    assert.deepEqual(window.sections,legacy.sections.slice(start,start+50).map(({id,blocks}) => ({id,blocks})));
    allIDs.push(...window.sections.map(section => section.id));
  }
  assert.deepEqual(allIDs,largeSummary.sections.map(section => section.id), 'Every chapter33 manifest position and body must be covered without omissions');
  const chapter33 = {
    chapterID:33, totalSections:largeSummary.sections.length, windowSections:5,
    coverage:'Every 50-section window has exact IDs and blocks parity with legacy',
    measurementScope:'Local host serialization and JSON.parse; gzip is an estimate, not observed transport compression',
    parseIterations:200,
    legacy:{decodedJSONBytes:legacyFive.bytes, estimatedGzipBytes:gzipSync(legacyFive.text).length, jsonParseMedianMilliseconds:parseMedian(legacyFive.text)},
    compact:{decodedJSONBytes:compactFive.bytes, estimatedGzipBytes:gzipSync(compactFive.text).length, jsonParseMedianMilliseconds:parseMedian(compactFive.text)}
  };
  console.log(JSON.stringify({ passed: true, measurements, chapter33 }, null, 2));
} finally {
  await new Promise((resolve) => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
