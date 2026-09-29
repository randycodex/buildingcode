// Host-only actual-corpus regression. Compile production target model, heading
// parser, bookmark resolver and view property; no SwiftUI or device runtime.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const source = await readFile(new URL('../../NYC CC APP/permitext/Views/NativeChapterTextReaderView.swift', import.meta.url), 'utf8');
function between(start, end) {
 const a = source.indexOf(start), b = source.indexOf(end, a);
 assert.ok(a >= 0 && b > a, `Production declaration ${start}`);
 return source.slice(a, b);
}
const target = between('struct NativeReaderSectionTarget:', '\nenum NativeReaderSectionNavigator');
const parser = between('enum NativeReaderSectionNavigator {', '    static func targets(')
 + between('    static func sectionNumber(from heading:', '\nstruct NativeReaderSearchMatch:');
const resolver = between('enum NativeReaderBookmarkTargetResolver {', '\nenum NativeReaderSearchIndex');
const property = between('    private var currentBookmarkSectionID:', '\n    private func jumpPicker(');
const root = fileURLToPath(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/', import.meta.url));
const fixture = String.raw`
// The actual chapter's opaque rid anchors cannot resolve section references.
// Heading parsing below is production code; link navigation is outside this test.
enum NativeReaderLinkResolver {
 enum Kind { case section }
 struct Reference { let kind: Kind; let token: String }
 static func fragmentURL(_ value: String) -> URL? { nil }
 static func reference(for url: URL) -> Reference? { nil }
}
struct Summary { let id: Int64 }
struct Remembered { var wrappedValue: Int64? }
struct Reader {
 var sectionTargets: [NativeReaderSectionTarget]
 var currentSectionTarget: NativeReaderSectionTarget?
 var pendingInitialBlockID: String?
 var rememberedSectionID = Remembered(wrappedValue: 13)
 var initialSectionID: Int64 = 13
 var codeSectionID: Int64 = 1
 var summaries: [String: Int64]
 func sectionSummary(for target: NativeReaderSectionTarget) -> Summary? {
  guard let number = target.sectionNumber, let id = summaries["\(codeSectionID):\(number)"] else { return nil }
  return Summary(id: id)
 }
 PROPERTY
 var bookmark: Int64? { currentBookmarkSectionID }
}
func check(_ value: @autoclosure () -> Bool, _ message: String) {
 if !value() { FileHandle.standardError.write(Data((message + "\n").utf8)); exit(1) }
}
func json(_ url: URL) throws -> [String: Any] {
 try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
}
let root = URL(fileURLWithPath: CommandLine.arguments[1])
let index = try json(root.appendingPathComponent("native-reader-index.json"))
let entry = (index["entries"] as! [[String: Any]]).first {
 $0["relativePath"] as? String == "2022-construction-codes/code-sections/building-code/chapters/1.html"
}!
let compressed = try Data(contentsOf: root.appendingPathComponent(entry["documentPath"] as! String))
let size = entry["uncompressedByteCount"] as! Int
var bytes = [UInt8](repeating: 0, count: size)
let count = bytes.withUnsafeMutableBytes { destination in
 compressed.withUnsafeBytes { source in
  compression_decode_buffer(destination.bindMemory(to: UInt8.self).baseAddress!, size,
   source.bindMemory(to: UInt8.self).baseAddress!, compressed.count, nil, COMPRESSION_LZFSE)
 }
}
check(count == size, "Actual native chapter must decompress completely")
let document = try JSONSerialization.jsonObject(with: Data(bytes)) as! [String: Any]
let metadata = document["metadata"] as! [String: Any]
check(metadata["codeSectionID"] as? Int == 1, "Fixture must be 2022 Building")
let targets = (document["blocks"] as! [[String: Any]]).filter { $0["kind"] as? String == "heading" }.map { block in
 let id = block["id"] as! String, title = block["plainText"] as! String
 let anchor = (block["anchorIDs"] as! [String]).first
 check(anchor?.hasPrefix("rid-") == true, "Fixture anchors must satisfy opaque-anchor test boundary")
 return NativeReaderSectionTarget(id: id, blockID: id, sourceBlockID: id, sourceOrder: block["sourceOrder"] as! Int,
  sectionNumber: NativeReaderSectionNavigator.sectionNumber(from: title, anchorID: anchor), title: title,
  anchorID: anchor, level: block["headingLevel"] as! Int)
}
let prepared = try json(root.appendingPathComponent("2022-construction-codes/prepared/chapters/1.json"))
let sections = (prepared["groups"] as! [[String: Any]]).flatMap { $0["sections"] as! [[String: Any]] }
var summaries = Dictionary(uniqueKeysWithValues: sections.map { ("1:" + ($0["sectionNumber"] as! String), Int64($0["id"] as! Int)) })
// Identical section number in another code must never supply a Building bookmark.
summaries["2:101.1"] = 90001
var reader = Reader(sectionTargets: targets, currentSectionTarget: targets.first, summaries: summaries)
check(targets[0].sectionNumber == nil && targets[0].title == "Chapter 1: Administration", "Actual chapter heading")
check(reader.bookmark == 1, "Chapter top must save 101.1/id1, not remembered 102.3/id13")
let group = targets.first { $0.sectionNumber == "101" }!
let leaf = targets.first { $0.sectionNumber == "101.1" }!
check(group.level == leaf.level, "Actual equal heading levels must be covered")
reader.currentSectionTarget = group
check(reader.bookmark == 1, "Group101 must resolve descendant101.1 despite equal heading levels")
reader.currentSectionTarget = targets.first { $0.sectionNumber == "102.3" }
check(reader.bookmark == 13, "Ordinary102.3 must keep exact section identity")
reader.currentSectionTarget = group
reader.summaries = ["1:102.3": 13, "2:101.1": 90001]
check(reader.bookmark == nil, "Unresolved101 must not cross sibling102 or code scope")
reader.summaries = summaries
reader.pendingInitialBlockID = "pending"
check(reader.bookmark == nil, "Pending navigation must disable save")
reader.pendingInitialBlockID = nil
reader.currentSectionTarget = nil
reader.sectionTargets = []
check(reader.bookmark == nil, "Unloaded targets must not use remembered fallback")
let unknown = NativeReaderSectionTarget(id: "unknown", blockID: "unknown", sourceBlockID: "unknown", sourceOrder: 0,
 sectionNumber: nil, title: "Unknown heading", anchorID: nil, level: 6)
reader.sectionTargets = [unknown] + targets
reader.currentSectionTarget = unknown
check(reader.bookmark == nil, "Unknown unresolved heading must not use unrelated remembered section")
let missing = NativeReaderSectionTarget(id: "missing", blockID: "missing", sourceBlockID: "missing", sourceOrder: 0,
 sectionNumber: "10", title: "10 Missing", anchorID: nil, level: 6)
reader.sectionTargets = [missing, leaf]; reader.currentSectionTarget = missing
check(reader.bookmark == nil, "Numeric prefix10 must not include unrelated101.1")
print("PASS: actual2022BCChapter1 chapter/group/leaf identities; same-level headings, sibling/code boundaries, unknown/unloaded targets and pending navigation.")
`.replace(' PROPERTY', property);
const dir = await mkdtemp(join(tmpdir(), 'permitext-bookmark-target-'));
try {
 const swift = `import Foundation\nimport Compression\n${target}\n${parser}\n${resolver}\n${fixture}`;
 await writeFile(join(dir, 'main.swift'), swift);
 execFileSync('xcrun', ['swiftc', join(dir, 'main.swift'), '-o', join(dir, 'verify')], {stdio:'inherit'});
 execFileSync(join(dir, 'verify'), [root], {stdio:'inherit'});
 const oldProperty = '    private var currentBookmarkSectionID: Int64? { currentSectionTarget.flatMap(sectionSummary(for:))?.id ?? rememberedSectionID.wrappedValue ?? initialSectionID }\n';
 await writeFile(join(dir, 'main.swift'), swift.replace(property, oldProperty));
 execFileSync('xcrun', ['swiftc', join(dir, 'main.swift'), '-o', join(dir, 'mutant')], {stdio:'pipe'});
 assert.throws(() => execFileSync(join(dir, 'mutant'), [root], {stdio:'pipe'}), error => error.status === 1 && error.stderr.toString().includes('Chapter top must save 101.1/id1'));
 console.log('PASS: pre-fix remembered-target fallback fails actual-corpus regression.');
} finally { await rm(dir, {recursive:true, force:true}); }
