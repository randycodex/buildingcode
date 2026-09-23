import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const source = await readFile(new URL('../../NYC CC APP/permitext/Data/NativeReaderDocumentStore.swift', import.meta.url), 'utf8');
function region(start, end) {
 const a = source.indexOf(start), b = source.indexOf(end, a);
 assert.ok(a >= 0 && b > a, start);
 return source.slice(a, b).replaceAll('private ', '');
}
const state = region('    private struct PreparedCacheEntry', '    func cachedRolloutRoute')
 .replace(/    private let corpusRootURL[^\n]*\n/g, '')
 .replace(/    let corpusRootURL[^\n]*\n/g, '')
 .replace(/    let indexTask[^\n]*\n/g, '');
let operations = region('    func loadPreparedDocument(', '    func metrics()');
const bodyStart = operations.indexOf('            let signpostID');
const bodyEnd = operations.indexOf('\n        let preparation = Preparation', bodyStart);
assert.ok(bodyStart > 0 && bodyEnd > bodyStart);
// Substitute only disk/decoding work. All admission, consumer, cancellation,
// memory-generation and hit-recency code below is extracted unchanged.
operations = operations.slice(0, bodyStart) + `            try await Task.sleep(nanoseconds: 50_000_000)
            return NativeReaderPreparedDocument(estimatedMemoryCost: route.cost)
        }` + operations.slice(bodyEnd);
const cache = region('    private func cachedPreparedDocument(for', '    private static func supportsValidatedEligibility');
const directory = await mkdtemp(join(tmpdir(), 'permitext-native-admission-'));
try {
 const path = join(directory, 'main.swift');
 await writeFile(path, `import Foundation
struct NativeReaderPreparedDocument: Sendable { let estimatedMemoryCost: Int }
struct NativeReaderDocumentRoute: Sendable { let documentID: String; let cost: Int }
final class Harness: @unchecked Sendable {
${state}
${operations}
${cache}
}
@main struct Verify {
 static func main() async throws {
  let h = Harness(); let mb = 1024 * 1024
  func put(_ id: String, _ cost: Int, _ speculative: Bool) {
   h.storePreparedDocumentLocked(.init(estimatedMemoryCost: cost), for: id, speculative: speculative)
  }
  put("current", 30 * mb, true); put("recent", 19 * mb, true)
  precondition(h.preparedDocuments["current"] != nil && h.preparedDocuments["recent"] == nil)
  precondition(h.mutableMetrics.evictionCount == 0)
  h.handleMemoryWarning()
  for id in ["a", "b", "c", "d"] { put(id, 1, false) }
  put("warm", 1, true)
  precondition(h.preparedDocuments.count == 4 && h.preparedDocuments["warm"] == nil)
  _ = h.cachedPreparedDocumentLocked(for: "a", promote: false)
  put("foreground", 1, false)
  precondition(h.preparedDocuments["a"] == nil && h.preparedDocuments["foreground"] != nil)
  _ = h.cachedPreparedDocumentLocked(for: "b")
  put("next", 1, false)
  precondition(h.preparedDocuments["b"] != nil && h.preparedDocuments["c"] == nil)

  h.handleMemoryWarning()
  put("demandA", 1, false)
  for id in ["warmB", "warmC", "warmD"] { put(id, 1, true) }
  put("demandE", 1, false)
  precondition(h.preparedDocuments["demandA"] != nil && h.preparedDocuments["warmD"] == nil)
  precondition(h.preparedDocuments["warmB"] != nil && h.preparedDocuments["warmC"] != nil)
  _ = h.cachedPreparedDocumentLocked(for: "warmC")
  precondition(h.preparedDocuments["warmC"]?.speculative == false)
  put("demandF", 1, false)
  precondition(h.preparedDocuments["warmB"] == nil && h.preparedDocuments["warmC"] != nil)

  let route = NativeReaderDocumentRoute(documentID: "joined", cost: 1)
  guard case .pending(let first, let warmConsumer) = h.beginPreparation(for: route, speculative: true),
        case .pending(let second, let demandConsumer) = h.beginPreparation(for: route, speculative: false)
  else { fatalError("must join") }
  precondition(first.id == second.id && second.hasDemandConsumer)
  h.releasePreparation(route.documentID, id: first.id, consumer: warmConsumer)
  precondition(!first.task.isCancelled)
  let document = try await second.task.value
  h.finishPreparation(document, documentID: route.documentID, id: first.id)
  h.releasePreparation(route.documentID, id: first.id, consumer: demandConsumer)
  precondition(h.preparedDocuments["joined"] != nil && h.mutableMetrics.diskLoadCount == 1)

  let pressure = NativeReaderDocumentRoute(documentID: "pressure", cost: 1)
  guard case .pending(let pending, _) = h.beginPreparation(for: pressure, speculative: false) else { fatalError() }
  h.handleMemoryWarning()
  let delivered = try await pending.task.value
  h.finishPreparation(delivered, documentID: pressure.documentID, id: pending.id)
  precondition(h.preparedDocuments.isEmpty && h.preparedDocumentMemoryCost == 0)
  let cancelled = NativeReaderDocumentRoute(documentID: "cancelled", cost: 1)
  guard case .pending(let abandoned, let consumer) = h.beginPreparation(for: cancelled, speculative: true) else { fatalError() }
  h.releasePreparation(cancelled.documentID, id: abandoned.id, consumer: consumer)
  precondition(abandoned.task.isCancelled && h.preparations[cancelled.documentID] == nil)
  let direct = try await h.loadPreparedDocument(for: cancelled)
  precondition(direct.estimatedMemoryCost == 1 && h.preparedDocuments["cancelled"] != nil)
  print("PASS: speculative cost/count admission, demand LRU, warm recency, shared demand promotion, independent cancellation, warning generation, retry")
 }
}
`);
 const binary = join(directory, 'verify');
 try { execFileSync('xcrun', ['swiftc', '-parse-as-library', path, '-o', binary], {stdio:'pipe'}); }
 catch (error) { throw new Error(error.stderr?.toString() || String(error)); }
 console.log(execFileSync(binary, [], {encoding:'utf8'}).trim());
} finally { await rm(directory, {recursive:true, force:true}); }
