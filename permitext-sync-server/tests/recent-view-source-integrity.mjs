import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { syncCodeVersion, historicalConstructionSyncCodeVersion as historical, defaultSyncCodeVersion as current } from '../public/sync-identity.js';
import { mergeContinuityRecords } from '../continuity-merge.mjs';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function actual(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
const opened = [];
const options = [{ prefix: 'AC', label: '2022 Administrative', codeVersion: current }, { prefix: 'AC', label: '2014 Administrative', codeVersion: historical }, { prefix: 'BC', label: 'Building Code' }];
const c = vm.createContext({ syncCodeVersion, defaultSyncCodeVersion: current, historicalConstructionSyncCodeVersion: historical, codeOptions: options,
  chapters: [{ id: 1, codePrefix: 'AC', codeSectionID: 3, codeVersion: current, title: 'Wrong edition chapter' }],
  state: { recentlyViewedSections: [] }, swiftReferenceDateSeconds: () => 123,
  codeOptionVersion: option => syncCodeVersion(option.codeVersion),
  recentViewLimit: 50, saveWorkspaceState() {},
  codeOptionFor: (prefix, version) => options.find(o => o.prefix === prefix && o.codeVersion === version),
  codeDisplayLabel: (prefix, version) => `${prefix} ${version === historical ? '2014' : '2022'}`,
  paneIDForUtilityInstance: i => i.id, openSourceInReader: async (...args) => opened.push(args),
  recentlyViewedPreviewHasEnactedText: () => false,
  resolveSectionDetail: async () => { throw new Error('Legacy hydration must not guess a source'); },
  mergeRecentlyViewedDetails: () => false,
});
vm.runInContext(['recentViewCodePrefix', 'recentViewSourceVersion', 'recentViewNavigationSource', 'recentViewSourceLabel',
  'recentViewIdentity', 'recentViewEntryForReader', 'openRecentlyViewedInReader', 'hydrateSearchRecentlyViewedEntries'].map(actual).join('\n'), c);
const old = { sectionID: 7, codePrefix: 'AC', codeSectionID: 3, codeSectionName: '2022 Administrative', previewText: '', viewedAt: 1 };
const reader = { ...old, chapterID: 1, codeVersion: historical };
const entry = c.recentViewEntryForReader(reader);
assert.equal(entry.codeVersion, historical);
assert.equal(entry.sourceVersion, historical);
assert.equal(entry.codeSectionName, '2014 Administrative');
assert.equal(entry.chapterTitle, ''); // Same chapter ID in another edition must not be borrowed.
assert.equal(c.recentViewSourceLabel(entry), 'AC 2014');
assert.equal(c.recentViewSourceLabel(old), 'AC · Edition not recorded');
assert.notEqual(c.recentViewIdentity(old), c.recentViewIdentity(entry));
assert.notEqual(c.recentViewIdentity({ ...entry, codeVersion: current }), c.recentViewIdentity(entry));
assert.equal(c.recentViewIdentity({ ...old, sourceVersion: '2014 Construction Codes' }), c.recentViewIdentity(entry));
await c.openRecentlyViewedInReader({ id: 'search' }, old);
await c.openRecentlyViewedInReader({ id: 'search' }, { ...old, sourceVersion: historical });
assert.equal(Object.hasOwn(opened[0][0], 'codeVersion'), false);
assert.equal(opened[1][0].codeVersion, historical);
assert.equal(opened[0][0].sectionID, 7);
const legacyHydration = await c.hydrateSearchRecentlyViewedEntries([old]);
assert.equal(legacyHydration[0], old);
assert.match(source, /openSourceInReader\(recentViewNavigationSource\(entry\), paneIDForUtilityInstance\(instance\)/); // New-reader action shares exact identity.

const record = views => ({ userID: 'test', codeVersion: current, updatedAt: '2026-09-28T00:00:00.000Z', values: { recentlyViewedSectionsJSON: JSON.stringify(views) } });
const views = r => JSON.parse(r.values.recentlyViewedSectionsJSON);
const native = { ...old, sourceVersion: '2014 Construction Codes', viewedAt: 2 };
delete native.codePrefix;
const web = { ...entry, viewedAt: 3 };
const a = record([native, old]);
const b = record([web, { ...entry, sourceVersion: current, codeVersion: current, viewedAt: 4 }]);
const merged = mergeContinuityRecords(a, b);
assert.deepEqual(merged, mergeContinuityRecords(b, a));
assert.equal(views(merged).length, 3); // Alias/native-web merge, but 2014/2022/legacy remain separate.
assert.equal(views(merged).find(v => v.codeVersion === historical).viewedAt, 3);
const families = ['BC68', 'EBC', 'ECC', 'EC', 'FC', 'HMC', 'T24', 'T25', 'T26', 'T28', 'LL'];
const many = record(families.map((codePrefix, index) => ({ ...entry, sectionID: 100 + index, codePrefix, viewedAt: 3 })));
assert.equal(views(mergeContinuityRecords(many, many)).length, families.length);
console.log('Recently Viewed source integrity passed: exact entry/label, native alias, legacy navigation, no guessed hydration, edition-aware commutative merge and additional families.');

for (const [codePrefix, codeSectionName] of [['FC', 'Fire Code'], ['ECC', 'Energy Conservation Code']]) {
  const nativeEntry = { ...entry, sourceVersion: historical, codeSectionName, viewedAt: 2 };
  delete nativeEntry.codePrefix; delete nativeEntry.codeVersion;
  const webEntry = { ...entry, codePrefix, viewedAt: 3 };
  assert.equal(c.recentViewIdentity(nativeEntry), c.recentViewIdentity(webEntry));
  assert.equal(views(mergeContinuityRecords(record([nativeEntry]), record([webEntry]))).length, 1);
}

const unknown = { sectionID: 7, codeSectionName: 'Unrecognized family', sourceVersion: 'specialty-library' };
assert.equal(Object.hasOwn(c.recentViewNavigationSource(unknown), 'codePrefix'), false);
const legacyUnknown = { sectionID: 7, codeSectionName: ' Unknown Family ' };
assert.equal(c.recentViewIdentity(legacyUnknown), c.recentViewIdentity({ ...legacyUnknown, codeSectionName: 'unknown family' }));

assert.equal(c.recentViewSourceLabel({ ...entry, codeVersion: 'unknown-explicit-edition' }), 'AC · Source details unavailable');
// Run the actual preview merger: matching edition enriches, other editions and
// unresolved legacy retain their own text even when numeric section IDs overlap.
vm.runInContext(actual('mergeRecentlyViewedDetails'), c);
c.state.recentlyViewedSections = [
  { ...entry, previewText: '' },
  { ...entry, codeVersion: current, sourceVersion: current, previewText: 'Current edition text' },
  { ...old, previewText: 'Legacy text' },
];
assert.equal(c.mergeRecentlyViewedDetails([{ ...entry, previewText: 'Historical enacted text' }]), true);
assert.equal(c.state.recentlyViewedSections.length, 3);
assert.deepEqual(Array.from(c.state.recentlyViewedSections, item => item.previewText),
  ['Historical enacted text', 'Current edition text', 'Legacy text']);
console.log('Unknown edition labeling and actual cross-edition preview merge isolation passed.');
