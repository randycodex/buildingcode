#!/usr/bin/env python3
"""Run production Project-cache IO and caller identity gates with Swift 6."""
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
cache = (ROOT / 'NYC CC APP/permitext/Data/ProjectHubOfflineCache.swift').read_text()
cache = cache[:cache.index('/// A new session invalidates')]
cache += '\nenum ResearchQuestionAttempt { static let cacheScope = "research-question-attempt" }\n'
model = (ROOT / 'NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift').read_text()
def method(start, end):
    a = model.index(start)
    return model[a:model.index(end, a)]
methods = method('    func projectHubSnapshot(folderID:', '    func refreshOrganizations()')
methods += method('    func organizationProjectSnapshot(', '    func organizationProjectReportURL(')

io = r'''
struct OffMainValue: Codable, Sendable, Equatable {
 let text: String
 init(_ text: String) { self.text = text }
 init(from decoder: Decoder) throws {
  precondition(!Thread.isMainThread, "Snapshot decoding must leave the UI thread")
  text = try decoder.singleValueContainer().decode(String.self)
 }
 func encode(to encoder: Encoder) throws {
  precondition(!Thread.isMainThread, "Snapshot encoding must leave the UI thread")
  var container = encoder.singleValueContainer()
  try container.encode(text)
 }
}
@main struct Check {
 @MainActor static func main() async throws {
  let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
  defer { try? FileManager.default.removeItem(at: directory) }
  let cache = ProjectHubOfflineCache(directoryURL: directory)
  let worker = ProjectHubOfflineCacheWorker.shared
  let value = OffMainValue(String(repeating: "snapshot ", count: 120000))
  try await worker.store(value, in: cache, accountID: "A", projectID: "P", scope: "personal")
  let loaded = try await worker.load(OffMainValue.self, from: cache, accountID: "A", projectID: "P", scope: "personal")
  precondition(loaded?.value == value)
  try await worker.store(OffMainValue("new"), in: cache, accountID: "A", projectID: "P", scope: "personal")
  let newest = try await worker.load(OffMainValue.self, from: cache, accountID: "A", projectID: "P", scope: "personal")
  precondition(newest?.value.text == "new", "Awaited writes retain their order")
  let other = try await worker.load(OffMainValue.self, from: cache, accountID: "B", projectID: "P", scope: "personal")
  precondition(other == nil, "Account-scoped reads remain isolated")
  let cancelled = Task { @MainActor in
   try await worker.store(OffMainValue("cancelled"), in: cache, accountID: "A", projectID: "P", scope: "personal")
  }
  cancelled.cancel()
  do { try await cancelled.value; preconditionFailure("Cancelled queued IO must not run") }
  catch is CancellationError {} catch { throw error }
  try cache.store("draft", accountID: "A", projectID: "P", scope: "native-notebook-draft:note")
  let invalidation = Task { @MainActor in
   try await worker.removeProject(from: cache, accountID: "A", projectID: "P")
  }
  invalidation.cancel()
  try await invalidation.value
  let removed = try await worker.load(OffMainValue.self, from: cache, accountID: "A", projectID: "P", scope: "personal")
  let draft = try cache.load(String.self, accountID: "A", projectID: "P", scope: "native-notebook-draft:note")
  precondition(removed == nil && draft?.value == "draft", "Cancellation cannot skip authorized invalidation; drafts remain retained")
  try cache.removeAccount(accountID: "A", knownProjectIDs: ["P"])
  do {
   try await worker.store(value, in: cache, accountID: "A", projectID: "P", scope: "personal")
   preconditionFailure("A queued snapshot cannot resurrect a deleted account")
  } catch ProjectHubOfflineCacheError.accountDeleted {} catch { throw error }
  print("PASS: actual cache encoding/decoding off-main, ordered round trip, cancellation, account isolation, draft retention and deletion tombstone")
 }
}
'''

