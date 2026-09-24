import { gunzipSync } from "node:zlib";
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReaderSearchProjection } from './reader-search-projection.mjs';

const defaultOutput = fileURLToPath(new URL('../generated/reader-search/', import.meta.url));
const historicalVersion = 'CodeContent/authored/new-york-city/2014-construction-codes/bundle.json#1';

// The caller supplies its isolated HTTP reader. Importing this module never
// starts a server or selects application storage.
export async function verifyReaderSearchIndex({ get, outputDirectory = defaultOutput, chapterIDs = [], projector } = {}) {
  assert.equal(typeof get, 'function', 'An isolated chapter API reader is required');
  projector ||= await createReaderSearchProjection();
  const current = (await get('/code/chapters')).chapters;
  const historical = (await get(`/code/chapters?version=${encodeURIComponent(historicalVersion)}`)).chapters;
  const catalog = new Map([...current, ...historical].map(chapter => [String(chapter.id), chapter]));
  const selected = chapterIDs.length ? [...new Set(chapterIDs.map(String))] : [...catalog.keys()];
  assert.ok(selected.length, 'Catalog must not be empty');
  if (!chapterIDs.length) {
    const files = (await readdir(outputDirectory)).filter(name => name.endsWith('.json.gz')).sort();
    assert.deepEqual(files, [...catalog.keys()].map(id => `${id}.json.gz`).sort(), 'Generated chapter file set differs from current catalogs');
  }
  let sectionCount = 0;
  for (const id of selected) {
    assert.match(id, /^[a-zA-Z0-9_-]+$/);
    assert.ok(catalog.has(id), `Unknown chapter ID: ${id}`);
    const value = JSON.parse(gunzipSync(await readFile(join(outputDirectory, `${id}.json.gz`))).toString('utf8'));
    const summary = (await get(`/code/chapters/${id}?bodyContract=2`)).chapter;
    assert.equal(summary.bodyContract, 2);
    assert.equal(String(summary.id), id);
    assert.match(summary.corpusRevision, /^[a-f0-9]{64}$/);
    assert.equal(value.schemaVersion, 1, `${id}: index schema`);
    assert.equal(value.chapterID, summary.id, `${id}: chapter identity`);
    assert.equal(value.codeVersion, summary.codeVersion, `${id}: edition identity`);
    assert.equal(value.corpusRevision, summary.corpusRevision, `${id}: stale corpus revision`);
    assert.equal(value.projectionRevision, projector.projectionRevision, `${id}: stale Reader projection; regenerate indexes`);
    assert.ok(Array.isArray(value.sections), `${id}: missing sections`);
    assert.deepEqual(value.sections.map(section => section.id), summary.sections.map(section => section.id), `${id}: incomplete or reordered sections`);
    for (let index = 0; index < value.sections.length; index++) {
      const section = value.sections[index];
      const source = summary.sections[index];
      assert.equal(section.sectionNumber, source.sectionNumber || '', `${id}: section number`);
      assert.equal(section.title, source.title || '', `${id}: section title`);
      assert.equal(section.displayTitle, projector.displayTitle(source), `${id}: display title`);
      assert.ok(Array.isArray(section.blocks), `${id}: missing projected blocks`);
      for (const block of section.blocks) {
        assert.deepEqual(Object.keys(block).sort(), ['blockID', 'text'], `${id}: unexpected projected block fields`);
        assert.equal(typeof block.blockID, 'string');
        assert.equal(typeof block.text, 'string');
        assert.equal(block.blockID, block.blockID.trim());
        assert.equal(block.text, block.text.replace(/\s+/g, ' ').trim());
      }
    }
    sectionCount += value.sections.length;
  }
  return { chapters: selected.length, sections: sectionCount, projectionRevision: projector.projectionRevision };
}

export async function verifyWithIsolatedServer(options = {}) {
  const temporary = await mkdtemp(join(tmpdir(), 'permitext-reader-index-verify-'));
  const overrides = { NODE_ENV: 'test', VERCEL: '', VERCEL_ENV: '', PERMITEXT_SYNC_DATA_PATH: join(temporary, 'sync.json') };
  const removed = ['DATABASE_URL', 'PERMITEXT_SYNC_DATABASE_URL', 'POSTGRES_URL', 'NEON_DATABASE_URL', 'STORAGE_URL'];
  const prior = Object.fromEntries([...Object.keys(overrides), ...removed].map(key => [key, process.env[key]]));
  let server;
  try {
    Object.assign(process.env, overrides);
    for (const key of removed) delete process.env[key];
    const { handleRequest } = await import('../app.mjs');
    server = createServer(handleRequest);
    await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const get = async path => {
      const response = await fetch(base + path);
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      return response.json();
    };
    return await verifyReaderSearchIndex({ ...options, get });
  } finally {
    if (server?.listening) { server.closeAllConnections(); await new Promise(done => server.close(done)); }
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let outputDirectory = defaultOutput;
  const chapterIDs = [];
  for (let index = 2; index < process.argv.length; index++) {
    const argument = process.argv[index];
    if (argument === '--output' && process.argv[index + 1]) outputDirectory = resolve(process.argv[++index]);
    else if (argument === '--chapter' && process.argv[index + 1]) chapterIDs.push(process.argv[++index]);
    else throw new Error(`Unknown/incomplete argument: ${argument}`);
  }
  console.log(JSON.stringify(await verifyWithIsolatedServer({ outputDirectory, chapterIDs })));
}
