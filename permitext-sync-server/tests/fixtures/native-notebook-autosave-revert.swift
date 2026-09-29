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
 init(_ path: String) { url = URL(fileURLWithPath: path) }
 func store<T: Encodable>(_ value: T, accountID: String, projectID: String, scope: String) throws {
  if fail { throw CocoaError(.fileWriteOutOfSpace) }
  try JSONEncoder().encode(value).write(to: url, options: .atomic)
 }
 func removeProject(accountID: String, projectID: String) throws {}
 func reopen() throws -> NativeNotebookDraft { try JSONDecoder().decode(NativeNotebookDraft.self, from: Data(contentsOf: url)) }
}
@MainActor final class Network {
 var attempts: [NativeNotebookSaveAttempt] = []
 var suspended: CheckedContinuation<NotebookCard, Error>?
 var hold = false
 func notebookCards(projectID: String) async throws -> ListResponse { ListResponse() }
 func saveNotebookCard(projectID: String, cardID: String?, expectedVersion: Int, title: String,
  document: NotebookDocument, evidenceLinks: [NotebookEvidenceLink], clientMutationID: String) async throws -> NotebookCard {
  let attempt = NativeNotebookSaveAttempt(clientMutationID: clientMutationID, cardID: cardID,
   expectedVersion: expectedVersion, content: .init(title: title, document: document, evidenceLinks: evidenceLinks))
  attempts.append(attempt)
  if hold { return try await withCheckedThrowingContinuation { suspended = $0 } }
  return response(attempt)
 }
 func response(_ attempt: NativeNotebookSaveAttempt) -> NotebookCard {
  NotebookCard(id: attempt.cardID ?? "new-note", version: attempt.expectedVersion + 1, createdAt: "", updatedAt: "",
   title: attempt.content.title, document: attempt.content.document, evidenceLinks: attempt.content.evidenceLinks)
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
 var lastSyncedContent: NativeNotebookEditableContent?, mutationContent: NativeNotebookEditableContent?
 var editObservation = NativeNotebookEditObservation(), conflictingCard: NotebookCard?
 let owner: Owner? = Owner(), projectID = "test-project", routeID = "note"
 let cache: DraftCache, library = Network()
 init(_ path: String) {
  cache = DraftCache(path)
  lastSyncedContent = editableContent; mutationContent = editableContent; editObservation.reset(to: editableContent)
 }
 func edit(_ value: String) { title = value; scheduleAutosave() }
 func retry() async { await saveNow() }
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
  print("PASS: production autosave/save/cache/acknowledgement methods; debounce revert, in-flight compensation, durable pending retry, disk failure and conflict preservation.")
 }
}
