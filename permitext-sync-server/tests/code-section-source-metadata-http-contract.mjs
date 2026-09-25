import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { codeSourceKey } from '../public/active-code-sources.js';
const temporary = await mkdtemp(join(tmpdir(), 'permitext-source-preflight-'));
Object.assign(process.env, { NODE_ENV: 'test', VERCEL: '', VERCEL_ENV: '', PERMITEXT_SYNC_DATA_PATH: join(temporary, 'sync.json'), PERMITEXT_TEST_RESEARCH_MOCK: '1' });
for (const key of ['DATABASE_URL', 'PERMITEXT_SYNC_DATABASE_URL', 'POSTGRES_URL', 'NEON_DATABASE_URL', 'STORAGE_URL']) delete process.env[key];
const { handleRequest, allSectionCatalogByID, exactSectionMetadataMatches } = await import('../app.mjs');
const { activeCodeSourceCatalog } = await import('../active-code-source-catalog.mjs');
const server = createServer(handleRequest);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  const catalog = await activeCodeSourceCatalog();
  const sections = [...(await allSectionCatalogByID()).values()];
  for (const source of catalog) {
    const summary = sections.find(section => section.codePrefix === source.codePrefix && section.codeSectionID === source.categoryID &&
      (section.codeVersion || 'CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1') === source.canonicalEdition);
    assert.ok(summary, `Representative source ${codeSourceKey(source)}`);
    const path = `/code/sections/${summary.id}?include=metadata`;
    const response = await fetch(base + path + `&version=${encodeURIComponent(source.canonicalEdition)}`);
    assert.equal(response.status, 200, source.codePrefix);
    const { section } = await response.json();
    assert.equal(codeSourceKey(section.codeSource), codeSourceKey(source));
    assert.equal(section.sectionID, Number(summary.id));
    const resolveParams = new URLSearchParams({include:'metadata',code:source.codePrefix,version:source.canonicalEdition,sectionNumber:section.sectionNumber});
    const matching = exactSectionMetadataMatches(new Map(sections.map(entry=>[String(entry.id),entry])), {code:source.codePrefix,version:source.canonicalEdition,sectionNumber:section.sectionNumber});
    const resolvedResponse = await fetch(base + '/code/sections/resolve?' + resolveParams);
    assert.equal(resolvedResponse.status, matching.length === 1 ? 200 : 409);
    if (matching.length === 1) assert.deepEqual((await resolvedResponse.json()).section, section);
    resolveParams.set('version','wrong-edition');
    assert.equal((await fetch(base + '/code/sections/resolve?' + resolveParams)).status,404);

    for (const forbidden of ['blocks', 'html', 'body', 'rawDraftText', 'searchText', 'plainText']) assert.ok(!(forbidden in section));
    assert.equal((await fetch(base + path + '&version=not-an-installed-edition')).status, 409);
    assert.equal((await fetch(base + path + '&version=')).status, 400);
    assert.equal((await fetch(base + path + '&version=nyc-2022&version=nyc-2014')).status, 400);
    const wrong = catalog.find(candidate => candidate.canonicalEdition !== source.canonicalEdition).canonicalEdition;
    assert.equal((await fetch(base + path + `&version=${encodeURIComponent(wrong)}`)).status, 409);
    if (summary.webSectionID) {
      const alias = await fetch(base + `/code/sections/${summary.webSectionID}?include=metadata`);
      assert.equal(alias.status, 200);
      assert.equal((await alias.json()).section.sectionID, section.sectionID);
    }
  }

  assert.equal((await fetch(base + '/code/sections/resolve?include=metadata&code=BC&version=x&sectionNumber=')).status,400);
  assert.equal((await fetch(base + '/code/sections/resolve?include=metadata&code=BC&version=x&sectionNumber=101&code=BC')).status,400);
  const sample={id:1,codePrefix:'BC',codeVersion:'edition:A',sectionNumber:'101.1'};
  const aliases=new Map([['1',sample],['alias',sample]]);
  assert.equal(exactSectionMetadataMatches(aliases,{code:'BC',version:'edition:A',sectionNumber:'Section 101.1(1)'}).length,1);
  aliases.set('2',{...sample,id:2});
  assert.equal(exactSectionMetadataMatches(aliases,{code:'BC',version:'edition:A',sectionNumber:'101.1'}).length,2,'Ambiguity cannot silently choose a source');
  assert.equal((await fetch(base + '/code/sections/999999999999?include=metadata')).status, 404);
  assert.equal((await fetch(base + '/code/sections/invalid?include=metadata')).status, 400);
  // Run the actual handler in an isolated context: metadata branch must succeed
  // even though every rich-body provider throws if reached.
  const text = await readFile(new URL('../app.mjs', import.meta.url), 'utf8');
  const functionText = text.slice(text.indexOf('async function handleCodeSection(request, path, response) {'), text.indexOf('\nasync function handleCodeSections('));
  const selected = sections.find(section => section.codePrefix === 'BC' && !section.codeVersion);
  let sent;
  const context = { requestURL: request => new URL(request.url, base),
    allSectionCatalogByID: async () => new Map([[String(selected.id), { ...selected, blocks: ['must not escape'], html: 'forbidden' }]]),
    defaultSyncCodeVersion: 'CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1',
    applyVisibleSectionNumber: value => value, sendPublicCodeJSON: (_request, _response, payload) => { sent = payload; },
    findActiveCodeSource: async args => catalog.find(source => source.canonicalEdition === args.canonicalEdition && source.categoryID === args.categoryID),
    sectionBody: () => { throw Error('rich body invoked'); }, enactedSection: () => { throw Error('rich body invoked'); },
    historicalConstructionSection: () => { throw Error('rich body invoked'); }, zoningSection: () => { throw Error('rich body invoked'); }, existingBuildingSection: () => { throw Error('rich body invoked'); } };
  vm.createContext(context);
  vm.runInContext(functionText.replace('const { findActiveCodeSource } = await import("./active-code-source-catalog.mjs");', ''), context);
  await context.handleCodeSection({ url: `/code/sections/${selected.id}?include=metadata` }, `code/sections/${selected.id}`, {});
  assert.ok(sent.section.codeSource);
  assert.ok(!('blocks' in sent.section) && !('html' in sent.section));
  console.log('PASS section source metadata: 22 identities, aliases, wrong-edition rejection, no rich body providers');
} finally {
  await new Promise(resolve => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
