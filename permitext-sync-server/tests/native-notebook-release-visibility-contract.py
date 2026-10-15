#!/usr/bin/env python3
"""Execute the current Notebook list/editor paths against retained deferred cards."""
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
source = (ROOT / 'NYC CC APP/permitext/Views/NotebookView.swift').read_text()
model = (ROOT / 'NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift').read_text()
cache = (ROOT / 'NYC CC APP/permitext/Data/ProjectHubOfflineCache.swift').read_text()
cache = cache[:cache.index('/// A new session invalidates')]
policy = model[model.index('enum PermitextReleaseSurfaceVisibility {'):model.index('\n}', model.index('enum PermitextReleaseSurfaceVisibility {'))+2]
helper = source[source.index('func nativeNotebookCachedCardType('):source.index('\nenum NativeNotebookOfflineDraftPolicy')]
def method(signature):
    start = source.index('    private func ' + signature)
    return source[start:source.index('\n    }', start)+6].replace('    private func', '    func', 1)

harness = r'''
struct ProjectNotebookCardSummary: Codable, Sendable, Equatable {
 let id: String; let cardType: String; var updatedAt = "2026-10-15"
}
struct NotebookAccess: Codable, Sendable { let role: String; let readOnly: Bool }
struct NotebookCardListResponse: Codable, Sendable { let cards: [ProjectNotebookCardSummary]; var access: NotebookAccess? = nil }
struct NotebookCard: Codable, Sendable { let id: String; let cardType: String; var version = 1 }
struct NativeNotebookDraft: Codable, Sendable { var cardID: String?; var editedAt: Date? = nil; var hasUnsynchronizedChanges = true }
enum ResearchQuestionAttempt { static let cacheScope = "research-question-attempt" }
struct Owner { let accountID = "A" }
struct Editor { var isReady = false }
enum NativePrivateCachePolicy {
 static func requiresInvalidation(after error: Error) -> Bool { false }
 static func permitsOfflineFallback(after error: Error) -> Bool { true }
}
enum NativeNotebookOfflineDraftPolicy {
 static func permitsDraftEditing(cachedAccess: NotebookAccess?, after error: Error) -> Bool { false }
}
func nativeNotebookRequestErrorMessage(_ error: Error) -> String { "offline" }
enum NativeNotebookRefreshDecision {
 case preservePending, reviewConflict, preserveDraft, applyServer
 static func resolve(draft: NativeNotebookDraft?, serverVersion: Int, serverContent: String) -> Self { draft == nil ? .applyServer : .preserveDraft }
}
@MainActor final class Library {
 var rows: [ProjectNotebookCardSummary] = []
 var card: NotebookCard = .init(id: "note", cardType: "finding")
 var offline = false; var cardReads = 0
 func notebookCards(projectID: String) async throws -> NotebookCardListResponse {
  if offline { throw URLError(.notConnectedToInternet) }
  return .init(cards: rows)
 }
 func notebookCard(projectID: String, cardID: String) async throws -> NotebookCard {
  cardReads += 1
  if offline { throw URLError(.notConnectedToInternet) }
  return card
 }
}
@MainActor final class Harness {
 let cache: ProjectHubOfflineCache; let library = Library()
 var owner: Owner? = .init(); var isCurrentOwner = true
 let projectID = "P"; var routeID = "note"; var cardID: String? = "note"; var currentCardID: String?
 var isLoading = false; var hasLoaded = false; var needsSave = false; var requiresConflictReview = false
 var saveTask: Task<Void, Never>?; var conflictingCard: NotebookCard?
 var errorMessage: String?; var statusMessage = ""
 var documentEditor = Editor(); var applied: [String] = []; var appliedDraft = false
 var currentDraft: NativeNotebookDraft { .init(cardID: currentCardID) }
 var cards: [ProjectNotebookCardSummary] = []
 var localDrafts: [(scope: String, value: NativeNotebookDraft)] = []
 var access = NotebookAccess(role: "viewer", readOnly: true)
 var permitsLocalDraftEditing = false; var cachedAt: String?; var loadID: UUID?; var editorRoute: String?
 init(_ cache: ProjectHubOfflineCache) { self.cache = cache }
 func flushEditorDraft() async -> Bool { true }
 func saveNow() async {}
 func editableContent(for card: NotebookCard) -> String { card.id }
 func apply(_ card: NotebookCard) { applied.append(card.cardType); hasLoaded = true; currentCardID = card.id }
 func apply(_ draft: NativeNotebookDraft) { appliedDraft = true; hasLoaded = true; currentCardID = draft.cardID }
 METHODS
}
@main struct Check {
 @MainActor static func main() async throws {
  let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
  defer { try? FileManager.default.removeItem(at: directory) }
  let visible = ProjectNotebookCardSummary(id: "note", cardType: "finding")
  let hidden = ProjectNotebookCardSummary(id: "deferred", cardType: "coordination-item")
  let all = [hidden, visible]
  precondition(PermitextReleaseSurfaceVisibility.visibleNotebookCards(all) == [visible])
  precondition(all.count == 2, "Presentation filtering must retain source records")
  for network in [false, true] {
   let cache = ProjectHubOfflineCache(directoryURL: directory.appendingPathComponent("list-\(network)"))
   try cache.store(NotebookCardListResponse(cards: all), accountID: "A", projectID: "P", scope: "native-notebook-list")
   for id in [visible.id, hidden.id] { try cache.store(NativeNotebookDraft(cardID: id), accountID: "A", projectID: "P", scope: "native-notebook-draft:\(id)") }
   let h = Harness(cache); h.library.rows = all; h.library.offline = !network
   await h.loadCards()
   precondition(h.cards == [visible] && h.localDrafts.map { $0.value.cardID! } == [visible.id], "Cached and network Notebook must hide Coordination while showing ordinary Notes/drafts")
   let retained = try cache.load(NotebookCardListResponse.self, accountID: "A", projectID: "P", scope: "native-notebook-list")
   precondition(retained?.value.cards == all, "Gating must not erase retained Coordination")
  }
  for path in ["cached-card", "cached-draft", "unknown-draft", "retry-unknown-draft", "network", "force-network"] {
   for type in ["coordination-item", "finding"] {
    let cache = ProjectHubOfflineCache(directoryURL: directory.appendingPathComponent("\(path)-\(type)"))
    let card = NotebookCard(id: "note", cardType: type)
    let draft = NativeNotebookDraft(cardID: "note")
    if path == "cached-card" || path == "cached-draft" {
     try cache.store(card, accountID: "A", projectID: "P", scope: "native-notebook-card:note")
    }
    if path == "cached-draft" || path == "unknown-draft" || path == "retry-unknown-draft" {
     try cache.store(draft, accountID: "A", projectID: "P", scope: "native-notebook-draft:note")
    }
    let h = Harness(cache); h.library.card = card
    if path == "retry-unknown-draft" {
     h.library.offline = true
     await h.loadCard()
     precondition(!h.hasLoaded && !h.appliedDraft, "An untyped old draft stays on disk until validation succeeds")
     h.library.offline = false
    }
    await h.loadCard(forceNetwork: path == "force-network" || path == "retry-unknown-draft")
    if type == "coordination-item" {
     precondition(!h.hasLoaded && h.applied.isEmpty && !h.appliedDraft, "Direct/deep links cannot reveal a deferred card or its existing draft")
     precondition(h.errorMessage == "This item is not available in Notebook.")
    } else {
     precondition(h.hasLoaded, "Ordinary Notes remain available through every route")
     if path == "retry-unknown-draft" { precondition(h.appliedDraft, "A forced retry must recover the ordinary draft, not replace it with the server copy") }
    }
    if path == "cached-draft" || path == "unknown-draft" || path == "retry-unknown-draft" {
     let retained = try cache.load(NativeNotebookDraft.self, accountID: "A", projectID: "P", scope: "native-notebook-draft:note")
     precondition(retained?.value.cardID == "note", "Blocked drafts must remain recoverable")
    }
   }
  }
  let cache = ProjectHubOfflineCache(directoryURL: directory.appendingPathComponent("new"))
  let newNote = Harness(cache); newNote.cardID = nil
  await newNote.loadCard()
  precondition(newNote.hasLoaded && newNote.library.cardReads == 0, "New ordinary Notes remain editable offline")
  print("PASS: actual Notebook cached/network lists and six direct-editor routes hide retained Coordination, preserve disk data, and retain ordinary/new Notes")
 }
}
'''.replace(' METHODS', '\n'.join(method(name) for name in ['loadCard(', 'showUnavailableCoordinationCard()', 'loadCards(']))
with tempfile.TemporaryDirectory(prefix='permitext-notebook-visibility-') as temporary:
    path = Path(temporary)
    swift = path / 'contract.swift'
    swift.write_text(cache + '\n' + policy + '\n' + helper + '\n' + harness)
    subprocess.run(['xcrun', 'swiftc', '-parse-as-library', '-swift-version', '6', str(swift), '-o', str(path / 'contract')], check=True)
    subprocess.run([str(path / 'contract')], check=True)
