#!/usr/bin/env python3
"""Execute production targeted/full HTML synthesis and rich enrichment in Swift."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('search_pack', ROOT / 'Tools/permitext_search_text_pack.py')
pack = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pack)
source = pack.STORE.read_text()
between = pack.between
prefix = pack.swift_source().split('struct Resolver {')[0]
methods = between(source, '    private struct HTMLHeading {', '    private static func sortChapters(')
methods += between(source, '    private func contentBlocksEnrichedWithPublishedRichSources(', '    private func plainText(from contentBlocks:')
synthesis = between(source, '    private static func extractRequestedHTMLContentBlocks(', '    func search(')
synthesis = '\n'.join(line for line in synthesis.splitlines() if 'OSSignpostID' not in line and 'os_signpost(' not in line)
# Deterministically suspend a real production decode immediately before publication.
synthesis = synthesis.replace('        let requestedBlocks = chapterBlocks[indexed.section.id] ?? []', '        decodedObserver?(chapterBlocks)\n        beforePublication?()\n        let requestedBlocks = chapterBlocks[indexed.section.id] ?? []')
methods += synthesis
methods += between(source, '    // Per-edition limits for recreatable rich payloads', '    init(jsonURL:').replace('private func reservePreparedContent', 'func reservePreparedContent')
# The plain-text resolver/search fallback must retain its default chapter batch.
official = between(source, '    private func officialText(', '    private func resolvedOfficialText(')
assert 'synthesizedContentBlocks(for: indexed)' in official
assert 'onlyRequestedSection' not in official
assert 'onlyRequestedSection: true' in between(source, '    func sectionDetail(', '    private func preparedContentBlocks(')
fixtures = []
for edition in sorted(pack.CORPUS.iterdir()):
    if not (edition / 'prepared/chapterCatalog.json').exists():
        continue
    chapters = pack.edition_input(edition)['chapters']
    chosen = [next(c for c in chapters if c['sections'])]
    chosen += [c for c in chapters if c['chapterNumber'] == '4' and 'BUILDING' in (c['codeSectionName'] or '').upper()]
    for chapter in chosen:
        fixtures.append(dict(edition=edition.name, path=str(edition / 'chapters'), **chapter))

swift = prefix + r'''
struct Fixture: Decodable {
 let edition: String; let path: String; let chapterID: Int64
 let chapterNumber: String; let codeSectionID: Int64?; let codeSectionName: String?
 let sections: [Section]
}
struct Chapter { let id: Int64; let chapterNumber: String; let codeSectionID: Int64? }
struct IndexedSection { let section: Section; let chapter: Chapter }
final class Harness {
 var beforePublication: (() -> Void)?
 var decodedObserver: (([Int64: [CodeContentBlock]]) -> Void)?
 var synthesizedContentBlocksBySectionID: [Int64: [CodeContentBlock]] = [:]
 var synthesizedChapterKeys: Set<String> = []
 let synthesizedContentLock = NSLock()
 var synthesizedContentGeneration: UInt64 = 0
 var synthesizedContentCost = 0
 var synthesizedContentCosts: [Int64: Int] = [:]
 var synthesizedContentAccess: [Int64: UInt64] = [:]
 var synthesizedContentClock: UInt64 = 0
 let preparedContentLock = NSLock()
 var sectionDataFlights: [Int64: Int] = [:]
 var contentBlockFlights: [Int64: Int] = [:]
 var preparedContentGeneration: UInt64 = 0
 var preparedContentCost = 0
 var preparedContentCosts: [Int64: Int] = [:]
 var preparedContentAccess: [Int64: UInt64] = [:]
 var preparedContentClock: UInt64 = 0
 var preparedSectionDataBySectionID: [Int64: Int] = [:]
 var preparedContentBlocksBySectionID: [Int64: [CodeContentBlock]] = [:]
 var previewTextBySectionID: [Int64: String] = [:]
 var missingPreparedSectionIDs: Set<Int64> = []
 let sectionsByChapterIDIndex: [Int64: [Section]]
 let codeSectionNameByID: [Int64: String]
 let authoredHTMLChaptersURL: URL
 let chapter: Chapter
 init(_ fixture: Fixture) {
  chapter = Chapter(id: fixture.chapterID, chapterNumber: fixture.chapterNumber, codeSectionID: fixture.codeSectionID)
  sectionsByChapterIDIndex = [fixture.chapterID: fixture.sections.filter { $0.synthesisEligible }]
  codeSectionNameByID = fixture.codeSectionID.flatMap { id in fixture.codeSectionName.map { [id: $0] } } ?? [:]
  authoredHTMLChaptersURL = URL(fileURLWithPath: fixture.path)
 }
 func indexed(_ section: Section) -> IndexedSection { IndexedSection(section: section, chapter: chapter) }
 func blocks(_ section: Section, targeted: Bool) -> [CodeContentBlock] {
  synthesizedContentBlocks(for: indexed(section), onlyRequestedSection: targeted)
 }
 func enriched(_ blocks: [CodeContentBlock], section: Section) -> [CodeContentBlock] {
  contentBlocksEnrichedWithPublishedRichSources(blocks, for: indexed(section))
 }
''' + methods + r'''
}
func require(_ value: @autoclosure () -> Bool, _ message: String) {
 if !value() { fatalError(message) }
}
let fixtures = try JSONDecoder().decode([Fixture].self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
var checks = 0
for fixture in fixtures {
 let whole = Harness(fixture)
 var decodedBlocks: [Int64: [CodeContentBlock]] = [:]
 whole.decodedObserver = { decodedBlocks = $0 }
 let first = fixture.sections.first!
 let fullStart = ProcessInfo.processInfo.systemUptime
 _ = whole.blocks(first, targeted: false)
 let fullMS = (ProcessInfo.processInfo.systemUptime - fullStart) * 1000
 whole.decodedObserver = nil
 var selected = Array(fixture.sections.prefix(2)) + Array(fixture.sections.suffix(1))
 selected += fixture.sections.filter { $0.sectionNumber == "403.2.3.3" }
 for kind in [CodeContentBlockKind.table, .image] {
  if let section = fixture.sections.first(where: { (decodedBlocks[$0.id] ?? []).contains { $0.kind == kind } }) { selected.append(section) }
 }
 if let section = fixture.sections.first(where: { !$0.synthesisEligible }) { selected.append(section) }
 for section in selected {
  let target = Harness(fixture)
  let start = ProcessInfo.processInfo.systemUptime
  let actual = target.blocks(section, targeted: true)
  let elapsed = (ProcessInfo.processInfo.systemUptime - start) * 1000
  let expected = whole.blocks(section, targeted: false)
  require(actual == expected, "Targeted mismatch: \(fixture.edition) / \(section.sectionNumber)")
  require(target.synthesizedChapterKeys.isEmpty, "Targeted load marked whole chapter complete")
  require(Set(target.synthesizedContentBlocksBySectionID.keys) == [section.id], "Targeted load decoded siblings or failed to cache empty")
  require(target.blocks(section, targeted: true) == actual, "Cached targeted blocks changed")
  // Existing missing-image and table-reference enrichment chooses exactly the same rich source.
  let prepared = [CodeContentBlock(id: "prepared", kind: .html, html: nil, tableID: nil, imageID: nil, caption: nil, plainText: "See Table 1 and Figure 1.")]
  require(target.enriched(prepared, section: section) == whole.enriched(prepared, section: section), "Rich enrichment changed")
  if let sibling = fixture.sections.first(where: { $0.id != section.id && $0.synthesisEligible }) {
   require(target.blocks(sibling, targeted: false) == whole.blocks(sibling, targeted: false), "Targeted load suppressed later full-chapter fallback")
   require(target.synthesizedContentBlocksBySectionID.count <= 256 && target.synthesizedContentCost <= 8 * 1024 * 1024, "Full fallback exceeded cache budget")
  }
  checks += 1
  if fixture.edition == "2022-construction-codes" && section.sectionNumber == "403.2.3.3" {
   print(String(format: "Host 2022 BC4 full extraction %.3f ms; targeted403.2.3.3 %.3f ms (not device timing)", fullMS, elapsed))
  }
 }
}
// Boundary identity comes from the complete heading list, including repeated numbers.
let root = URL(fileURLWithPath: CommandLine.arguments[2])
try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
let html = """
<h6>101 Scope.</h6><p>First body.</p><table><tr><td>First table</td></tr></table><img src="first.png">
<h6>Not a numbered heading</h6><p>Still first body.</p>
<div><span depth="1"><h6>102 Other.</h6><p>Second boundary.</p></span></div>
<h6>101 Duplicate.</h6><p>Duplicate must not replace first.</p>
<h6>103 End.</h6><p>Last body.</p>
<h6>§ A104. 2 Unicode.</h6><p>Unicode café Ω 😀 body.</p>
<div><span depth="2"><h6>A105 Final.</h6><p>Trailing body.</p></span></div>
"""
try html.write(to: root.appendingPathComponent("1.html"), atomically: true, encoding: .utf8)
func section(_ id: Int64, _ number: String, eligible: Bool = true) -> Section {
 Section(id: id, sectionNumber: number, title: number, officialText: "", contentBlocks: [], synthesisEligible: eligible)
}
let synthetic = Fixture(edition: "synthetic", path: root.path, chapterID: 1, chapterNumber: "1", codeSectionID: nil, codeSectionName: nil,
 sections: [section(1,"101"), section(2,"102"), section(3,"101"), section(4,"103"), section(5,"999"), section(6,"101",eligible:false), section(7,"A104.2"), section(8,"A105")])
let whole = Harness(synthetic); _ = whole.blocks(synthetic.sections[0], targeted:false)
for entry in synthetic.sections {
 let target = Harness(synthetic)
 require(target.blocks(entry,targeted:true) == whole.blocks(entry,targeted:false), "Synthetic duplicate/boundary/missing/flat-catalog parity")
 checks += 1
}
let rich = whole.blocks(synthetic.sections[0],targeted:false)
require(rich.contains { $0.kind == .table } && rich.contains { $0.kind == .image }, "Synthetic rich blocks did not exercise parser")
require(!rich.contains { ($0.plainText ?? "").contains("Second boundary") }, "Sibling content leaked into target")
// Force count eviction after a full chapter; its marker must no longer hide evicted sections.
let bounded = Harness(synthetic)
_ = bounded.blocks(synthetic.sections[0], targeted:false)
for id in 1000..<1300 {
 _ = bounded.blocks(section(Int64(id), "999"), targeted:true)
}
require(bounded.synthesizedContentBlocksBySectionID.count <= 256, "Unbounded content entries")
require(bounded.blocks(synthetic.sections[0], targeted:true) == rich, "Eviction left stale chapter-complete marker")
bounded.purgeRecreatableCaches()
require(bounded.synthesizedContentBlocksBySectionID.isEmpty && bounded.synthesizedChapterKeys.isEmpty, "Purge retained rich content")
require(bounded.blocks(synthetic.sections[0], targeted:false) == rich, "Post-purge full read changed rich content")
let inFlight = Harness(synthetic)
let decoded = DispatchSemaphore(value: 0)
let resumeDecode = DispatchSemaphore(value: 0)
let finishedDecode = DispatchSemaphore(value: 0)
inFlight.beforePublication = { decoded.signal(); resumeDecode.wait() }
DispatchQueue.global().async {
 require(inFlight.blocks(synthetic.sections[0], targeted:true) == rich, "Purged in-flight decode lost returned value")
 finishedDecode.signal()
}
decoded.wait()
inFlight.purgeRecreatableCaches()
resumeDecode.signal()
finishedDecode.wait()
require(inFlight.synthesizedContentBlocksBySectionID.isEmpty, "Stale in-flight decode repopulated purged generation")
// Over-budget chapter retains a useful forward window, including the next section.
let largeSections = (1...300).map { section(Int64($0), String($0 + 100)) }
let largeHTML = largeSections.map { "<h6>\($0.sectionNumber) Heading.</h6><p>Body.</p>" }.joined()
try largeHTML.write(to: root.appendingPathComponent("2.html"), atomically:true, encoding:.utf8)
let largeFixture = Fixture(edition:"large", path:root.path, chapterID:2, chapterNumber:"2", codeSectionID:nil, codeSectionName:nil, sections:largeSections)
let large = Harness(largeFixture)
var extractions = 0
large.beforePublication = { extractions += 1 }
_ = large.blocks(largeSections[0], targeted:false)
_ = large.blocks(largeSections[1], targeted:false)
require(extractions == 1, "Oversized chapter reparsed for next sequential section")
for id in 1000..<1260 {
 _ = large.blocks(section(Int64(id), "missing"), targeted:true)
 _ = large.blocks(largeSections[0], targeted:true)
}
require(large.synthesizedContentBlocksBySectionID[largeSections[0].id] != nil, "Hot entry evicted")
// Production lock/generation paths under concurrent purge and reads.
DispatchQueue.concurrentPerform(iterations: 60) { iteration in
 if iteration % 3 == 0 { bounded.purgeRecreatableCaches() }
 else { require(bounded.blocks(synthetic.sections[0], targeted: iteration % 2 == 0) == rich, "Concurrent purge changed returned content") }
}
bounded.purgeRecreatableCaches()
require(bounded.synthesizedContentBlocksBySectionID.isEmpty, "Final purge did not clear cache")
require(bounded.blocks(synthetic.sections[0], targeted:true) == rich, "Post-concurrency read failed")
bounded.preparedContentLock.lock()
for id in 0..<600 {
 if bounded.reservePreparedContent(sectionID: Int64(id), cost: 100_000) { bounded.preparedSectionDataBySectionID[Int64(id)] = id }
}
require(bounded.preparedContentCost <= 8 * 1024 * 1024, "Prepared payload cost unbounded")
require(bounded.preparedSectionDataBySectionID.count <= 256, "Prepared entry count unbounded")
require(!bounded.reservePreparedContent(sectionID: 999, cost: 9 * 1024 * 1024), "Oversized payload retained")
require(!bounded.preparedSectionDataBySectionID.isEmpty, "Oversize wiped existing prepared entries")
bounded.preparedContentLock.unlock()
bounded.purgeRecreatableCaches()
require(bounded.preparedSectionDataBySectionID.isEmpty, "Prepared purge failed")
try FileManager.default.removeItem(at: root.appendingPathComponent("1.html"))
for contents in [Data(), Data([0xff,0xfe,0xff])] {
 try contents.write(to: root.appendingPathComponent("1.html"))
 let target = Harness(synthetic)
 require(target.blocks(synthetic.sections[0],targeted:true).isEmpty, "Empty/unreadable HTML must fall back")
 require(target.synthesizedContentBlocksBySectionID[1] == [], "Empty target must be cached")
 try FileManager.default.removeItem(at: root.appendingPathComponent("1.html"))
}
let missing = Harness(synthetic)
require(missing.blocks(synthetic.sections[0],targeted:true).isEmpty, "Missing HTML must fall back")
require(missing.synthesizedChapterKeys.isEmpty, "Missing target claimed full chapter")
print("\(checks) actual/synthetic targeted/full rich-block parity cases; missing/empty/invalid HTML, LRU/cost limits, hot-entry retention, oversized sequential reuse, purge generation and concurrent reload passed.")
'''
with tempfile.TemporaryDirectory(prefix='permitext-detail-parity-') as directory:
    temp = Path(directory)
    (temp / 'fixtures.json').write_text(json.dumps(fixtures))
    (temp / 'Verify.swift').write_text(swift)
    subprocess.run(['swiftc', '-O', str(temp / 'Verify.swift'), '-o', str(temp / 'verify')], check=True)
    subprocess.run([str(temp / 'verify'), str(temp / 'fixtures.json'), str(temp / 'html')], check=True)
