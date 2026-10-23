import {readFile} from 'node:fs/promises';
import {deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {endianness} from 'node:os';
import {createRetryableLazyLoader} from './retryable-lazy-loader.mjs';
import {prepareSearchWordIndex} from './public/search-words.js';

export const searchRuntimeDigest = bytes => createHash('sha256').update(bytes).digest('hex');

// Catalog string values repeat for thousands of sections. Store them once and
// retain their shared references when restoring the original record shapes.
export function unpackSearchCatalog({strings, shapes, rows}) {
  return rows.map(row => {
    const fields = shapes[row[0]], record = {};
    for (let cell = 1; cell < row.length; ++cell) {
      const value = row[cell];
      record[fields[cell - 1]] = typeof value === 'number' && value < 0 ? strings[-value - 1] : value;
    }
    return record;
  });
}

export function createPreparedSearchRuntime({directory = new URL('./generated/search-catalogs/', import.meta.url)} = {}) {
  const families = new Map();
  const familyLoaders = family => {
    if (!/^[a-zA-Z0-9]+$/.test(family)) throw new Error('Invalid Search runtime family');
    if (!families.has(family)) {
      const metadata = createRetryableLazyLoader(async () => {
        let bytes;
        try {bytes = await readFile(new URL(`${family}.runtime`, directory));}
        catch (error) {if (error.code === 'ENOENT' && !process.env.VERCEL) return null;throw error;}
        const payload = deserialize(bytes);
        if (payload.schemaVersion !== 1 || payload.family !== family || endianness() !== 'LE' ||
            payload.buildCommit !== (process.env.VERCEL_GIT_COMMIT_SHA || null)) throw new Error('Invalid prepared Search runtime');
        const {catalog, ...indexMetadata} = payload;
        return {...indexMetadata, catalog:unpackSearchCatalog(catalog)};
      });
      const index = createRetryableLazyLoader(async () => {
        const [meta, bytes] = await Promise.all([metadata(), readFile(new URL(`${family}.postings`, directory))
          .catch(error => {if (error.code === 'ENOENT' && !process.env.VERCEL) return null;throw error;})]);
        if (!meta && !bytes) return null;
        if (!meta || !bytes) throw new Error('Incomplete prepared Search runtime');
        if (bytes.length !== meta.bytes || bytes.length % 4 || searchRuntimeDigest(bytes) !== meta.sha256) throw new Error('Corrupt prepared Search postings');
        // Buffers from file reads are normally aligned. Preserve correct views
        // without copying on platforms where the allocator supplies an offset.
        const aligned = bytes.byteOffset % 4 ? Uint8Array.from(bytes) : bytes;
        const words = new Uint32Array(aligned.buffer, aligned.byteOffset, aligned.byteLength / 4);
        if ((meta.aliasEnds.at(-1) ?? meta.ends.at(-1) ?? 0) !== words.length) throw new Error('Invalid Search posting boundaries');
        const restore = (tokens, ends, begin = 0) => {
          if (tokens.length !== ends.length) throw new Error('Invalid Search posting boundaries');
          const map = new Map();
          for (let i = 0; i < tokens.length; ++i) {
            const end = ends[i];
            if (!Number.isSafeInteger(end) || end < begin || end > words.length) throw new Error('Invalid Search posting boundaries');
            map.set(tokens[i], words.subarray(begin, end));begin = end;
          }
          return map;
        };
        const result = restore(meta.tokens, meta.ends);
        const aliases = restore(meta.aliasTokens, meta.aliasEnds, meta.ends.at(-1) || 0);
        prepareSearchWordIndex(result, {aliases, vocabulary:meta.vocabulary});
        return result;
      });
      families.set(family, {metadata, index});
    }
    return families.get(family);
  };
  return {
    catalog:async family => (await familyLoaders(family).metadata())?.catalog || null,
    index:async (family, fallback) => {
      if (process.env.PERMITEXT_BUILD_SEARCH_CATALOGS === '1') return fallback();
      return await familyLoaders(family).index() || fallback();
    }
  };
}

export const preparedSearchRuntime = createPreparedSearchRuntime();
