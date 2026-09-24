import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const vm=await readFile(new URL('../../NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift',import.meta.url),'utf8');
const model=await readFile(new URL('../../NYC CC APP/permitext/Models/ActiveCodeSources.swift',import.meta.url),'utf8');
function extract(signature){const start=vm.indexOf(signature);assert.ok(start>=0,signature);let depth=1;const open=vm.indexOf('{',start);for(let end=open+1;end<vm.length;end++){if(vm[end]==='{')depth++;if(vm[end]==='}'&&--depth===0)return vm.slice(start,end+1);}throw Error(signature);}
const method=extract('    func authoredSourceNavigationAccess(');
assert.ok(!method.includes('sectionDetail('));
const contextMethods=[extract('    struct CodeSourceNavigationContext:'),extract('    func captureCodeSourceNavigationContext('),extract('    func enableCodeSourceForNavigation(')].join('\n');
const dir=await mkdtemp(join(tmpdir(),'permitext-navigation-adapter-'));
try{
const swift=`import Foundation
${model}
enum Kind { case authored, sqlite }
struct BundledCodeVersion: Sendable { let fileName:String; let codeVersion:String; let contentKind:Kind; let fileURL:URL; let authoredCodeID:Int64?; let jurisdictionID:Int64? }
struct CodeSectionCategory { let id:Int64; let codeID:Int64; let name:String }
struct Account { let appUserID:String }
enum UserContentSyncCodeVersion { static func server(_ value:String)->String { value } }
final class AuthoredCodeStore: @unchecked Sendable {
 struct Chapter { let codeSectionID:Int64? }
 static var constructions=0
 static var gate:DispatchSemaphore?; static var reached:DispatchSemaphore?
 let ids:[Int64:Int64]
 init(ids:[Int64:Int64]){self.ids=ids}
 convenience init(jsonURL:URL,codeID:Int64?,jurisdictionID:Int64?) throws { Self.constructions += 1; self.init(ids:[77:1]) }
 func readerTarget(sectionID:Int64)->(chapter:Chapter,section:Int64)? {
  Self.reached?.signal(); Self.gate?.wait()
  return ids[sectionID].map { (Chapter(codeSectionID:$0),sectionID) }
 }
 func codeSections()->[CodeSectionCategory] { [1,2].map { CodeSectionCategory(id:$0,codeID:1,name:"category") } }
 func sectionDetail(sectionID:Int64)->Never { fatalError("Rich body must never be read") }
}
@MainActor final class Harness {
 var ownsAccountSync=true; var sharedAccountLibrary:Harness?; var writes=0; var failWrite=false; var syncs=0
 func updateActiveCodeSource(_ source:ActiveCodeSourceIdentity,enabled:Bool)->Bool { guard ownsAccountSync else{return false};if failWrite {activeCodeSources=nil;return false};writes+=1;activeCodeSources?.enable(source);activeCodeSourceRevision=UUID();return true }
 func synchronizeIndependentReaderSession(from owner:Harness){syncs+=1;activeCodeSources=owner.activeCodeSources;activeCodeSourceRevision=UUID()}
 ${contextMethods}
 var activeCodeSources:ActiveCodeSources?=ActiveCodeSources()
 var privateSessionID=UUID(); var activeCodeSourceRevision=UUID(); var signedInAccount:Account?=Account(appUserID:"A")
 var availableVersions:[BundledCodeVersion]=[]
 var allEditionSearchStores:[String:AuthoredCodeStore]=[:]
 var isInitialContentLoaded=false; var authoredCodeStore:AuthoredCodeStore?; var selectedVersionFileName=""
 nonisolated static func activeSourceIdentity(version:BundledCodeVersion,category:CodeSectionCategory)->ActiveCodeSourceIdentity? {
  guard let j=version.jurisdictionID,let c=version.authoredCodeID else{return nil}
  return ActiveCodeSourceIdentity(canonicalEdition:version.codeVersion,jurisdictionID:j,codeID:c,categoryID:category.id)
 }
 ${method}
}
func version(_ name:String,_ kind:Kind = .authored)->BundledCodeVersion {
 BundledCodeVersion(fileName:name,codeVersion:name,contentKind:kind,fileURL:URL(fileURLWithPath:"/synthetic/"+name),authoredCodeID:1,jurisdictionID:1)
}
func check(_ value:Bool,_ message:String){if !value {fatalError(message)}}
@main struct Run {
 @MainActor static func main() async {
  let h=Harness();h.availableVersions=[version("A")];h.allEditionSearchStores=["A":AuthoredCodeStore(ids:[77:1])]
  let target=ActiveCodeSourceNavigationTarget(sectionID:77,source:ActiveCodeSourceIdentity(canonicalEdition:"A",jurisdictionID:1,codeID:1,categoryID:1))
  check(await h.authoredSourceNavigationAccess(sectionID:77,canonicalEdition:"A") == .allowed(target),"reused allowed")
  check(AuthoredCodeStore.constructions == 0,"reused store constructed")
  check(await h.authoredSourceNavigationAccess(sectionID:77,canonicalEdition:"missing") == .unavailable(.sourceNotFound),"explicit edition fallback")
  check(AuthoredCodeStore.constructions == 0,"missing edition searched other stores")
  h.activeCodeSources?.disable(target.source)
  check(await h.authoredSourceNavigationAccess(sectionID:77,canonicalEdition:"A") == .requiresEnable(target),"disabled exact source")
  h.activeCodeSources=ActiveCodeSources()
  h.availableVersions.append(version("B"));h.allEditionSearchStores["B"]=AuthoredCodeStore(ids:[77:2])
  check(await h.authoredSourceNavigationAccess(sectionID:77) == .unavailable(.ambiguousSource),"bare ID ambiguous")
  check(await h.authoredSourceNavigationAccess(sectionID:77,categoryID:1) == .allowed(target),"category narrowing")
  check(await h.authoredSourceNavigationAccess(sectionID:77,canonicalEdition:"A",categoryID:2) == .unavailable(.sourceNotFound),"wrong category fallback")
  h.availableVersions=[version("legacy",.sqlite)]
  check(await h.authoredSourceNavigationAccess(sectionID:77,canonicalEdition:"legacy") == .unavailable(.sourceNotFound),"legacy unsupported")
  h.availableVersions=[version("A"),version("legacy",.sqlite)]
  check(await h.authoredSourceNavigationAccess(sectionID:77) == .unavailable(.sourceNotFound),"mixed bare catalog must remain conservative")
  h.availableVersions=[version("A")]
  for mode in ["account","revision"] {
   let reached=DispatchSemaphore(value:0),gate=DispatchSemaphore(value:0)
   AuthoredCodeStore.reached=reached;AuthoredCodeStore.gate=gate
   let pending=Task { await h.authoredSourceNavigationAccess(sectionID:77,canonicalEdition:"A") }
   await Task.detached { reached.wait() }.value
   if mode == "account" { h.signedInAccount=Account(appUserID:"B");h.privateSessionID=UUID() }
   else { h.activeCodeSourceRevision=UUID() }
   gate.signal()
   check(await pending.value == .unavailable(.preferencesUnavailable),"late context result published")
   AuthoredCodeStore.reached=nil;AuthoredCodeStore.gate=nil
  }
  h.activeCodeSources=nil
  check(await h.authoredSourceNavigationAccess(sectionID:77) == .unavailable(.preferencesUnavailable),"missing preference")
  check(AuthoredCodeStore.constructions == 0,"unexpected construction")
  let owner=Harness(),shadow=Harness();shadow.ownsAccountSync=false;shadow.sharedAccountLibrary=owner
  owner.activeCodeSources?.disable(target.source);shadow.activeCodeSources=owner.activeCodeSources
  let old=shadow.captureCodeSourceNavigationContext()!
  owner.activeCodeSourceRevision=UUID() // even identical preference after away/back is obsolete
  check(!shadow.enableCodeSourceForNavigation(source:target.source,context:old),"stale owner accepted")
  check(owner.writes==0,"stale owner persisted")
  let fresh=shadow.captureCodeSourceNavigationContext()!
  check(shadow.enableCodeSourceForNavigation(source:target.source,context:fresh),"delegation failed")
  check(owner.writes==1 && shadow.writes==0,"shadow persisted independently")
  check(shadow.activeCodeSources==owner.activeCodeSources,"shadow not refreshed")
  let accountContext=shadow.captureCodeSourceNavigationContext()!
  owner.signedInAccount=Account(appUserID:"other")
  check(!shadow.enableCodeSourceForNavigation(source:target.source,context:accountContext),"changed owner account accepted")
  owner.signedInAccount=Account(appUserID:"A")
  let instanceContext=shadow.captureCodeSourceNavigationContext()!
  let replacement=Harness();replacement.privateSessionID=owner.privateSessionID;replacement.activeCodeSourceRevision=owner.activeCodeSourceRevision;replacement.activeCodeSources=owner.activeCodeSources
  shadow.sharedAccountLibrary=replacement
  check(!shadow.enableCodeSourceForNavigation(source:target.source,context:instanceContext),"replacement owner accepted")
  check(replacement.writes==0,"replacement owner persisted")
  let failureContext=shadow.captureCodeSourceNavigationContext()!
  replacement.failWrite=true
  let oldSyncs=shadow.syncs
  check(!shadow.enableCodeSourceForNavigation(source:target.source,context:failureContext),"failed write reported success")
  check(shadow.syncs==oldSyncs+1 && shadow.activeCodeSources==nil,"failed owner state not inherited")
  check(shadow.captureCodeSourceNavigationContext()==nil,"nil preference captured")
  let direct=Harness();let directContext=direct.captureCodeSourceNavigationContext()!
  check(direct.enableCodeSourceForNavigation(source:target.source,context:directContext) && direct.writes==1,"direct owner failed")
  print("Actual native navigation adapter and owner delegation contracts passed")
 }
}
`;
await writeFile(join(dir,'main.swift'),swift);
execFileSync('xcrun',['swiftc','-swift-version','5','-parse-as-library',join(dir,'main.swift'),'-o',join(dir,'check')],{timeout:120000,stdio:'pipe'});
console.log(execFileSync(join(dir,'check'),[],{timeout:30000,encoding:'utf8'}).trim());
}finally{await rm(dir,{recursive:true,force:true});}
