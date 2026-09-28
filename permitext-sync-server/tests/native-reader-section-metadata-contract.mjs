import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Compile actual production metadata and parser on the host. Minimal document
// and resolver fixtures isolate lookup parity; no UIKit/device timing claim.
const store = await readFile(new URL('../../NYC CC APP/permitext/Data/NativeReaderDocumentStore.swift', import.meta.url), 'utf8');
const view = await readFile(new URL('../../NYC CC APP/permitext/Views/NativeChapterTextReaderView.swift', import.meta.url), 'utf8');
const metadata = store.slice(store.indexOf('struct NativeReaderSectionMetadata:'), store.indexOf('struct NativeReaderPreparedDocument:'));
assert.ok(metadata.startsWith('struct NativeReaderSectionMetadata:'));
const navigator = view.slice(view.indexOf('enum NativeReaderSectionNavigator {'), view.indexOf('\nstruct NativeReaderSearchMatch:'));
const parser = navigator.slice(0, navigator.indexOf('    static func targets(')) + navigator.slice(navigator.indexOf('    static func sectionNumber('));
const readerBlocks = view.slice(view.indexOf('    private func readerBlocks('), view.indexOf('    @ViewBuilder\n    private func openingPassage'));
assert.doesNotMatch(readerBlocks, /document\.blocks|NativeReaderSectionNavigator\.sectionNumber/);
assert.match(readerBlocks, /sectionMetadata\.definitionSectionIDs\.contains/);
assert.match(readerBlocks, /sectionMetadata\.sectionNumbersBySectionID\[/);
assert.match(view, /_sectionMetadata = State\(initialValue: prepared\.sectionMetadata\)/);
assert.match(view, /sectionTargets = \[\]\s+sectionMetadata = \.empty/);
assert.match(view, /sectionTargets = prepared\.sectionTargets\s+sectionMetadata = prepared\.sectionMetadata/);
assert.match(store, /try Task\.checkCancellation\(\)\s+let sectionMetadata = NativeReaderSectionMetadata\.prepare\(document: document\)\s+try Task\.checkCancellation\(\)/);
assert.match(store, /estimatedMemoryCost: max\(route\.uncompressedByteCount \+ derivedCost \+ sectionMetadata\.estimatedMemoryCost, 1\)/);
const fixture = String.raw`
enum Kind { case heading, paragraph }
struct Block { let kind:Kind; let sectionID:String?; let plainText:String; let anchorIDs:[String] }
struct NativeReaderRuntimeDocument { let blocks:[Block] }
enum NativeReaderLinkResolver {
 enum ReferenceKind { case section, chapter }
 struct Reference { let kind:ReferenceKind; let token:String }
 static func fragmentURL(_ id:String)->URL? { URL(string:"https://fixture.invalid/#"+id) }
 static func reference(for url:URL)->Reference? {
  switch url.fragment {
   case "section-403": return Reference(kind:.section,token:"403")
   case "section-G101": return Reference(kind:.section,token:"G101")
   case "chapter-16": return Reference(kind:.chapter,token:"16")
   default: return nil
  }
 }
}
// Frozen pre-memoization expressions from readerBlocks, preserving duplicate policy.
func legacy(_ document:NativeReaderRuntimeDocument)->NativeReaderSectionMetadata {
 let definitionSections = Set(document.blocks.filter {
  $0.kind == .heading && $0.plainText.range(of: #"\bdefinitions[.:]?\s*$"#, options: [.regularExpression, .caseInsensitive]) != nil
 }.compactMap(\.sectionID))
 let sectionNumbers = Dictionary(document.blocks.compactMap { block -> (String,String)? in
  guard block.kind == .heading, let sectionID=block.sectionID,
   let number=NativeReaderSectionNavigator.sectionNumber(from:block.plainText,anchorID:block.anchorIDs.first) else { return nil }
  return (sectionID,number)
 }, uniquingKeysWith:{ first,_ in first })
 return NativeReaderSectionMetadata(definitionSectionIDs:definitionSections,sectionNumbersBySectionID:sectionNumbers)
}
let headings = ["1602 Definitions", "DEFINITIONS.", "Definitions: \n", "Nondefinitions", "Definitions elsewhere", "27- 2017.4 Smoke alarms", "SECTION G101.1 Appendix", "Concrete walls", "", "403.2.3.3 Concrete", "😀 definitions"]
let ids:[String?] = [nil,"","a","b"]
let anchors = [[],["section-403"],["unknown","section-G101"],["section-G101","section-403"],["chapter-16"]]
var blocks:[Block]=[]
for text in headings { for id in ids { for anchor in anchors {
 for kind in [Kind.heading,.paragraph] { blocks.append(Block(kind:kind,sectionID:id,plainText:text,anchorIDs:anchor)) }
}}}
var cases=0
for group in [blocks,Array(blocks.reversed()),[],Array(blocks.prefix(7))] {
 let document=NativeReaderRuntimeDocument(blocks:group)
 let prepared=NativeReaderSectionMetadata.prepare(document:document)
 precondition(prepared==legacy(document))
 for block in group {
  let sectionID=block.sectionID ?? ""
  precondition(prepared.definitionSectionIDs.contains(sectionID)==legacy(document).definitionSectionIDs.contains(sectionID))
  precondition(prepared.sectionNumbersBySectionID[sectionID]==legacy(document).sectionNumbersBySectionID[sectionID])
 }
 precondition(prepared.estimatedMemoryCost>=128)
 cases += 1
}
let special=NativeReaderRuntimeDocument(blocks:[
 Block(kind:.heading,sectionID:"dup",plainText:"No number",anchorIDs:[]),
 Block(kind:.heading,sectionID:"dup",plainText:"27- 2017.4 Definitions",anchorIDs:[]),
 Block(kind:.heading,sectionID:"dup",plainText:"999 Later",anchorIDs:[]),
 Block(kind:.heading,sectionID:"first-anchor",plainText:"No number",anchorIDs:["unknown","section-403"]),
 Block(kind:.heading,sectionID:"appendix",plainText:"Appendix",anchorIDs:["section-G101"]),
 Block(kind:.paragraph,sectionID:"paragraph",plainText:"Definitions",anchorIDs:[])
])
let prepared=NativeReaderSectionMetadata.prepare(document:special)
precondition(prepared==legacy(special))
precondition(prepared.sectionNumbersBySectionID["dup"]=="27-2017.4")
precondition(prepared.definitionSectionIDs==["dup"])
precondition(prepared.sectionNumbersBySectionID["first-anchor"]==nil)
precondition(prepared.sectionNumbersBySectionID["appendix"]=="G101")
let payload=prepared.definitionSectionIDs.reduce(0){$0+$1.utf8.count}+prepared.sectionNumbersBySectionID.reduce(0){$0+$1.key.utf8.count+$1.value.utf8.count}
precondition(prepared.estimatedMemoryCost>payload)
precondition(NativeReaderSectionMetadata.prepare(document:NativeReaderRuntimeDocument(blocks:[])) == .empty)
print("PASS: production metadata parity across \(blocks.count) heading/paragraph fixtures in \(cases) order/empty cases, duplicate-first value, first anchor, HMC, appendix, definitions suppression and accounted memory")
`;
const dir = await mkdtemp(join(tmpdir(), 'permitext-section-metadata-'));
await writeFile(join(dir, 'main.swift'), `import Foundation\n${metadata}\n${parser}\n${fixture}`);
execFileSync('xcrun', ['swiftc', '-O', join(dir, 'main.swift'), '-o', join(dir, 'verify')], {stdio:'inherit'});
execFileSync(join(dir, 'verify'), [], {stdio:'inherit'});
