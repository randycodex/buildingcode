// Compile the real pending-Project save coordinator with a recording storage
// double. SQLite transactions/outbox durability have separate native coverage.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = new URL('../../NYC CC APP/permitext/', import.meta.url);
const [model, chapter, bookmarks, app] = await Promise.all([
  readFile(new URL('ViewModels/CodeLibraryViewModel.swift', root), 'utf8'),
  readFile(new URL('Views/ChapterReaderView.swift', root), 'utf8'),
  readFile(new URL('Views/BookmarksView.swift', root), 'utf8'),
  readFile(new URL('PermitextApp.swift', root), 'utf8'),
]);
const pending = model.slice(model.indexOf('    struct ProjectSaveRequest:'), model.indexOf('    @Published private(set) var projectSaveRequest:'));
const coordinator = model.slice(model.indexOf('    func requestProjectSelection('), model.indexOf('    var readerSaveDestinationProjects:'));
const note = model.slice(model.indexOf('    func saveNote(sectionID: Int64, blockID:'), model.indexOf('    func clearAllBookmarks()'));
assert.match(note, /requestProjectSelection\(sectionID: sectionID, blockID: normalizedBlockID, noteBody: body\)/);
assert.match(note, /guard saveSection\(sectionID: sectionID, toFolderIDs: ids\)/);
assert.match(model, /destinations.contains\(where: \{ \$0.folderType == \.project && \$0.deletedAt == nil \}\)/);
assert.doesNotMatch(bookmarks, /Unassigned|unassigned|collectionOnly|allSavedLink/);
assert.match(chapter, /Text\(library.readerSaveDestinationName\)/);
assert.match(chapter, /library.createFolder\(name: projectName/);
assert.match(app, /library.projectSaveRequest != nil/);
assert.match(app, /onChange\(of: library.signedInAccount\?\.appUserID\)/);

const fixture = `import Foundation
struct Account { let appUserID: String }
struct Version { let codeVersion: String }
struct CodeFolder { let id: Int64; let clientID: String; let name: String }
struct Destination { let projectClientID: String?; static func project(_ id:String)->Self { Self(projectClientID:id) } }
enum NoteSaveResult { case saved, failed(String,String) }
struct Write { let edition:String; let section:Int64; let projects:Set<Int64>; let block:String; let note:String? }
@MainActor final class CodeLibraryViewModel {
 ${pending}
 var signedInAccount:Account? = Account(appUserID:"A")
 var selectedVersion:Version? = Version(codeVersion:"2014")
 var sharedAccountLibrary:CodeLibraryViewModel?
 var projectSaveRequest:ProjectSaveRequest?
 var privateRequestIdentity = UUID()
 var statusMessage:String?
 var projects = [CodeFolder(id:1,clientID:"p1",name:"First"),CodeFolder(id:2,clientID:"p2",name:"Second")]
 var hasProjectAccess = true
 var readerSaveDestination = Destination(projectClientID:nil)
 var readerSaveDestinationProjects:[CodeFolder] { (sharedAccountLibrary ?? self).projects }
 var folderMembership:[Int64:[Int64]] = [:]
 var savedWrites:[Write] = []
 var prepareAction:(()->Void)?
 var saveFailure = false
 var reconciliations = 0
 func requireProjectAccess()->Bool { hasProjectAccess }
 func selectReaderSaveDestination(_ destination:Destination) { readerSaveDestination=destination }
 func makeSearchReaderLibrary(sourceVersion:String)->CodeLibraryViewModel {
   let reader=CodeLibraryViewModel();reader.sharedAccountLibrary=self
   reader.selectedVersion=Version(codeVersion:sourceVersion)
   reader.folderMembership=folderMembership
   return reader
 }
 func prepareCodeVersionForEvidence(_ version:String) async -> Bool {
   (sharedAccountLibrary ?? self).prepareAction?(); return true
 }
 func saveSection(sectionID:Int64,toFolderIDs:Set<Int64>)->Bool {
   let owner=sharedAccountLibrary ?? self
   guard !owner.saveFailure else { statusMessage="Storage failure";return false }
   owner.savedWrites.append(Write(edition:selectedVersion!.codeVersion,section:sectionID,projects:toFolderIDs,block:"",note:nil));return true
 }
 func saveNote(sectionID:Int64,blockID:String,body:String)->NoteSaveResult {
   (sharedAccountLibrary ?? self).savedWrites.append(Write(edition:selectedVersion!.codeVersion,section:sectionID,projects:[],block:blockID,note:body));return .saved
 }
 func reconcileExternalSavedWorkChange(from:CodeLibraryViewModel,scheduleAccountSync:Bool) { reconciliations += 1 }
 ${coordinator}
}
@main struct Main {
 @MainActor static func main() async {
  let owner=CodeLibraryViewModel(), origin=CodeLibraryViewModel()
  origin.sharedAccountLibrary=owner
  let first=owner.projects[0], second=owner.projects[1]
  origin.requestProjectSelection(sectionID:261,blockID:"paragraph",noteBody:"Keep note")
  precondition(owner.projectSaveRequest?.codeVersion == "2014")
  origin.selectedVersion=Version(codeVersion:"2022")
  owner.folderMembership[261]=[2]
  let completed=await owner.completeProjectSelection(first)
  precondition(completed && owner.projectSaveRequest == nil)
  precondition(owner.savedWrites.count == 2 && owner.reconciliations == 1)
  precondition(owner.savedWrites[0].edition == "2014" && owner.savedWrites[0].projects == [1,2])
  precondition(owner.savedWrites[1].edition == "2014" && owner.savedWrites[1].block == "paragraph" && owner.savedWrites[1].note == "Keep note")
  precondition(owner.readerSaveDestination.projectClientID == "p1")
  owner.savedWrites=[]
  origin.requestProjectSelection(sectionID:99); origin.cancelProjectSelection()
  let cancelled=await owner.completeProjectSelection(second)
  precondition(!cancelled && owner.savedWrites.isEmpty)
  origin.requestProjectSelection(sectionID:99)
  owner.prepareAction={ owner.signedInAccount=Account(appUserID:"B");owner.privateRequestIdentity=UUID() }
  let stale=await owner.completeProjectSelection(second)
  precondition(!stale && owner.savedWrites.isEmpty)
  owner.prepareAction=nil; owner.signedInAccount=Account(appUserID:"A")
  origin.requestProjectSelection(sectionID:99)
  owner.prepareAction={ owner.cancelProjectSelection() }
  let dismissed=await owner.completeProjectSelection(second)
  precondition(!dismissed && owner.savedWrites.isEmpty)
  owner.prepareAction=nil; origin.requestProjectSelection(sectionID:99)
  owner.prepareAction={ owner.readerSaveDestination = .project("p1") }
  let changed=await owner.completeProjectSelection(second)
  precondition(!changed && owner.savedWrites.isEmpty)
  owner.prepareAction=nil; origin.requestProjectSelection(sectionID:99)
  owner.projects.removeAll { $0.clientID == "p2" }
  let deleted=await owner.completeProjectSelection(second)
  precondition(!deleted && owner.savedWrites.isEmpty)
  origin.requestProjectSelection(sectionID:99); owner.saveFailure=true
  let failed=await owner.completeProjectSelection(first)
  precondition(!failed && owner.savedWrites.isEmpty && owner.projectSaveRequest != nil)
  owner.saveFailure=false; origin.requestProjectSelection()
  let selectionOnly=await owner.completeProjectSelection(first)
  precondition(selectionOnly && owner.savedWrites.isEmpty && owner.projectSaveRequest == nil)
  owner.hasProjectAccess=false;origin.requestProjectSelection(sectionID:99)
  precondition(owner.projectSaveRequest == nil)
  print("Native Project saving passed: original edition/block/note, additive membership, cancellation, account and selection races, missing Projects, storage failure and selection-only navigation.")
 }
}`;
const directory = await mkdtemp(join(tmpdir(), 'permitext-project-saving-'));
try {
 const path=join(directory,'verify.swift'), binary=join(directory,'verify');
 await writeFile(path,fixture);
 execFileSync('swiftc',['-parse-as-library',path,'-o',binary],{stdio:'inherit'});
 execFileSync(binary,[],{stdio:'inherit'});
} finally { await rm(directory,{recursive:true,force:true}); }
