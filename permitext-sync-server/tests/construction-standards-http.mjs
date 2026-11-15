import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {constructionContentRoot} from '../construction-html-content.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'permitext-standards-http-'));
Object.assign(process.env, {NODE_ENV:'test', VERCEL:'', VERCEL_ENV:'', PERMITEXT_SYNC_DATA_PATH:join(temporary, 'sync.json')});
for (const name of ['OPENAI_API_KEY', 'DATABASE_URL', 'PERMITEXT_SYNC_DATABASE_URL', 'POSTGRES_URL', 'NEON_DATABASE_URL', 'STORAGE_URL']) delete process.env[name];
const {handleRequest} = await import('../app.mjs');
const server = createServer(handleRequest);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const fetchOriginal = globalThis.fetch;
globalThis.fetch = (url, options) => {
  assert.equal(new URL(url).origin, base, 'The test may only call its isolated server.');
  return fetchOriginal(url, options);
};
async function get(path) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200, path);
  return response.json();
}
try {
  for (const [chapterID, id, tableCount, rowCount] of [[35,6863,74,758], [73,25652,13,118], [96,25653,30,308], [118,25654,29,340]]) {
    const prepared = JSON.parse(await readFile(join(constructionContentRoot, `prepared/sections/${id}.json`), 'utf8'));
    const {section} = await get(`/code/sections/${id}`);
    assert.equal(section.sectionID, id);
    const html = section.blocks.map(block => block.html || '').join('');
    assert.equal((html.match(/<table\b/gi) || []).length, tableCount, `${id}: served table count.`);
    assert.equal((html.match(/<tr\b/gi) || []).length, rowCount, `${id}: served table rows.`);
    assert.equal(section.blocks.map(block => block.plainText || '').join('\n'), prepared.blocks.map(block => block.plainText || '').join('\n'), `${id}: served standards text.`);
    const {chapter} = await get(`/code/chapters/${chapterID}?bodyContract=2`);
    assert(chapter.sections.some(section => section.id === id), `${id}: Reader manifest entry.`);
    const {readerSearch} = await get(`/code/chapters/${chapterID}?readerSearch=ASTM`);
    assert(readerSearch.results.some(result => result.sectionID === id), `${id}: Reader Find must include standards table text.`);
    const search = await get(`/code/search?q=${prepared.sectionNumber}&code=${chapter.codePrefix}&limit=20`);
    assert(search.results.some(result => (result.sectionID || result.id) === id), `${id}: public Search must resolve the recovered Standards section.`);
  }
  console.log('Construction standards HTTP passed: complete tables through the serving API, Reader manifests, Reader Find, and public Search.');
} finally {
  globalThis.fetch = fetchOriginal;
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await rm(temporary, {recursive:true, force:true});
}
