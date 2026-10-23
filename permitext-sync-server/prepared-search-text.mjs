import {open, readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRetryableLazyLoader} from './retryable-lazy-loader.mjs';

export const searchSectionTextKey = section => [section.codeVersion || '', section.codePrefix || '', section.webSectionID || section.id].join(':');
export const searchTextDigest = bytes => createHash('sha256').update(bytes).digest('hex');

export function createPreparedSearchTextReader({
  directory = new URL('./generated/search-catalogs/', import.meta.url),
  sourceOnly = () => process.env.PERMITEXT_BUILD_SEARCH_CATALOGS === '1'
} = {}) {
  const load = createRetryableLazyLoader(async () => {
    let manifest, file;
    try {
      manifest = JSON.parse(await readFile(new URL('search-text.json', directory), 'utf8'));
      file = await open(new URL('search-text.utf8', directory), 'r');
    } catch (error) {
      await file?.close();
      if (error.code === 'ENOENT' && !process.env.VERCEL) return null;
      throw error;
    }
    try {
      const size = (await file.stat()).size;
      if (manifest.schemaVersion !== 1 || manifest.buildCommit !== (process.env.VERCEL_GIT_COMMIT_SHA || null) ||
          manifest.bytes !== size || !manifest.records || !Object.keys(manifest.records).length) {
        throw new Error('Invalid prepared search text manifest');
      }
      return {file, size, records:manifest.records};
    } catch (error) {
      await file.close();
      throw error;
    }
  });
  return async (section, sourceLoader) => {
    if (sourceOnly()) return sourceLoader();
    const artifact = await load();
    if (!artifact) return sourceLoader();
    const record = artifact.records[searchSectionTextKey(section)];
    if (!Array.isArray(record) || !Number.isSafeInteger(record[0]) || !Number.isSafeInteger(record[1]) ||
        record[0] < 0 || record[1] < 0 || record[0] + record[1] > artifact.size) {
      throw new Error('Missing or invalid prepared search text identity');
    }
    const [offset, length, sha256] = record;
    // Read just this passage. Never retain the full corpus blob or rich chapter
    // objects in order to answer a small Search preview.
    const bytes = Buffer.alloc(length);
    let read = 0;
    while (read < length) {
      const result = await artifact.file.read(bytes, read, length - read, offset + read);
      if (!result.bytesRead) throw new Error('Truncated prepared search text');
      read += result.bytesRead;
    }
    if (searchTextDigest(bytes) !== sha256) throw new Error('Corrupt prepared search text');
    return bytes.toString('utf8');
  };
}

export const preparedSearchText = createPreparedSearchTextReader();
