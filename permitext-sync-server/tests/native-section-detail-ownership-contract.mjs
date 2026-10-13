import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const source=await readFile(new URL('../../NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift',import.meta.url),'utf8');
const start=source.indexOf('    func loadSectionDetailResultAsync('),end=source.indexOf('    func loadSectionDetailAsync(',start);
assert.ok(start>=0&&end>start);
const batchStart=source.indexOf('    func loadSectionDetailsAsync('),batchEnd=source.indexOf('    func sourceProblemContext(',batchStart);
const loaderStart=source.indexOf('    func sectionDetails(sectionIDs:'),loaderEnd=source.indexOf('    func firstSectionIDs(',loaderStart);
assert.ok(batchStart>=0&&batchEnd>batchStart&&loaderStart>=0&&loaderEnd>loaderStart);
const dir=await mkdtemp(join(tmpdir(),'permitext-detail-owner-'));
try{
await writeFile(join(dir,'main.swift'),`import Foundation
struct ReaderSectionDetail:Equatable,Sendable {let id:Int64;let edition:String}
enum SectionDetailLoadResult:Equatable {case loaded(ReaderSectionDetail),missing,failed(String)}
final class Store:@unchecked Sendable {
 let edition:String;let reached=DispatchSemaphore(value:0);let release=DispatchSemaphore(value:0)
 private let lock=NSLock();private var reads:[Int64]=[]
 var missingIDs:Set<Int64>=[]
 init(_ edition:String){self.edition=edition}
 func waitUntilReached(){reached.wait()}
 func readIDs()->[Int64]{lock.lock();defer{lock.unlock()};return reads}
 func sectionDetail(sectionID:Int64)->ReaderSectionDetail? {
  lock.lock();let isFirst=reads.isEmpty;reads.append(sectionID);lock.unlock()
  if isFirst {reached.signal();release.wait()}
  return missingIDs.contains(sectionID) ? nil : ReaderSectionDetail(id:sectionID,edition:edition)
 }
}
actor Loader {
 let database:Database
 init(_ store:Store,fails:Bool=false){database=Database(store,fails:fails)}
 func sectionDetail(sectionID:Int64) throws->ReaderSectionDetail? {try database.sectionDetail(sectionID:sectionID)}
 ${source.slice(loaderStart,loaderEnd)}
}
class Database {
 let store:Store;let fails:Bool
 init(_ store:Store,fails:Bool=false){self.store=store;self.fails=fails}
 func sectionDetail(sectionID:Int64)throws->ReaderSectionDetail?{
  let detail=store.sectionDetail(sectionID:sectionID)
  if fails {throw NSError(domain:"fixture",code:1,userInfo:[NSLocalizedDescriptionKey:"fixture failure"])}
  return detail
 }
}
@MainActor final class Harness {
 var selectedVersionFileName="A";var authoredCodeStore:Store?;var sqliteChapterLoader:Loader?;var codeDatabase:Database?;var statusMessage:String?
 var cached:[Int64:ReaderSectionDetail]=[:]
 func cachedSectionDetail(for id:Int64)->ReaderSectionDetail?{cached[id]}
 func storeSectionDetailInCache(_ detail:ReaderSectionDetail,sectionID:Int64){cached[sectionID]=detail}
 ${source.slice(start,end)}
 ${source.slice(batchStart,batchEnd)}
}
func check(_ condition:Bool,_ message:String){if !condition{fatalError(message)}}
@main struct Run {
 @MainActor static func main() async {
  for mode in ["edition","same-edition-store","cancel","stable"] {
   let h=Harness(),old=Store("A");h.authoredCodeStore=old
   let pending=Task { await h.loadSectionDetailResultAsync(sectionID:77) }
   await Task.detached { old.waitUntilReached() }.value
   if mode=="edition" {h.selectedVersionFileName="B";h.authoredCodeStore=Store("B")}
   if mode=="same-edition-store" {h.authoredCodeStore=Store("A-new")}
   if mode=="cancel" {pending.cancel()}
   old.release.signal()
   let result=await pending.value
   if mode=="stable" {check(result == .loaded(ReaderSectionDetail(id:77,edition:"A")),"stable result missing");check(h.cached[77]?.edition=="A","stable cache missing")}
   else {check(result == .missing,"obsolete body published");check(h.cached.isEmpty,"obsolete body poisoned cache")}
  }
  for backend in ["authored","sqlite"] {
   for mode in ["edition","same-edition-store","cancel","stable","error","stale-error"] {
    if backend=="authored" && mode.contains("error") {continue}
    let h=Harness(),old=Store("A");old.missingIDs=[3]
    if backend=="authored" {h.authoredCodeStore=old}
    else {h.sqliteChapterLoader=Loader(old,fails:mode.contains("error"))}
    let cached=ReaderSectionDetail(id:1,edition:"A-cached");h.cached[1]=cached
    let pending=Task {await h.loadSectionDetailsAsync(sectionIDs:[2,1,2,3,1])}
    await Task.detached {old.waitUntilReached()}.value
    if mode=="edition" || mode=="stale-error" {h.selectedVersionFileName="B"}
    if mode=="same-edition-store" {
     if backend=="authored" {h.authoredCodeStore=Store("A-new")}
     else {h.sqliteChapterLoader=Loader(Store("A-new"))}
    }
    if mode=="cancel" {pending.cancel()}
    old.release.signal()
    let result=await pending.value
    if mode=="stable" {
     check(result.map(\\.id)==[2,1,2,1],"batch must preserve requested order and duplicates, omit missing details")
     check(result[1]==cached && result[0].edition=="A","cached and loaded details must agree")
     check(old.readIDs()==[2,3],"decode each missing ID once")
     check(h.cached[2]?.edition=="A","stable batch cache missing")
    } else if mode=="error" {
     check(result==[cached,cached],"current loader error must preserve cached detail behavior")
     check(h.statusMessage=="fixture failure","current loader error must remain visible")
    } else {
     check(result.isEmpty,"obsolete batch published")
     check(h.cached==[1:cached],"obsolete batch poisoned cache")
     check(h.statusMessage==nil,"obsolete error changed current status")
     if mode=="cancel" {check(old.readIDs()==[2],"cancelled batch decoded another section")}
    }
   }
   let h=Harness(),unused=Store("unused")
   if backend=="authored" {h.authoredCodeStore=unused}
   else {h.sqliteChapterLoader=Loader(unused)}
   h.cached[1]=ReaderSectionDetail(id:1,edition:"cached")
   let cachedResult=await h.loadSectionDetailsAsync(sectionIDs:[1,1])
   check(cachedResult.count==2 && unused.readIDs().isEmpty,"cache hits must not decode")
   let cancelled=Task {
    while !Task.isCancelled {await Task.yield()}
    return await h.loadSectionDetailsAsync(sectionIDs:[1,2])
   }
   cancelled.cancel()
   let cancelledResult=await cancelled.value
   check(cancelledResult.isEmpty && unused.readIDs().isEmpty,"pre-cancelled batch must not return cache or start reads")
   let empty=await h.loadSectionDetailsAsync(sectionIDs:[])
   check(empty.isEmpty,"empty batch")
  }
  print("Native single/batch section-detail contracts passed: source ownership, cancellation, decode deduplication, cache/order parity, and SQLite errors")
 }
}
`);
execFileSync('xcrun',['swiftc','-swift-version','5','-parse-as-library',join(dir,'main.swift'),'-o',join(dir,'check')],{timeout:120000});
console.log(execFileSync(join(dir,'check'),[],{encoding:'utf8',timeout:30000}).trim());
const reader=await readFile(new URL('../../NYC CC APP/permitext/Views/ReaderView.swift',import.meta.url),'utf8');
assert.match(reader,/await loadContent\(expectedVersionFileName: version\.fileName\)/);
assert.ok((reader.match(/library.selectedVersionFileName == expectedVersionFileName/g)||[]).length>=3);
}finally{await rm(dir,{recursive:true,force:true});}
