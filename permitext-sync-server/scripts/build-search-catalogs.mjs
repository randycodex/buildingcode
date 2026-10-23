import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Always derive from this checkout's authoritative catalogs, never a previous
// build artifact or live account storage.
process.env.PERMITEXT_BUILD_SEARCH_CATALOGS = '1';
const temporary = await mkdtemp(join(tmpdir(), 'permitext-search-catalog-build-'));
process.env.PERMITEXT_SYNC_DATA_PATH = join(temporary, 'sync.json');
for (const name of ['DATABASE_URL', 'PERMITEXT_SYNC_DATABASE_URL', 'POSTGRES_URL', 'NEON_DATABASE_URL', 'STORAGE_URL']) {
  delete process.env[name];
}
try {
  const {publicSearchCatalogs} = await import('../app.mjs');
  const catalogs = await publicSearchCatalogs();
  const directory = new URL('../generated/search-catalogs/', import.meta.url);
  await mkdir(directory, {recursive:true});
  for (const [family, sections] of Object.entries(catalogs)) {
    const contents = JSON.stringify({schemaVersion:1, family, sections});
    await writeFile(new URL(`${family}.json`, directory), contents);
    console.log(`Prepared search catalog: ${family}, ${sections.length} sections, ${Buffer.byteLength(contents)} bytes`);
  }
} finally {
  await rm(temporary, {recursive:true, force:true});
}
