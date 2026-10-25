import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {serialize} from 'node:v8';
import {endianness} from 'node:os';
import {prepareSearchWordIndex} from '../public/search-words.js';
import {searchRuntimeDigest, unpackSearchCatalog} from '../prepared-search-runtime.mjs';

export function packSearchCatalog(catalog) {
  const strings = [], stringIDs = new Map(), shapes = [], shapeIDs = new Map();
  const rows = catalog.map(record => {
    const fields = Object.keys(record), shapeKey = JSON.stringify(fields);
    if (!shapeIDs.has(shapeKey)) {shapeIDs.set(shapeKey, shapes.length);shapes.push(fields);}
    return [shapeIDs.get(shapeKey), ...fields.map(field => {
      const value = record[field];
      if (typeof value === 'string') {
        if (!stringIDs.has(value)) {stringIDs.set(value, strings.length);strings.push(value);}
        return -stringIDs.get(value) - 1;
      }
      assert.ok(value == null || typeof value === 'number' && Number.isSafeInteger(value) && value >= 0,
        `Unsupported Search catalog field: ${field}`);
      return value;
    })];
  });
  const packed = {strings, shapes, rows};
  assert.deepEqual(unpackSearchCatalog(packed), catalog);
  return packed;
}

export async function prepareSearchRuntime(family, catalog, index, directory) {
  assert.equal(endianness(), 'LE');
  const lexical = prepareSearchWordIndex(index);
  const tokens = [], ends = [], aliasTokens = [], aliasEnds = [], postings = [];
  let count = 0;
  const append = (map, keys, offsets) => {
    for (const [token, values] of map) {
      keys.push(token);
      const ids = Array.from(values);
      assert.ok(ids.every(id => Number.isSafeInteger(id) && id >= 0 && id <= 0xffffffff), 'Search identities must fit uint32');
      const buffer = new Uint32Array(ids);
      postings.push(Buffer.from(buffer.buffer));count += ids.length;offsets.push(count);
    }
  };
  append(index, tokens, ends);append(lexical.aliases, aliasTokens, aliasEnds);
  const bytes = Buffer.concat(postings);
  const metadata = serialize({schemaVersion:2, family, buildCommit:process.env.VERCEL_GIT_COMMIT_SHA || null,
    bytes:bytes.length, sha256:searchRuntimeDigest(bytes), catalog:packSearchCatalog(catalog),
    tokens, ends, aliasTokens, aliasEnds, vocabulary:lexical.vocabulary});
  await writeFile(new URL(`${family}.runtime`, directory), metadata);
  await writeFile(new URL(`${family}.postings`, directory), bytes);
  return {family, tokens:tokens.length, catalog:catalog.length, bytes:metadata.length + bytes.length};
}
