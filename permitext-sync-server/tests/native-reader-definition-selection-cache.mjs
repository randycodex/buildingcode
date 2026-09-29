import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const source = await readFile(new URL('../../NYC CC APP/permitext/Views/AttributedTextView.swift', import.meta.url), 'utf8');
const context = source.slice(source.indexOf('struct ReaderDefinitionContext: Hashable'), source.indexOf('private struct ReaderDefinitionContextKey:'));
let models = source.slice(source.indexOf('struct ReaderDefinitionEntry:'), source.indexOf('final class ReaderDefinitionMatcher {'));
models = models.replace('func entries(for context: ReaderDefinitionContext, includeSectionScoped: Bool = false) -> [ReaderDefinitionEntry] {', 'func entries(for context: ReaderDefinitionContext, includeSectionScoped: Bool = false) -> [ReaderDefinitionEntry] { registryReads += 1');
let store = source.slice(source.indexOf('@MainActor\nfinal class ReaderDefinitionStore'), source.indexOf('private struct ReaderDefinitionPresentation:'));
// Expose private state and inject the real bundled registry only in the compiled
// host harness. Production lookup/cache methods are compiled without alteration.
const initStart = store.indexOf('    private init() {');
const initEnd = store.indexOf('\n    func hasSectionScopes', initStart);
assert.ok(initStart > 0 && initEnd > initStart);
store = store.slice(0, initStart) + '    init(registry: ReaderDefinitionRegistry? = nil) { self.registry = registry }\n' + store.slice(initEnd);
store = store.replaceAll('private ', '');
const registryPath = fileURLToPath(new URL('../../NYC CC APP/permitext/Resources/CodeContent/reader-definition-registry.json', import.meta.url));
const harness = String.raw`
var registryReads = 0
final class ReaderDefinitionMatcher {
 let entries: [ReaderDefinitionEntry]
 init(entries: [ReaderDefinitionEntry], sectionNumber: String?) { self.entries = entries }
}
@main struct Verify {
 @MainActor static func main() throws {
 let registry = try JSONDecoder().decode(ReaderDefinitionRegistry.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
 let store = ReaderDefinitionStore(registry: registry)
 func context(_ bundle:String, _ code:Int64, _ chapter:String, _ id:Int64?, _ section:String?) -> ReaderDefinitionContext {
  ReaderDefinitionContext(versionFileName:"new-york-city/"+bundle+"/fixture",codeSectionID:code,chapterNumber:chapter,chapterID:id,sectionNumber:section)
 }
 func scoped(_ entries:[ReaderDefinitionEntry])->Bool {
  entries.contains { $0.applicableSections != nil || $0.applicableExactSections != nil || $0.excludedSections != nil || $0.excludedExactSections != nil || $0.excludedOccurrences != nil }
 }
 var checked = 0
 for book in registry.books {
  let chapters = Set(["16","33","2","A","a","G",book.definitionChapter ?? ""] + book.entries.flatMap { $0.applicableChapters ?? [] })
  let ids:[Int64?] = [nil,book.chapterID,book.entries.compactMap { $0.applicableChapterIDs?.first }.first,-1]
  for chapter in chapters { for id in ids { for section:String? in [nil,"", "1602.1", "3301", "G101"] {
   let c=context(book.bundle,book.codeSectionID,chapter,id,section)
   let expected=registry.entries(for:c,includeSectionScoped:true)
   precondition(store.chapterEntries(for:c)==expected)
   precondition(store.hasSectionScopes(for:c)==scoped(expected))
   // Matcher retains original section-filter-before-dedup semantics.
   precondition(store.matcher(for:c).entries==registry.entries(for:c))
   precondition(store.chapters.count<=12 && store.chapterRecency.count==store.chapters.count)
   checked += 1
  }}}
 }
 let empty=ReaderDefinitionStore()
 precondition(empty.chapterEntries(for:context("",1,"16",nil,nil)).isEmpty)
 precondition(!empty.hasSectionScopes(for:context("",1,"16",nil,nil)))
 let bounded=ReaderDefinitionStore(registry:registry)
 let base=registry.books.first!
 func numbered(_ n:Int, _ section:String?=nil)->ReaderDefinitionContext { context(base.bundle,base.codeSectionID,String(n),nil,section) }
 for n in 0..<12 { _=bounded.chapterEntries(for:numbered(n)) }
 let first=bounded.chapterRecency.first!
 let readsBeforeHit=registryReads
 _=bounded.hasSectionScopes(for:numbered(0,"0.1"))
 _=bounded.chapterEntries(for:numbered(0,"0.2"))
 precondition(registryReads==readsBeforeHit)
 precondition(bounded.chapters.count==12 && bounded.chapterRecency.last==first)
 _=bounded.chapterEntries(for:numbered(12))
 precondition(bounded.chapters[first] != nil)
 precondition(!bounded.chapterRecency.contains { $0.chapterNumber=="1" })
 for n in 13..<1000 { _=bounded.hasSectionScopes(for:numbered(n)) }
 precondition(bounded.chapters.count==12 && bounded.chapterRecency.count==12)
 let building=registry.books.first { $0.bundle=="2022-construction-codes" && $0.entries.contains { $0.source.code.uppercased()=="BUILDING CODE" } }!
 let timings=ReaderDefinitionStore(registry:registry)
 let contexts=["16","33"].map { context(building.bundle,building.codeSectionID,$0,nil,nil) }
 var checksum=0
 let start=Date()
 for _ in 0..<1000 { for c in contexts { checksum += scoped(registry.entries(for:c,includeSectionScoped:true)) ? 1:0 } }
 let uncached=Date().timeIntervalSince(start)*1000
 let readsBeforeCached=registryReads
 let cachedStart=Date()
 for _ in 0..<1000 { for c in contexts { checksum += timings.hasSectionScopes(for:c) ? 1:0 } }
 let cached=Date().timeIntervalSince(cachedStart)*1000
 precondition(registryReads==readsBeforeCached+2)
 print("PASS: \(checked) actual-registry contexts, exact entry/order/scope/matcher parity; section reuse, LRU promotion/eviction and 12-entry bound")
 print("HOST ONLY: 2,000 Chapter16/33 scope reads; uncached=\(uncached)ms cached=\(cached)ms checksum=\(checksum), codeID=\(building.codeSectionID)")
 }
}
`;
const dir=await mkdtemp(join(tmpdir(),'permitext-definition-selection-'));
await writeFile(join(dir,'verify.swift'), `import Foundation\n${context}\n${models}\n${store}\n${harness}`);
execFileSync('xcrun',['swiftc','-O','-parse-as-library',join(dir,'verify.swift'),'-o',join(dir,'verify')],{stdio:'inherit'});
execFileSync(join(dir,'verify'),[registryPath],{stdio:'inherit'});
