import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Host-only Foundation contract. Production navigator is compiled verbatim;
// model stubs and deterministic resolver fixtures isolate parser behavior.
// This does not validate the real link resolver, UIKit, displayed frames or device latency.
const source = await readFile(new URL('../../NYC CC APP/permitext/Views/NativeChapterTextReaderView.swift', import.meta.url), 'utf8');
const start = source.indexOf('enum NativeReaderSectionNavigator {');
const end = source.indexOf('\nstruct NativeReaderSearchMatch:', start);
assert.ok(start >= 0 && end > start, 'production navigator boundaries');
const navigator = source.slice(start, end);
const methods = navigator.slice(navigator.indexOf('    static func sectionNumber('));
assert.equal((navigator.match(/NSRegularExpression\(\s*pattern:/g) ?? []).length, 2, 'exactly two compiled patterns');
assert.doesNotMatch(methods, /NSRegularExpression\(\s*pattern:|options: \.regularExpression/, 'no regex construction in per-heading methods');
assert.equal((navigator.match(/(?:private )?static let \w+.*NSRegularExpression/g) ?? []).length, 2, 'patterns have static storage');
const legacy = String.raw`enum LegacyNavigator {
    static func sectionNumber(from heading: String, anchorID: String?) -> String? {
        // Enacted HMC headings include separately numbered sections such as “27- 2017.4”.
        let normalizedHeading = heading.replacingOccurrences(of: #"^(\s*27-)\s+(?=\d)"#, with: "$1", options: .regularExpression)
        let headingPattern = #"(?i)^\s*(?:(?:SECTION|ARTICLE|PART)\s+)?(?:(?:EBC|FGC|BC|PC|MC|AC|FC|ZR)\s+)?([A-Z]?\d+(?:[.\-]\d+)*(?:\([A-Za-z0-9]+\))?)\b"#
        if let token = firstCapture(in: normalizedHeading, pattern: headingPattern) {
            return token.uppercased()
        }
        if let anchorID,
           let referenceURL = NativeReaderLinkResolver.fragmentURL(anchorID),
           let reference = NativeReaderLinkResolver.reference(for: referenceURL),
           reference.kind == .section {
            return reference.token
        }
        return nil
    }

    private static func firstCapture(in value: String, pattern: String) -> String? {
        guard let expression = try? NSRegularExpression(pattern: pattern),
              let match = expression.firstMatch(
                  in: value,
                  range: NSRange(location: 0, length: value.utf16.count)
              ),
              let range = Range(match.range(at: 1), in: value) else { return nil }
        return String(value[range])
    }
}`;
const fixtures = String.raw`
enum BlockKind { case heading, paragraph }
struct Block { let id:String; let kind:BlockKind; let anchorIDs:[String]; let plainText:String; let sourceOrder:Int; let headingLevel:Int? }
struct Anchor { let blockID:String; let id:String }
struct Metadata { let chapterNumber:String; let chapterTitle:String?; let chapterIdentifier:String }
struct NativeReaderRuntimeDocument { let blocks:[Block]; let anchors:[Anchor]; let metadata:Metadata }
struct NativeReaderDisplayBlock {
 let sourceBlockID:String; let id:String
 static func sourceBlockID(for id:String, in document:NativeReaderRuntimeDocument)->String? { document.blocks.first(where:{$0.id==id})?.id }
}
struct NativeReaderSectionTarget {
 let id:String; let blockID:String; let sourceBlockID:String; let sourceOrder:Int
 let sectionNumber:String?; let title:String; let anchorID:String?; let level:Int
}
enum NativeReaderLinkResolver {
 enum Kind { case section, chapter }
 struct Reference { let kind:Kind; let token:String }
 static func fragmentURL(_ anchor:String)->URL? { anchor == "invalid" ? nil : URL(string:"https://fixture.invalid/#" + anchor) }
 static func reference(for url:URL)->Reference? {
  switch url.fragment {
   case "section-403.2.3.3": return Reference(kind:.section,token:"403.2.3.3")
   case "appendix-G101": return Reference(kind:.section,token:"G101")
   case "chapter-16": return Reference(kind:.chapter,token:"16")
   default: return nil
  }
 }
}
let headings = [
 "403.2.3.3 Concrete and masonry walls", "SECTION 722.2.4 Concrete columns",
 " section bc 1604.3 Deflections", "ARTICLE 27-2017.4", "27- 2017.4 Smoke alarms",
 "  27-   2017.4 Smoke alarms", "27-\t2017.4 Smoke alarms", "SECTION 27- 2017.4",
 "PART EBC 101.1 Title", "FGC 101.2 Scope", "PC 101.1", "MC 101.1", "AC 28-101.1",
 "FC 901.1", "ZR 12-10", "SECTION G101.1 Appendix", "g101.1 lower case appendix",
 "APPENDIX G FLOOD-RESISTANT CONSTRUCTION", "SECTION 1607.1(a) Loads", "1607.1(2) Loads",
 "16 Structural design", "TABLE 1607.1", "Concrete walls", "", "   ", "§ 27-2017.4",
 "😀 403.2.3.3", "403.2.3.3 égress", "Ａ101 Full-width", "2014 Edition", "A1x", "001.2"
]
let anchors:[String?] = [nil,"section-403.2.3.3","appendix-G101","chapter-16","invalid","unknown"]
var comparisons=0
for _ in 0..<3 {
 for heading in headings {
  for anchor in anchors {
   let expected=LegacyNavigator.sectionNumber(from:heading,anchorID:anchor)
   let actual=NativeReaderSectionNavigator.sectionNumber(from:heading,anchorID:anchor)
   precondition(actual==expected, "Parser mismatch: \(heading), \(anchor ?? "nil")")
   comparisons += 1
  }
 }
}
precondition(NativeReaderSectionNavigator.sectionNumber(from:"27- 2017.4 Smoke alarms",anchorID:nil)=="27-2017.4")
precondition(NativeReaderSectionNavigator.sectionNumber(from:"SECTION G101.1 Appendix",anchorID:nil)=="G101.1")
precondition(NativeReaderSectionNavigator.sectionNumber(from:"Concrete walls",anchorID:"section-403.2.3.3")=="403.2.3.3")
precondition(NativeReaderSectionNavigator.sectionNumber(from:"Concrete walls",anchorID:"chapter-16")==nil)
let first=Block(id:"p1",kind:.paragraph,anchorIDs:[],plainText:"Text without a heading",sourceOrder:0,headingLevel:nil)
let display=[NativeReaderDisplayBlock(sourceBlockID:"p1",id:"display-p1")]
for title:String? in ["Structural design",nil] {
 let document=NativeReaderRuntimeDocument(blocks:[first],anchors:[Anchor(blockID:"p1",id:"chapter-16")],metadata:Metadata(chapterNumber:"16",chapterTitle:title,chapterIdentifier:"chapter-16"))
 let targets=NativeReaderSectionNavigator.targets(in:document,displayBlocks:display)
 precondition(targets.count==1)
 precondition(targets[0].sectionNumber=="16" && targets[0].title==(title ?? "chapter-16"))
 precondition(targets[0].blockID=="display-p1" && targets[0].sourceBlockID=="p1" && targets[0].anchorID=="chapter-16" && targets[0].level==1)
 precondition(NativeReaderSectionNavigator.targets(in:document,displayBlocks:[]).isEmpty)
}
let empty=NativeReaderRuntimeDocument(blocks:[],anchors:[],metadata:Metadata(chapterNumber:"16",chapterTitle:nil,chapterIdentifier:"chapter-16"))
precondition(NativeReaderSectionNavigator.targets(in:empty,displayBlocks:display).isEmpty)
// Informational same-input host microbenchmark. Fixed order, warm process, synthetic
// headings and resolver stub: this is not a phone or displayed-frame benchmark.
func measure(_ parse:(String,String?)->String?) -> (Double,Int) {
 let start=ProcessInfo.processInfo.systemUptime
 var checksum=0
 for _ in 0..<100 {
  for heading in headings {
   for anchor in anchors { checksum += parse(heading,anchor)?.utf8.count ?? 0 }
  }
 }
 return ((ProcessInfo.processInfo.systemUptime-start)*1000,checksum)
}
let oldTiming=measure { LegacyNavigator.sectionNumber(from:$0,anchorID:$1) }
let newTiming=measure { NativeReaderSectionNavigator.sectionNumber(from:$0,anchorID:$1) }
precondition(oldTiming.1==newTiming.1)
print(String(format:"INFO host only, 19,200 parses each: legacy %.2f ms; candidate %.2f ms; checksum %d",oldTiming.0,newTiming.0,newTiming.1))
print("PASS: \(comparisons) legacy/production section parser comparisons; HMC, appendix, anchor fallback, no-heading and empty-document targets; static regex reuse structure")
`;
const dir = await mkdtemp(join(tmpdir(), 'permitext-section-parser-'));
await writeFile(join(dir, 'main.swift'), `import Foundation\n${navigator}\n${legacy}\n${fixtures}`);
execFileSync('xcrun', ['swiftc', '-O', join(dir, 'main.swift'), '-o', join(dir, 'verify')], {stdio:'inherit'});
execFileSync(join(dir, 'verify'), [], {stdio:'inherit'});
