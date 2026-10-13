// Run SearchView's actual opening, scroll binding and sheet handoff methods.
// Only the corpus loader, persistence actor and SwiftUI Binding are fixtures.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const source = await readFile(new URL('../../NYC CC APP/permitext/Views/SearchView.swift', import.meta.url), 'utf8');
function declaration(start) {
  const a = source.indexOf(start), brace = source.indexOf('{', a);
  assert.ok(a >= 0 && brace > a, `Missing ${start}`);
  let depth = 1, b = brace + 1;
  for (; depth && b < source.length; b++) {
    if (source[b] === '{') depth++;
    if (source[b] === '}') depth--;
  }
  assert.equal(depth, 0);
  return source.slice(a, b);
}
assert.match(source, /\.sheet\(item: \$passageDetail\) \{ prepared in/);
assert.match(source, /\.sheet\(item: \$historyCollection, onDismiss: historySheetDidDismiss\)/);
assert.doesNotMatch(source, /showsPassageDetail|preparedDestinations\.values\.first/);
const snapshot = source.slice(source.indexOf('struct SearchSessionSnapshot:'), source.indexOf('    static func load(cache:')) + '}';
const methods = [
  '    private var isHistoryVisible:', '    private var positionReady:', '    private var scrollPositionBinding:',
  '    private func releaseScrollAnchorForPassageDetail()', '    private func presentPassageDetail(',
  '    private func historySheetDidDismiss()', '    private func cancelReaderOpening()',
  '    private func openReader(', '    private func restoreSearchSession()', '    private func persistSearchSession()'
].map(declaration).join('\n').split('\n').filter(line => !line.includes('os_signpost(')).join('\n')
  // The facade uses reference semantics for inspection across awaited tasks;
  // explicit captures adapt the View struct's binding to that test class.
  .replace('Binding(get: { scrollTargetID }, set: { value in', 'Binding(get: { [self] in scrollTargetID }, set: { [self] value in');
const fixture = String.raw`
struct Binding<Value> { let get: () -> Value; let set: (Value) -> Void }
struct NavigationPath { }
enum Tab { case search, reader }
enum CodeSectionKind { case section }
struct CodeSearchResult {
 let id: Int64; let sourceVersion: String?; let codeSectionID: Int64?
 let chapterNumber: String; let sectionNumber: String; let title: String; let kind: CodeSectionKind
}
struct ActiveCodeSourceNavigationTarget { }
struct RecentEntry { let historyIdentity: String }
@MainActor final class CodeLibraryViewModel {
 typealias CodeSourceNavigationContext = String
 struct Account { let appUserID: String }
 var signedInAccount: Account? = Account(appUserID: "A")
 var selectedTab = Tab.search
 var activeCodeSourceRevision = UUID()
 var isSearchInProgress = false
 var recentlyViewedSections: [RecentEntry] = []
 func captureCodeSourceNavigationContext() -> String? { signedInAccount?.appUserID }
 func synchronizeIndependentReaderSession(from: CodeLibraryViewModel) { }
}
@MainActor enum RunningSearchSessions {
 static var snapshots: [String: SearchSessionSnapshot] = [:]
 static var deletionGenerations: [String: UInt64] = [:]
 static func save(_ snapshot: SearchSessionSnapshot, accountID: String, scope: String) { snapshots[scope] = snapshot }
}
actor SearchSessionPersistence {
 static let shared = SearchSessionPersistence()
 var snapshot = SearchSessionSnapshot()
 var reads = 0
 var pending: CheckedContinuation<SearchSessionSnapshot, Never>?
 func load(accountID: String) async -> SearchSessionSnapshot {
  reads += 1
  return await withCheckedContinuation { pending = $0 }
 }
 func finish(_ saved: SearchSessionSnapshot) { pending!.resume(returning: saved); pending = nil }
}
@MainActor struct PreparedSearchReaderDestination: Identifiable {
 let library: CodeLibraryViewModel
 let route: SearchReaderRoute
 ${declaration('    nonisolated var id: ObjectIdentifier')}
 enum PreparationError: LocalizedError { case unavailable, requiresEnable(ActiveCodeSourceNavigationTarget) }
 struct Request {
  let route: SearchReaderRoute
  let completion: CheckedContinuation<PreparedSearchReaderDestination, any Error>
 }
 static var requests: [Request] = []
 static func prepare(route: SearchReaderRoute, sharedLibrary: CodeLibraryViewModel, prepareChapter: Bool) async throws -> Self {
  precondition(!prepareChapter, "Search passage cards must not prepare an entire chapter")
  return try await withCheckedThrowingContinuation { requests.append(Request(route: route, completion: $0)) }
 }
 static func finish(_ index: Int) {
  let request = requests[index]
  request.completion.resume(returning: Self(library: CodeLibraryViewModel(), route: request.route))
 }
}
@MainActor final class SearchProbe {
 let library = CodeLibraryViewModel()
 var historyCollection: String? = nil
 var isHistorySheetPresented = false
 var passageDetail: PreparedSearchReaderDestination? = nil
 var pendingPassageDetail: PreparedSearchReaderDestination? = nil
 var query = ""
 var cachedFilteredResults: [Int] = []
 var isSearchRequestPending = false
 var restoredSessionScope: String? = "A|all-installed-editions"
 var searchFilterCodeSectionIDs: Set<Int64> = []
 var preparedDestinations: [SearchReaderRoute: PreparedSearchReaderDestination] = [:]
 var openingRoute: SearchReaderRoute? = nil
 var openingQuery: String? = nil
 var openingFilters: Set<Int64>? = nil
 var openingScope: String? = nil
 var openingSourceRevision: UUID? = nil
 var openingTask: Task<Void, Never>? = nil
 var openingTimeoutTask: Task<Void, Never>? = nil
 var openingGeneration = UUID()
 struct SourceEnablePrompt {
  let route: SearchReaderRoute; let target: ActiveCodeSourceNavigationTarget
  let context: String; let globalProgress: Bool
 }
 var sourceEnablePrompt: SourceEnablePrompt? = nil
 var deepLinkError: String? = nil
 var showsOpeningIndicator = false
 var openingError: String? = nil
 var failedOpeningRoute: SearchReaderRoute? = nil
 var showsGlobalOpeningProgress = false
 var scrollTargetID: String? = nil
 var pendingScrollTargetID: String? = nil
 var needsPositionReset = false
 var historyPositionID: String? = nil
 var resultPositionID: String? = nil
 var selectedResultID: Int64? = nil
 var selectedResultIdentity: String? = nil
 var queryEditGeneration: UInt64 = 0
 var searchNavigationPath = NavigationPath()
 var lastSavedSession = SearchSessionSnapshot()
 var sessionStorageMessage: String? = nil
 var sessionAccountID: String { library.signedInAccount?.appUserID ?? "permitext-signed-out-search" }
 var sessionScope: String { "\(sessionAccountID)|all-installed-editions" }
 func dismissKeyboard() { }
 func scheduleSearch() { }
 func openPendingDeepLinkedSectionIfNeeded() { }
 func rebuildSearchCaches() { }
 ${methods}
 func open(_ route: SearchReaderRoute) { openReader(route) }
 func dismissHistory() { historySheetDidDismiss() }
 func cancel() { cancelReaderOpening() }
 func writeScroll(_ id: String) { scrollPositionBinding.set(id) }
 func restore() async { await restoreSearchSession() }
 var tracksPosition: Bool { positionReady }
}
@main struct Contract {
 @MainActor static func settle() async { for _ in 0..<30 { await Task.yield() } }
 @MainActor static func finish(_ index: Int, _ probe: SearchProbe) async {
  PreparedSearchReaderDestination.finish(index)
  await probe.openingTask?.value
 }
 @MainActor static func main() async {
  let old = SearchReaderRoute(sectionID: 7, sourceVersion: "2014")
  let current = SearchReaderRoute(sectionID: 7, sourceVersion: "2022")
  let recent = SearchProbe()
  recent.scrollTargetID = "history:2014:7"
  recent.resultPositionID = "result:2022:99"
  recent.pendingScrollTargetID = "history:stale"
  recent.needsPositionReset = true
  recent.open(old)
  precondition(recent.scrollTargetID == nil && recent.pendingScrollTargetID == nil && !recent.needsPositionReset)
  precondition(recent.historyPositionID == "history:2014:7" && recent.resultPositionID == "result:2022:99")
  precondition(!recent.tracksPosition)
  recent.writeScroll("history:other")
  precondition(recent.scrollTargetID == nil && recent.historyPositionID == "history:2014:7")
  try? await Task.sleep(for: .milliseconds(400))
  precondition(recent.showsOpeningIndicator && !recent.tracksPosition)
  await settle()
  await finish(0, recent)
  precondition(recent.passageDetail?.route == old && recent.pendingPassageDetail == nil)
  recent.writeScroll("history:reordered-under-card")
  precondition(recent.scrollTargetID == nil)
  let firstID = recent.passageDetail!.id
  recent.open(current)
  await settle(); await finish(1, recent)
  precondition(recent.passageDetail?.route == current && recent.passageDetail!.id != firstID)
  recent.passageDetail = nil
  recent.writeScroll("history:after-close")
  precondition(recent.scrollTargetID == "history:after-close")

  let fast = SearchProbe()
  fast.historyCollection = "Last opened"; fast.isHistorySheetPresented = true
  fast.open(old)
  await settle(); await finish(2, fast)
  precondition(fast.historyCollection == nil && fast.passageDetail == nil && fast.pendingPassageDetail?.route == old)
  precondition(!fast.tracksPosition)
  fast.dismissHistory()
  precondition(!fast.isHistorySheetPresented && fast.passageDetail?.route == old && fast.pendingPassageDetail == nil)
  let slow = SearchProbe()
  slow.isHistorySheetPresented = true
  slow.open(current); await settle()
  slow.dismissHistory()
  precondition(slow.passageDetail == nil)
  await finish(3, slow)
  precondition(slow.passageDetail?.route == current)

  // A second tap or a cancelled/session-invalidated handoff cannot open stale content.
  let double = SearchProbe()
  double.open(old); await settle()
  double.open(current); await settle()
  PreparedSearchReaderDestination.finish(4); await settle()
  precondition(double.passageDetail == nil)
  await finish(5, double)
  precondition(double.passageDetail?.route == current)
  for invalidation in ["cancel", "account", "sources", "tab"] {
   let stale = SearchProbe(); stale.isHistorySheetPresented = true
   let index = PreparedSearchReaderDestination.requests.count
   stale.open(old); await settle(); await finish(index, stale)
   switch invalidation {
   case "cancel": stale.cancel()
   case "account": stale.library.signedInAccount = .init(appUserID: "B")
   case "sources": stale.library.activeCodeSourceRevision = UUID()
   default: stale.library.selectedTab = .reader
   }
   stale.dismissHistory()
   precondition(stale.passageDetail == nil && stale.pendingPassageDetail == nil)
  }

  // Exercise the disk-restore race through the production restore method.
  RunningSearchSessions.snapshots = [:]
  let cold = SearchProbe(); cold.restoredSessionScope = nil
  let restoring = Task { await cold.restore() }
  while await SearchSessionPersistence.shared.reads == 0 { await Task.yield() }
  let index = PreparedSearchReaderDestination.requests.count
  cold.open(old); await settle()
  var saved = SearchSessionSnapshot(); saved.query = "old disk query"
  saved.historyPositionID = "history:stale-disk-position"
  await SearchSessionPersistence.shared.finish(saved)
  await restoring.value
  precondition(cold.query.isEmpty && cold.restoredSessionScope == cold.sessionScope)
  precondition(cold.scrollTargetID == nil && cold.pendingScrollTargetID == nil && cold.openingRoute == old)
  await finish(index, cold)
  precondition(cold.passageDetail?.route == old)

  // Normal restoration still retains the query, selected result and return position.
  let restored = SearchProbe(); restored.restoredSessionScope = nil
  saved.resultPositionID = "result:2022:7"; saved.selectedResultID = 7
  saved.selectedResultIdentity = "2022:7"
  RunningSearchSessions.snapshots[restored.sessionScope] = saved
  await restored.restore()
  precondition(restored.query == saved.query && restored.selectedResultIdentity == "2022:7")
  precondition(restored.resultPositionID == "result:2022:7" && restored.pendingScrollTargetID == "result:2022:7")

  // Result openings share the same detachment while preserving history separately.
  let result = SearchProbe(); result.query = "concrete"; result.cachedFilteredResults = [1]
  result.historyPositionID = "history:2014:7"; result.scrollTargetID = "result:2022:7"
  result.open(current); await settle()
  precondition(result.resultPositionID == "result:2022:7" && result.historyPositionID == "history:2014:7")
  await finish(PreparedSearchReaderDestination.requests.count - 1, result)
  precondition(result.passageDetail?.route == current)
  print("PASS: Search recent/result opening, stable scroll position, item replacement, fast/slow history dismissal, cancellation/session/source guards and cold restoration race")
 }
}
`;
const directory = await mkdtemp(join(tmpdir(), 'permitext-search-passage-'));
try {
  const path = join(directory, 'Contract.swift');
  await writeFile(path, `import Foundation\n${snapshot}\n${declaration('struct SearchReaderRoute:')}\n${fixture}`);
  execFileSync('xcrun', ['swiftc', '-parse-as-library', '-swift-version', '6', path, '-o', join(directory, 'verify')], { stdio: 'inherit' });
  execFileSync(join(directory, 'verify'), [], { stdio: 'inherit' });
} finally { await rm(directory, { recursive: true, force: true }); }
