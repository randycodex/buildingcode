#!/usr/bin/env python3
"""Execute production coalescing/cache code; replace only disk IO with a barrier."""
from pathlib import Path
import tempfile, subprocess
root = Path(__file__).resolve().parents[2]
s = (root / 'NYC CC APP/permitext/Data/AuthoredCodeStore.swift').read_text()
def region(a,b):
    return s[s.index(a):s.index(b,s.index(a))].replace('private ', '')
state = region('    private var preparedContentBlocksBySectionID:', '    private let bundleUsesExternalSectionText:')
ops = region('    private func preparedSectionData(', '    // No rich passage decoding')
ops = ops.replace('Data(contentsOf: url)', 'readFixture(url)')
ops = ops.replace('return flight.wait()', 'joined.signal(); return flight.wait()')
cache = region('    private func touchPreparedContent(', '    private func cacheSynthesizedContent(')
purge = s[s.index('        preparedContentLock.lock()', s.index('    func purgeRecreatableCaches()')):s.index('        synthesizedContentLock.lock()',s.index('    func purgeRecreatableCaches()'))]
code = '''import Foundation
struct CodeContentBlock: Codable, Equatable { let text: String }
struct PreparedSectionContent: Codable { let schemaVersion: Int; let sectionID: Int64; let officialText: String?; let previewText: String?; let richTextOverrideData: Data?; let blocks: [CodeContentBlock] }
struct PreparedSectionData { let officialText: String; let richTextOverrideData: Data?; let previewText: String; let blocks: [CodeContentBlock] }
extension String { var titleThroughFirstPeriod: String { self } }
final class Harness: @unchecked Sendable {
let preparedSectionsURL = URL(fileURLWithPath: "/unused")
let bundleUsesExternalSectionText: Bool
let entered = DispatchSemaphore(value: 0), release = DispatchSemaphore(value: 0), joined = DispatchSemaphore(value: 0)
let secondRelease = DispatchSemaphore(value: 0)
let counterLock = NSLock(); var reads = 0
var payload: Data
init(external: Bool, oversized: Bool) {
 bundleUsesExternalSectionText = external
 payload = try! JSONEncoder().encode(PreparedSectionContent(schemaVersion: 1, sectionID: 1, officialText: "exact", previewText: "preview", richTextOverrideData: nil, blocks: [.init(text: oversized ? String(repeating: "x", count: 2048) : "rich")]))
}
func readFixture(_ url: URL) throws -> Data {
 counterLock.lock(); reads += 1; let index = reads; counterLock.unlock()
 entered.signal(); precondition((index == 1 ? release : secondRelease).wait(timeout: .now() + 5) == .success)
 return payload
}
static let contentCacheEntryLimit = 2, contentCacheCostLimit = 1024
static func contentCost(_ blocks: [CodeContentBlock]) -> Int { blocks.reduce(0) { $0 + $1.text.utf8.count } }
''' + state + cache + ops + '\nfunc purge() {\n' + purge + '\n}\n}\n' + '''
func wait(_ semaphore: DispatchSemaphore) { precondition(semaphore.wait(timeout: .now() + 5) == .success) }
for external in [false, true] {
 for oversized in [false, true] {
  let h = Harness(external: external, oversized: oversized)
  let done = DispatchSemaphore(value: 0)
  let expected = oversized ? String(repeating: "x", count: 2048) : "rich"
  func read() { precondition(h.preparedContentBlocks(sectionID: 1) == [.init(text: expected)]); done.signal() }
  DispatchQueue.global().async { read() }; wait(h.entered)
  DispatchQueue.global().async { read() }; wait(h.joined)
  precondition(h.reads == 1); h.release.signal(); wait(done); wait(done)
  precondition(h.reads == 1)
  precondition(h.preparedContentCosts.isEmpty == oversized)
  precondition(h.sectionDataFlights.isEmpty && h.contentBlockFlights.isEmpty)
 }
 // Decode failure is also delivered to all waiters, without deadlock.
 let missing = Harness(external: external, oversized: false)
 missing.payload = Data("invalid".utf8)
 let failed = DispatchSemaphore(value: 0)
 DispatchQueue.global().async { precondition(missing.preparedContentBlocks(sectionID: 1) == nil); failed.signal() }
 wait(missing.entered)
 DispatchQueue.global().async { precondition(missing.preparedContentBlocks(sectionID: 1) == nil); failed.signal() }
 wait(missing.joined); missing.release.signal(); wait(failed); wait(failed)
 precondition(missing.reads == 1 && missing.missingPreparedSectionIDs.contains(1))
 precondition(missing.sectionDataFlights.isEmpty && missing.contentBlockFlights.isEmpty)
 // Purge while old producer + waiter are blocked. New generation must
 // start its own producer; finishing the old one must not retire the new one.
 let h = Harness(external: external, oversized: false)
 let done = DispatchSemaphore(value: 0)
 func read() { precondition(h.preparedContentBlocks(sectionID: 1) == [.init(text: "rich")]); done.signal() }
 DispatchQueue.global().async { read() }; wait(h.entered)
 DispatchQueue.global().async { read() }; wait(h.joined)
 h.purge()
 // Start a new-generation producer before finishing the old one.
 DispatchQueue.global().async { read() }; wait(h.entered)
 precondition(h.reads == 2)
 h.release.signal(); wait(done); wait(done)
 precondition(h.preparedContentCosts.isEmpty)
 // Old completion must not remove the new flight: this caller joins it.
 DispatchQueue.global().async { read() }; wait(h.joined)
 precondition(h.reads == 2)
 h.secondRelease.signal(); wait(done); wait(done)
 precondition(!h.preparedContentCosts.isEmpty)
}
print("PASS: production section/block coalescing, oversized delivery, purge waiter delivery, stale refill prevention, fresh generation retry")
'''
with tempfile.TemporaryDirectory(prefix='permitext-prepared-coalescing-') as d:
    path = Path(d)/'main.swift'; path.write_text(code)
    subprocess.run(['xcrun','swiftc',str(path),'-o',d+'/verify'],check=True)
    subprocess.run([d+'/verify'],check=True,timeout=40)
