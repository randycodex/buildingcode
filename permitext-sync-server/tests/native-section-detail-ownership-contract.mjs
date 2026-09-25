import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const source=await readFile(new URL('../../NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift',import.meta.url),'utf8');
const start=source.indexOf('    func loadSectionDetailResultAsync('),end=source.indexOf('    func loadSectionDetailAsync(',start);
assert.ok(start>=0&&end>start);
const dir=await mkdtemp(join(tmpdir(),'permitext-detail-owner-'));
try{
await writeFile(join(dir,'main.swift'),`import Foundation
struct ReaderSectionDetail:Equatable {let edition:String}
enum SectionDetailLoadResult:Equatable {case loaded(ReaderSectionDetail),missing,failed(String)}
final class Store:@unchecked Sendable {
 let edition:String;let reached=DispatchSemaphore(value:0);let release=DispatchSemaphore(value:0)
 init(_ edition:String){self.edition=edition}
 func waitUntilReached(){reached.wait()}
 func sectionDetail(sectionID:Int64)->ReaderSectionDetail? {reached.signal();release.wait();return ReaderSectionDetail(edition:edition)}
}
actor Loader {
 func sectionDetail(sectionID:Int64) async throws->ReaderSectionDetail? {nil}
}
class Database {func sectionDetail(sectionID:Int64)throws->ReaderSectionDetail?{nil}}
@MainActor final class Harness {
 var selectedVersionFileName="A";var authoredCodeStore:Store?;var sqliteChapterLoader:Loader?;var codeDatabase:Database?;var statusMessage:String?
 var cached:ReaderSectionDetail?
 func cachedSectionDetail(for id:Int64)->ReaderSectionDetail?{cached}
 func storeSectionDetailInCache(_ detail:ReaderSectionDetail,sectionID:Int64){cached=detail}
 ${source.slice(start,end)}
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
   if mode=="stable" {check(result == .loaded(ReaderSectionDetail(edition:"A")),"stable result missing");check(h.cached?.edition=="A","stable cache missing")}
   else {check(result == .missing,"obsolete body published");check(h.cached==nil,"obsolete body poisoned cache")}
  }
  print("Native section-detail ownership contracts passed")
 }
}
`);
execFileSync('xcrun',['swiftc','-swift-version','5','-parse-as-library',join(dir,'main.swift'),'-o',join(dir,'check')],{timeout:120000});
console.log(execFileSync(join(dir,'check'),[],{encoding:'utf8',timeout:30000}).trim());
const reader=await readFile(new URL('../../NYC CC APP/permitext/Views/ReaderView.swift',import.meta.url),'utf8');
assert.match(reader,/await loadContent\(expectedVersionFileName: version\.fileName\)/);
assert.ok((reader.match(/library.selectedVersionFileName == expectedVersionFileName/g)||[]).length>=3);
}finally{await rm(dir,{recursive:true,force:true});}