caller = r'''
import Foundation
struct Account: Sendable { let appUserID = "A" }
struct Folder { let clientID = "P" }
enum UserContentProjectIdentity { static func stable(_ id: String, userID: String) -> String? { id } }
enum ProjectHubLoadError: Error { case projectUnavailable, signInRequired }
enum Failure: Error { case offline, denied }
struct ProjectHubSnapshot: Codable, Sendable {
 let value: String
 var cachedAt: String?
 func cachedCopy(at timestamp: String) -> Self { var copy = self; copy.cachedAt = timestamp; return copy }
}
typealias BackendOrganizationProjectSnapshotResponse = ProjectHubSnapshot
struct Cache: Sendable {}
@MainActor final class Backend {
 var failure: Failure?
 func projectHub(account: Account, projectID: String) async throws -> ProjectHubSnapshot {
  if let failure { throw failure }; return .init(value: "network")
 }
 func organizationProjectSnapshot(account: Account, projectID: String) async throws -> ProjectHubSnapshot {
  try await projectHub(account: account, projectID: projectID)
 }
}
struct CacheLoad<Value: Sendable>: Sendable { let value: Value; let cachedAt: String }
actor ProjectHubOfflineCacheWorker {
 static let shared = ProjectHubOfflineCacheWorker()
 var continuation: CheckedContinuation<Void, Never>?
 var expected = ""
 func prepare(_ stage: String) { precondition(continuation == nil); expected = stage }
 func ready() -> Bool { continuation != nil }
 func release() { continuation?.resume(); continuation = nil }
 func wait(_ stage: String) async {
  precondition(stage == expected)
  await withCheckedContinuation { continuation = $0 }
 }
 func store<Value: Codable & Sendable>(_ value: Value, in cache: Cache, accountID: String, projectID: String, scope: String) async throws { await wait("store") }
 func load<Value: Codable & Sendable>(_ type: Value.Type, from cache: Cache, accountID: String, projectID: String, scope: String) async throws -> CacheLoad<Value>? {
  await wait("load")
  return .init(value: try JSONDecoder().decode(type, from: Data(#"{"value":"cached"}"#.utf8)), cachedAt: "timestamp")
 }
 func removeProject(from cache: Cache, accountID: String, projectID: String) async throws { await wait("remove") }
}
enum NativePrivateCachePolicy {
 static func requiresInvalidation(after error: Error) -> Bool { (error as? Failure) == .denied }
 static func permitsOfflineFallback(after error: Error) -> Bool { (error as? Failure) == .offline }
}
@MainActor final class Model {
 var signedInAccount: Account? = .init()
 var privateRequestIdentity: Int? = 1
 let accountBackendClient = Backend()
 let projectHubOfflineCache = Cache()
 func folder(id: Int64) -> Folder? { .init() }
 METHODS
}
@main struct Check {
 @MainActor static func main() async throws {
  let worker = ProjectHubOfflineCacheWorker.shared
  for kind in ["personal", "organization"] {
   for stage in ["store", "load", "remove"] {
    for boundary in ["same", "account/session", "cancel"] {
     let model = Model()
     model.accountBackendClient.failure = stage == "load" ? .offline : stage == "remove" ? .denied : nil
     await worker.prepare(stage)
     let operation = Task { @MainActor in
      if kind == "personal" { return try await model.projectHubSnapshot(folderID: 1) }
      return try await model.organizationProjectSnapshot(projectID: "P")
     }
     while !(await worker.ready()) { await Task.yield() }
     if boundary == "account/session" { model.privateRequestIdentity = 2 }
     if boundary == "cancel" { operation.cancel() }
     await worker.release()
     do {
      let value = try await operation.value
      precondition(boundary == "same" && stage != "remove", "A stale/cancelled result cannot publish")
      precondition(value.value == (stage == "store" ? "network" : "cached"))
      precondition(value.cachedAt == (stage == "load" ? "timestamp" : nil))
     } catch is CancellationError {
      precondition(boundary != "same")
     } catch Failure.denied {
      precondition(stage == "remove" && boundary == "same", "Authorization failure cannot become cached success")
     } catch { throw error }
    }
   }
  }
  print("PASS: both production Project callers reject changed account/session or cancellation after every asynchronous cache boundary; fallback and denied behavior retained")
 }
}
'''.replace(' METHODS', methods)

with tempfile.TemporaryDirectory(prefix='permitext-project-cache-') as temporary:
    path = Path(temporary)
    for name, code in [('io', cache + '\n' + io), ('callers', caller)]:
        swift = path / f'{name}.swift'
        swift.write_text(code)
        subprocess.run(['xcrun', 'swiftc', '-parse-as-library', '-swift-version', '6', str(swift), '-o', str(path / name)], check=True)
        subprocess.run([str(path / name)], check=True)
