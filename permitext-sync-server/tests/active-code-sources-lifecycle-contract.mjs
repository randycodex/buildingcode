import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const source = await readFile(join(root, "NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift"), "utf8");
function method(signature) {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, signature);
  const open = source.indexOf("{", start);
  let depth = 1;
  for (let index = open + 1; index < source.length; index++) {
    if (source[index] === "{") depth++;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw Error(signature);
}
const temporary = await mkdtemp(join(tmpdir(), "permitext-source-lifecycle-"));
try {
  const swift = `import Foundation
struct Account { let appUserID: String }
struct BundledCodeVersion { let codeVersion: String; let jurisdictionID: Int64?; let authoredCodeID: Int64? }
struct CodeSectionCategory { let id: Int64; let codeID: Int64 }
enum UserContentSyncCodeVersion { static func server(_ value: String) -> String { value } }
@MainActor final class Harness {
 var activeCodeSources: ActiveCodeSources? = nil
 var activeCodeSourcesError: String? = nil
 var ownsAccountSync = true
 var sharedAccountLibrary: Harness? = nil
 let preferencesDefaults: UserDefaults
 var signedInAccount: Account? = nil
 var allEditionSearchGeneration = UUID()
 var searchTask: Task<Void, Never>? = nil
 var activeSearchWorkTask: Task<Void, Never>? = nil
 var startupWarmupTask: Task<Void, Never>? = nil
 var isSearchInProgress = true
 var searchResults = ["stale"]
 var allEditionSearchSections = ["stale"]
 var allEditionSearchError: String? = "stale"
 var allEditionSearchWarnings = ["stale"]
 var warmupCancellations = 0
 init(_ defaults: UserDefaults, owner: Bool = true, shared: Harness? = nil) {
  preferencesDefaults = defaults; ownsAccountSync = owner; sharedAccountLibrary = shared
  reloadActiveCodeSourcePreferences()
 }
 func cancelSpeculativeChapterWork() { warmupCancellations += 1 }
 ${method("    static func activeSourceIdentity(")}
 ${method("    private func invalidateActiveSourceWork(")}
 ${method("    func reloadActiveCodeSourcePreferences(")}
 ${method("    func updateActiveCodeSource(")}
}
@main struct Run {
 @MainActor static func main() throws {
  let name = "active-source-lifecycle-" + UUID().uuidString
  let defaults = UserDefaults(suiteName: name)!
  defer { defaults.removePersistentDomain(forName: name) }
  let identity = ActiveCodeSourceIdentity(canonicalEdition: "2022", jurisdictionID: 1, codeID: 2, categoryID: 3)
  let owner = Harness(defaults)
  precondition(owner.activeCodeSources?.isEnabled(identity) == true)
  owner.signedInAccount = Account(appUserID: "a")
  owner.reloadActiveCodeSourcePreferences()
  let beforeAccountChange = owner.allEditionSearchGeneration
  owner.signedInAccount = Account(appUserID: "same-defaults")
  owner.reloadActiveCodeSourcePreferences(forceInvalidation: true)
  precondition(owner.allEditionSearchGeneration != beforeAccountChange)
  owner.signedInAccount = Account(appUserID: "a")
  owner.reloadActiveCodeSourcePreferences(forceInvalidation: true)
  let search = Task<Void, Never> { try? await Task.sleep(nanoseconds: 1_000_000_000) }
  let work = Task<Void, Never> { try? await Task.sleep(nanoseconds: 1_000_000_000) }
  let warmup = Task<Void, Never> { try? await Task.sleep(nanoseconds: 1_000_000_000) }
  owner.searchTask = search; owner.activeSearchWorkTask = work; owner.startupWarmupTask = warmup
  let generation = owner.allEditionSearchGeneration
  precondition(owner.updateActiveCodeSource(identity, enabled: false))
  precondition(search.isCancelled && work.isCancelled && warmup.isCancelled)
  precondition(owner.allEditionSearchGeneration != generation && owner.searchTask == nil && owner.activeSearchWorkTask == nil)
  precondition(owner.searchResults.isEmpty && owner.allEditionSearchSections.isEmpty && owner.allEditionSearchWarnings.isEmpty && owner.allEditionSearchError == nil && !owner.isSearchInProgress)
  let stable = owner.allEditionSearchGeneration
  precondition(owner.updateActiveCodeSource(identity, enabled: false))
  precondition(owner.allEditionSearchGeneration == stable)
  let shadow = Harness(defaults, owner: false, shared: owner)
  precondition(shadow.activeCodeSources == owner.activeCodeSources)
  precondition(!shadow.updateActiveCodeSource(identity, enabled: true))
  owner.signedInAccount = Account(appUserID: "b"); owner.reloadActiveCodeSourcePreferences()
  precondition(owner.activeCodeSources?.isEnabled(identity) == true)
  shadow.reloadActiveCodeSourcePreferences()
  precondition(shadow.activeCodeSources == owner.activeCodeSources)
  owner.signedInAccount = Account(appUserID: "a"); owner.reloadActiveCodeSourcePreferences()
  precondition(owner.activeCodeSources?.isEnabled(identity) == false)
  let key = "permitext.active-code-sources.v1.account." + Data("a".utf8).base64EncodedString()
  let corrupt = Data("broken".utf8); defaults.set(corrupt, forKey: key)
  owner.reloadActiveCodeSourcePreferences()
  precondition(owner.activeCodeSources == nil && owner.activeCodeSourcesError != nil)
  precondition(!owner.updateActiveCodeSource(identity, enabled: true))
  precondition(defaults.data(forKey: key) == corrupt)
  shadow.reloadActiveCodeSourcePreferences()
  precondition(shadow.activeCodeSources == nil && shadow.activeCodeSourcesError == owner.activeCodeSourcesError)
  precondition(Harness.activeSourceIdentity(version: .init(codeVersion: "2022", jurisdictionID: 1, authoredCodeID: 2), category: .init(id: 3, codeID: 2)) == identity)
  precondition(Harness.activeSourceIdentity(version: .init(codeVersion: "2022", jurisdictionID: nil, authoredCodeID: 2), category: .init(id: 3, codeID: 2)) == nil)
  precondition(Harness.activeSourceIdentity(version: .init(codeVersion: "2022", jurisdictionID: 1, authoredCodeID: 2), category: .init(id: 3, codeID: 9)) == nil)
  print("Active-source lifecycle passed: actual methods restore owner/shadow, preserve corruption, isolate accounts, cancel work/reset generation and validate identity.")
 }
}
`;
  const main = join(temporary, "Harness.swift");
  await writeFile(main, swift);
  const binary = join(temporary, "lifecycle");
  execFileSync("swiftc", ["-parse-as-library", join(root, "NYC CC APP/permitext/Models/ActiveCodeSources.swift"), main, "-o", binary], { stdio: "pipe" });
  process.stdout.write(execFileSync(binary, [], { encoding: "utf8" }));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
