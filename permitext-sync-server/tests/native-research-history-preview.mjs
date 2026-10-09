// Compile the actual visible-row loader; only requested rows may decode history.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const source = await readFile(new URL('../../NYC CC APP/permitext/Views/ResearchView.swift',import.meta.url),'utf8');
const start = source.indexOf('    private func loadHistoryPreview(');
assert.ok(start >= 0);
const method = source.slice(start,source.indexOf('\n    }',start)+6).replace('    private func','    func');
const fixture = `import Foundation
struct Owner: Sendable { var accountID = "owner" }
struct ResearchConversationSummary: Sendable { var id: String; var updatedAt: String; var starterQuestion: String? = "Fallback question" }
struct Answer: Sendable { var answerText: String?; var conclusion: String }
struct Message: Sendable { var answer: Answer? }
struct ResearchConversation: Sendable { var messages: [Message] }
struct Envelope<T> { let value: T }
final class Cache: @unchecked Sendable {
 let lock = NSLock(); var reads = 0; var accounts: [String] = []; var blocked = false
 let started = DispatchSemaphore(value: 0); let release = DispatchSemaphore(value: 0)
 func waitForRead() { started.wait() }
 func read(account: String) -> ResearchConversation {
  lock.lock(); reads += 1; accounts.append(account); let shouldBlock = blocked; lock.unlock()
  if shouldBlock { started.signal(); release.wait() }
  return ResearchConversation(messages: [.init(answer: .init(answerText: "**FIRST** answer " + String(repeating: "body ",count: 1000),conclusion: "Conclusion"))])
 }
}
enum ResearchConversationCacheLifecycle {
 static func load(_ type: ResearchConversation.Type,cache: Cache,accountID: String,conversationID: String) throws -> Envelope<ResearchConversation>? {
  Envelope(value: cache.read(account: accountID))
 }
}
@MainActor final class Harness {
 var isCurrentOwner = true; let owner: Owner? = Owner(); let cache = Cache()
 var historyPreviews: [String: String] = [:]; var historyPreviewRevisions: [String: String] = [:]
 var summaries = (0..<100).map { ResearchConversationSummary(id: "row-\\($0)",updatedAt: "v1") }
 ${method}
}
@main struct Main {
 @MainActor static func main() async {
  let h = Harness()
  await h.loadHistoryPreview(h.summaries[50])
  precondition(h.cache.reads == 1,"Opening one row must not decode all 100 histories")
  let preview = h.historyPreviews["row-50"]!
  precondition(preview.hasPrefix("FIRST answer") && preview.count <= 1200,"Plain preview is bounded and markdown-free")
  await h.loadHistoryPreview(h.summaries[50])
  precondition(h.cache.reads == 1,"Unchanged summary must reuse its preview")
  h.summaries[50].updatedAt = "v2"
  await h.loadHistoryPreview(h.summaries[50])
  precondition(h.cache.reads == 2,"Changed history invalidates its preview")
  let switched = Harness(); switched.cache.blocked = true
  let task = Task { await switched.loadHistoryPreview(switched.summaries[0]) }
  await Task.detached { switched.cache.waitForRead() }.value
  switched.isCurrentOwner = false
  switched.cache.release.signal(); await task.value
  precondition(switched.historyPreviews.isEmpty,"Late private preview cannot publish after account change")
  let cancelled = Harness(); cancelled.cache.blocked = true
  let work = Task { await cancelled.loadHistoryPreview(cancelled.summaries[0]) }
  await Task.detached { cancelled.cache.waitForRead() }.value
  work.cancel(); cancelled.cache.release.signal(); await work.value
  precondition(cancelled.historyPreviews.isEmpty,"Cancelled preview cannot publish")
  print("PASS: 100-row history performs one requested decode, bounded markdown preview, revision reuse/invalidation, account change and cancellation")
 }
}
`;
const dir = await mkdtemp(join(tmpdir(),'permitext-history-preview-'));
try {
 await writeFile(join(dir,'verify.swift'),fixture);
 execFileSync('xcrun',['swiftc','-parse-as-library',join(dir,'verify.swift'),'-o',join(dir,'verify')],{stdio:'inherit'});
 execFileSync(join(dir,'verify'),[],{stdio:'inherit'});
} finally { await rm(dir,{recursive:true,force:true}); }
