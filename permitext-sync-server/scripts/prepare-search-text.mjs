import assert from 'node:assert/strict';
import {open, writeFile} from 'node:fs/promises';
import {searchSectionTextKey, searchTextDigest} from '../prepared-search-text.mjs';

export async function prepareSearchText(catalogs, readSource, directory) {
  const file = await open(new URL('search-text.utf8', directory), 'w');
  const records = Object.create(null);
  let offset = 0;
  try {
    for (const sections of Object.values(catalogs)) {
      for (let start = 0; start < sections.length; start += 16) {
        const batch = sections.slice(start, start + 16);
        const texts = await Promise.all(batch.map(readSource));
        const buffers = [];
        for (let index = 0; index < batch.length; ++index) {
          const key = searchSectionTextKey(batch[index]);
          const bytes = Buffer.from(texts[index], 'utf8');
          assert.equal(bytes.toString('utf8'), texts[index], 'Prepared text must retain exact Unicode and whitespace');
          const digest = searchTextDigest(bytes);
          if (records[key]) {
            assert.equal(records[key][2], digest, 'Aliased Search identities must have identical text');
            continue;
          }
          records[key] = [offset, bytes.length, digest];
          offset += bytes.length;
          buffers.push(bytes);
        }
        await file.writeFile(Buffer.concat(buffers));
      }
    }
  } finally {
    await file.close();
  }
  await writeFile(new URL('search-text.json', directory), JSON.stringify({schemaVersion:1,
    buildCommit:process.env.VERCEL_GIT_COMMIT_SHA || null, bytes:offset, records}));
  return {sections:Object.keys(records).length, bytes:offset};
}
