struct Owner { let accountID = "synthetic" }
struct Access: Encodable { let readOnly = false; let role = "owner" }
struct ListResponse: Encodable { let access: Access? = Access() }
enum PermitextBackendHTTPError: Error {
 case serverStatus(Int, String)
 var statusCode: Int { switch self { case let .serverStatus(code, _): return code } }
}
enum NativePrivateCachePolicy { static func requiresInvalidation(after error: Error) -> Bool { false } }
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
 var rejectInvalidQuestions = true
 var storedQuestions: [NotebookQuestion]? = nil
 func notebookCards(projectID: String) async throws -> ListResponse { ListResponse() }
 func saveNotebookCard(projectID: String, cardID: String?, expectedVersion: Int, title: String,
  document: NotebookDocument, evidenceLinks: [NotebookEvidenceLink], clientMutationID: String, openQuestions: [NotebookQuestion]? = nil) async throws -> NotebookCard {
  let attempt = NativeNotebookSaveAttempt(clientMutationID: clientMutationID, cardID: cardID,
   expectedVersion: expectedVersion, content: .init(title: title, document: document, evidenceLinks: evidenceLinks, openQuestions: openQuestions))
  attempts.append(attempt)
  if rejectInvalidQuestions, NotebookQuestion.validationMessage(in: openQuestions ?? []) != nil {
   throw PermitextBackendHTTPError.serverStatus(400, "Invalid question")
  }
  if hold { return try await withCheckedThrowingContinuation { suspended = $0 } }
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
}
@MainActor final class Editor {
 var isCurrentOwner = true, hasLoaded = true, editingReadOnly = false, isDeleting = false
 var localDraftOnly = false, hasFreshWriteAccess = true, isLoading = false, requiresConflictReview = false
 var isSaving = false, needsSave = false, canPerformNetworkWrites = true, hasDeniedWriteAccess = false
 var hasLocalDraft = false, errorMessage: String?, statusMessage = "Synced"
 var saveTask: Task<Void, Never>?, lastLocalEditAt: Date?, pendingSave: NativeNotebookSaveAttempt?
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
  check(editor.statusMessage == "Saving…", "Edit must schedule autosave")
  editor.edit("Saved")
  check(editor.statusMessage == "Synced", "Reverting before debounce must clear Saving")
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
  check(active.statusMessage != "Synced" && active.pendingSave == pending, "Reverting cannot declare an uncertain write synced")
  check(active.saveTask?.isCancelled == false, "Reverting must not cancel active save")
  let disk = try active.cache.reopen()
  check(disk.title == "Saved" && disk.pendingSave == pending && disk.hasUnsynchronizedChanges, "Disk must retain reverted text and original pending receipt")
  active.library.acknowledge()
  try await Task.sleep(for: .milliseconds(30))
  check(active.library.attempts.count == 2, "Revert after dispatch requires a compensating save")
  check(active.library.attempts[1].content.title == "Saved" && active.library.attempts[1].expectedVersion == 2, "Compensation must use acknowledged version")
  check(active.statusMessage == "Synced" && active.pendingSave == nil, "Both acknowledgements must converge")

  let uncertain = Editor(path)
  uncertain.edit("Uncertain")
  uncertain.saveTask?.cancel()
  uncertain.pendingSave = NativeNotebookSaveAttempt(clientMutationID: "receipt", cardID: "note", expectedVersion: 1,
   content: .init(title: "Uncertain", document: uncertain.document, evidenceLinks: []))
  uncertain.statusMessage = "Draft kept on this iPhone"
  uncertain.edit("Saved")
  check(uncertain.statusMessage != "Synced", "Pending failed request must remain uncertain after revert")
  let recovered = try uncertain.cache.reopen()
  check(recovered.title == "Saved" && recovered.pendingSave?.clientMutationID == "receipt", "Reopen must retain original retry identity")
  await uncertain.retry()
  try await Task.sleep(for: .milliseconds(30))
  check(uncertain.library.attempts.first?.clientMutationID == "receipt" && uncertain.library.attempts.count == 2, "Retry must resolve original receipt before compensating")
  check(uncertain.statusMessage == "Synced", "Recovered revert must eventually sync")

  let failure = Editor(path)
  failure.edit("Changed"); failure.cache.fail = true; failure.edit("Saved")
  check(failure.statusMessage == "Draft is not saved on this iPhone", "Disk failure must not falsely report Synced")
  let conflict = Editor(path)
  conflict.edit("Changed"); conflict.saveTask?.cancel(); conflict.requiresConflictReview = true
  conflict.statusMessage = "Review conflict"; conflict.edit("Saved")
  check(conflict.statusMessage == "Review conflict", "Revert must preserve unresolved conflict")

  let questions = Editor(path)
  let blank = NotebookQuestion(text: " ")
  let valid = NotebookQuestion(text: "Saved legacy metadata")
  questions.library.storedQuestions = [valid]
  questions.lastSyncedContent?.openQuestions = [valid]
  questions.openQuestions = [blank]
  questions.edit("Ordinary note update"); questions.saveTask?.cancel()
  await questions.retry()
  check(questions.library.attempts.count == 1 && questions.library.attempts[0].content.openQuestions == nil,
        "Ordinary note saves must omit hidden question updates")
  check(questions.statusMessage == "Synced" && questions.errorMessage == nil && !questions.hasLocalDraft,
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
  check(pendingQuestion.title == "Latest ordinary text" && pendingQuestion.statusMessage == "Synced" && pendingQuestion.openQuestions == [valid],
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
  check(legacyInvalid.library.attempts.last?.clientMutationID != "invalid-old-receipt" && legacyInvalid.library.attempts.last?.content.openQuestions == nil && legacyInvalid.statusMessage == "Synced",
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
  print("PASS: hidden legacy metadata remains recoverable without blocking ordinary saves; saved metadata and old receipts preserved, rejected receipts recover, legacy decoding and field limits retained.")
 }
}
