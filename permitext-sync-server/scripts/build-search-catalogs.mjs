import {mkdir, mkdtemp, readdir, rename, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareSearchText} from './prepare-search-text.mjs';
import {prepareSearchRuntime} from './prepare-search-runtime.mjs';

// Always derive from this checkout's authoritative catalogs, never a previous
// build artifact or live account storage.
process.env.PERMITEXT_BUILD_SEARCH_CATALOGS = '1';
globalThis.fetch = async () => { throw new Error('Search preparation is offline'); };
const temporary = await mkdtemp(join(tmpdir(), 'permitext-search-catalog-build-'));
let staging;
process.env.PERMITEXT_SYNC_DATA_PATH = join(temporary, 'sync.json');
for (const name of ['DATABASE_URL', 'PERMITEXT_SYNC_DATABASE_URL', 'POSTGRES_URL', 'NEON_DATABASE_URL', 'STORAGE_URL']) {
  delete process.env[name];
}
try {
  const {publicSearchCatalogs, publicSearchIndexes, publicSearchSectionText} = await import('../app.mjs');
  const catalogs = await publicSearchCatalogs();
  const destination = new URL('../generated/search-catalogs/', import.meta.url);
  staging = new URL(`.build-${process.pid}/`, destination);
  const directory = staging;
  await mkdir(staging, {recursive:true});
  for (const [family, sections] of Object.entries(catalogs)) {
    const contents = JSON.stringify({schemaVersion:1, family, sections});
    await writeFile(new URL(`${family}.json`, directory), contents);
    console.log(`Prepared search catalog: ${family}, ${sections.length} sections, ${Buffer.byteLength(contents)} bytes`);
  }
  const indexes = await publicSearchIndexes();
  for (const [family, sections] of Object.entries(catalogs)) {
    console.log('Prepared Search runtime:', await prepareSearchRuntime(family, sections, indexes[family], directory));
  }
  console.log('Prepared exact Search text:', await prepareSearchText(catalogs, publicSearchSectionText, directory));
  // A running local server may still hold the old passage file open. Publish
  // complete files by rename, preserving that descriptor instead of truncating
  // the file underneath active readers while a build is in progress.
  for (const name of await readdir(staging)) {
    await rename(new URL(name, staging), new URL(name, destination));
  }
} finally {
  if (staging) await rm(staging, {recursive:true, force:true});
  await rm(temporary, {recursive:true, force:true});
}
