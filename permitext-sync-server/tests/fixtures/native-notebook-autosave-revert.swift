struct Owner { let accountID = "synthetic" }
struct Access: Encodable { let readOnly = false; let role = "owner" }
struct ListResponse: Encodable { let access: Access? = Access() }
enum PermitextBackendHTTPError: Error {
 case serverStatus(Int, String)
 var statusCode: Int { switch self { case let .serverStatus(code, _): return code } }
}
enum NativePrivateCachePolicy {
 static func requiresInvalidation(after error: Error) -> Bool { false }
 static func permitsOfflineFallback(after error: Error) -> Bool {
  (error as? URLError)?.code == .notConnectedToInternet
 }
}
enum ResearchQuestionAttempt { static let cacheScope = "research-question-attempt" }
enum PermitextReleaseSurfaceVisibility {
 static func notebookCardIsVisible(_ cardType: String) -> Bool { cardType == "finding" }
}
func nativeNotebookCachedCardType(cache: ProjectHubOfflineCache, accountID: String, projectID: String, cardID: String) -> String? {
 try? cache.load(NotebookCard.self, accountID: accountID, projectID: projectID, scope: "native-notebook-card:\(cardID)")?.value.cardType
}
func nativeNotebookRequestErrorMessage(_ error: Error) -> String { "Synthetic request failure" }
final class DraftCache {
 let url: URL
 var fail = false
 var recoveryURLs: [URL] = []
 init(_ path: String) { url = URL(fileURLWithPath: path) }
 func store<T: Encodable>(_ value: T, accountID: String, projectID: String, scope: String) throws {
  if fail { throw CocoaError(.fileWriteOutOfSpace) }
  let target = scope.hasPrefix("native-notebook-legacy-metadata:")
   ? url.appendingPathExtension(scope.replacingOccurrences(of: ":", with: "-")) : url
  try JSONEncoder().encode(value).write(to: target, options: .atomic)
  if target != url && !recoveryURLs.contains(target) { recoveryURLs.append(target) }
 }
 func removeProject(accountID: String, projectID: String) throws {}
 func reopen() throws -> NativeNotebookDraft { try JSONDecoder().decode(NativeNotebookDraft.self, from: Data(contentsOf: url)) }
}
@MainActor final class Network {
 var attempts: [NativeNotebookSaveAttempt] = []
 var suspended: CheckedContinuation<NotebookCard, Error>?
 var hold = false
 var isNetworkAvailable = true
 var networkConnectionGeneration: UInt = 0
 var rejectsWithConflict = false
 var rejectionStatus: Int?
 var rejectInvalidQuestions = true
 var storedQuestions: [NotebookQuestion]? = nil
 func invalidateProjectDashboardPreview(projectID: String) {}
 func notebookCards(projectID: String) async throws -> ListResponse { ListResponse() }
 func saveNotebookCard(projectID: String, cardID: String?, expectedVersion: Int, title: String,
  document: NotebookDocument, evidenceLinks: [NotebookEvidenceLink], clientMutationID: String, openQuestions: [NotebookQuestion]? = nil) async throws -> NotebookCard {
  let attempt = NativeNotebookSaveAttempt(clientMutationID: clientMutationID, cardID: cardID,
   expectedVersion: expectedVersion, content: .init(title: title, document: document, evidenceLinks: evidenceLinks, openQuestions: openQuestions))
  attempts.append(attempt)
  if !isNetworkAvailable { throw URLError(.notConnectedToInternet) }
  if let rejectionStatus { throw PermitextBackendHTTPError.serverStatus(rejectionStatus, "Temporary failure") }
  if rejectsWithConflict { throw PermitextBackendHTTPError.serverStatus(409, "Newer version") }
  if rejectInvalidQuestions, NotebookQuestion.validationMessage(in: openQuestions ?? []) != nil {
   throw PermitextBackendHTTPError.serverStatus(400, "Invalid question")
  }
  if hold {
   let saved = try await withCheckedThrowingContinuation { suspended = $0 }
   try Task.checkCancellation()
   return saved
  }
  return response(attempt)
 }
 func response(_ attempt: NativeNotebookSaveAttempt) -> NotebookCard {
  // Match the API: omission preserves questions; [] explicitly clears them.
  if let questions = attempt.content.openQuestions { storedQuestions = questions }
  return NotebookCard(id: attempt.cardID ?? "new-note", version: attempt.expectedVersion + 1, createdAt: "", updatedAt: "",
   title: attempt.content.title, document: attempt.content.document, evidenceLinks: attempt.content.evidenceLinks,
   openQuestions: storedQuestions)
 }
 func acknowledge() { hold = false; suspended?.resume(returning: response(attempts.last!)); suspended = nil }
 func failOnReconnect() {
  hold = false
  networkConnectionGeneration += 1
  suspended?.resume(throwing: URLError(.notConnectedToInternet))
  suspended = nil
 }
}
@MainActor final class ClosedNotebookWorker {
 let projectHubOfflineCache: ProjectHubOfflineCache
 let privateRequestIdentity = NativePrivateRequestIdentity(accountID: "account", sessionID: UUID())
 let library = Network()
 var isNetworkAvailable: Bool { library.isNetworkAvailable }
 var notebookReconnectRevision = 0
 var notebookReconnectNeedsRetry = false
 private var replayingNotebookDraft: NotebookDraftAddress?
 init(_ directory: URL) { projectHubOfflineCache = ProjectHubOfflineCache(directoryURL: directory) }
 func invalidateProjectDashboardPreview(projectID: String) {}
 func notebookCard(projectID: String, cardID: String) async throws -> NotebookCard {
  throw URLError(.fileDoesNotExist)
 }
 func saveNotebookCard(projectID: String, cardID: String?, expectedVersion: Int, title: String,
  document: NotebookDocument, evidenceLinks: [NotebookEvidenceLink], clientMutationID: String, openQuestions: [NotebookQuestion]?) async throws -> NotebookCard {
  try await library.saveNotebookCard(projectID: projectID, cardID: cardID, expectedVersion: expectedVersion, title: title,
   document: document, evidenceLinks: evidenceLinks, clientMutationID: clientMutationID, openQuestions: openQuestions)
 }
 // CLOSED_REPLAY_METHOD
}
@MainActor final class Editor {
 var isCurrentOwner = true, hasLoaded = true, editingReadOnly = false, isDeleting = false
 var localDraftOnly = false, isLoading = false, requiresConflictReview = false
 var freshWriteRole: String? = "owner"
 var isSaving = false, needsSave = false, canPerformNetworkWrites = true, hasDeniedWriteAccess = false
 var hasLocalDraft = false, errorMessage: String?
 var retryAfterReconnect = false, isEditorVisible = true, isLeaving = false
 var automaticSaveRetryTask: Task<Void, Never>?, saveRetryCount = 0
 var saved: Bool { !hasLocalDraft && !isSaving && pendingSave == nil && editableContent == lastSyncedContent && errorMessage == nil }
 var autosaveDebounceTask: Task<Void, Never>?, lastLocalEditAt: Date?, pendingSave: NativeNotebookSaveAttempt?
 var currentCardID: String? = "note", version = 1, draftMutationID = "original"
 var title = "Saved", document = NotebookDocument.empty, evidenceLinks: [NotebookEvidenceLink] = []
 var openQuestions: [NotebookQuestion] = []
 var lastSyncedContent: NativeNotebookEditableContent?, mutationContent: NativeNotebookEditableContent?
 var editObservation = NativeNotebookEditObservation(), conflictingCard: NotebookCard?
 let owner: Owner? = Owner(), projectID = "test-project", routeID = "note"
 let cache: DraftCache, library = Network()
 init(_ path: String) {
  cache = DraftCache(path)
  lastSyncedContent = editableContent; mutationContent = editableContent; editObservation.reset(to: editableContent)
 }
 func edit(_ value: String) { title = value; scheduleAutosave() }
 func editQuestions(_ value: [NotebookQuestion]) { openQuestions = value; scheduleAutosave() }
 func retry() async { await saveNow() }
 func networkRecovered() async { await retryOfflineSaveIfReady() }
 func releaseClosedDraft() {}
 func flushEditorDraft() async -> Bool { cacheDraft() }
 func restore(_ draft: NativeNotebookDraft) { apply(draft) }
 func storeServerCard(_ card: NotebookCard) {}
 func onSaved() {}
 func reconcileVersionConflict(_ error: PermitextBackendHTTPError) async { fatalError("Unexpected conflict") }
 // PRODUCTION_METHODS
}
func check(_ condition: @autoclosure () -> Bool, _ message: String) {
 if !condition() { FileHandle.standardError.write(Data((message + "\n").utf8)); exit(1) }
}
@main struct Verify {
 @MainActor static func main() async throws {
  let path = CommandLine.arguments[1]
  let editor = Editor(path)
  editor.edit("Changed")
  check(editor.autosaveDebounceTask != nil && editor.hasLocalDraft, "Edit must queue a save after caching the draft")
  editor.edit("Saved")
  check(editor.autosaveDebounceTask == nil && editor.saved, "Reverting before debounce must cancel the queued save")
  try await Task.sleep(for: .milliseconds(720))
  check(editor.library.attempts.isEmpty, "Revert before debounce must not send a write")
  check(!editor.hasLocalDraft && !editor.needsSave && editor.lastLocalEditAt == nil, "Revert must clear obsolete dirty state")
  let revertedDisk = try editor.cache.reopen()
  check(!revertedDisk.hasUnsynchronizedChanges, "Reopened draft must not resurrect reverted text")

  let active = Editor(path)
  active.library.hold = true
  active.edit("Sent")
  try await Task.sleep(for: .milliseconds(720))
  check(active.isSaving && active.pendingSave != nil, "Controlled network must hold active write")
  let pending = active.pendingSave
  active.edit("Saved")
  check(!active.saved && active.pendingSave == pending, "Reverting cannot declare an uncertain write synced")
  check(active.autosaveDebounceTask == nil, "The debounce task handle must be cleared before the request starts")
  let disk = try active.cache.reopen()
  check(disk.title == "Saved" && disk.pendingSave == pending && disk.hasUnsynchronizedChanges, "Disk must retain reverted text and original pending receipt")
  active.library.acknowledge()
  try await Task.sleep(for: .milliseconds(30))
  check(active.library.attempts.count == 2, "Revert after dispatch requires a compensating save")
  check(active.library.attempts[1].content.title == "Saved" && active.library.attempts[1].expectedVersion == 2, "Compensation must use acknowledged version")
  check(active.saved, "Both acknowledgements must converge")

  let uncertain = Editor(path)
  uncertain.edit("Uncertain")
  uncertain.autosaveDebounceTask?.cancel()
  uncertain.pendingSave = NativeNotebookSaveAttempt(clientMutationID: "receipt", cardID: "note", expectedVersion: 1,
   content: .init(title: "Uncertain", document: uncertain.document, evidenceLinks: []))
  uncertain.edit("Saved")
  check(!uncertain.saved, "Pending failed request must remain uncertain after revert")
  let recovered = try uncertain.cache.reopen()
  check(recovered.title == "Saved" && recovered.pendingSave?.clientMutationID == "receipt", "Reopen must retain original retry identity")
  await uncertain.retry()
  try await Task.sleep(for: .milliseconds(30))
  check(uncertain.library.attempts.first?.clientMutationID == "receipt" && uncertain.library.attempts.count == 2, "Retry must resolve original receipt before compensating")
  check(uncertain.saved, "Recovered revert must eventually sync")

  let offline = Editor(path)
  offline.library.isNetworkAvailable = false
  offline.edit("Edited offline")
  await offline.retry()
  let offlineDraft = try offline.cache.reopen()
  check(offlineDraft.retryAfterReconnect == true && offlineDraft.pendingSave != nil,
        "A connection failure must persist automatic retry and its exact save receipt")
  await offline.networkRecovered()
  check(offline.library.attempts.count == 1, "An offline notification must not send another request")
  offline.library.isNetworkAvailable = true
  offline.library.networkConnectionGeneration += 1
  await offline.networkRecovered()
  await offline.networkRecovered()
  check(offline.saved && offline.library.attempts.count == 2 &&
        offline.library.attempts[0] == offline.library.attempts[1],
        "Reconnection must replay the original request once and clear the draft")

  let reopened = Editor(path)
  reopened.restore(offlineDraft)
  await reopened.networkRecovered()
  check(reopened.saved && reopened.title == "Edited offline",
        "A reopened offline draft must retry when the connection is available")
  let ambiguous = Editor(path)
  ambiguous.restore(recovered)
  await ambiguous.networkRecovered()
  check(ambiguous.library.attempts.isEmpty, "An unvalidated cached receipt waits for the Note refresh before replay")

  let throttled = Editor(path)
  throttled.library.rejectionStatus = 429
  throttled.edit("Temporarily throttled")
  await throttled.retry()
  check(throttled.errorMessage == nil && throttled.retryAfterReconnect && throttled.pendingSave != nil,
        "A temporary server rejection must keep the receipt without a banner")
  throttled.library.rejectionStatus = nil
  try await Task.sleep(for: .milliseconds(1200))
  check(throttled.saved && throttled.library.attempts.count == 2 &&
        throttled.library.attempts[0] == throttled.library.attempts[1],
        "Automatic retry must repeat the same request without a connection change")

  let crossing = Editor(path)
  crossing.library.hold = true
  crossing.edit("Failed during reconnect")
  let initialSave = Task { await crossing.retry() }
  while crossing.library.suspended == nil { await Task.yield() }
  crossing.library.failOnReconnect()
  await initialSave.value
  try await Task.sleep(for: .milliseconds(1200))
  check(crossing.saved && crossing.library.attempts.count == 2 &&
        crossing.library.attempts[0] == crossing.library.attempts[1],
        "A reconnect during a failing save must not be missed")

  let worker = ClosedNotebookWorker(URL(fileURLWithPath: path).deletingLastPathComponent().appendingPathComponent("closed"))
  let cache = worker.projectHubOfflineCache
  let address = NotebookDraftAddress(owner: worker.privateRequestIdentity, projectID: "closed-project",
                                    scope: "native-notebook-draft:note", cardID: "note")
  try cache.store(NotebookCard(id: "note", version: 1, createdAt: "", updatedAt: "", title: "Saved", document: .empty),
                  accountID: address.owner.accountID, projectID: address.projectID, scope: "native-notebook-card:note")
  var latestOffline = offlineDraft
  latestOffline.title = "Later offline text"
  latestOffline.clientMutationID = "later-edit"
  try cache.store(latestOffline, accountID: address.owner.accountID, projectID: address.projectID, scope: address.scope)
  let queued = try cache.notebookDraftEntries(NativeNotebookDraft.self, accountID: address.owner.accountID, knownProjectIDs: [])
  check(queued.count == 1 && queued[0].projectID == address.projectID && queued[0].value == latestOffline,
        "A closed draft must be discoverable in its owning account without opening its project")
  worker.library.rejectionStatus = 429
  await worker.replayClosedNotebookDraft(at: address)
  let deferred = try cache.load(NativeNotebookDraft.self, accountID: address.owner.accountID, projectID: address.projectID, scope: address.scope)?.value
  check(worker.notebookReconnectNeedsRetry && deferred == latestOffline,
        "A temporary failure must keep a closed draft queued for the next background retry")
  worker.library.rejectionStatus = nil
  await worker.replayClosedNotebookDraft(at: address)
  let replayed = try cache.load(NotebookCard.self, accountID: address.owner.accountID, projectID: address.projectID,
                                scope: "native-notebook-card:note")?.value
  let retired = try cache.load(NativeNotebookDraft.self, accountID: address.owner.accountID, projectID: address.projectID, scope: address.scope)
  check(worker.library.attempts.first?.clientMutationID == offlineDraft.pendingSave?.clientMutationID &&
        worker.library.attempts.count == 3 && worker.library.attempts[0] == worker.library.attempts[1] &&
        worker.library.attempts.last?.expectedVersion == 2 &&
        replayed?.title == "Later offline text" && retired == nil && worker.notebookReconnectRevision == 1,
        "The closed replay must resolve the old receipt and save the latest draft before retiring it")
  try cache.store(latestOffline, accountID: address.owner.accountID, projectID: address.projectID, scope: address.scope)
  worker.library.rejectsWithConflict = true
  await worker.replayClosedNotebookDraft(at: address)
  let retained = try cache.load(NativeNotebookDraft.self, accountID: address.owner.accountID, projectID: address.projectID, scope: address.scope)?.value
  check(retained?.title == latestOffline.title && retained?.version == latestOffline.version && retained?.retryAfterReconnect == nil,
        "Rejected closed writes must leave the user's draft and its original version for conflict review")

  let failure = Editor(path)
  failure.edit("Changed"); failure.cache.fail = true; failure.edit("Saved")
  check(failure.errorMessage?.contains("Could not save the local draft.") == true, "Disk failure must remain visible")
  let conflict = Editor(path)
  conflict.edit("Changed"); conflict.autosaveDebounceTask?.cancel(); conflict.requiresConflictReview = true
  conflict.errorMessage = "Review conflict"; conflict.edit("Saved")
  check(conflict.errorMessage == "Review conflict", "Revert must preserve unresolved conflict")

  let questions = Editor(path)
  let blank = NotebookQuestion(text: " ")
  let valid = NotebookQuestion(text: "Saved legacy metadata")
  questions.library.storedQuestions = [valid]
  questions.lastSyncedContent?.openQuestions = [valid]
  questions.openQuestions = [blank]
  questions.edit("Ordinary note update"); questions.autosaveDebounceTask?.cancel()
  await questions.retry()
  check(questions.library.attempts.count == 1 && questions.library.attempts[0].content.openQuestions == nil,
        "Ordinary note saves must omit hidden question updates")
  check(questions.saved,
        "Invalid hidden metadata must not block note saving or leave an invisible dirty state")
  check(questions.openQuestions == [valid] && questions.library.storedQuestions == [valid],
        "Ordinary note updates must preserve saved server metadata")
  let archived = try questions.cache.recoveryURLs.map { try JSONDecoder().decode(NativeNotebookDraft.self, from: Data(contentsOf: $0)) }
  check(archived.contains { $0.openQuestions == [blank] && $0.title == "Ordinary note update" },
        "Unsent legacy metadata must survive acknowledgement in a durable recovery record")

  let pendingQuestion = Editor(path)
  let oldReceipt = NativeNotebookSaveAttempt(clientMutationID: "old-valid", cardID: "note", expectedVersion: 1,
   content: .init(title: "Old draft", document: pendingQuestion.document, evidenceLinks: [], openQuestions: [valid]))
  pendingQuestion.pendingSave = oldReceipt
  pendingQuestion.openQuestions = [blank]
  pendingQuestion.title = "Latest ordinary text"
  await pendingQuestion.retry()
  try await Task.sleep(for: .milliseconds(50))
  check(pendingQuestion.library.attempts.first == oldReceipt,
        "Legacy uncertain requests must replay their exact original body and identity")
  check(pendingQuestion.library.attempts.count == 2 && pendingQuestion.library.attempts.last?.content.openQuestions == nil,
        "Compensating ordinary save must omit questions after resolving legacy receipt")
  check(pendingQuestion.title == "Latest ordinary text" && pendingQuestion.saved && pendingQuestion.openQuestions == [valid],
        "Legacy acknowledgement must retain newer note text and saved metadata")

  let legacyInvalid = Editor(path)
  legacyInvalid.openQuestions = [blank]
  legacyInvalid.title = "New ordinary text"
  legacyInvalid.pendingSave = NativeNotebookSaveAttempt(clientMutationID: "invalid-old-receipt", cardID: "note", expectedVersion: 1,
   content: .init(title: "Old text", document: legacyInvalid.document, evidenceLinks: [], openQuestions: [blank]))
  await legacyInvalid.retry()
  try await Task.sleep(for: .milliseconds(50))
  check(legacyInvalid.library.attempts.count == 2 && legacyInvalid.library.attempts[0].clientMutationID == "invalid-old-receipt",
        "Invalid legacy receipt must first receive definitive rejection before replacement")
  check(legacyInvalid.library.attempts.last?.clientMutationID != "invalid-old-receipt" && legacyInvalid.library.attempts.last?.content.openQuestions == nil && legacyInvalid.saved,
        "Definitively rejected legacy metadata must not block a fresh ordinary save")
  let rejectedArchives = try legacyInvalid.cache.recoveryURLs.map { try JSONDecoder().decode(NativeNotebookDraft.self, from: Data(contentsOf: $0)) }
  check(rejectedArchives.contains { $0.pendingSave?.clientMutationID == "invalid-old-receipt" },
        "Rejected legacy receipt and metadata must remain durably recoverable")

  for invalid in [NotebookQuestion(text: String(repeating: "😀", count: 501)),
                  NotebookQuestion(text: "Question", why: String(repeating: "x", count: 2001)),
                  NotebookQuestion(text: "Question", resolution: String(repeating: "x", count: 4001))] {
   check(NotebookQuestion.validationMessage(in: [invalid]) != nil, "Native limits must match server UTF-16 limits")
  }
  var legacyJSON = try JSONSerialization.jsonObject(with: JSONEncoder().encode(questions.cache.reopen())) as! [String: Any]
  legacyJSON.removeValue(forKey: "openQuestions")
  if var base = legacyJSON["baseContent"] as? [String: Any] {
   base.removeValue(forKey: "openQuestions"); legacyJSON["baseContent"] = base
  }
  let legacyDraft = try JSONDecoder().decode(NativeNotebookDraft.self, from: JSONSerialization.data(withJSONObject: legacyJSON))
  check(legacyDraft.openQuestions == nil && legacyDraft.baseContent?.openQuestions == nil,
        "Existing drafts and saved baselines without questions must still decode")
  print("PASS: production autosave/save/cache/acknowledgement methods; debounce revert, in-flight compensation, durable pending retry, disk failure and conflict preservation.")
  print("PASS: offline drafts retry the original mutation on reconnect, across reopening and during a failing request.")
  print("PASS: closed draft discovery, receipt replay, subsequent edits and conflict preservation.")
  print("PASS: hidden legacy metadata remains recoverable without blocking ordinary saves; saved metadata and old receipts preserved, rejected receipts recover, legacy decoding and field limits retained.")
 }
}
