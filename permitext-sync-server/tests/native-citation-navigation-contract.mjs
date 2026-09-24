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
@MainActor final class Harness {
 var citationNavigationTask: Task<Void, Never>?
 var versionLoadTask: Task<Void, Never>?
 var contentLoadTask: Task<Void, Never>?
 var context: UUID? = UUID()
 var isInitialContentLoaded = true
 var selectedTab: Tab = .browse
 var selectedVersionFileName = "unchanged-reader"
 var pendingDeepLinkedSectionID: Int64?
 var pendingDeepLinkedCodeVersion: String?
 var pendingDeepLinkedError: String?
 var resolution: ActiveCodeSourceNavigationAccess = .unavailable(.sourceNotFound)
 var resolutionCalls = 0
 var duringResolution: (() -> Void)?
 func captureCodeSourceNavigationContext() -> UUID? { context }
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
  precondition(h.consumePendingDeepLinkedDestination() == nil && h.pendingDeepLinkedCodeVersion == nil && h.pendingDeepLinkedError == nil)
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
  h.duringResolution = { h.context = UUID() }
  h.queueExplicitCitation(sectionID: 50, codeVersion: nil)
  await h.citationNavigationTask?.value
  precondition(h.consumePendingDeepLinkedDestination() == nil)
  h.duringResolution = nil
  var release: CheckedContinuation<Void, Never>?
  h.contentLoadTask = Task { await withCheckedContinuation { release = $0 } }
  await Task.yield()
  h.queueExplicitCitation(sectionID: 50, codeVersion: "2022")
  h.context = UUID()
  release?.resume()
  await h.citationNavigationTask?.value
  precondition(h.consumePendingDeepLinkedDestination() == nil)
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
  print("Citation navigation passed: exact canonical queue, no Reader selection mutation, enable-required target, unavailable error, cancellation/context rejection and one-shot consumption.")
 }
}
`);
  const binary = join(temporary, "citation-navigation");
  execFileSync("swiftc", ["-parse-as-library", join(root, "NYC CC APP/permitext/Models/ActiveCodeSources.swift"), main, "-o", binary], { stdio: "inherit" });
  process.stdout.write(execFileSync(binary, [], { encoding: "utf8", timeout: 15000 }));
} finally { await rm(temporary, { recursive: true, force: true }); }
