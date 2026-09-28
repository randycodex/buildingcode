import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const source=await readFile(new URL('../../NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift',import.meta.url),'utf8');
const start=source.indexOf('    private func scheduleProjectPresentationRefresh(');
const end=source.indexOf('    private func projectPresentationSnapshot()',start);
let methods=source.slice(start,end).replaceAll('private func','func');
const signpostStart=methods.indexOf('            let signpostID');
const signpostEnd=methods.indexOf('            do {',signpostStart);
assert.ok(signpostStart>0&&signpostEnd>signpostStart);
methods=methods.slice(0,signpostStart)+methods.slice(signpostEnd);
const dir=await mkdtemp(join(tmpdir(),'permitext-saved-hydration-'));
await writeFile(join(dir,'Verify.swift'),`import Foundation
struct ProjectPresentationSnapshot: Sendable {}
struct Result: Sendable { let rowsByFolderID = [1:[9]]; let recordCountByFolderID = [1:1] }
class Repository {}
final class UserDataStore: Repository { let databaseURL = URL(fileURLWithPath:"/unused") }
actor SnapshotBuilder { func build(databaseURL: URL, folders:[Int], availableVersions:[Int]) throws -> ProjectPresentationSnapshot { .init() } }
actor Builder {
 var continuation: CheckedContinuation<[Int], Error>?
 func build(_ snapshot:ProjectPresentationSnapshot) throws -> Result { .init() }
 func buildSavedRows(_ snapshot:ProjectPresentationSnapshot) async throws -> [Int] {
  try await withCheckedThrowingContinuation { continuation = $0 }
 }
 func ready() -> Bool { continuation != nil }
 func finish(fail:Bool = false) { if fail { continuation?.resume(throwing:NSError(domain:"fixture",code:1)) } else { continuation?.resume(returning:[9]) }; continuation=nil }
}
@MainActor final class Model {
 var projectPresentationRefreshGeneration=0
 var projectPresentationRefreshTask:Task<Void,Never>?
 var privateRequestIdentity:Int?=1
 var privateSessionID=1
 var selectedVersionFileName="2014"
 var userContentRepository:Repository? { didSet { cancelProjectPresentationRefresh() } }
 var folders:[Int]=[], availableVersions:[Int]=[]
 let projectPresentationSnapshotBuilder=SnapshotBuilder()
 let projectPresentationBuilder=Builder()
 var projectBookmarksByFolderID:[Int:[Int]]=[:]
 var projectEvidenceRecordCountByFolderID:[Int:Int]=[:]
 var hasDeferredSavedPresentation=true
 var bookmarks=[2], bookmarkRevision=0
 var statusMessage:String?
 func projectPresentationSnapshot() throws -> ProjectPresentationSnapshot { .init() }
 ${methods}
}
@main struct Check {
 @MainActor static func main() async throws {
  for boundary in ["success","account","session","version","mutation","repository","failure"] {
   let model=Model()
   model.scheduleProjectPresentationRefresh(delay:.zero)
   while !(await model.projectPresentationBuilder.ready()) { await Task.yield() }
   let task=model.projectPresentationRefreshTask!
   switch boundary {
    case "account": model.privateRequestIdentity=2
    case "session": model.privateSessionID=2
    case "version": model.selectedVersionFileName="2022"
    case "mutation": model.cancelProjectPresentationRefresh(); model.bookmarks=[3]
    case "repository": model.userContentRepository=Repository()
    default: break
   }
   await model.projectPresentationBuilder.finish(fail:boundary == "failure")
   await task.value
   if boundary == "success" {
    precondition(model.bookmarks == [9] && model.hasDeferredSavedPresentation && model.bookmarkRevision == 1)
   } else {
    precondition(model.bookmarks == (boundary == "mutation" ? [3] : [2]))
    precondition(model.hasDeferredSavedPresentation && model.bookmarkRevision == 0)
    precondition(model.projectBookmarksByFolderID.isEmpty)
   }
  }
  print("Saved actor publication: success, failure retention, account/session/version/repository/mutation races passed")
 }
}
`);
execFileSync('xcrun',['swiftc','-parse-as-library',join(dir,'Verify.swift'),'-o',join(dir,'verify')],{stdio:'inherit'});
execFileSync(join(dir,'verify'),[],{stdio:'inherit'});
