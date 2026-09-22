import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const base = new URL('../../NYC CC APP/permitext/', import.meta.url);
const models = await readFile(new URL('Models/CodeModels.swift', base), 'utf8');
const cache = await readFile(new URL('Data/CompletedSearchCache.swift', base), 'utf8');
function declaration(name) {
 const start = models.indexOf(name);
 assert.ok(start >= 0);
 let depth = 0, opened = false;
 for (let i = start; i < models.length; i++) {
  if (models[i] === '{') { depth++; opened = true; }
  if (models[i] === '}' && --depth === 0 && opened) return models.slice(start, i + 1);
  if (models[i] !== '}') continue;
 }
 throw new Error(`Unclosed ${name}`);
}
// These models contain no braces in string literals other than balanced interpolation.
const result = declaration('struct CodeSearchResult:').replace(/    var displayTitle: String \{[\s\S]*?\n    \}/, '');
const sourceModels = [declaration('enum CodeSectionKind:'), declaration('struct CodeSectionCategory:'), result].join('\n');
const dir = await mkdtemp(join(tmpdir(), 'permitext-search-cache-'));
try {
 const path = join(dir, 'Verify.swift');
 await writeFile(path, `import Foundation\n${sourceModels}\n${cache}\n
@main struct Verify {
 static func require(_ value: Bool, _ message: String) { precondition(value, message) }
 static func main() async throws {
  let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
  defer { try? FileManager.default.removeItem(at: root) }
  let cache = CompletedSearchCache(directory: root, maximumEntries: 2, maximumBytes: 100_000)
  func key(_ query: String, _ scope: [String] = ["2022", "2014"], _ corpus: String = "a", _ engine: String = "1") -> CompletedSearchCache.Key {
   .init(query: query, scope: scope, corpusRevision: corpus, engineRevision: engine)
  }
  var first = CodeSearchResult(id: 12, chapterNumber: "1", sectionNumber: "101", title: "Scope", snippet: "not persisted")
  first.sourceVersion = "2022"; first.searchFilterID = 42
  let second = CodeSearchResult(id: 11, codeSectionID: 3, chapterNumber: "2", sectionNumber: "201", title: "Definitions", snippet: "", kind: .textBlock)
  let filters = [CodeSectionCategory(id: 42, codeID: 1, name: "BC · 2022")]
  await cache.store(results: [first, second], filters: filters, for: key("concrete"))
  // A fresh actor must load from disk and preserve ordering, nils and filter metadata.
  let reopened = CompletedSearchCache(directory: root, maximumEntries: 2, maximumBytes: 100_000)
  let value = await reopened.value(for: key("concrete"))
  require(value?.results.map { $0.id } == [12, 11], "ranking must round-trip")
  require(value?.results.first?.codeSectionID == nil, "nil source ID")
  require(value?.results.first?.sourceVersion == "2022", "edition identity")
  require(value?.results.first?.snippet == "", "no snippet bodies persisted")
  require(value?.filters == filters, "filter metadata")
  for mismatch in [key("Concrete"), key("concrete", ["2014", "2022"]), key("concrete", ["2022"]), key("concrete", ["2022", "2014"], "b"), key("concrete", ["2022", "2014"], "a", "2")] {
   require(await reopened.value(for: mismatch) == nil, "key dimensions must invalidate")
  }
  await cache.store(results: [], filters: filters, for: key("empty"))
  require(await cache.value(for: key("empty"))?.results.isEmpty == true, "complete empty results cacheable")
  // Force the concrete entry's access time old, then read it to make empty the LRU.
  for url in try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil) {
   let text = try String(contentsOf: url, encoding: .utf8)
   if text.contains("concrete") { try FileManager.default.setAttributes([.modificationDate: Date(timeIntervalSince1970: 1)], ofItemAtPath: url.path) }
  }
  _ = await cache.value(for: key("concrete"))
  await cache.store(results: [second], filters: [], for: key("third"))
  require(await cache.value(for: key("empty")) == nil, "LRU eviction")
  require(await cache.value(for: key("concrete")) != nil, "recent hit survives")
  let cancel = Task {
   while !Task.isCancelled { await Task.yield() }
   await cache.store(results: [first], filters: [], for: key("cancelled"))
  }
  cancel.cancel(); await cancel.value
  require(await cache.value(for: key("cancelled")) == nil, "cancelled work never saved")
  // Corrupt every entry and require graceful misses.
  for url in try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil) {
   try Data("invalid".utf8).write(to: url)
  }
  require(await cache.value(for: key("concrete")) == nil, "corruption falls back")
  // Aggregate bytes, not only entry count, enforce eviction.
  let byteRoot = root.appendingPathComponent("byte-budget")
  let byteProbe = CompletedSearchCache(directory: byteRoot, maximumEntries: 10, maximumBytes: 100_000)
  await byteProbe.store(results: [first], filters: [], for: key("one"))
  let probeURL = try FileManager.default.contentsOfDirectory(at: byteRoot, includingPropertiesForKeys: nil)[0]
  let entryBytes = try Data(contentsOf: probeURL).count
  let byteBound = CompletedSearchCache(directory: byteRoot, maximumEntries: 10, maximumBytes: entryBytes + 20)
  await byteBound.store(results: [first], filters: [], for: key("two"))
  let survivors = try FileManager.default.contentsOfDirectory(at: byteRoot, includingPropertiesForKeys: nil)
  require(survivors.count == 1, "aggregate byte eviction")
  require(await byteBound.value(for: key("two")) != nil, "newest entry survives byte eviction")
  // Preexisting oversized files are rejected before decoding.
  try Data(repeating: 65, count: entryBytes + 21).write(to: survivors[0])
  require(await byteBound.value(for: key("two")) == nil, "oversized disk entry rejected")
  let small = CompletedSearchCache(directory: root.appendingPathComponent("small"), maximumEntries: 2, maximumBytes: 8)
  await small.store(results: [first], filters: [], for: key("too big"))
  require(await small.value(for: key("too big")) == nil, "oversize entry skipped")
  let blocker = root.appendingPathComponent("file-not-directory")
  try Data().write(to: blocker)
  let unavailable = CompletedSearchCache(directory: blocker)
  await unavailable.store(results: [], filters: [], for: key("disk failure"))
  require(await unavailable.value(for: key("disk failure")) == nil, "storage failure falls back")
  await cache.removeValue(for: key("third"))
  require(await cache.value(for: key("third")) == nil, "explicit invalidation")
  print("PASS: persistent search cache preserves ranking and metadata; keys isolate query/scope/corpus/engine; LRU, cancellation, corruption and storage failures are bounded")
 }
}
`);
 const binary = join(dir, 'verify');
 execFileSync('xcrun', ['swiftc', '-parse-as-library', path, '-o', binary], {stdio:'pipe'});
 console.log(execFileSync(binary, [], {encoding:'utf8'}).trim());
} finally { await rm(dir, {recursive:true, force:true}); }
