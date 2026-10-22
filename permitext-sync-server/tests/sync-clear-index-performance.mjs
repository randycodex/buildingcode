import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
import * as identity from '../public/sync-identity.js';
import { indexBulkClears, bulkClearTimestamp, bulkClearEventID, recordSurvivesBulkClear, annotationAfterBulkClears } from '../public/sync-state.js';

const editions = [identity.defaultSyncCodeVersion, identity.historicalConstructionSyncCodeVersion,
  identity.zoningSyncCodeVersion, identity.existingBuildingSyncCodeVersion,
  identity.enactedAdministrativeSyncCodeVersion, identity.specialtyCodesSyncCodeVersion];
const aliases = ['nyc-2022', 'nyc-2014', 'nyc zoning resolution — text through 2026-10-21',
  'nyc-existing-building-code', 'nyc-enacted-administrative-code', 'nyc-2025-specialty-codes'];
for (const [index, edition] of editions.entries()) {
  for (const value of [edition, edition.toUpperCase(), edition.toLowerCase(), `  ${edition} `,
    aliases[index], aliases[index].toUpperCase()]) assert.equal(identity.syncCodeVersion(value), edition);
}
assert.equal(identity.syncCodeVersion('  Unknown Edition İ  '), 'Unknown Edition İ');
for (const empty of [undefined, null, '', ' ', false, 0]) assert.equal(identity.syncCodeVersion(empty), editions[0]);

// Count the costly operation directly. Common canonical records and exact
// aliases must not pay for locale setup on each identity comparison.
const source = await readFile(new URL('../public/sync-identity.js', import.meta.url), 'utf8');
const context = vm.createContext({ editions, aliases: aliases.slice(0, 2) });
vm.runInContext(source.replaceAll('export ', '') + `
  let localeCalls = 0;
  const originalLower = String.prototype.toLocaleLowerCase;
  String.prototype.toLocaleLowerCase = function (...args) { localeCalls++; return originalLower.apply(this, args); };
  for (let i = 0; i < 1000; i++) for (const value of [...editions, ...aliases]) syncCodeVersion(value);
  if (localeCalls !== 0) throw new Error('Canonical identity comparisons repeated locale conversion.');
`, context);

let clearReads = 0;
const clears = Array.from({ length: 72 }, (_, index) => ({
  get codeVersion() { clearReads++; return editions[index % editions.length]; },
  values: { scope: ['bookmarks', 'folders', 'notes', 'tags'][Math.floor(index / editions.length) % 4] },
  updatedAt: index % 7 ? new Date(Date.UTC(2026, 8, 1 + index % 12)).toISOString() : 'invalid',
  serverEventID: index % 11 ? 100 - index : 'invalid'
}));
const indexed = indexBulkClears(clears);
assert.equal(clearReads, clears.length);
for (const edition of editions) for (const scope of ['bookmarks', 'folders', 'notes', 'tags', 'missing']) {
  assert.equal(bulkClearTimestamp(indexed, edition, scope), bulkClearTimestamp(clears, edition, scope));
  assert.equal(bulkClearEventID(indexed, edition, scope), bulkClearEventID(clears, edition, scope));
}
const records = Array.from({ length: 1000 }, (_, index) => ({ codeVersion: editions[index % editions.length],
  updatedAt: index % 9 ? new Date(Date.UTC(2026, 8, 1 + index % 20)).toISOString() : '',
  serverEventID: index % 123, noteBody: 'Retain the independent note and tag semantics.', tags: ['test'] }));
for (const record of records) {
  assert.equal(recordSurvivesBulkClear(record, indexed, ['bookmarks', 'folders']),
    recordSurvivesBulkClear(record, clears, ['bookmarks', 'folders']));
  assert.deepEqual(annotationAfterBulkClears(record, indexed), annotationAfterBulkClears(record, clears));
}
clearReads = 0;
for (const record of records) annotationAfterBulkClears(record, indexed);
assert.equal(clearReads, 0, 'Lookups must not scan or renormalize the input clear records.');
const axes = [
  { codeVersion: aliases[0], values: { scope: 'notes' }, updatedAt: '2026-10-20', serverEventID: 1 },
  { codeVersion: editions[0], values: { scope: 'notes' }, updatedAt: '2026-10-01', serverEventID: 100 }
];
assert.equal(recordSurvivesBulkClear({ codeVersion: editions[0], updatedAt: '2026-10-21', serverEventID: 99 }, indexBulkClears(axes), ['notes']), false);
assert.equal(recordSurvivesBulkClear({ codeVersion: editions[0], updatedAt: '2026-10-19', serverEventID: 101 }, indexBulkClears(axes), ['notes']), false);
assert.equal(recordSurvivesBulkClear({ codeVersion: editions[0], updatedAt: '2026-10-21', serverEventID: 101 }, indexBulkClears(axes), ['notes']), true);
axes.push({ ...axes[1], updatedAt: '2026-10-22', serverEventID: 102 });
assert.equal(bulkClearEventID(indexBulkClears(axes), editions[0], 'notes'), 102, 'A new snapshot sees subsequent changes.');
const measure = lookup => { const start = performance.now();for (const record of records) annotationAfterBulkClears(record, lookup);return Math.round((performance.now() - start) * 100) / 100; };
const arrayMs = measure(clears);
clearReads = 0;
const indexedMs = measure(indexed);
console.log(JSON.stringify({ records: records.length, clearRecords: clears.length,
  arrayMs, indexedMs, parity: true, indexedClearScans: clearReads }));
console.log('Canonical identity and bulk-clear indexing passed: all editions, both deletion-order axes, tags/notes independence and fresh snapshot parity.');
