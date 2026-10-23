import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {serialize, deserialize} from 'node:v8';
import {createPreparedSearchRuntime} from '../prepared-search-runtime.mjs';
import {prepareSearchRuntime, packSearchCatalog} from '../scripts/prepare-search-runtime.mjs';
import {prepareSearchWordIndex, searchWords, searchWordPosting} from '../public/search-words.js';

const temporary = await mkdtemp(join(tmpdir(), 'permitext-compiled-search-'));
process.env.PERMITEXT_SYNC_DATA_PATH = join(temporary, 'sync.json');
process.env.PERMITEXT_BUILD_SEARCH_CATALOGS = '1';
for (const key of ['DATABASE_URL','PERMITEXT_SYNC_DATABASE_URL','POSTGRES_URL','NEON_DATABASE_URL','STORAGE_URL']) delete process.env[key];
try {
  const {publicSearchCatalogs, publicSearchIndexes, candidateSectionIDs} = await import('../app.mjs');
  const [catalogs, indexes] = await Promise.all([publicSearchCatalogs(), publicSearchIndexes()]);
  delete process.env.PERMITEXT_BUILD_SEARCH_CATALOGS;
  const runtime = createPreparedSearchRuntime();
  let postingCount = 0;
  const queries = ['sprinkler control valve','exhaust air duct','accessible route','standpipe system',
    'roof access hatch','fire-resistance','fires','stair','3.1','foot-candle','mezzanine','noncombustible','occupancy','hazard','zoning'];
  for (const [family, original] of Object.entries(indexes)) {
    const catalog = await runtime.catalog(family);
    assert.deepEqual(catalog, catalogs[family], 'Catalog fields, undefined properties, order, identities, and navigation remain exact');
    const compiled = await runtime.index(family, () => assert.fail('Prepared Search must not parse source indexes'));
    assert.deepEqual([...compiled.keys()], [...original.keys()]);
    for (const [token, ids] of original) {
      assert.ok(compiled.get(token) instanceof Uint32Array);
      assert.deepEqual(Array.from(compiled.get(token)), ids, `${family}: ${token}`);
      postingCount += ids.length;
    }
    const sourceWords = prepareSearchWordIndex(original), compiledWords = prepareSearchWordIndex(compiled);
    assert.deepEqual(compiledWords.vocabulary, sourceWords.vocabulary);
    assert.deepEqual([...compiledWords.aliases.keys()], [...sourceWords.aliases.keys()]);
    for (const [word, ids] of sourceWords.aliases) assert.deepEqual(Array.from(compiledWords.aliases.get(word)), Array.from(ids));
    for (const query of queries) {
      for (const word of searchWords(query)) assert.deepEqual(searchWordPosting(compiled, word), searchWordPosting(original, word));
      for (const mode of ['words','exact']) for (const allowed of [null,new Set(),new Set(catalog.slice(0,20).map(row=>row.id))]) {
        const tokens = searchWords(query);
        assert.deepEqual(candidateSectionIDs(compiled,tokens,query,query,allowed,mode), candidateSectionIDs(original,tokens,query,query,allowed,mode));
      }
    }
  }
  const directory = pathToFileURL(`${temporary}/`);
  const fallback = new Map([['x',[1]]]);
  assert.equal(await createPreparedSearchRuntime({directory}).index('missing',()=>fallback),fallback);
  const catalog=[{id:1, codePrefix:'BC', codeVersion:'2022', title:'Fire-resistance', optional:undefined},
    {id:2, codePrefix:'BC', codeVersion:'2022', title:'Fire-resistance', other:null}];
  const index=new Map([['fire-resistance',[1,2]],['stairs',[2]]]);
  await prepareSearchRuntime('fixture',catalog,index,directory);
  const fixture=createPreparedSearchRuntime({directory});
  assert.deepEqual(await fixture.catalog('fixture'),catalog);
  assert.deepEqual(Array.from((await fixture.index('fixture',()=>assert.fail())).get('stairs')),[2]);
  await assert.rejects(fixture.index('../invalid',()=>assert.fail()),/Invalid/);
  assert.throws(()=>packSearchCatalog([{id:-1}]),/Unsupported/);
  const metaPath=new URL('fixture.runtime',directory), dataPath=new URL('fixture.postings',directory);
  const valid=await readFile(dataPath);await writeFile(dataPath,Buffer.alloc(valid.length));
  await assert.rejects(createPreparedSearchRuntime({directory}).index('fixture',()=>assert.fail()),/Corrupt/);
  await writeFile(dataPath,valid);
  const meta=deserialize(await readFile(metaPath));meta.ends[0]=-1;
  await writeFile(metaPath,serialize(meta));
  await assert.rejects(createPreparedSearchRuntime({directory}).index('fixture',()=>assert.fail()),/boundaries/);
  console.log(`Prepared Search runtime: exact catalogs and ${postingCount} section postings, prepared aliases/completion, exact/words scope parity, fallback and corruption guards passed.`);
} finally {
  await rm(temporary,{recursive:true,force:true});
}
