#!/usr/bin/env python3
"""Exercise production Search session persistence in fresh actor instances."""
from pathlib import Path
import subprocess
import tempfile
ROOT = Path(__file__).resolve().parents[2]
source = (ROOT / 'NYC CC APP/permitext/Views/SearchView.swift').read_text()
model = source[source.index('struct SearchSessionSnapshot:'):source.index('struct SearchReaderRoute:')]
cache = (ROOT / 'NYC CC APP/permitext/Data/ProjectHubOfflineCache.swift').read_text()
cache = cache[:cache.index('enum NativePrivateCachePolicy')]
cache += '\nenum ResearchQuestionAttempt { static let cacheScope = "research-question-attempt" }\n'
harness = r'''
@main struct Contract {
 static func main() async throws {
  precondition(!SearchSessionSnapshot.canRestoreQuery(original: "", current: "", originalGeneration: 0, currentGeneration: 2), "Type then clear must defeat stale restoration")
  precondition(SearchSessionSnapshot.canRestoreQuery(original: "", current: "", originalGeneration: 0, currentGeneration: 0))
  let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
  defer { try? FileManager.default.removeItem(at: directory) }
  let cache = ProjectHubOfflineCache(directoryURL: directory)
  let store = SearchSessionPersistence(cache: cache)
  var concrete = SearchSessionSnapshot(); concrete.query = "concrete"
  concrete.resultPositionID = "2022:261"; concrete.selectedResultIdentity = "2022:261"
  await store.save(concrete, accountID: "A", revision: 1)
  let fresh = SearchSessionPersistence(cache: cache)
  let restored = await fresh.load(accountID: "A")
  precondition(restored == concrete, "New process-like store must restore exact snapshot")
  let other = await fresh.load(accountID: "B")
  let guest = await fresh.load(accountID: "permitext-signed-out-search")
  precondition(other.query.isEmpty && guest.query.isEmpty, "Account/guest isolation")
  var newer = concrete; newer.query = "steel"
  await store.save(newer, accountID: "A", revision: 3)
  await store.save(concrete, accountID: "A", revision: 2)
  let ordered = await fresh.load(accountID: "A")
  precondition(ordered.query == "steel", "Late older request cannot overwrite newer")
  await store.save(SearchSessionSnapshot(), accountID: "A", revision: 4)
  let cleared = await fresh.load(accountID: "A")
  precondition(cleared.query.isEmpty, "Empty query persists")
  await store.save(concrete, accountID: "B", revision: 5)
  try cache.removeAccount(accountID: "B")
  await store.save(newer, accountID: "B", revision: 6)
  let deleted = await fresh.load(accountID: "B")
  precondition(deleted.query.isEmpty, "Deleted account cannot restore or recreate state")
  let writer = Task { await store.save(concrete, accountID: "C", revision: 7) }
  try await Task.sleep(for: .milliseconds(20))
  await store.flush()
  let flushed = await fresh.load(accountID: "C")
  precondition(flushed == concrete, "Lifecycle flush persists pending snapshot")
  await writer.value
  let burstOld = Task { await store.save(concrete, accountID: "D", revision: 8) }
  try await Task.sleep(for: .milliseconds(20))
  let burstNew = Task { await store.save(newer, accountID: "D", revision: 9) }
  await burstOld.value; await burstNew.value
  let burst = await fresh.load(accountID: "D")
  precondition(burst.query == "steel", "Coalesced burst preserves newest snapshot")
  let deletedPending = Task { await store.save(concrete, accountID: "E", revision: 10) }
  try await Task.sleep(for: .milliseconds(20))
  try cache.removeAccount(accountID: "E")
  let pendingDeleted = await store.load(accountID: "E")
  precondition(pendingDeleted.query.isEmpty, "Tombstone defeats pending in-memory snapshot")
  await deletedPending.value
  await store.save(newer, accountID: "F", revision: 12, flushImmediately: true)
  await store.save(concrete, accountID: "F", revision: 11)
  let immediate = await fresh.load(accountID: "F")
  precondition(immediate.query == "steel", "Immediate lifecycle write defeats older queued save")
  let enumerator = FileManager.default.enumerator(at: directory, includingPropertiesForKeys: nil)!
  for case let url as URL in enumerator.allObjects where url.pathExtension == "json" {
   try Data("not json".utf8).write(to: url)
  }
  let corrupt = await fresh.load(accountID: "A")
  precondition(corrupt.query.isEmpty, "Corrupt cache safely falls back")
  await MainActor.run {
   RunningSearchSessions.snapshots["A|all-installed-editions"] = concrete
   RunningSearchSessions.remove(accountID: "A")
   precondition(RunningSearchSessions.snapshots["A|all-installed-editions"] == nil)
   precondition(RunningSearchSessions.deletionGenerations["A"] == 1)
  }
  print("Production Search session persistence checks passed")
 }
}
'''
with tempfile.TemporaryDirectory(prefix='permitext-session-') as tmp:
    path = Path(tmp)
    swift = path / 'contract.swift'
    swift.write_text('import Foundation\n' + cache + '\n' + model + '\n' + harness)
    subprocess.run(['swiftc', '-parse-as-library', '-swift-version', '6', str(swift), '-o', str(path/'contract')], check=True)
    subprocess.run([str(path/'contract')], check=True)
