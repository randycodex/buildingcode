// Build-time public-source index; no questions, facts or generated answers.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { serialize, deserialize } from 'node:v8';
import { gzipSync, gunzipSync } from 'node:zlib';
import { preparedResearchSemanticCorpusIDs } from './research-semantic-artifact.mjs';
import { codeAssetRevision } from './code-asset-manifest.mjs';
import { researchPassageIndexVersion, mergeResearchPassageIndexes } from './research-passage-index.mjs';

export const preparedPassageDirectory = new URL('./prepared/research-passages/', import.meta.url);
const digest = value => createHash('sha256').update(value).digest('hex');
const catalogDigest = catalog => digest(JSON.stringify(catalog));
let implementationDigest;
async function implementation() {
  return implementationDigest ||= readFile(new URL('./research-passage-index.mjs', import.meta.url)).then(digest);
}
export async function encodePreparedPassages(corpus, catalog, index) {
  const strings = new Map();
  const packed = transform(index, value => {
    if (typeof value !== 'string') return undefined;
    if (!strings.has(value)) strings.set(value, { value });
    return strings.get(value);
  });
  const bytes = gzipSync(serialize({ strings: [...strings.values()], index: packed }), { level: 6 });
  return { bytes, manifest: {
    schemaVersion: 1, corpusID: corpus.id, codeVersion: corpus.codeVersion,
    indexVersion: researchPassageIndexVersion, implementationSHA256: await implementation(),
    publicAssetRevision: await codeAssetRevision(), buildCommit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    catalogSHA256: catalogDigest(catalog), sha256: digest(bytes),
    fingerprint: index.fingerprint, passageCount: index.passageCount
  } };
}
export async function decodePreparedPassages(corpus, catalog, bytes, manifest) {
  if (manifest?.schemaVersion !== 1 || manifest.corpusID !== corpus.id || manifest.codeVersion !== corpus.codeVersion ||
      manifest.indexVersion !== researchPassageIndexVersion || manifest.implementationSHA256 !== await implementation() ||
      manifest.publicAssetRevision !== await codeAssetRevision() ||
      manifest.buildCommit !== (process.env.VERCEL_GIT_COMMIT_SHA || null) ||
      manifest.catalogSHA256 !== catalogDigest(catalog) || manifest.sha256 !== digest(bytes)) {
    throw new Error('Prepared Research passage index is stale or corrupt');
  }
  const packed = deserialize(gunzipSync(bytes));
  const strings = new Map(packed.strings.map(entry => [entry, entry.value]));
  const index = transform(packed.index, value => strings.get(value));
  mergeResearchPassageIndexes([index]); // canonical identity/record invariants
  if (index.fingerprint !== manifest.fingerprint || index.passageCount !== manifest.passageCount ||
      catalogDigest([...index.sections.values()]) !== manifest.catalogSHA256) {
    throw new Error('Prepared Research passage index identity mismatch');
  }
  return index;
}
export async function loadPreparedPassages(corpus, catalog) {
  if (process.env.PERMITEXT_RESEARCH_BUILD_PASSAGES === '1') return null;
  if (!/^[a-z0-9-]+$/.test(corpus.id)) throw new Error('Invalid Research corpus ID');
  let bytes, manifest;
  try {
    [bytes, manifest] = await Promise.all([
      readFile(new URL(`${corpus.id}.bin.gz`, preparedPassageDirectory)),
      readFile(new URL(`${corpus.id}.json`, preparedPassageDirectory), 'utf8').then(JSON.parse)
    ]);
  } catch (error) {
    // Historical/opt-in corpora and local development may not have artifacts.
    // A present invalid artifact is never silently accepted or rebuilt.
    if (error.code === 'ENOENT' && !process.env.VERCEL) return null;
    if (error.code === 'ENOENT' && !currentPreparedCorpusIDs.has(corpus.id)) return null;
    throw error;
  }
  return decodePreparedPassages(corpus, catalog, bytes, manifest);
}
const currentPreparedCorpusIDs = new Set(preparedResearchSemanticCorpusIDs);

// V8 preserves object aliases but repeats string bytes. Interning repeated
// canonical text keeps the private artifact small without dropping any fields.
function transform(root, replace, seen = new Map()) {
  const replacement = replace(root);
  if (replacement !== undefined) return replacement;
  if (!root || typeof root !== 'object' || ArrayBuffer.isView(root)) return root;
  if (seen.has(root)) return seen.get(root);
  const result = root instanceof Map ? new Map() : Array.isArray(root) ? [] : {};
  seen.set(root, result);
  if (root instanceof Map) {
    for (const [key, value] of root) result.set(key, transform(value, replace, seen));
  } else {
    for (const [key, value] of Object.entries(root)) result[key] = transform(value, replace, seen);
  }
  return result;
}
