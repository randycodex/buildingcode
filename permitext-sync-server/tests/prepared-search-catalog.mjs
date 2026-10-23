import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadPreparedSearchCatalog} from '../prepared-search-catalog.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'permitext-search-catalog-test-'));
process.env.PERMITEXT_SYNC_DATA_PATH = join(temporary, 'sync.json');
process.env.PERMITEXT_BUILD_SEARCH_CATALOGS = '1';
for (const name of ['DATABASE_URL', 'PERMITEXT_SYNC_DATABASE_URL', 'POSTGRES_URL', 'NEON_DATABASE_URL', 'STORAGE_URL']) delete process.env[name];
try {
  const {publicSearchCatalogs} = await import('../app.mjs');
  const source = await publicSearchCatalogs();
  let count = 0;
  for (const [family, sections] of Object.entries(source)) {
    const prepared = await loadPreparedSearchCatalog(family, () => assert.fail('Built catalog must not read rich chapters'), {sourceOnly:false});
    assert.deepEqual(prepared, JSON.parse(JSON.stringify(sections)), `${family}: preserve every field, identity, navigation target, and ordering`);
    count += sections.length;
  }
  const directory = pathToFileURL(`${temporary}/`);
  const fallback = [{id:1, codePrefix:'BC'}];
  assert.equal(await loadPreparedSearchCatalog('missing', async () => fallback, {directory, sourceOnly:false}), fallback);
  await writeFile(join(temporary, 'invalid.json'), JSON.stringify({schemaVersion:0, family:'invalid', sections:fallback}));
  await assert.rejects(loadPreparedSearchCatalog('invalid', () => assert.fail('Invalid artifact must fail closed'), {directory, sourceOnly:false}), /Invalid prepared/);
  await writeFile(join(temporary, 'broken.json'), '{');
  await assert.rejects(loadPreparedSearchCatalog('broken', () => assert.fail('Corruption must not be silently masked'), {directory, sourceOnly:false}), SyntaxError);
  console.log(`Prepared search catalogs match all ${count} authoritative section records across five families; local fallback and corruption handling verified.`);
} finally {
  await rm(temporary, {recursive:true, force:true});
}
