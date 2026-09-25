import { gzipSync } from "node:zlib";
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createReaderSearchProjection } from './reader-search-projection.mjs';

const historicalVersion = 'CodeContent/authored/new-york-city/2014-construction-codes/bundle.json#1';
const defaultOutput = fileURLToPath(new URL('../generated/reader-search/', import.meta.url));

export async function projectChapter(chapterID, get, projector) {
  assert.match(String(chapterID), /^[a-zA-Z0-9_-]+$/);
  const path = `/code/chapters/${chapterID}`;
  const manifest = (await get(`${path}?bodyContract=2`)).chapter;
  assert.equal(manifest.bodyContract, 2);
  assert.equal(String(manifest.id), String(chapterID));
  assert.match(manifest.corpusRevision, /^[a-f0-9]{64}$/);
  assert.equal(typeof manifest.codeVersion, 'string');
  assert.ok(manifest.codeVersion.length);
  assert.ok(Array.isArray(manifest.sections));
  const sections = [];
  for (let start = 0; start < manifest.sections.length; start += 50) {
    const end = Math.min(start + 50, manifest.sections.length);
    const body = (await get(`${path}?bodyContract=2&include=body&bodyStart=${start}&bodyLimit=50`)).chapter;
    for (const key of ['id', 'codeVersion', 'codePrefix', 'corpusRevision', 'bodyContract']) {
      assert.equal(body[key], manifest[key], `Window ${start}: ${key} mismatch`);
    }
    assert.deepEqual(body.bodyRange, { start, end, total: manifest.sections.length, complete: start === 0 && end === manifest.sections.length });
    assert.equal(body.sections.length, end - start, 'Window section count mismatch');
    for (let offset = 0; offset < body.sections.length; offset++) {
      const metadata = manifest.sections[start + offset];
      const value = body.sections[offset];
      assert.equal(value.id, metadata.id, 'Window section order mismatch');
      assert.ok(Array.isArray(value.blocks), 'Missing rich body blocks');
      // Preserve the legacy search input exactly; display hydration adds chapter-level
      // prefixes separately, and must not change search block boundaries.
      const section = { ...metadata, blocks: value.blocks };
      sections.push({ id: metadata.id, sectionNumber: metadata.sectionNumber || '', title: metadata.title || '',
        displayTitle: projector.displayTitle(section), blocks: projector.projectSection(section) });
    }
  }
  assert.equal(sections.length, manifest.sections.length);
  return { schemaVersion: 1, chapterID: manifest.id, codeVersion: manifest.codeVersion,
    corpusRevision: manifest.corpusRevision, projectionRevision: projector.projectionRevision, sections };
}

export async function generateReaderSearchIndex({ outputDirectory = defaultOutput, chapterIDs = [] } = {}) {
  // Isolate before dynamically importing app.mjs, whose repositories are selected
  // at module initialization. Never touch the developer's local sync database.
  const temporary = await mkdtemp(join(tmpdir(), 'permitext-reader-index-'));
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
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${await response.text()}`);
      return response.json();
    };
    const current = (await get('/code/chapters')).chapters;
    const historical = (await get(`/code/chapters?version=${encodeURIComponent(historicalVersion)}`)).chapters;
    const catalog = new Map([...current, ...historical].map(chapter => [String(chapter.id), chapter]));
    const selected = chapterIDs.length ? [...new Set(chapterIDs.map(String))] : [...catalog.keys()];
    for (const id of selected) assert.ok(catalog.has(id), `Unknown chapter ID: ${id}`);
    const projector = await createReaderSearchProjection();
    await mkdir(outputDirectory, { recursive: true });
    const results = [];
    for (const id of selected) {
      const value = await projectChapter(id, get, projector);
      const destination = join(outputDirectory, `${id}.json.gz`);
      const staged = `${destination}.${randomUUID()}.tmp`;
      const data = gzipSync(JSON.stringify(value) + '\n', { level: 9 });
      try {
        await writeFile(staged, data, { flag: 'wx' });
        await rename(staged, destination);
      } finally { await rm(staged, { force: true }); }
      results.push({ chapterID: id, sections: value.sections.length, bytes: Buffer.byteLength(data) });
      console.log(`Indexed ${id}: ${value.sections.length} sections, ${Buffer.byteLength(data)} bytes`);
    }
    return results;
  } finally {
    if (server?.listening) {
      server.closeAllConnections();
      await new Promise(done => server.close(done));
    }
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
  await generateReaderSearchIndex({ outputDirectory, chapterIDs });
}
