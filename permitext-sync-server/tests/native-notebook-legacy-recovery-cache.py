#!/usr/bin/env python3
"""Exercise legacy note recovery preservation using the production disk cache."""
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
cache = (ROOT / 'NYC CC APP/permitext/Data/ProjectHubOfflineCache.swift').read_text()
cache = cache[:cache.index('enum NativePrivateCachePolicy')]
cache += '\nenum ResearchQuestionAttempt { static let cacheScope = "research-question-attempt" }\n'
harness = r'''
@main struct Contract {
 static func main() throws {
  let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
  defer { try? FileManager.default.removeItem(at: directory) }
  let cache = ProjectHubOfflineCache(directoryURL: directory)
  let recovery = "native-notebook-legacy-metadata:note:old-receipt"
  let draft = "native-notebook-draft:note"
  let server = "native-notebook-card:note"
  for scope in [recovery, draft, server] {
   try cache.store(["original": scope], accountID: "A", projectID: "P", scope: scope)
  }
  try cache.store(["other": "account"], accountID: "B", projectID: "P", scope: recovery)
  try cache.removeProject(accountID: "A", projectID: "P")
  let reopened = ProjectHubOfflineCache(directoryURL: directory)
  let retained = try reopened.load([String:String].self, accountID: "A", projectID: "P", scope: recovery)
  let retainedDraft = try reopened.load([String:String].self, accountID: "A", projectID: "P", scope: draft)
  let invalidated = try reopened.load([String:String].self, accountID: "A", projectID: "P", scope: server)
  precondition(retained?.value == ["original": recovery], "Recovery must survive normal project cache invalidation and reopen")
  precondition(retainedDraft != nil && invalidated == nil, "Normal draft retention and server invalidation must still work")
  let visibleDrafts = try reopened.entries([String:String].self, accountID: "A", projectID: "P", scopePrefix: "native-notebook-draft:")
  precondition(visibleDrafts.count == 1 && visibleDrafts[0].scope == draft, "Recovery must not create a phantom Note draft")
  try reopened.removeAccount(accountID: "A", knownProjectIDs: ["P"])
  let removed = try reopened.load([String:String].self, accountID: "A", projectID: "P", scope: recovery)
  let isolated = try reopened.load([String:String].self, accountID: "B", projectID: "P", scope: recovery)
  precondition(removed == nil && isolated?.value == ["other": "account"], "Account deletion must remove its recovery without touching another account")
  try reopened.removeProject(accountID: "B", projectID: "P", preservingDrafts: false)
  let fullyRemoved = try reopened.load([String:String].self, accountID: "B", projectID: "P", scope: recovery)
  precondition(fullyRemoved == nil, "Explicit full project removal must remove recovery")
  print("PASS: legacy metadata recovery survives ordinary invalidation, stays out of Notes, and honors account/full-project deletion.")
 }
}
'''
with tempfile.TemporaryDirectory(prefix='permitext-note-recovery-') as temporary:
    path = Path(temporary)
    swift = path / 'contract.swift'
    swift.write_text(cache + '\n' + harness)
    subprocess.run(['xcrun', 'swiftc', '-parse-as-library', '-swift-version', '6', str(swift), '-o', str(path / 'contract')], check=True)
    subprocess.run([str(path / 'contract')], check=True)
