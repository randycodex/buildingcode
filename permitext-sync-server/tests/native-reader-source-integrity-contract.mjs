import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/', import.meta.url);
const index = JSON.parse(await readFile(new URL('native-reader-index.json', root), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
assert.ok(index.entries.length > 0);
for (const entry of index.entries) {
  assert.equal(sha(await readFile(new URL(entry.relativePath, root))), entry.sourceSHA256,
    `${entry.relativePath}: authored source changed without regenerating native Reader document; runtime would fall back to HTML`);
  const packed = await readFile(new URL(entry.documentPath, root));
  assert.equal(packed.length, entry.compressedByteCount, `${entry.relativePath}: compressed size mismatch`);
  assert.equal(sha(packed), entry.compressedSHA256, `${entry.relativePath}: compressed document hash mismatch`);
}
console.log(`PASS: ${index.entries.length} native Reader sources and compressed documents match indexed integrity metadata`);
