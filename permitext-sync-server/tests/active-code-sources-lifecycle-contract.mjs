import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const source = await readFile(join(root, "NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift"), "utf8");
function method(signature, text = source) {
  const source = text;
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
// Use the production partial-publication closure, with telemetry removed only.
const partialPublication = method("await MainActor.run", source.slice(source.indexOf("let partialStores = stores")))
  .replace("await MainActor.run", "")
  .split("\n").filter(line => !line.includes("os_signpost(") && !line.includes("signpostID: searchSignpostID")).join("\n");
assert.ok(method("    private func clearCaches()").includes("resetSearchForContentReplacement()"));
const temporary = await mkdtemp(join(tmpdir(), "permitext-source-lifecycle-"));
try {
  const swift = `import Foundation
struct Account { let appUserID: String }
struct BundledCodeVersion { let codeVersion: String; let jurisdictionID: Int64?; let authoredCodeID: Int64?; var fileURL: URL = URL(fileURLWithPath: "/unused") }
struct CodeSectionCategory { let id: Int64; let codeID: Int64; var name: String = "Category" }
struct BrowseStore {
 func codeSections() -> [CodeSectionCategory] { [] }
 func chapters(codeSectionID: Int64?) -> [Int] { [1] }
}
enum UserContentSyncCodeVersion { static func server(_ value: String) -> String { value } }
@MainActor final class Harness {
 var selectedCodeSectionID: Int64? = 2
 var authoredCodeStore: BrowseStore? = BrowseStore()
 var codeSections: [CodeSectionCategory] = []
 var chapters: [Int] = []
 func persistContinuityContext() {}
 static func sortedCodeSections(_ values: [CodeSectionCategory]) -> [CodeSectionCategory] { values }
 func prewarmCodeSectionForBrowsing(id: Int64?) {}
 ${method("    func updateSelectedCodeSection(")}
 var activeCodeSources: ActiveCodeSources? = nil
 var activeCodeSourcesError: String? = nil
 var ownsAccountSync = true
 var sharedAccountLibrary: Harness? = nil
 let preferencesDefaults: UserDefaults
 var signedInAccount: Account? = nil
 var activeCodeSourceRevision = UUID()
 var searchContentRevision = UUID()
 var allEditionSearchGeneration = UUID()
 var searchTask: Task<Void, Never>? = nil
 var activeSearchWorkTask: Task<Void, Never>? = nil
 var startupWarmupTask: Task<Void, Never>? = nil
 var isSearchInProgress = true
 var searchResults = ["stale"]
 var allEditionSearchSections = ["stale"]
 var allEditionSearchStores = ["stale"]
 var allEditionSearchError: String? = "stale"
 var allEditionSearchWarnings = ["stale"]
 var warmupCancellations = 0
 init(_ defaults: UserDefaults, owner: Bool = true, shared: Harness? = nil) {
  preferencesDefaults = defaults; ownsAccountSync = owner; sharedAccountLibrary = shared
  reloadActiveCodeSourcePreferences()
 }
 func cancelSpeculativeChapterWork() { warmupCancellations += 1 }
 ${method("    nonisolated static func activeSourceIdentity(")}
 ${method("    nonisolated static func allowedSearchCategoryIDs(")}
 ${method("    nonisolated static func searchCategoryMetadata(")}
 ${method("    private func invalidateActiveSourceWork(")}
 ${method("    private func resetSearchForContentReplacement(")}
 func resetContent() { resetSearchForContentReplacement() }
 func publishQueuedPartial(generation: UUID, partialResults: [String], partialFilters: [String], partialStores: [String]) ${partialPublication}
 ${method("    func reloadActiveCodeSourcePreferences(")}
 ${method("    func updateActiveCodeSource(")}
}
@main struct Run {
 @MainActor static func main() throws {
  let name = "active-source-lifecycle-" + UUID().uuidString
  let defaults = UserDefaults(suiteName: name)!
  defer { defaults.removePersistentDomain(forName: name) }
  let queued = Harness(defaults)
  queued.searchResults = ["completed-all-editions"]
  let unchangedRevision = queued.searchContentRevision
  queued.updateSelectedCodeSection(id: 2)
  precondition(queued.searchResults == ["completed-all-editions"] && queued.searchContentRevision == unchangedRevision)
  queued.updateSelectedCodeSection(id: 3)
  precondition(queued.searchResults.isEmpty && queued.searchContentRevision != unchangedRevision)
  let oldGeneration = queued.allEditionSearchGeneration
  let oldContentRevision = queued.searchContentRevision
  queued.searchResults = ["partial-before-2014"]
  queued.isSearchInProgress = true
  queued.resetContent()
  queued.publishQueuedPartial(generation: oldGeneration, partialResults: ["stale-partial"], partialFilters: ["old"], partialStores: ["old"])
  precondition(queued.searchResults.isEmpty && queued.allEditionSearchSections.isEmpty)
  precondition(!queued.isSearchInProgress && queued.searchContentRevision != oldContentRevision)
  queued.publishQueuedPartial(generation: queued.allEditionSearchGeneration, partialResults: ["fresh"], partialFilters: ["new"], partialStores: ["new"])
  precondition(queued.searchResults == ["fresh"], "Current owner must still publish")
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
  let version = BundledCodeVersion(codeVersion: "2022", jurisdictionID: 1, authoredCodeID: 2)
  let categories = [CodeSectionCategory(id: 3, codeID: 2), CodeSectionCategory(id: 4, codeID: 2)]
  var preferences = ActiveCodeSources()
  precondition(Harness.allowedSearchCategoryIDs(version: version, categories: categories, preferences: preferences) == nil)
  preferences.disable(identity)
  precondition(Harness.allowedSearchCategoryIDs(version: version, categories: categories, preferences: preferences) == Set([4]))
  preferences.disable(.init(canonicalEdition: "2022", jurisdictionID: 1, codeID: 2, categoryID: 4))
  precondition(Harness.allowedSearchCategoryIDs(version: version, categories: categories, preferences: preferences) == Set<Int64>())
  precondition(Harness.allowedSearchCategoryIDs(version: .init(codeVersion: "2014", jurisdictionID: 1, authoredCodeID: 2), categories: categories, preferences: preferences) == nil)
  precondition(Harness.allowedSearchCategoryIDs(version: .init(codeVersion: "2022", jurisdictionID: nil, authoredCodeID: 2), categories: categories, preferences: preferences) == nil)
  let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
  try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
  defer { try? FileManager.default.removeItem(at: directory) }
  let object: [String: Any] = ["codeSections": [["id": 3, "codeID": 2, "name": "Building"], ["id": 8, "codeID": 9, "name": "Other"]]]
  for ext in ["json", "plist"] {
   var metadataVersion = version
   metadataVersion.fileURL = directory.appendingPathComponent("metadata." + ext)
   let data = ext == "json" ? try JSONSerialization.data(withJSONObject: object) : try PropertyListSerialization.data(fromPropertyList: object, format: .binary, options: 0)
   try data.write(to: metadataVersion.fileURL)
   let metadata = try Harness.searchCategoryMetadata(version: metadataVersion)
   precondition(metadata.count == 1 && metadata[0].id == 3 && metadata[0].name == "Building")
   try Data("broken".utf8).write(to: metadataVersion.fileURL)
   do { _ = try Harness.searchCategoryMetadata(version: metadataVersion); preconditionFailure("Malformed metadata accepted") } catch {}
  }
  let corpus = URL(fileURLWithPath: CommandLine.arguments[1]).appendingPathComponent("NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city")
  let adminEdition = "CodeContent/authored/new-york-city/2026-enacted-administrative-code/bundle.json#1"
  let adminVersion = BundledCodeVersion(codeVersion: adminEdition, jurisdictionID: 1, authoredCodeID: 1, fileURL: corpus.appendingPathComponent("2026-enacted-administrative-code/bundle.json"))
  let adminCategories = try Harness.searchCategoryMetadata(version: adminVersion)
  precondition(adminCategories.count == 8)
  var only1968Off = ActiveCodeSources()
  only1968Off.disable(.init(canonicalEdition: adminEdition, jurisdictionID: 1, codeID: 1, categoryID: 4))
  precondition(Harness.allowedSearchCategoryIDs(version: adminVersion, categories: adminCategories, preferences: only1968Off) == Set([1,2,3,5,6,7,8]))
  let version2022 = BundledCodeVersion(codeVersion: "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1", jurisdictionID: 1, authoredCodeID: 1, fileURL: corpus.appendingPathComponent("2022-construction-codes/bundle.json"))
  let categories2022 = try Harness.searchCategoryMetadata(version: version2022)
  precondition(categories2022.contains(where: { $0.id == 4 }))
  precondition(Harness.allowedSearchCategoryIDs(version: version2022, categories: categories2022, preferences: only1968Off) == nil)
  print("Active-source lifecycle passed: actual methods restore owner/shadow, preserve corruption, isolate accounts, cancel work/reset generation and validate identity.")
 }
}
`;
  const main = join(temporary, "Harness.swift");
  await writeFile(main, swift);
  const binary = join(temporary, "lifecycle");
  execFileSync("swiftc", ["-parse-as-library", join(root, "NYC CC APP/permitext/Models/ActiveCodeSources.swift"), main, "-o", binary], { stdio: "pipe" });
  process.stdout.write(execFileSync(binary, [root], { encoding: "utf8" }));
  // Exercise the real SwiftUI scheduling methods, including their duplicate-ID
  // guard and debounce task. A source change must resubmit an unchanged query.
  const view = await readFile(join(root, "NYC CC APP/permitext/Views/SearchView.swift"), "utf8");
  const scheduling = `import Foundation
@MainActor final class Library {
 var activeCodeSourceRevision = UUID()
 var searchContentRevision = UUID()
 var selectedVersionFileName = "2022"
 var selectedCodeSectionID: Int64? = nil
 var isInitialContentLoaded = true
 var submissions: [(UUID, String)] = []
 func searchAllEditions(query: String) { submissions.append((activeCodeSourceRevision, query)) }
}
@MainActor final class Scheduler {
 let library = Library()
 var sessionScope = "owner"
 var restoredSessionScope: String? = "owner"
 var query = "concrete"
 var submittedSearchTaskID: String? = nil
 var isSearchRequestPending = false
 var searchDebounceTask: Task<Void, Never>? = nil
 ${method("    private var searchTaskID:", view)}
 ${method("    private func scheduleSearch()", view).split("\n").filter(line => !line.includes("os_signpost(")).join("\n")}
 func schedule() { scheduleSearch() }
}
@main struct Run {
 @MainActor static func main() async throws {
  let s = Scheduler()
  s.schedule()
  try await Task.sleep(for: .milliseconds(350))
  precondition(s.library.submissions.count == 1)
  s.schedule()
  try await Task.sleep(for: .milliseconds(350))
  precondition(s.library.submissions.count == 1, "Same completed scope must not repeat")
  s.library.activeCodeSourceRevision = UUID()
  let disabledScope = s.library.activeCodeSourceRevision
  s.schedule()
  try await Task.sleep(for: .milliseconds(350))
  precondition(s.library.submissions.count == 2, "Same query must rerun after source toggle")
  precondition(s.library.submissions.last!.0 == disabledScope && s.library.submissions.last!.1 == "concrete")
  s.library.activeCodeSourceRevision = UUID()
  s.schedule()
  // Change scope again during debounce: only the latest scope may submit.
  s.library.activeCodeSourceRevision = UUID()
  let restoredScope = s.library.activeCodeSourceRevision
  s.schedule()
  try await Task.sleep(for: .milliseconds(350))
  precondition(s.library.submissions.count == 3)
  precondition(s.library.submissions.last!.0 == restoredScope)
  precondition(!s.isSearchRequestPending)
  s.library.searchContentRevision = UUID()
  s.schedule()
  try await Task.sleep(for: .milliseconds(350))
  precondition(s.library.submissions.count == 4, "Same-edition content replacement must rerun retained query")
  s.sessionScope = "other-account"
  s.library.searchContentRevision = UUID()
  s.schedule()
  try await Task.sleep(for: .milliseconds(350))
  precondition(s.library.submissions.count == 4, "Unrestored account must not inherit a search resubmission")
  print("Actual Search scheduler passed: unchanged-query source rerun, duplicate suppression and rapid-toggle debounce ownership.")
 }
}
`;
  const schedulerMain = join(temporary, "Scheduler.swift");
  const schedulerBinary = join(temporary, "scheduler");
  await writeFile(schedulerMain, scheduling);
  execFileSync("swiftc", ["-parse-as-library", schedulerMain, "-o", schedulerBinary], { stdio: "pipe" });
  process.stdout.write(execFileSync(schedulerBinary, [], { encoding: "utf8" }));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
