import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const source = await readFile(new URL('../../NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift', import.meta.url), 'utf8');
function between(start, end) {
 const a = source.indexOf(start), b = source.indexOf(end, a);
 assert.ok(a >= 0 && b > a); return source.slice(a, b);
}
// Execute production state/reconciliation code with deterministic repository and
// corpus fixtures. No SwiftUI or bundled 35 MB corpus is needed for this contract.
const methods = between('    private func refreshSearchReaderSavedControls()', '    // MARK: - Folders')
 + between('    func reconcileExternalSavedWorkChange(\n', '    func resolveReferences(');
const factory = between('    func makeSearchReaderLibrary(', '    func searchReaderTarget(');
assert.match(factory, /model\.refreshSearchReaderSavedControls\(\)/);
assert.match(factory, /model\.sharedSavedSessionID = privateSessionID/);
assert.doesNotMatch(factory, /model\.refreshBookmarks\(\)/);
const session = between('    func synchronizeIndependentReaderSession(', '    /// Reconciles a mutation');
assert.match(session, /userContentRepository = sharedLibrary\.userContentRepository/);
assert.match(session, /sharedSavedSessionID != sharedLibrary\.privateSessionID/);
assert.match(session, /cancelProjectPresentationRefresh\(\)/);
const clear = between('    private func clearCaches()', '    func suspendReaderWarmups(');
assert.match(clear, /hasDeferredSavedPresentation = true/);
const folder = between('    func refreshFolders(', '    private func scheduleProjectPresentationRefresh(');
assert.match(folder, /scheduleProjectPresentation: Bool = true/);
assert.match(folder, /if scheduleProjectPresentation \{ scheduleProjectPresentationRefresh\(\) \}/);
const dir = await mkdtemp(join(tmpdir(), 'permitext-saved-deferral-'));
try {
 const swift = join(dir, 'Verify.swift');
 await writeFile(swift, `import Foundation
struct Version { let codeVersion: String }
struct Account { let appUserID: String }
struct Annotation { let sectionID: Int64 }
struct Row: Equatable { let id: Int64; let codeVersion: String; var rowID: String { "\\(codeVersion):\\(id)" } }
enum UserContentSyncCodeVersion { static func server(_ value: String) -> String { value } }
enum BookmarkSorter {
 enum Mode { case codeOrder }
 static func sorted(_ rows: [Row], mode: Mode, codeSectionName: (Int64?) -> String) -> [Row] { rows.sorted { $0.rowID < $1.rowID } }
}
enum Fault: Error { case failed }
final class Repository {
 var ids: [Int64] = [1, 2]; var notes: [Int64: String] = [3: "note"]
 var tags: [Int64: [String]] = [4: ["tag"]]; var annotations = [Annotation(sectionID: 5)]
 var calls: [String] = []; var failing: String?
 func check(_ name: String) throws { calls.append(name); if failing == name { throw Fault.failed } }
 func bookmarkedSectionIDs(codeVersion: String) throws -> [Int64] { try check("ids"); return ids }
 func noteEntries(codeVersion: String) throws -> [Int64: String] { try check("notes"); return notes }
 func tagsBySectionID(codeVersion: String) throws -> [Int64: [String]] { try check("tags"); return tags }
 func annotationEntries(codeVersion: String) throws -> [Annotation] { try check("annotations"); return annotations }
 func bookmarkCreatedAtBySectionID(codeVersion: String) throws -> [Int64: Date] { try check("dates"); return [:] }
}
final class Corpus {
 func savedSections(ids: [Int64], codeVersion: String, bookmarkedSectionIDs: Set<Int64>, notesBySectionID: [Int64: String], tagsBySectionID: [Int64: [String]], annotationEntries: [Annotation], bookmarkCreatedAtBySectionID: [Int64: Date]) -> [Row] { ids.map { Row(id: $0, codeVersion: codeVersion) } }
}
final class CodeLibraryViewModel {
 var selectedVersion: Version? = Version(codeVersion: "2014")
 var signedInAccount: Account? = Account(appUserID: "a")
 var userContentRepository: Repository? = Repository()
 var authoredCodeStore: Corpus? = Corpus(); var codeDatabase: Corpus?
 var hasDeferredSavedPresentation = false; var savedPresentationRefreshTask: Task<Void, Never>?
 var bookmarks: [Row] = []; var bookmarkedSectionIDs: Set<Int64> = []
 var externallyLoadedBookmarksByCodeVersion: [String: [Row]] = [:]
 var projectBookmarksByFolderID: [Int64: [Row]] = [:]
 var projectEvidenceRecordCountByFolderID: [Int64: Int] = [:]
 var bookmarkRevision = 0; var statusMessage: String?
 weak var sharedAccountLibrary: CodeLibraryViewModel?
 var folderRefreshes: [Bool] = []; var syncCount = 0; var cancelCount = 0
 func refreshFolders(scheduleProjectPresentation: Bool = true) { folderRefreshes.append(scheduleProjectPresentation) }
 func cancelProjectPresentationRefresh() { cancelCount += 1 }
 func scheduleUserContentAutoSync() { syncCount += 1 }
 func synchronizeIndependentReaderSession(from owner: CodeLibraryViewModel) {}
 func codeSectionName(id: Int64?) -> String { "BC" }
 func initialize() { refreshSearchReaderSavedControls() }
${methods}
}
let reader = CodeLibraryViewModel()
let repo = reader.userContentRepository!
reader.initialize()
precondition(reader.bookmarkedSectionIDs == [1, 2])
precondition(reader.bookmarks.isEmpty && reader.hasDeferredSavedPresentation)
precondition(repo.calls == ["ids"] && reader.folderRefreshes == [false])
// A mutation before full hydration changes only one local optimistic row.
repo.ids.append(6); reader.bookmarks = [Row(id: 6, codeVersion: "2014")]
let owner = CodeLibraryViewModel(); owner.selectedVersion = Version(codeVersion: "2022")
owner.reconcileExternalSavedWorkChange(from: reader, scheduleAccountSync: true)
precondition(!reader.hasDeferredSavedPresentation)
precondition(Set(owner.externallyLoadedBookmarksByCodeVersion["2014"]!.map(\\.id)) == [1,2,3,4,5,6])
precondition(owner.syncCount == 1)
// Every evidence query failure must retain the owner's previous complete rows.
for name in ["ids", "notes", "tags", "annotations", "dates"] {
 reader.initialize(); repo.failing = name
 let previous = owner.externallyLoadedBookmarksByCodeVersion
 let syncs = owner.syncCount
 owner.reconcileExternalSavedWorkChange(from: reader, scheduleAccountSync: true)
 precondition(reader.hasDeferredSavedPresentation)
 precondition(owner.externallyLoadedBookmarksByCodeVersion == previous)
 precondition(owner.syncCount == syncs + 1)
 repo.failing = nil
 owner.reconcileExternalSavedWorkChange(from: reader, scheduleAccountSync: false)
 precondition(!reader.hasDeferredSavedPresentation)
}
// Missing repository/corpus cannot turn a deferred snapshot into authoritative empty rows.
reader.initialize(); reader.authoredCodeStore = nil
let previous = owner.externallyLoadedBookmarksByCodeVersion
owner.reconcileExternalSavedWorkChange(from: reader, scheduleAccountSync: true)
precondition(reader.hasDeferredSavedPresentation && owner.externallyLoadedBookmarksByCodeVersion == previous)
reader.authoredCodeStore = Corpus(); reader.userContentRepository = nil
owner.reconcileExternalSavedWorkChange(from: reader, scheduleAccountSync: true)
precondition(reader.hasDeferredSavedPresentation && owner.externallyLoadedBookmarksByCodeVersion == previous)
// A mismatched account must not contribute any historical rows or sync.
reader.userContentRepository = repo; reader.signedInAccount = Account(appUserID: "b")
let calls = repo.calls.count
owner.reconcileExternalSavedWorkChange(from: reader, scheduleAccountSync: true)
precondition(repo.calls.count == calls && owner.externallyLoadedBookmarksByCodeVersion == previous)
// Default full refresh retains its existing best-effort optional-category semantics.
let normal = CodeLibraryViewModel(); normal.userContentRepository!.failing = "annotations"
normal.refreshBookmarks()
precondition(!normal.bookmarks.isEmpty && normal.folderRefreshes == [true])
print("Search reader immediate controls, deferred full evidence, failure/retry, missing corpus, account isolation, and default behavior passed.")
`);
 const executable = join(dir, 'verify');
 execFileSync('swiftc', [swift, '-o', executable], {stdio: 'pipe'});
 process.stdout.write(execFileSync(executable, {encoding:'utf8'}));
} finally { await rm(dir, {recursive:true, force:true}); }
