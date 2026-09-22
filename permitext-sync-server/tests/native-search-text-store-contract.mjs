import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, mkdir, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const source = await readFile(new URL('../../NYC CC APP/permitext/Data/SearchTextStore.swift', import.meta.url), 'utf8');
const authored = await readFile(new URL('../../NYC CC APP/permitext/Data/AuthoredCodeStore.swift', import.meta.url), 'utf8');
const signature = '    private func searchOfficialText(';
const start = authored.indexOf(signature);
const end = authored.indexOf('\n    }', start) + 6;
assert.ok(start >= 0 && end > start);
const helper = authored.slice(start, end);
const digest = value => createHash('sha256').update(value).digest('hex');
const dir = await mkdtemp(join(tmpdir(), 'permitext-search-pack-contract-'));
try {
 const cases = [];
 async function pack(name, mutate = () => {}, expected = null) {
  const root = join(dir, name); await mkdir(root);
  const fixture = {
   text: Buffer.from('concrete café'),
   index: {schemaVersion: 1, sections: {'1': [0, Buffer.byteLength('concrete café')], '2': [0, 0]}},
   manifest: {schemaVersion: 1, sourceRevision: 'fixture-v1', sectionCount: 2, textByteCount: Buffer.byteLength('concrete café')},
  };
  mutate(fixture);
  const index = Buffer.from(JSON.stringify(fixture.index));
  fixture.manifest.textSHA256 ??= digest(fixture.text);
  fixture.manifest.indexSHA256 ??= digest(index);
  if (!fixture.missingText) await writeFile(join(root, 'searchText.utf8'), fixture.text);
  if (!fixture.missingIndex) await writeFile(join(root, 'searchTextIndex.json'), index);
  if (!fixture.missingManifest) await writeFile(join(root, 'searchTextManifest.json'), JSON.stringify(fixture.manifest));
  cases.push({name, path: root, expected});
 }
 await pack('valid', () => {}, 'concrete café');
 await pack('manifest-schema', f => { f.manifest.schemaVersion = 2; });
 await pack('index-schema', f => { f.index.schemaVersion = 2; });
 await pack('missing-manifest', f => { f.missingManifest = true; });
 await pack('missing-text', f => { f.missingText = true; });
 await pack('missing-index', f => { f.missingIndex = true; });
 await pack('bad-text-digest', f => { f.manifest.textSHA256 = '0'.repeat(64); });
 await pack('bad-index-digest', f => { f.manifest.indexSHA256 = '0'.repeat(64); });
 await pack('wrong-byte-count', f => { f.manifest.textByteCount += 1; });
 await pack('wrong-section-count', f => { f.manifest.sectionCount += 1; });
 await pack('negative-start', f => { f.index.sections['1'][0] = -1; });
 await pack('negative-length', f => { f.index.sections['1'][1] = -1; });
 await pack('past-end', f => { f.index.sections['1'][0] = 999; });
 await pack('length-overflow', f => { f.index.sections['1'][1] = Number.MAX_SAFE_INTEGER; });
 await pack('span-arity', f => { f.index.sections['1'].push(1); });
 await pack('invalid-section-id', f => { f.index.sections.bad = f.index.sections['1']; delete f.index.sections['1']; });
 await pack('invalid-utf8', f => { f.text = Buffer.from([0xff]); f.manifest.textByteCount = 1; f.index.sections['1'] = [0, 1]; });
 await writeFile(join(dir, 'cases.json'), JSON.stringify(cases));
 const swift = `import Foundation
struct Section { let id: Int64 }
struct IndexedSection { let section: Section }
struct Fixture: Decodable { let name: String; let path: String; let expected: String? }
final class Harness {
 let searchTextStore: SearchTextStore
 init(_ store: SearchTextStore) { searchTextStore = store }
 func officialText(for indexed: IndexedSection) -> String { "authoritative fallback" }
 ${helper}
 func text(_ id: Int64) -> String { searchOfficialText(for: IndexedSection(section: Section(id: id))) }
}
let fixtures = try JSONDecoder().decode([Fixture].self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
for fixture in fixtures {
 let store = SearchTextStore(preparedURL: URL(fileURLWithPath: fixture.path))
 precondition(store.text(sectionID: 1) == fixture.expected, fixture.name)
 precondition(Harness(store).text(1) == (fixture.expected ?? "authoritative fallback"), "Fallback: \\(fixture.name)")
 precondition(Harness(store).text(999) == "authoritative fallback", "Missing section fallback")
 if fixture.name == "valid" {
  precondition(store.text(sectionID: 2) == "", "Empty resolved body is valid")
  precondition(Harness(store).text(2) == "", "Empty result must not fall back")
  precondition(store.revision != nil)
 }
}
print("PASS: \\(fixtures.count) real SearchTextStore pack validation cases; authoritative fallback and empty text preserved")
`;
 await writeFile(join(dir, 'main.swift'), swift);
 await writeFile(join(dir, 'SearchTextStore.swift'), source);
 execFileSync('xcrun', ['swiftc', join(dir, 'main.swift'), join(dir, 'SearchTextStore.swift'), '-o', join(dir, 'check')], {stdio: 'pipe'});
 console.log(execFileSync(join(dir, 'check'), [join(dir, 'cases.json')], {encoding: 'utf8'}).trim());
} finally { await rm(dir, {recursive: true, force: true}); }
