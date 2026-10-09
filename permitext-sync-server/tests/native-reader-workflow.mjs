// Compile production presentation, account preference, save routing, and handoff
// logic on the host. Repository double records mutations; SQLite atomicity is
// independently covered by native-saved-queue-reopen.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const read = p => readFile(new URL(`../../NYC CC APP/permitext/${p}`, import.meta.url),'utf8');
const [destination, presentation, handoff, model, browse, search, reader, chapter, app] = await Promise.all([
 read('Models/NativeReaderSaveDestination.swift'), read('Models/NativeSearchResultPresentation.swift'),
 read('Models/NativeReaderHandoff.swift'),read('ViewModels/CodeLibraryViewModel.swift'),read('Views/BrowseView.swift'),
 read('Views/SearchView.swift'),read('Views/ReaderView.swift'),read('Views/ChapterReaderView.swift'),read('PermitextApp.swift')]);
const methods = model.slice(model.indexOf('    var readerSaveDestinationProjects:'),model.indexOf('    func toggleBookmark(sectionID:'));
assert.ok(methods.includes('func toggleReaderDestinationSave'));
assert.doesNotMatch(methods.replace(/\/\/[^\n]*/g,''),/activeProjectID/, 'Last opened Project is never the save choice');
assert.match(model,/readerSaveDestinationChoice = NativeReaderSaveDestination\.load\(accountID: signedInAccount\?\.appUserID/);
assert.match(model,/readerSaveDestinationChoice = sharedLibrary\.readerSaveDestinationChoice/);
assert.match(model,/self.readerSaveDestinationChoice = NativeReaderSaveDestination\.load\(accountID: loadedSignedInAccount\?\.appUserID/);
assert.match(reader,/ReaderCurrentSectionBookmarkButton\(sectionID: sectionID/);
assert.match(chapter,/toggleReaderDestinationSave\(sectionID: sectionID\)/);
assert.doesNotMatch(chapter,/showsSavedFollowUp/, 'Successful save never presents a blocking follow-up alert');
assert.match(chapter,/showBookmarkConfirmation\("Saved to /, 'Transient confirmation still names the explicit destination');
assert.match(chapter,/if let sectionID, library.isBookmarked\(sectionID: sectionID\) \{\s*Divider\(\)\s*Button\("Add to Projects"\) \{ openFolderPicker\(\) \}/,
 'Already saved passages retain deliberate additional Project assignment in the context menu');
assert.match(chapter,/memberFolderIDs: Set\(library.folderMembership\[sectionID\] \?\? \[\]\)/, 'Secondary assignment retains current memberships');
assert.match(browse,/ReaderSaveDestinationMenuContent\(\)/);
assert.match(search,/Button\("Open in Reader 1"\)/);
assert.match(search,/Button\("Open in Reader 2"\)/);
assert.match(browse,/rememberedSectionBinding\(for: target.chapter.id\).wrappedValue = target.section.id/);
assert.match(browse,/persistVersionFileName\(library.selectedVersionFileName, for: browserContext\)/);
assert.match(browse,/guard !Task.isCancelled, request.permits\(library.captureCodeSourceNavigationContext\(\)\)/);
assert.match(search,/didResolveAutomaticExpansion = true/);
assert.match(search,/let preview = result.snippet.isEmpty\s*\? await library.searchPreview[\s\S]*?: result.snippet/, 'Parent metadata must not cause existing snippets to hydrate full passage');
assert.match(browse,/private func restoreReaderVersionIfNeeded\(\) \{[\s\S]*?guard readerHandoff.shouldRestoreVersion\(in: browserContext\) else \{ return \}/);
for (const start of ['private func prepareAndOpenChapter(', 'private func selectReaderCode(']) {
 const method = browse.slice(browse.indexOf(start), browse.indexOf('\n    }',browse.indexOf(start)));
 assert.match(method,/readerHandoff.cancel\(in: browserContext\)/, 'Manual navigation supersedes pending explicit handoff');
}
const fixture = `import Foundation
import Combine
${destination}
${presentation}
enum BrowserContextID: Hashable { case primary, secondary }
struct SearchReaderRoute { let sectionID: Int64; let sourceVersion: String? }
struct CodeFolder { enum Kind { case project, folder }; var id:Int64; var clientID:String; var name:String; var folderType:Kind = .project; var deletedAt:String? }
extension Notification.Name { static let permitextSavedWorkDidChange = Self("test.saved.changed") }
final class Repository {
 var folders = [CodeFolder(id:1,clientID:"p1",name:"Project A"),CodeFolder(id:2,clientID:"p2",name:"Project B")]
 var members: [Int64:[Int64]] = [:]; var bookmarks:Set<Int64> = []; var fail = false
 enum Failure:Error { case storage }
 func allFolders() throws -> [CodeFolder] { if fail { throw Failure.storage }; return folders }
 func folderMembership(codeVersion:String) throws -> [Int64:[Int64]] { if fail { throw Failure.storage }; return members }
 func removeSection(_ id:Int64,fromFolder:Int64,codeVersion:String) throws { if fail { throw Failure.storage }; members[id]?.removeAll{$0 == fromFolder} }
}
@MainActor final class CodeLibraryViewModel {
 struct Account { var appUserID:String }
 struct Version { var codeVersion = "2022" }
 struct CodeSourceNavigationContext { var accountID:String?; var ownerSessionID:UUID; var ownerRevision:UUID; var ownerIdentity:ObjectIdentifier }
 enum Tab { case browse, browseSecondary, search }
 var selectedTab = Tab.search
 var signedInAccount:Account? = Account(appUserID:"A")
 var selectedVersion:Version? = Version()
 var ownerSessionID = UUID(); var ownerRevision = UUID()
 var sharedAccountLibrary:CodeLibraryViewModel?
 var hasProjectAccess = true; var hasSavedAccess = true
 var readerSaveDestinationChoice = NativeReaderSaveDestination.unassigned
 let preferencesDefaults:UserDefaults
 var userContentRepository:Repository? = Repository()
 var folders:[CodeFolder] = []; var folderMembership:[Int64:[Int64]] = [:]
 var statusMessage:String?; var saveCalls=0; var toggleCalls=0; var syncCalls=0
 init(_ defaults:UserDefaults) { preferencesDefaults=defaults; refreshBookmarks() }
 func captureCodeSourceNavigationContext()->CodeSourceNavigationContext? {
  let owner=sharedAccountLibrary ?? self
  return .init(accountID:owner.signedInAccount?.appUserID,ownerSessionID:owner.ownerSessionID,ownerRevision:owner.ownerRevision,ownerIdentity:ObjectIdentifier(owner))
 }
 func requireProjectAccess()->Bool { hasProjectAccess }
 func requireSavedWorkAccess()->Bool { hasSavedAccess }
 func isBookmarked(sectionID:Int64)->Bool { userContentRepository?.bookmarks.contains(sectionID) == true }
 func refreshBookmarks() { folders=userContentRepository?.folders ?? []; folderMembership=userContentRepository?.members ?? [:] }
 func scheduleUserContentAutoSync() { syncCalls += 1 }
 func saveSection(sectionID:Int64,toFolderIDs:Set<Int64>)->Bool {
  saveCalls += 1; userContentRepository?.bookmarks.insert(sectionID); userContentRepository?.members[sectionID]=Array(toFolderIDs); refreshBookmarks(); return true
 }
 func toggleBookmark(sectionID:Int64)->Bool {
  toggleCalls += 1
  if isBookmarked(sectionID:sectionID) { userContentRepository?.bookmarks.remove(sectionID);userContentRepository?.members[sectionID]=[];refreshBookmarks();return false }
  guard requireSavedWorkAccess() else { return false }
  userContentRepository?.bookmarks.insert(sectionID);refreshBookmarks();return true
 }
 ${methods}
}
${handoff}
@main struct Main {
 @MainActor static func main() {
  let suite="permitext-reader-workflow-\\(UUID())", defaults=UserDefaults(suiteName:suite)!
  defer { defaults.removePersistentDomain(forName:suite) }
  precondition(NativeReaderSaveDestination.load(accountID:"A",defaults:defaults) == .unassigned)
  NativeReaderSaveDestination.project("p1").store(accountID:"A",defaults:defaults)
  precondition(NativeReaderSaveDestination.load(accountID:"A",defaults:defaults) == .project("p1"))
  precondition(NativeReaderSaveDestination.load(accountID:"B",defaults:defaults) == .unassigned)
  precondition(NativeReaderSaveDestination.load(accountID:nil,defaults:defaults) == .unassigned)
  precondition(NativeReaderSaveDestination.project("deleted").validated(projectClientIDs:["p1"]) == .unassigned)
  let library=CodeLibraryViewModel(defaults), repo=library.userContentRepository!
  library.selectReaderSaveDestination(.project("p1"))
  repo.bookmarks.insert(42);repo.members[42]=[2];library.refreshBookmarks()
  precondition(library.toggleReaderDestinationSave(sectionID:42))
  precondition(Set(repo.members[42]!) == [1,2] && repo.bookmarks.contains(42),"Saving to Project must preserve existing memberships")
  precondition(library.readerSaveActionLabel(sectionID:42) == "Remove from Project: Project A")
  precondition(!library.toggleReaderDestinationSave(sectionID:42))
  precondition(repo.members[42] == [2] && repo.bookmarks.contains(42),"Remove from Project must retain Saved and other memberships")
  precondition(library.toggleCalls == 0 && library.syncCalls == 1)
  repo.folders.removeAll{$0.id == 1}
  precondition(!library.toggleReaderDestinationSave(sectionID:43) && !repo.bookmarks.contains(43),"Deleted Project revalidated from storage before mutation")
  library.selectReaderSaveDestination(.unassigned)
  precondition(library.toggleReaderDestinationSave(sectionID:44) && repo.members[44] == nil,"Unassigned adds no Project membership")
  library.hasProjectAccess=false
  library.selectReaderSaveDestination(.project("p2"))
  precondition(library.readerSaveDestinationChoice == .unassigned,"Project access cannot be bypassed by destination picker")
  library.hasProjectAccess=true;library.refreshBookmarks();library.selectReaderSaveDestination(.project("p2"));repo.fail=true
  precondition(!library.toggleReaderDestinationSave(sectionID:45) && !repo.bookmarks.contains(45),"Storage failure never falls back to a different destination")
  repo.fail=false
  let secondary=CodeLibraryViewModel(defaults);secondary.sharedAccountLibrary=library
  secondary.selectReaderSaveDestination(.unassigned)
  precondition(library.readerSaveDestinationChoice == .unassigned && secondary.readerSaveDestination == .unassigned,"Secondary selection updates the shared explicit choice")
  let p=NativeSearchResultPresentation(sectionNumber:"403.1.1",title:"The building shall comply with section 403.1.1.",isParagraph:true,codeName:"Building Code",edition:"2022",chapterNumber:"4",parentLabels:["403 High-rise buildings"],snippet:"The building shall comply with section 403.1.1.")
  precondition(p.source == "Building Code · 2022" && p.heading == "Passage 403.1.1" && p.context == "Chapter 4 · 403 High-rise buildings")
  precondition(!p.heading.contains("shall") && p.excerpt.contains("shall"),"Paragraph text appears once as excerpt, never duplicated as heading")
  let long=NativeSearchResultPresentation(sectionNumber:"1",title:"1 Scope",isParagraph:false,codeName:"2022 Code",edition:"2022",chapterNumber:"",parentLabels:[],snippet:"1 Scope " + String(repeating:"Façade 🚪 concrete ",count:50))
  precondition(long.source == "2022 Code" && long.excerpt.count <= 240 && !long.excerpt.hasPrefix("1 Scope"))
  precondition(NativeSearchGroupExpansion.automaticGroup(groupIDs:["2022"],isSearching:false,isPending:false) == "2022")
  for ids in [[],["2014","2022"]] { precondition(NativeSearchGroupExpansion.automaticGroup(groupIDs:ids,isSearching:false,isPending:false) == nil) }
  precondition(NativeSearchGroupExpansion.automaticGroup(groupIDs:["2022"],isSearching:true,isPending:false) == nil)
  precondition(NativeSearchGroupExpansion.automaticGroup(groupIDs:["2022"],isSearching:false,isPending:true) == nil)
  let handoffs=NativeReaderHandoff(), route=SearchReaderRoute(sectionID:42,sourceVersion:"2022")
  handoffs.open(route,in:.secondary,library:library)
  let first=handoffs.requests[.secondary]!
  precondition(handoffs.requests[.primary] == nil && library.selectedTab == .browseSecondary,"Only explicit Reader slot is touched")
  precondition(!handoffs.shouldRestoreVersion(in:.secondary) && handoffs.shouldRestoreVersion(in:.primary),"Cold target Reader must skip old-version restoration; other Reader retains normal restoration")
  precondition(first.permits(secondary.captureCodeSourceNavigationContext()),"Secondary context may share same authenticated owner")
  let stranger=CodeLibraryViewModel(defaults)
  precondition(!first.permits(stranger.captureCodeSourceNavigationContext()),"Same account string on another owner does not suffice")
  library.ownerSessionID=UUID();precondition(!first.permits(library.captureCodeSourceNavigationContext()),"Account session rotation rejects old requests")
  handoffs.open(route,in:.secondary,library:library)
  handoffs.finish(first,in:.secondary)
  precondition(handoffs.requests[.secondary] != nil,"Obsolete completion cannot consume a newer request")
  let current=handoffs.requests[.secondary]!
  library.ownerRevision=UUID();precondition(!current.permits(library.captureCodeSourceNavigationContext()),"Source preference revision invalidates pending handoff")
  handoffs.open(.init(sectionID:42,sourceVersion:nil),in:.primary,library:library)
  precondition(handoffs.requests[.primary] == nil,"Missing source never guesses an edition")
  handoffs.open(route,in:.primary,library:library)
  let untouched=handoffs.requests[.primary]!.id
  handoffs.cancel(in:.secondary)
  precondition(handoffs.requests[.secondary] == nil && handoffs.requests[.primary]?.id == untouched,"Manual choice cancels target handoff without touching the other Reader")
  precondition(handoffs.shouldRestoreVersion(in:.secondary),"Manual cancellation releases restoration suppression")
  handoffs.finish(current,in:.secondary)
  precondition(handoffs.requests[.primary]?.id == untouched,"Late old completion cannot consume another Reader's request")
  print("PASS: native destination account isolation/deletion/access/storage guards, preserved membership and scoped removal; concise result metadata and single-group-only expansion; explicit Reader handoff isolation, cold restoration race, manual cancellation and stale-session/revision rejection")
 }
}
`;
const dir=await mkdtemp(join(tmpdir(),'permitext-reader-workflow-'));
try { await writeFile(join(dir,'verify.swift'),fixture);execFileSync('xcrun',['swiftc','-parse-as-library',join(dir,'verify.swift'),'-o',join(dir,'verify')],{stdio:'inherit'});execFileSync(join(dir,'verify'),[],{stdio:'inherit'}); }
finally { await rm(dir,{recursive:true,force:true}); }
