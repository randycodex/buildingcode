import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
const run = promisify(execFile);
async function seed(profile) {
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const {stdout} = await run(process.execPath, [fileURLToPath(new URL('./populated-workspace-performance-fixture.mjs', import.meta.url)),
    '--port', String(port), '--profile', profile, '--visible-workload', 'matched', '--self-test-seed', 'true'],
    {timeout: 120000, maxBuffer: 1024 * 1024});
  const line = stdout.split('\n').find(line => line.startsWith('POPULATED_FIXTURE_RECEIPT '));
  assert.ok(line, 'Fixture must finish persisted-read assertions and return a receipt');
  return JSON.parse(line.slice('POPULATED_FIXTURE_RECEIPT '.length));
}
const small = await seed('small');
const large = await seed('large');
assert.deepEqual([small.saved, small.projects, small.notes], [12, 2, 4]);
assert.deepEqual([large.saved, large.projects, large.notes], [1000, 12, 60]);
assert.equal(small.matchedVisibleReceipt.stableContentSHA256, large.matchedVisibleReceipt.stableContentSHA256);
assert.deepEqual(small.matchedVisibleReceipt.canonicalSections, large.matchedVisibleReceipt.canonicalSections);
for (const fixture of [small, large]) {
  const visible = fixture.matchedVisibleReceipt;
  assert.deepEqual([visible.saved, visible.notes, visible.firstNoteParagraphs, visible.images, visible.reportBlocks], [3, 4, 1, 1, 8]);
  assert.equal(visible.persistedReadsVerified, true);
  assert.equal(visible.totalAccountNotes, fixture.notes);
}
console.log(`Matched visible workload HTTP contract passed: small12/2/4 and large1000/12/60; identical Project1 content hash ${small.matchedVisibleReceipt.stableContentSHA256}.`);
