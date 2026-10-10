import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const views = await readFile(new URL("../../NYC CC APP/permitext/Views/BookmarksView.swift", import.meta.url), "utf8");
const model = await readFile(new URL("../../NYC CC APP/permitext/Models/CodeModels.swift", import.meta.url), "utf8");
const library = await readFile(new URL("../../NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift", import.meta.url), "utf8");
function member(source, prefix) {
  const start = source.indexOf(`    ${prefix}`);
  const end = source.indexOf("\n    }", start);
  assert(start >= 0 && end > start);
  return source.slice(start, end + 6).replace("private ", "");
}
function enumeration(name) {
  const start = model.indexOf(`enum ${name} {`);
  assert(start >= 0);
  return model.slice(start, model.indexOf("\n}", start) + 2);
}
const dir = await mkdtemp(join(tmpdir(), "permitext-native-inbox-"));
await writeFile(join(dir, "main.swift"), `import Foundation
enum UserContentSyncCodeVersion { static func server(_ value: String) -> String { value } }
${enumeration("SavedEvidenceIdentity")}
enum BookmarkSortMode { case codeOrder, recentlySaved, codeBook, title }
${enumeration("BookmarkSorter")}
struct CodeFolder { enum Kind { case project, reference }; let id: Int64; let folderType: Kind }
struct Version { let codeVersion: String }
struct BookmarkedSection: Equatable {
 let id: Int64; let codeVersion: String; var annotationBlockID = ""; var noteBody = "";
 var codeSectionID: Int64? = 1; var codeSectionName = "Building Code";
 var chapterNumber = "1"; var sectionNumber = "101.1"; var displayTitle = "Title";
 var bookmarkedAt: Date?; var updatedAt: Date?;
 var rowID: String { "\\(codeVersion)|\\(id)|\\(annotationBlockID)" }
}
final class Repository {
 var links: [Int64: Set<String>] = [2: ["2022|3"]]
 var failID: Int64?
 func addSection(_ id: Int64, toFolder folder: Int64, codeVersion: String) throws {
  if id == failID { throw NSError(domain:"inbox", code:1) }
  links[folder, default: []].insert("\\(codeVersion)|\\(id)")
 }
}
final class Library {
 var folders = [CodeFolder(id:1,folderType:.project), CodeFolder(id:2,folderType:.project), CodeFolder(id:9,folderType:.reference)]
 var selectedVersion: Version? = Version(codeVersion:"2022")
 var bookmarks: [BookmarkedSection] = []
 var projectBookmarksByFolderID: [Int64:[BookmarkedSection]] = [:]
 var folderMembership: [Int64:[Int64]] = [:]
 var readerSaveDestination = "Project on phone"; var activeProject = "Research Project"
 var statusMessage: String?; var userContentRepository: Repository? = Repository()
 func requireProjectAccess() -> Bool { true }
 func folder(id:Int64) -> CodeFolder? { folders.first { $0.id == id } }
 func refreshFolders() {
  projectBookmarksByFolderID = Dictionary(uniqueKeysWithValues: folders.map { folder in
   (folder.id, bookmarks.filter { userContentRepository!.links[folder.id,default:[]].contains(SavedEvidenceIdentity.section(version:$0.codeVersion,sectionID:$0.id)) })
  })
 }
 func scheduleUserContentAutoSync() {}
 ${member(library, "func restoreProjectSections(")}
}
final class Inbox {
 let library: Library; init(_ library:Library) { self.library = library }
 var inboxSelecting = true; var inboxSelectedRowIDs = Set<String>(); var assignmentError: String?
 func rebuildBookmarkCaches() {}
 ${member(views, "private var unassignedBookmarks:")}
 ${member(views, "private func assignInboxEvidence(")}
}
let library = Library()
let old = BookmarkedSection(id:1,codeVersion:"2014",noteBody:"Historical note",bookmarkedAt:Date(timeIntervalSince1970:1))
let current = BookmarkedSection(id:1,codeVersion:"2022",noteBody:"Current note",bookmarkedAt:Date(timeIntervalSince1970:3))
let note = BookmarkedSection(id:2,codeVersion:"2014",annotationBlockID:"paragraph",noteBody:"Note-only",updatedAt:Date(timeIntervalSince1970:2))
let assigned = BookmarkedSection(id:3,codeVersion:"2022",bookmarkedAt:Date(timeIntervalSince1970:4))
library.bookmarks = [old,current,note,assigned]
library.folderMembership = [1:[9],3:[2]]
library.refreshFolders()
let inbox = Inbox(library)
precondition(inbox.unassignedBookmarks == [old,current,note], "Legacy collections must not exclude inbox records")
precondition(BookmarkSorter.sorted(inbox.unassignedBookmarks,mode:.recentlySaved,codeSectionName:{_ in "Building Code"}) == [current,note,old])
let originals = library.bookmarks
library.userContentRepository!.failID = 2
inbox.assignInboxEvidence([old,current,note],to:library.folders[0])
precondition(inbox.assignmentError != nil && inbox.inboxSelecting)
library.userContentRepository!.failID = nil
inbox.assignInboxEvidence([old,current,note],to:library.folders[0])
precondition(inbox.unassignedBookmarks.isEmpty && !inbox.inboxSelecting)
precondition(library.bookmarks == originals && library.bookmarks[2].noteBody == "Note-only")
precondition(library.userContentRepository!.links[1] == ["2014|1","2022|1","2014|2"])
precondition(library.userContentRepository!.links[2] == ["2022|3"])
precondition(library.readerSaveDestination == "Project on phone" && library.activeProject == "Research Project")
print("Native inbox passed: no-Project membership, historical identity, note recency, additive assignment, partial retry and destination preservation.")
`);
execFileSync("xcrun", ["swiftc", join(dir, "main.swift"), "-o", join(dir, "verify")], { stdio: "inherit" });
execFileSync(join(dir, "verify"), [], { stdio: "inherit" });
