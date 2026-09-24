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
  for (let end = open + 1; end < source.length; end++) {
    if (source[end] === "{") depth++;
    if (source[end] === "}" && --depth === 0) return source.slice(start, end + 1);
  }
  throw new Error(`Unclosed method: ${signature}`);
}
const temporary = await mkdtemp(join(tmpdir(), "permitext-browse-scope-"));
try {
  const swift = `import Foundation
enum ContentKind { case authored, sqlite }
struct BundledCodeVersion { let codeVersion: String; let jurisdictionID: Int64?; let authoredCodeID: Int64?; var contentKind: ContentKind = .authored }
struct CodeSectionCategory { let id: Int64; let codeID: Int64 }
struct CodeChapter: Equatable { let id: Int64; let codeSectionID: Int64? }
enum UserContentSyncCodeVersion { static func server(_ value: String) -> String { value } }
struct Store { let values: [CodeChapter]; func chapters(codeSectionID: Int64?) -> [CodeChapter] { values.filter { codeSectionID == nil || $0.codeSectionID == codeSectionID } } }
struct NativeReaderPreparedOpening { let route: Int; let prepared: Int }
@MainActor final class NativeReaderDocumentStore {
 static let shared = NativeReaderDocumentStore()
 func rolloutRoute(for url: URL) async -> Int? { nil }
 func loadPreparedDocument(for route: Int) async throws -> Int { route }
}
@MainActor final class Harness {
 var activeCodeSources: ActiveCodeSources? = ActiveCodeSources()
 var selectedVersion: BundledCodeVersion? = .init(codeVersion: "2022", jurisdictionID: 1, authoredCodeID: 2)
 var codeSections = [CodeSectionCategory(id: 10, codeID: 2), CodeSectionCategory(id: 20, codeID: 2)]
 var chapters = [CodeChapter(id: 1, codeSectionID: 10), CodeChapter(id: 2, codeSectionID: 20)]
 var authoredCodeStore: Store? = nil
 var currentReaderChapterID: Int64 = 1
 var isInitialContentLoaded = true
 var isSearchInProgress = false
 var initialLoadProgress = 1.0
 var speculativeChapterIDs: Set<Int64> = []
 var warmedChapterIDs: Set<Int64> = []
 var chapterWarmupTasks: [Int64: Task<Void, Never>] = [:]
 var codeSectionWarmupTask: Task<Void, Never>?
 var warmed: [Int64] = []
 func startupPriorityChapters(from chapters: [CodeChapter]) -> [CodeChapter] { chapters }
 func warmChapterReaderEntry(chapter: CodeChapter, sectionLimit: Int) async { warmed.append(chapter.id) }
 func authoredHTMLWarmupTarget(for chapter: CodeChapter) -> (chapterURL: URL, readAccessURL: URL)? { nil }
 func suspendReaderWarmups() { codeSectionWarmupTask?.cancel(); chapterWarmupTasks.values.forEach { $0.cancel() }; speculativeChapterIDs = [] }
 ${method("    var enabledBrowseCodeSections:")}
 ${method("    func isChapterEnabledForBrowsing(")}
 ${method("    func browseChapters(")}
 ${method("    func chapters(for")}
 ${method("    nonisolated static func activeSourceIdentity(")}
 ${method("    func prewarmCodeSectionForBrowsing(")}
 ${method("    func prewarmChapterForBrowsing(")}
 ${method("    private func prewarmStartupPriorityChapters(").replace("private func", "func")}
 ${method("    func prepareChapterForOpening(")}
 ${method("    private func cancelSpeculativeChapterWork(")}
}
@main struct Run {
 @MainActor static func main() async throws {
  let h = Harness()
  let originalChapters = h.chapters
  precondition(h.enabledBrowseCodeSections.map(\\.id) == [10, 20])
  h.activeCodeSources?.disable(.init(canonicalEdition: "2022", jurisdictionID: 1, codeID: 2, categoryID: 10))
  precondition(h.codeSections.map(\\.id) == [10, 20])
  precondition(h.enabledBrowseCodeSections.map(\\.id) == [20])
  precondition(h.browseChapters(for: 10).isEmpty)
  precondition(h.browseChapters(for: nil).map(\\.id) == [2])
  precondition(h.chapters == originalChapters && h.chapters(for: 10).map(\\.id) == [1] && h.currentReaderChapterID == 1)
  precondition(!h.isChapterEnabledForBrowsing(.init(id: 99, codeSectionID: nil)))
  h.authoredCodeStore = Store(values: originalChapters)
  precondition(h.browseChapters(for: 10).isEmpty && h.chapters(for: 10).map(\\.id) == [1])
  h.prewarmCodeSectionForBrowsing(id: 10)
  precondition(h.speculativeChapterIDs.isEmpty && h.warmed.isEmpty)
  h.prewarmCodeSectionForBrowsing(id: 20)
  await h.codeSectionWarmupTask?.value
  precondition(h.warmed == [2])
  h.warmed = []; h.speculativeChapterIDs = [1, 2]
  h.prewarmChapterForBrowsing(originalChapters[0])
  precondition(h.chapterWarmupTasks[1] == nil)
  h.prewarmChapterForBrowsing(originalChapters[1])
  await h.chapterWarmupTasks[2]?.value
  precondition(h.warmed == [2])
  h.warmed = []
  await h.prewarmStartupPriorityChapters(originalChapters)
  precondition(h.warmed == [2] && h.speculativeChapterIDs == Set([2]))
  h.warmed = []
  _ = try await h.prepareChapterForOpening(originalChapters[0])
  precondition(h.warmed == [1] && h.currentReaderChapterID == 1)
  h.activeCodeSources = nil
  precondition(h.enabledBrowseCodeSections.isEmpty && h.browseChapters(for: nil).isEmpty)
  h.activeCodeSources = ActiveCodeSources()
  precondition(h.browseChapters(for: nil) == originalChapters)
  print("Active-source Browse passed: retained catalogs/Reader, enabled projections, disabled speculative warmup exclusion and explicit preparation preserved.")
 }
}
`;
  const main = join(temporary, "Harness.swift");
  const binary = join(temporary, "browse-scope");
  await writeFile(main, swift);
  execFileSync("swiftc", ["-parse-as-library", join(root, "NYC CC APP/permitext/Models/ActiveCodeSources.swift"), main, "-o", binary], { stdio: "inherit" });
  process.stdout.write(execFileSync(binary, [], { encoding: "utf8" }));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
