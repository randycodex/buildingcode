import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadPreparedSearchCatalog} from '../prepared-search-catalog.mjs';
import {createPreparedSearchTextReader, searchSectionTextKey} from '../prepared-search-text.mjs';
import {prepareSearchText} from '../scripts/prepare-search-text.mjs';

const deployment = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const included = deployment.functions['api/index.mjs'].includeFiles;
assert.ok(included.length <= 256, 'Vercel includeFiles must fit its schema limit');
assert.ok(deployment.buildCommand.length <= 256, 'Vercel buildCommand must fit its schema limit');
assert.ok(included.includes('generated/search-catalogs/**'), 'Prepared catalogs must ship with the function');
const scripts = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).scripts;
assert.equal(deployment.buildCommand, 'npm run build:production');
assert.ok(scripts['build:production'].startsWith('node scripts/build-search-catalogs.mjs &&'), 'Every deployment rebuilds catalogs from authoritative sources');

const temporary = await mkdtemp(join(tmpdir(), 'permitext-search-catalog-test-'));
process.env.PERMITEXT_SYNC_DATA_PATH = join(temporary, 'sync.json');
process.env.PERMITEXT_BUILD_SEARCH_CATALOGS = '1';
for (const name of ['DATABASE_URL', 'PERMITEXT_SYNC_DATABASE_URL', 'POSTGRES_URL', 'NEON_DATABASE_URL', 'STORAGE_URL']) delete process.env[name];
try {
  const {publicSearchCatalogs, publicSearchSectionText} = await import('../app.mjs');
  const source = await publicSearchCatalogs();
  const readText = createPreparedSearchTextReader({sourceOnly:()=>false});
  let count = 0;
  for (const [family, sections] of Object.entries(source)) {
    const prepared = await loadPreparedSearchCatalog(family, () => assert.fail('Built catalog must not read rich chapters'), {sourceOnly:false});
    assert.deepEqual(prepared, JSON.parse(JSON.stringify(sections)), `${family}: preserve every field, identity, navigation target, and ordering`);
    for (let start = 0; start < sections.length; start += 16) {
      await Promise.all(sections.slice(start, start + 16).map(async section => {
        assert.equal(await readText(section, () => assert.fail('Prepared Search must not read rich passage files')),
          await publicSearchSectionText(section), `${family}: exact text, whitespace, definitions, and rich-source recovery for ${section.id}`);
      }));
    }
    count += sections.length;
  }
  const directory = pathToFileURL(`${temporary}/`);
  const fallback = [{id:1, codePrefix:'BC'}];
  assert.equal(await loadPreparedSearchCatalog('missing', async () => fallback, {directory, sourceOnly:false}), fallback);
  await writeFile(join(temporary, 'invalid.json'), JSON.stringify({schemaVersion:0, family:'invalid', sections:fallback}));
  await assert.rejects(loadPreparedSearchCatalog('invalid', () => assert.fail('Invalid artifact must fail closed'), {directory, sourceOnly:false}), /Invalid prepared/);
  await writeFile(join(temporary, 'broken.json'), '{');
  await assert.rejects(loadPreparedSearchCatalog('broken', () => assert.fail('Corruption must not be silently masked'), {directory, sourceOnly:false}), SyntaxError);
  const fixture = [{id:1, codePrefix:'BC', text:'', codeVersion:'2022'},
    {id:2, webSectionID:3, codePrefix:'BC', text:'\nÉgress 🚪\n\nDoors.  ', codeVersion:'2022'},
    {id:2, codePrefix:'BC', text:'Different edition', codeVersion:'2014'}];
  const missingText = createPreparedSearchTextReader({directory, sourceOnly:()=>false});
  assert.equal(await missingText(fixture[0], async () => 'local source'), 'local source');
  await prepareSearchText({fixture}, async section => section.text, directory);
  const reader = createPreparedSearchTextReader({directory, sourceOnly:()=>false});
  for (const section of fixture) assert.equal(await reader(section, () => assert.fail()), section.text);
  await assert.rejects(reader({id:404, codePrefix:'BC'}, () => assert.fail()), /identity/);
  const manifest = JSON.parse(await readFile(new URL('search-text.json', directory), 'utf8'));
  manifest.records[searchSectionTextKey(fixture[1])][2] = 'wrong';
  await writeFile(new URL('search-text.json', directory), JSON.stringify(manifest));
  const corrupt = createPreparedSearchTextReader({directory, sourceOnly:()=>false});
  await assert.rejects(corrupt(fixture[1], () => assert.fail()), /Corrupt/);
  await writeFile(new URL('search-text.utf8', directory), 'truncated');
  const truncated = createPreparedSearchTextReader({directory, sourceOnly:()=>false});
  await assert.rejects(truncated(fixture[1], () => assert.fail()), /manifest/);
  console.log(`Prepared Search matches all ${count} authoritative metadata and exact passage text records; edition/alias/Unicode/empty-text identities, local fallback and corruption handling verified.`);
} finally {
  await rm(temporary, {recursive:true, force:true});
}
