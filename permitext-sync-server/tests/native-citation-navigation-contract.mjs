import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const source = await readFile(join(root, "NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift"), "utf8");
function method(signature) {
  const start = source.indexOf(signature); assert.ok(start >= 0, signature);
  const open = source.indexOf("{", start); let depth = 1;
  for (let end = open + 1; end < source.length; end++) {
    if (source[end] === "{") depth++;
    if (source[end] === "}" && --depth === 0) return source.slice(start, end + 1);
  }
  throw new Error(signature);
}
const temporary = await mkdtemp(join(tmpdir(), "permitext-citation-navigation-"));
try {
  const main = join(temporary, "Harness.swift");
  await writeFile(main, `import Foundation
enum UserContentSyncCodeVersion { static func server(_ value: String) -> String { value == "alias" ? "2022" : value } }
enum Tab { case browse, search }
struct NavigationContext: Equatable {
 var accountID = "A"
 var sessionID = UUID()
 var sourceRevision = UUID()
}
@MainActor final class Harness {
 var citationNavigationTask: Task<Void, Never>?
 var versionLoadTask: Task<Void, Never>?
 var contentLoadTask: Task<Void, Never>?
 var privateSessionID = UUID()
 var activeCodeSourceRevision = UUID()
 var context: NavigationContext? = NavigationContext()
 var isInitialContentLoaded = true
 var selectedTab: Tab = .browse
 var selectedVersionFileName = "unchanged-reader"
 var pendingDeepLinkedSectionID: Int64?
 var pendingDeepLinkedCodeVersion: String?
 var pendingDeepLinkedError: String?
 var pendingDeepLinkedContext: NavigationContext?
 var pendingDeepLinkedSessionID: UUID?
 var pendingDeepLinkedSourceRevision: UUID?
 var resolution: ActiveCodeSourceNavigationAccess = .unavailable(.sourceNotFound)
 var resolutionCalls = 0
 var duringResolution: (() -> Void)?
 func captureCodeSourceNavigationContext() -> NavigationContext? { context }
 func authoredSourceNavigationAccess(sectionID: Int64) async -> ActiveCodeSourceNavigationAccess {
  resolutionCalls += 1; duringResolution?(); return resolution
 }
 ${method("    private func queueExplicitCitation(").replace("private func", "func")}
 ${method("    func consumePendingDeepLinkedDestination(")}
}
@main struct Run {
 @MainActor static func main() async {
  let h = Harness()
  h.queueExplicitCitation(sectionID: 50, codeVersion: "alias")
  await h.citationNavigationTask?.value
  let explicit = h.consumePendingDeepLinkedDestination()
  precondition(explicit?.sectionID == 50 && explicit?.codeVersion == "2022" && explicit?.error == nil)
  precondition(h.selectedVersionFileName == "unchanged-reader" && h.resolutionCalls == 0)
  precondition(h.consumePendingDeepLinkedDestination() == nil && h.pendingDeepLinkedCodeVersion == nil && h.pendingDeepLinkedError == nil && h.pendingDeepLinkedContext == nil)
  let target = ActiveCodeSourceNavigationTarget(sectionID: 50, source: .init(canonicalEdition: "2014", jurisdictionID: 1, codeID: 2, categoryID: 3))
  for access in [ActiveCodeSourceNavigationAccess.allowed(target), .requiresEnable(target)] {
   h.resolution = access
   h.queueExplicitCitation(sectionID: 50, codeVersion: nil)
   await h.citationNavigationTask?.value
   let destination = h.consumePendingDeepLinkedDestination()
   precondition(destination?.codeVersion == "2014" && destination?.error == nil)
   precondition(h.selectedVersionFileName == "unchanged-reader")
  }
  h.resolution = .unavailable(.ambiguousSource)
  h.queueExplicitCitation(sectionID: 50, codeVersion: nil)
  await h.citationNavigationTask?.value
  let missing = h.consumePendingDeepLinkedDestination()
  precondition(missing?.sectionID == 50 && missing?.codeVersion == nil && missing?.error != nil)
  h.queueExplicitCitation(sectionID: 50, codeVersion: "2022")
  h.citationNavigationTask?.cancel()
  await h.citationNavigationTask?.value
  precondition(h.consumePendingDeepLinkedDestination() == nil)
  h.resolution = .allowed(target)
  h.duringResolution = { h.context = NavigationContext() }
  h.queueExplicitCitation(sectionID: 50, codeVersion: nil)
  await h.citationNavigationTask?.value
  precondition(h.consumePendingDeepLinkedDestination() == nil)
  h.duringResolution = nil
  var release: CheckedContinuation<Void, Never>?
  h.contentLoadTask = Task { await withCheckedContinuation { release = $0 } }
  await Task.yield()
  h.queueExplicitCitation(sectionID: 50, codeVersion: "2022")
  h.context = NavigationContext()
  release?.resume()
  await h.citationNavigationTask?.value
  precondition(h.consumePendingDeepLinkedDestination() == nil)
  // Publication and consumption are separate lifecycle boundaries: Search can
  // wait for session restoration between them. Exercise the actual consumer.
  for mode in ["account", "source", "account-away-back", "source-away-back", "unavailable"] {
   let queued = Harness()
   queued.queueExplicitCitation(sectionID: 99, codeVersion: "2022")
   await queued.citationNavigationTask?.value
   precondition(queued.pendingDeepLinkedSectionID == 99)
   switch mode {
   case "account": queued.context?.accountID = "B"
   case "source": queued.context?.sourceRevision = UUID()
   case "account-away-back":
    queued.context?.accountID = "B"
    queued.context?.sessionID = UUID()
    queued.context?.accountID = "A"
   case "source-away-back":
    queued.context?.sourceRevision = UUID()
    queued.context?.sourceRevision = UUID()
   default: queued.context = nil
   }
   precondition(queued.consumePendingDeepLinkedDestination() == nil, "Obsolete published destination consumed: " + mode)
   precondition(queued.pendingDeepLinkedSectionID == nil && queued.pendingDeepLinkedCodeVersion == nil &&
    queued.pendingDeepLinkedError == nil && queued.pendingDeepLinkedContext == nil && queued.pendingDeepLinkedSessionID == nil && queued.pendingDeepLinkedSourceRevision == nil)
   precondition(queued.consumePendingDeepLinkedDestination() == nil)
   queued.context = NavigationContext()
   queued.queueExplicitCitation(sectionID: 100, codeVersion: "alias")
   await queued.citationNavigationTask?.value
   precondition(queued.consumePendingDeepLinkedDestination()?.sectionID == 100, "Fresh retry rejected")
  }
  let unavailable = Harness()
  unavailable.context = nil
  unavailable.queueExplicitCitation(sectionID: 99, codeVersion: "2022")
  await unavailable.citationNavigationTask?.value
  let unavailableDestination = unavailable.consumePendingDeepLinkedDestination()
  precondition(unavailableDestination?.error?.contains("Source preferences are unavailable") == true,
   "Unavailable preferences need a visible failure, never passage navigation")
  unavailable.queueExplicitCitation(sectionID: 99, codeVersion: "2022")
  await unavailable.citationNavigationTask?.value
  unavailable.privateSessionID = UUID()
  precondition(unavailable.consumePendingDeepLinkedDestination() == nil,
   "Nil contexts from different account sessions must not match")
  unavailable.queueExplicitCitation(sectionID: 99, codeVersion: "2022")
  await unavailable.citationNavigationTask?.value
  unavailable.activeCodeSourceRevision = UUID()
  precondition(unavailable.consumePendingDeepLinkedDestination() == nil,
   "Nil contexts across source revisions must not match")
  let launch = Harness()
  launch.isInitialContentLoaded = false
  var releaseVersion: CheckedContinuation<Void, Never>?
  var releaseContent: CheckedContinuation<Void, Never>?
  launch.versionLoadTask = Task {
   await withCheckedContinuation { releaseVersion = $0 }
   launch.contentLoadTask = Task {
    await withCheckedContinuation { releaseContent = $0 }
    launch.isInitialContentLoaded = true
   }
  }
  while releaseVersion == nil { await Task.yield() }
  launch.queueExplicitCitation(sectionID: 77, codeVersion: "alias")
  await Task.yield()
  precondition(launch.pendingDeepLinkedSectionID == nil)
  releaseVersion?.resume()
  while releaseContent == nil { await Task.yield() }
  precondition(launch.pendingDeepLinkedSectionID == nil)
  releaseContent?.resume()
  await launch.citationNavigationTask?.value
  let launched = launch.consumePendingDeepLinkedDestination()
  precondition(launched?.sectionID == 77 && launched?.codeVersion == "2022")
  precondition(launch.selectedVersionFileName == "unchanged-reader")
  print("Citation navigation passed: exact canonical queue, no Reader selection mutation, enable-required target, unavailable error, cancellation/context rejection before and after publication, fresh retry and one-shot consumption.")
 }
}
`);
  const binary = join(temporary, "citation-navigation");
  execFileSync("swiftc", ["-parse-as-library", join(root, "NYC CC APP/permitext/Models/ActiveCodeSources.swift"), main, "-o", binary], { stdio: "inherit" });
  process.stdout.write(execFileSync(binary, [], { encoding: "utf8", timeout: 15000 }));
} finally { await rm(temporary, { recursive: true, force: true }); }
