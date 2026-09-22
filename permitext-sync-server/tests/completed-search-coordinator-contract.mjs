import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const source = await readFile(new URL('../../NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift', import.meta.url), 'utf8');
const start = source.indexOf('    func searchAllEditions(query: String)');
const end = source.indexOf('    func search(query:', start);
assert.ok(start > 0 && end > start);
// Keep the production coordinator; remove only platform logging invocations.
const coordinator = source.slice(start, end)
 .replace(/\s*let searchSignpostID = OSSignpostID\([^\n]*\)/g, '')
 .replace(/os_signpost\([\s\S]*?\)\n/g, '');
const dir = await mkdtemp(join(tmpdir(), 'permitext-search-coordinator-'));
try {
 const path = join(dir, 'Verify.swift');
 await writeFile(path, `import Foundation
struct CodeSearchResult: Equatable, Sendable {
 let id: Int64; let codeSectionID: Int64?; let chapterNumber: String
 let sectionNumber: String; let title: String; let snippet: String; let kind: String
 var sourceVersion: String? = nil; var sourceEdition: String? = nil
 var sourceCodeName: String? = nil; var searchFilterID: Int64? = nil
}
struct CodeSectionCategory: Equatable, Sendable { let id: Int64; let codeID: Int64; let name: String }
struct Version: Sendable {
 enum Kind: Sendable { case authored, sqlite }
 let fileName: String; let codeVersion: String; let fileURL: URL
 let contentKind: Kind; let authoredCodeID: Int64?; let jurisdictionID: Int64?
}
enum UserContentSyncCodeVersion {
 static let canonicalNYC2022 = "2022"
 static func server(_ value: String) -> String { value }
}
enum NativeReaderEditionLabel { static func label(for value: String) -> String { value } }
enum FixtureError: Error { case unavailable }
final class AuthoredCodeStore: @unchecked Sendable {
 static let lock = NSLock()
 static var loadFailures: Set<String> = []
 static var missingRevisions: Set<String> = []
 static var cancelDuringSearch: Set<String> = []
 static var searchCalls: [String] = []
 static var blockedEdition: String?
 static let started = DispatchSemaphore(value: 0)
 static let release = DispatchSemaphore(value: 0)
 let edition: String
 init(jsonURL: URL, codeID: Int64?, jurisdictionID: Int64?) throws {
  edition = jsonURL.lastPathComponent
  if Self.loadFailures.contains(edition) { throw FixtureError.unavailable }
 }
 var searchCorpusRevision: String? { Self.missingRevisions.contains(edition) ? nil : "revision-" + edition }
 func codeSections() -> [CodeSectionCategory] { [.init(id: 10, codeID: 1, name: "BC")] }
 func validatesSearchResult(_ result: CodeSearchResult) -> Bool { result.id == (edition == "2022" ? 1 : 2) && result.codeSectionID == 10 }
 func search(query: String, includeSnippets: Bool, resultLimit: Int?) -> [CodeSearchResult] {
  Self.lock.lock(); Self.searchCalls.append(edition); Self.lock.unlock()
  if Self.blockedEdition == edition { Self.started.signal(); Self.release.wait() }
  if Task.isCancelled { return [] }
  if Self.cancelDuringSearch.contains(edition) { withUnsafeCurrentTask { $0?.cancel() }; return [] }
  if query == "empty" { return [] }
  return [.init(id: edition == "2022" ? 1 : 2, codeSectionID: 10, chapterNumber: "1", sectionNumber: "101", title: "Scope", snippet: "", kind: "title")]
 }
 static func reset() { loadFailures = []; missingRevisions = []; cancelDuringSearch = []; searchCalls = []; blockedEdition = nil }
}
struct BundleDatabaseLocator {}
struct CodeDatabase {
 init(databaseURL: URL, locator: BundleDatabaseLocator) throws {}
 func search(query: String) throws -> [CodeSearchResult] { throw FixtureError.unavailable }
}
actor CompletedSearchCache {
 static let shared = CompletedSearchCache()
 struct Key: Hashable, Sendable { let query: String; let scope: [String]; let corpusRevision: String; let engineRevision: String }
 struct Snapshot: Sendable { let results: [CodeSearchResult]; let filters: [CodeSectionCategory] }
 var entries: [Key: Snapshot] = [:]
 var writes = 0
 var hits = 0
 func value(for key: Key) -> Snapshot? { if entries[key] != nil { hits += 1 }; return entries[key] }
 func store(results: [CodeSearchResult], filters: [CodeSectionCategory], for key: Key) {
  guard !Task.isCancelled else { return }; writes += 1; entries[key] = Snapshot(results: results, filters: filters)
 }
 func removeValue(for key: Key) { entries[key] = nil }
 func reset() { entries = [:]; writes = 0; hits = 0 }
 func stats() -> (Int, Int) { (writes, hits) }
 func poisonFilters() { for (key, value) in entries { entries[key] = Snapshot(results: value.results, filters: []) } }
 func poisonIDs() { for (key, value) in entries { var result = value.results[0]; result = .init(id: -99, codeSectionID: 10, chapterNumber: "1", sectionNumber: "101", title: "Scope", snippet: "", kind: "title", sourceVersion: result.sourceVersion); entries[key] = Snapshot(results: [result], filters: value.filters) } }
}
@MainActor final class Harness {
 var allEditionSearchError: String?
 var allEditionSearchWarnings: [String] = []
 var allEditionSearchGeneration = UUID()
 var searchResults: [CodeSearchResult] = []
 var searchTask: Task<Void, Never>?
 var activeSearchWorkTask: Task<[CodeSearchResult], Never>?
 var isSearchInProgress = false
 var allEditionSearchStores: [String: AuthoredCodeStore] = [:]
 var allEditionSearchSections: [CodeSectionCategory] = []
 var availableVersions: [Version]
 var isInitialContentLoaded = false
 var authoredCodeStore: AuthoredCodeStore?
 var selectedVersionFileName = "2022"
 init(_ versions: [Version]) { availableVersions = versions }
 func cancelSpeculativeChapterWork() {}
 ${coordinator}
}
@main struct Run {
 static func require(_ value: Bool, _ message: String) { precondition(value, message) }
 @MainActor static func main() async throws {
  func versions() -> [Version] { ["2022", "2014"].map { Version(fileName: $0, codeVersion: $0, fileURL: URL(fileURLWithPath: "/" + $0), contentKind: .authored, authoredCodeID: 1, jurisdictionID: 1) } }
  func run(_ model: Harness, _ query: String = "concrete") async { model.searchAllEditions(query: query); await model.searchTask?.value }
  await CompletedSearchCache.shared.reset(); AuthoredCodeStore.reset()
  let first = Harness(versions()); await run(first)
  require(first.searchResults.map { $0.id } == [1, 2], "complete search order")
  require(await CompletedSearchCache.shared.stats().0 == 1, "exactly one complete write")
  let originalFilters = first.allEditionSearchSections
  AuthoredCodeStore.searchCalls = []
  let cold = Harness(versions()); await run(cold)
  require(AuthoredCodeStore.searchCalls.isEmpty, "cold hit avoids corpus search")
  require(cold.allEditionSearchStores.count == 2, "cold hit populates stores for previews/opening")
  require(cold.searchResults == first.searchResults && cold.allEditionSearchSections == originalFilters, "cold result/filter parity")
  require(!cold.isSearchInProgress, "cache hit completes loading state")
  await CompletedSearchCache.shared.poisonFilters()
  await run(Harness(versions()))
  require(AuthoredCodeStore.searchCalls.count == 2, "invalid filter metadata reruns search")
  AuthoredCodeStore.searchCalls = []
  await CompletedSearchCache.shared.poisonIDs()
  await run(Harness(versions()))
  require(AuthoredCodeStore.searchCalls.count == 2, "invalid identity reruns search")
  await CompletedSearchCache.shared.reset(); AuthoredCodeStore.reset()
  AuthoredCodeStore.loadFailures = ["2014"]
  let failed = Harness(versions()); await run(failed)
  require(failed.searchResults.count == 1 && failed.allEditionSearchWarnings.count == 1, "partial failure remains visible")
  require(await CompletedSearchCache.shared.stats().0 == 0, "failed/partial search never cached")
  await CompletedSearchCache.shared.reset(); AuthoredCodeStore.reset()
  AuthoredCodeStore.cancelDuringSearch = ["2014"]
  await run(Harness(versions()))
  require(await CompletedSearchCache.shared.stats().0 == 0, "cancelled after partial results never cached")
  await CompletedSearchCache.shared.reset(); AuthoredCodeStore.reset()
  AuthoredCodeStore.blockedEdition = "2014"
  let interrupted = Harness(versions())
  interrupted.searchAllEditions(query: "concrete")
  await Task.detached { AuthoredCodeStore.started.wait() }.value
  interrupted.searchTask?.cancel()
  AuthoredCodeStore.release.signal()
  await interrupted.searchTask?.value
  require(await CompletedSearchCache.shared.stats().0 == 0, "outer cancellation propagates before caching")
  await CompletedSearchCache.shared.reset(); AuthoredCodeStore.reset()
  AuthoredCodeStore.missingRevisions = ["2014"]
  let legacy = Harness(versions()); await run(legacy)
  require(legacy.searchResults.count == 2, "missing pack preserves fallback coverage")
  require(await CompletedSearchCache.shared.stats().0 == 0, "unknown revision never cached")
  await CompletedSearchCache.shared.reset(); AuthoredCodeStore.reset()
  await run(Harness(versions()), "empty")
  require(await CompletedSearchCache.shared.stats().0 == 1, "complete zero-results search cached")
  print("PASS: actual all-edition coordinator caches only complete valid revisions; failed/cancelled partials bypass; cold hits populate stores and preserve filters; invalid IDs fall back")
 }
}
`);
 const binary = join(dir, 'verify');
 execFileSync('xcrun', ['swiftc', '-parse-as-library', '-swift-version', '5', path, '-o', binary], {stdio:'pipe'});
 console.log(execFileSync(binary, [], {encoding:'utf8'}).trim());
} finally { await rm(dir, {recursive:true, force:true}); }
