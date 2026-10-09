// Compile the actual Swift loader and publication method against a controllable
// backend. A delayed read must never roll back a newer answer or its disk cache.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const source = await readFile(new URL('../../NYC CC APP/permitext/Views/ResearchView.swift', import.meta.url), 'utf8');
function method(signature) {
 const start = source.indexOf(`    private func ${signature}`);
 assert.ok(start >= 0);
 const end = source.indexOf('\n    }', start) + 6;
 return source.slice(start,end).replace('    private func','    func');
}
assert.match(source, /onChange\(of: library.activeResearchConversationID\)[\s\S]*?conversationLoadID = nil\s+isLoadingConversation = false/, 'Changing routes must release the previous detail loading state');
const fixture = `import Foundation
struct Account: Equatable { var accountID = "fixture" }
struct NativeResearchRequestIdentity: Equatable { var account = Account(); var conversationID: String? = "conversation" }
struct ResearchConversationSummary: Codable, Sendable { let id: String }
struct ResearchConversation: Codable, Sendable { var id = "conversation"; var updatedAt: String; var contextRevision: Int? = 0; var messages: [String] }
struct Envelope<T> { let value: T }
struct ResearchQuestionAttempt: Codable { static let cacheScope = "attempt"; func shouldRetainOnServer(_ c: ResearchConversation) -> Bool { false } }
final class Cache { var value: ResearchConversation?; func load<T>(_ type: T.Type, accountID: String, projectID: String, scope: String) throws -> Envelope<T>? { nil }; func remove(accountID: String, projectID: String, scope: String) throws {} }
enum ResearchConversationCacheLifecycle {
 static func load<T>(_ type: T.Type, cache: Cache, accountID: String, conversationID: String) throws -> Envelope<T>? { nil }
 static func store(_ value: ResearchConversation, cache: Cache, accountID: String, conversationID: String) throws { cache.value = value }
}
enum ResearchComposerDraftCache { static func load(cache: Cache, accountID: String, conversationID: String) throws -> String? { nil } }
struct PermitextBackendHTTPError: Error { var statusCode: Int? }
enum NativePrivateCachePolicy { static func permitsOfflineFallback(after e: Error) -> Bool { true }; static func requiresInvalidation(after e: Error) -> Bool { false } }
@MainActor final class Library {
 var activeResearchConversationID: String? = "conversation"
 var reads: [CheckedContinuation<ResearchConversation, Error>] = []
 var historyReads: [CheckedContinuation<[ResearchConversationSummary], Error>] = []
 func researchConversations() async throws -> [ResearchConversationSummary] { try await withCheckedThrowingContinuation { historyReads.append($0) } }
 func researchConversation(id: String) async throws -> ResearchConversation { try await withCheckedThrowingContinuation { reads.append($0) } }
 func retainInterruptedResearch(conversationID: String, attempt: ResearchQuestionAttempt, contextRevision: Int) async throws -> ResearchConversation { ResearchConversation(updatedAt: "unused",messages: []) }
}
@MainActor final class Harness {
 let library = Library(); let cache = Cache()
 var identity = NativeResearchRequestIdentity(); var isCurrentOwner = true; var owner: Account? = Account()
 var conversation: ResearchConversation?
 var historyLoadID: UUID?; var summaries: [ResearchConversationSummary] = []; var historyPreviews: [String: String] = [:]
 var conversationLoadID: UUID?; var conversationPublicationID = UUID()
 var historyPreviewRevisions: [String: String] = [:]
 var isLoadingHistory = false; var isLoadingConversation = false
 ${source.match(/    private var isLoading: Bool \{[^\n]+/)[0].replace("private ", "")}
 var question = ""; var errorMessage: String?; var historyErrorMessage: String?
 var pendingQuestionAttempt: ResearchQuestionAttempt?
 var retainingInterruptedIdentities: [NativeResearchRequestIdentity] = []
 var invalidations = 0
 func isCurrent(_ i: NativeResearchRequestIdentity) -> Bool { isCurrentOwner && i == identity }
 func invalidateConversationIfRequired(_ error: Error, id: String) { invalidations += 1; conversation = nil }
 func restoreCachedQuestionAttempt(for c: ResearchConversation, accountID: String) {}
 func cacheHistory(_ h: [ResearchConversationSummary], accountID: String) {}
 func publish(_ c: ResearchConversation) { conversation = c; cacheConversation(c) }
 ${method('loadHistory(forceNetwork:')}
 ${method('loadConversation(id:')}
 ${method('cacheConversation(_ conversation:')}
}
@main struct Main {
 @MainActor static func main() async {
  let old = ResearchConversation(updatedAt: "2026-10-08T10:00:00Z",messages: ["old answer"])
  let fresh = ResearchConversation(updatedAt: "2026-10-08T10:01:00Z",messages: ["old answer", "new answer"])
  for obsoleteFailure in [false, true] {
   let h = Harness(); h.publish(old)
   let refresh = Task { await h.loadConversation(id: "conversation", identity: h.identity, useCache: false) }
   while h.library.reads.isEmpty { await Task.yield() }
   h.publish(fresh)
   if obsoleteFailure { h.library.reads[0].resume(throwing: PermitextBackendHTTPError(statusCode: 403)) }
   else { h.library.reads[0].resume(returning: old) }
   await refresh.value
   precondition(h.conversation?.messages == fresh.messages, "Older GET must not roll back a completed answer")
   precondition(h.cache.value?.messages == fresh.messages, "Older GET must not roll back the cache")
   precondition(h.invalidations == 0, "Obsolete errors must not erase a newer publication")
  }
  for historyFinishesFirst in [true, false] {
   let h = Harness()
   let history = Task { await h.loadHistory(forceNetwork: true) }
   let detail = Task { await h.loadConversation(id: "conversation", identity: h.identity, useCache: false) }
   while h.library.historyReads.isEmpty || h.library.reads.isEmpty { await Task.yield() }
   precondition(h.isLoadingHistory && h.isLoadingConversation && h.isLoading)
   if historyFinishesFirst {
    h.library.historyReads[0].resume(returning: []); await history.value
    precondition(!h.isLoadingHistory && h.isLoadingConversation && h.isLoading, "History completion must not hide pending detail loading")
    h.library.reads[0].resume(returning: fresh); await detail.value
   } else {
    h.library.reads[0].resume(returning: fresh); await detail.value
    precondition(h.isLoadingHistory && !h.isLoadingConversation && h.isLoading, "Detail completion must not hide pending history loading")
    h.library.historyReads[0].resume(returning: []); await history.value
   }
   precondition(!h.isLoading, "Both independent loads must clear when finished")
  }
  for historyFails in [false, true] {
   let h = Harness()
   let history = Task { await h.loadHistory(forceNetwork: true) }
   let detail = Task { await h.loadConversation(id: "conversation", identity: h.identity, useCache: false) }
   while h.library.historyReads.isEmpty || h.library.reads.isEmpty { await Task.yield() }
   if historyFails {
    h.library.historyReads[0].resume(throwing: PermitextBackendHTTPError(statusCode: 503)); await history.value
    let error = h.historyErrorMessage
    precondition(error != nil)
    h.library.reads[0].resume(returning: fresh); await detail.value
    precondition(h.historyErrorMessage == error && h.errorMessage == nil, "Successful detail must not erase a failed history refresh")
   } else {
    h.library.reads[0].resume(throwing: PermitextBackendHTTPError(statusCode: 503)); await detail.value
    let error = h.errorMessage
    precondition(error != nil)
    h.library.historyReads[0].resume(returning: []); await history.value
    precondition(h.errorMessage == error && h.historyErrorMessage == nil, "Successful history must not erase a failed conversation read")
   }
  }
  let h = Harness()
  let first = Task { await h.loadConversation(id: "conversation", identity: h.identity, useCache: false) }
  while h.library.reads.count < 1 { await Task.yield() }
  let second = Task { await h.loadConversation(id: "conversation", identity: h.identity, useCache: false) }
  while h.library.reads.count < 2 { await Task.yield() }
  h.library.reads[1].resume(returning: fresh); await second.value
  h.library.reads[0].resume(returning: old); await first.value
  precondition(h.conversation?.messages == fresh.messages, "Newest read owns publication")
  let cancelled = Task { await h.loadConversation(id: "conversation", identity: h.identity, useCache: false) }
  while h.library.reads.count < 3 { await Task.yield() }
  cancelled.cancel(); h.library.reads[2].resume(returning: old); await cancelled.value
  precondition(h.conversation?.messages == fresh.messages, "Cancelled response must not publish")
  print("PASS: delayed response and error after mutation, out-of-order reads, cancellation, independent loading/error states; actual loaders and cache publication")
 }
}
`;
const dir = await mkdtemp(join(tmpdir(),'permitext-research-freshness-'));
try {
 await writeFile(join(dir,'verify.swift'),fixture);
 execFileSync('xcrun',['swiftc','-parse-as-library',join(dir,'verify.swift'),'-o',join(dir,'verify')],{stdio:'inherit'});
 execFileSync(join(dir,'verify'),[],{stdio:'inherit'});
 const mutant = fixture.replaceAll('conversationLoadID == loadID, conversationPublicationID == publicationID','true');
 await writeFile(join(dir,'mutant.swift'),mutant);
 execFileSync('xcrun',['swiftc','-parse-as-library',join(dir,'mutant.swift'),'-o',join(dir,'mutant')],{stdio:'pipe'});
 assert.throws(()=>execFileSync(join(dir,'mutant'),[],{stdio:'pipe'}), error => error.stderr.toString().includes('Older GET must not roll back a completed answer'));
 console.log('PASS: removing freshness guards fails the delayed-answer regression');
} finally { await rm(dir,{recursive:true,force:true}); }
