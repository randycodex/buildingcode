// Compile the actual Swift loader and publication method against a controllable
// backend. A delayed read must never roll back a newer answer or its disk cache.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const source = await readFile(new URL('../../NYC CC APP/permitext/Views/ResearchView.swift', import.meta.url), 'utf8');
const models = await readFile(new URL('../../NYC CC APP/permitext/Models/ResearchNotebookModels.swift', import.meta.url), 'utf8');
function method(signature) {
 const start = source.indexOf(`    private func ${signature}`);
 assert.ok(start >= 0);
 const end = source.indexOf('\n    }', start) + 6;
 return source.slice(start,end).replace('    private func','    func');
}
function property(name) {
 const start = source.indexOf(`    private var ${name}:`); assert.ok(start >= 0);
 return source.slice(start,source.indexOf('\n    }', start)+6).replace('    private var','    var');
}
function declaration(name) {
 const start = models.search(new RegExp(`(?:struct|enum) ${name}[: {]`)); assert.ok(start >= 0);
 return models.slice(start,models.indexOf('\n}',start)+2);
}
assert.match(source, /onChange\(of: library.activeResearchConversationID\)[\s\S]*?conversationLoadID = nil\s+isLoadingConversation = false/, 'Changing routes must release the previous detail loading state');
const fixture = `import Foundation
struct Account: Equatable { var accountID = "fixture" }
struct NativeResearchRequestIdentity: Equatable { var account = Account(); var conversationID: String? = "conversation" }
struct ResearchConversationSummary: Codable, Hashable, Sendable { let id: String; var title = ""; var primaryProjectID: String?; var starterQuestion: String? }
${declaration('ResearchConversationListResponse')}
${declaration('NativeResearchHistory')}
${declaration('ResearchNotebookHandoffPresentation')}
struct ResearchConversation: Codable, Sendable { var id = "conversation"; var updatedAt: String; var contextRevision: Int? = 0; var messages: [String] }
struct Envelope<T> { let value: T }
struct ResearchQuestionAttempt: Codable { static let cacheScope = "attempt"; func shouldRetainOnServer(_ c: ResearchConversation) -> Bool { false } }
final class Cache {
 var value: ResearchConversation?; var history: [ResearchConversationSummary]?; var historyWrites = 0; var removals = 0
 func load<T>(_ type: T.Type, accountID: String, projectID: String, scope: String) throws -> Envelope<T>? { guard scope == "research-history", let typed = history as? T else { return nil }; return Envelope(value: typed) }
 func store<T>(_ value: T, accountID: String, projectID: String, scope: String) throws { if scope == "research-history", let typed = value as? [ResearchConversationSummary] { history = typed; historyWrites += 1 } }
 func remove(accountID: String, projectID: String, scope: String) throws { removals += 1; if scope == "research-history" { history = nil } }
}
enum ResearchConversationCacheLifecycle {
 static func load<T>(_ type: T.Type, cache: Cache, accountID: String, conversationID: String) throws -> Envelope<T>? { nil }
 static func store(_ value: ResearchConversation, cache: Cache, accountID: String, conversationID: String) throws { cache.value = value }
}
enum ResearchComposerDraftCache { static func load(cache: Cache, accountID: String, conversationID: String) throws -> String? { nil } }
struct PermitextBackendHTTPError: Error { var statusCode: Int? }
enum NativePrivateCachePolicy {
 static func permitsOfflineFallback(after e: Error) -> Bool { ![401,403].contains((e as? PermitextBackendHTTPError)?.statusCode ?? 0) }
 static func requiresInvalidation(after e: Error) -> Bool { !permitsOfflineFallback(after: e) }
}
@MainActor final class Library {
 var activeResearchConversationID: String? = "conversation"
 var reads: [CheckedContinuation<ResearchConversation, Error>] = []
 var historyReads: [CheckedContinuation<ResearchConversationListResponse, Error>] = []
 var historyRequests: [(limit: Int, cursor: String?, query: String, projectID: String?)] = []
 func researchConversationPage(limit: Int, cursor: String?, query: String, projectID: String?) async throws -> ResearchConversationListResponse {
  historyRequests.append((limit,cursor,query,projectID))
  return try await withCheckedThrowingContinuation { historyReads.append($0) }
 }
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
 var historyQuery = ""; var historyProjectFilter = "all"; var historyNextCursor: String?
 var historyHasMore = false; var historyLegacySummaries: [ResearchConversationSummary]?
 var isLoadingMoreHistory = false; var historyLoadedFilterKey: String?
 ${property('historyProjectID')}
 ${property('historyIsFiltered')}
 ${property('historyFilterKey')}
 ${method('boundedHistoryQuery(_ value:')}
 var isLoadingHistory = false; var isLoadingConversation = false
 ${source.match(/    private var isLoading: Bool \{[^\n]+/)[0].replace("private ", "")}
 var question = ""; var errorMessage: String?; var historyErrorMessage: String?
 var pendingQuestionAttempt: ResearchQuestionAttempt?
 var retainingInterruptedIdentities: [NativeResearchRequestIdentity] = []
 var invalidations = 0
 func isCurrent(_ i: NativeResearchRequestIdentity) -> Bool { isCurrentOwner && i == identity }
 func invalidateConversationIfRequired(_ error: Error, id: String) { invalidations += 1; conversation = nil }
 func restoreCachedQuestionAttempt(for c: ResearchConversation, accountID: String) {}
 ${method('cacheHistory(_ history:')}
 ${method('removeHistoryConversation(id:')}
 ${method('invalidateHistoryCache(accountID:')}
 func publish(_ c: ResearchConversation) { conversation = c; cacheConversation(c) }
 ${method('loadHistory(forceNetwork:')}
 ${method('loadMoreHistory()')}
 ${method('loadConversation(id:')}
 ${method('cacheConversation(_ conversation:')}
}
@main struct Main {
 static func page(_ values: [ResearchConversationSummary], next: String? = nil, more: Bool? = false) -> ResearchConversationListResponse { ResearchConversationListResponse(conversations: values, nextCursor: next, hasMore: more) }
 static func row(_ id: String, _ question: String = "Ramp question", project: String? = nil) -> ResearchConversationSummary { ResearchConversationSummary(id: id, title: "Title " + id, primaryProjectID: project, starterQuestion: question) }
 @MainActor static func verifyHistory() async {
  let queryHarness = Harness()
  for query in ["ordinary question", String(repeating: "x", count: 201), String(repeating: "😀", count: 101), String(repeating: "👩‍👩‍👧‍👦", count: 21)] {
   let bounded = queryHarness.boundedHistoryQuery(query)
   precondition(bounded.utf16.count <= 200 && query.hasPrefix(bounded) && !bounded.hasSuffix("…"), "Search limits must use API units without appending a nonliteral ellipsis")
   if query.utf16.count <= 200 { precondition(bounded == query) }
  }
  let mixed = [row("a", "Door width", project: "project-a"), row("b", "Ramp slope"), row("c", "Ramp slope", project: "")]
  precondition(NativeResearchHistory.filtered(mixed, query: "  rAMP  ", projectID: nil).map(\\.id) == ["b", "c"])
  precondition(NativeResearchHistory.filtered(mixed, query: "", projectID: "").map(\\.id) == ["b", "c"])
  precondition(NativeResearchHistory.filtered(mixed, query: "door", projectID: "project-a").map(\\.id) == ["a"])
  let decoded = try! JSONDecoder().decode(ResearchConversationListResponse.self, from: Data(#"{"conversations":[]}"#.utf8))
  precondition(decoded.hasMore == nil && decoded.nextCursor == nil, "Old-server JSON must still decode")
  do {
   let h = Harness(); let all = (0..<65).map { row("legacy-" + String($0)) }
   let read = Task { await h.loadHistory(forceNetwork: true) }
   while h.library.historyReads.isEmpty { await Task.yield() }
   precondition(h.library.historyRequests[0].limit == 30 && h.library.historyRequests[0].projectID == nil)
   h.library.historyReads[0].resume(returning: page(all, more: nil)); await read.value
   precondition(h.summaries.count == 30 && h.historyHasMore && h.historyNextCursor == nil)
   precondition(h.cache.history?.count == 65, "A complete legacy list must be cached in full before local paging")
   await h.loadMoreHistory(); precondition(h.summaries.count == 60 && h.historyHasMore)
   await h.loadMoreHistory(); precondition(h.summaries.count == 65 && !h.historyHasMore)
   precondition(h.library.historyReads.count == 1, "Legacy full-list fallback pages locally without repeat network reads")
   let cachedIDs = h.cache.history?.map(\\.id)
   h.historyProjectFilter = "unassigned"; h.historyQuery = "door"
   let filtered = Task { await h.loadHistory(forceNetwork: true) }
   while h.library.historyReads.count < 2 { await Task.yield() }
   precondition(h.library.historyRequests[1].projectID == "" && h.library.historyRequests[1].query == "door")
   h.library.historyReads[1].resume(returning: page(mixed + [row("unassigned-door", "Door width")], more: nil)); await filtered.value
   precondition(h.summaries.map(\\.id) == ["unassigned-door"], "Old-server results must respect query and explicit unassigned filter locally")
   precondition(h.cache.history?.map(\\.id) == cachedIDs, "Filtered results must not replace the all-history cache")
  }
  do {
   let h = Harness()
   let first = Task { await h.loadHistory(forceNetwork: true) }
   while h.library.historyReads.isEmpty { await Task.yield() }
   h.library.historyReads[0].resume(returning: page([row("a"), row("b")], next: "page-2", more: true)); await first.value
   let next = Task { await h.loadMoreHistory() }
   while h.library.historyReads.count < 2 { await Task.yield() }
   await h.loadMoreHistory()
   precondition(h.library.historyReads.count == 2 && h.library.historyRequests[1].cursor == "page-2", "Repeated Load More shares the active page request")
   h.library.historyReads[1].resume(returning: page([row("b"), row("c")], next: "page-3", more: true)); await next.value
   precondition(h.summaries.map(\\.id) == ["a", "b", "c"], "Overlapping pages must not duplicate existing rows")
   let repeatedCursor = Task { await h.loadMoreHistory() }
   while h.library.historyReads.count < 3 { await Task.yield() }
   h.library.historyReads[2].resume(returning: page([row("d")], next: "page-3", more: true)); await repeatedCursor.value
   precondition(!h.historyHasMore && h.summaries.map(\\.id) == ["a", "b", "c", "d"], "A repeated cursor must stop an endless load loop")
   precondition(h.cache.history?.map(\\.id) == ["a", "b", "c", "d"])
  }
  for obsoleteFailure in [false, true] {
   let h = Harness()
   let old = Task { await h.loadHistory(forceNetwork: true) }
   while h.library.historyReads.count < 1 { await Task.yield() }
   let fresh = Task { await h.loadHistory(forceNetwork: true) }
   while h.library.historyReads.count < 2 { await Task.yield() }
   h.library.historyReads[1].resume(returning: page([row("newest")])); await fresh.value
   if obsoleteFailure { h.library.historyReads[0].resume(throwing: PermitextBackendHTTPError(statusCode: 403)) }
   else { h.library.historyReads[0].resume(returning: page([row("obsolete")])) }
   await old.value
   precondition(h.summaries.map(\\.id) == ["newest"] && h.cache.history?.map(\\.id) == ["newest"], "An older history refresh must not replace newer results/cache")
   precondition(h.historyErrorMessage == nil && h.cache.removals == 0, "An obsolete history error must not invalidate fresh history")
  }
  for obsoleteFailure in [false, true] {
   let h = Harness()
   let initial = Task { await h.loadHistory(forceNetwork: true) }
   while h.library.historyReads.isEmpty { await Task.yield() }
   h.library.historyReads[0].resume(returning: page([row("base")], next: "more", more: true)); await initial.value
   let next = Task { await h.loadMoreHistory() }
   while h.library.historyReads.count < 2 { await Task.yield() }
   h.historyQuery = "Door"; h.historyProjectFilter = "project-a"
   let replacement = Task { await h.loadHistory(forceNetwork: true) }
   while h.library.historyReads.count < 3 { await Task.yield() }
   precondition(h.library.historyRequests[2].cursor == nil && h.library.historyRequests[2].projectID == "project-a", "Changing a filter must start from the first page")
   h.library.historyReads[2].resume(returning: page([row("door", "Door width", project: "project-a")])); await replacement.value
   if obsoleteFailure { h.library.historyReads[1].resume(throwing: PermitextBackendHTTPError(statusCode: 403)) }
   else { h.library.historyReads[1].resume(returning: page([row("old-page")], next: "bad", more: true)) }
   await next.value
   precondition(h.summaries.map(\\.id) == ["door"] && !h.historyHasMore && h.historyNextCursor == nil, "A page from the previous filter must not append or restore its cursor")
   precondition(h.cache.history?.map(\\.id) == ["base"] && h.historyErrorMessage == nil && h.cache.removals == 0)
  }
  for outcome in ["filter", "owner", "cancel"] {
   let h = Harness()
   let read = Task { await h.loadHistory(forceNetwork: true) }
   while h.library.historyReads.isEmpty { await Task.yield() }
   if outcome == "filter" { h.historyQuery = "new filter" }
   if outcome == "owner" { h.isCurrentOwner = false }
   if outcome == "cancel" { read.cancel() }
   h.library.historyReads[0].resume(returning: page([row("must-not-publish")])); await read.value
   precondition(h.summaries.isEmpty && h.cache.historyWrites == 0, "Changed filter/owner and cancelled history reads cannot publish")
  }
  do {
   let h = Harness(); h.cache.history = mixed
   h.historyQuery = "ramp"; h.historyProjectFilter = "unassigned"
   let read = Task { await h.loadHistory() }
   while h.library.historyReads.isEmpty { await Task.yield() }
   precondition(h.summaries.map(\\.id) == ["b", "c"], "Cached first paint must respect current filters")
   h.library.historyReads[0].resume(throwing: PermitextBackendHTTPError(statusCode: 503)); await read.value
   precondition(h.summaries.map(\\.id) == ["b", "c"] && h.historyErrorMessage != nil, "Transient failure retains filtered offline results")
  }
  do {
   let h = Harness(); let all = (0..<65).map { row("cached-" + String($0)) }; h.cache.history = all
   let read = Task { await h.loadHistory(forceNetwork: true) }
   while h.library.historyReads.isEmpty { await Task.yield() }
   var current = Array(all.prefix(30)); current[0].title = "Updated title"
   h.library.historyReads[0].resume(returning: page(current, next: "older", more: true)); await read.value
   precondition(h.cache.history?.count == 65 && h.cache.history?.first?.title == "Updated title", "A partial modern page must update current rows without discarding older offline history")
   let reopened = Harness(); reopened.cache.history = h.cache.history
   let offline = Task { await reopened.loadHistory() }
   while reopened.library.historyReads.isEmpty { await Task.yield() }
   reopened.library.historyReads[0].resume(throwing: PermitextBackendHTTPError(statusCode: 503)); await offline.value
   precondition(reopened.summaries.count == 30 && reopened.historyHasMore)
   await reopened.loadMoreHistory(); await reopened.loadMoreHistory()
   precondition(reopened.summaries.count == 65 && !reopened.historyHasMore, "All previously cached rows must remain reachable after reopening offline")
   let complete = Task { await h.loadMoreHistory() }
   while h.library.historyReads.count < 2 { await Task.yield() }
   h.library.historyReads[1].resume(returning: page([all[30]])); await complete.value
   precondition(h.cache.history?.count == 31, "A complete unfiltered scan replaces stale rows absent from the authoritative list")
  }
  do {
   let h = Harness(); h.cache.history = mixed; h.historyProjectFilter = "unassigned"
   h.historyLegacySummaries = [mixed[1], mixed[2]]; h.summaries = [mixed[1]]
   h.historyLoadID = UUID(); h.historyLoadedFilterKey = h.historyFilterKey; h.historyHasMore = true
   h.removeHistoryConversation(id: "b", accountID: "fixture")
   precondition(h.cache.history?.map(\\.id) == ["a", "c"], "A filtered deletion removes its ID from global cache while preserving unrelated Projects")
   precondition(h.historyLegacySummaries?.map(\\.id) == ["c"])
   await h.loadMoreHistory(); precondition(h.summaries.map(\\.id) == ["c"], "Local legacy paging cannot resurrect a deleted conversation")
  }
  for revocation in [false, true] {
   let h = Harness(); h.cache.history = mixed
   let initial = Task { await h.loadHistory(forceNetwork: true) }
   while h.library.historyReads.isEmpty { await Task.yield() }
   h.library.historyReads[0].resume(returning: page([mixed[0]], next: "older", more: true)); await initial.value
   let more = Task { await h.loadMoreHistory() }
   while h.library.historyReads.count < 2 { await Task.yield() }
   if revocation {
    h.library.historyReads[1].resume(throwing: PermitextBackendHTTPError(statusCode: 403)); await more.value
    precondition(h.summaries.isEmpty && h.cache.history == nil && h.historyLegacySummaries == nil && !h.historyHasMore, "Revoked access must invalidate all cached/visible history")
   } else {
    h.removeHistoryConversation(id: "a", accountID: "fixture")
    h.library.historyReads[1].resume(returning: page([mixed[0], mixed[1]])); await more.value
    precondition(!h.summaries.contains { $0.id == "a" } && !(h.cache.history ?? []).contains { $0.id == "a" }, "A page started before deletion must not restore that deleted row")
   }
  }
 }
 @MainActor static func main() async {
  await verifyHistory()
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
    h.library.historyReads[0].resume(returning: page([])); await history.value
    precondition(!h.isLoadingHistory && h.isLoadingConversation && h.isLoading, "History completion must not hide pending detail loading")
    h.library.reads[0].resume(returning: fresh); await detail.value
   } else {
    h.library.reads[0].resume(returning: fresh); await detail.value
    precondition(h.isLoadingHistory && !h.isLoadingConversation && h.isLoading, "Detail completion must not hide pending history loading")
    h.library.historyReads[0].resume(returning: page([])); await history.value
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
    h.library.historyReads[0].resume(returning: page([])); await history.value
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
  print("PASS: actual loaders - history filter/paging ownership, old-server fallback, cursor/dedup/cache guards, delayed response/error after mutation, cancellation and independent loading/error states")
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
 const historyMutant = fixture.replaceAll('historyLoadID == loadID, historyFilterKey == filterKey','true');
 await writeFile(join(dir,'history-mutant.swift'),historyMutant);
 execFileSync('xcrun',['swiftc','-parse-as-library',join(dir,'history-mutant.swift'),'-o',join(dir,'history-mutant')],{stdio:'pipe'});
 assert.throws(()=>execFileSync(join(dir,'history-mutant'),[],{stdio:'pipe'}), error => error.stderr.toString().includes('An older history refresh must not replace newer results/cache'));
 console.log('PASS: removing history ownership guards fails the new history regression');
} finally { await rm(dir,{recursive:true,force:true}); }
