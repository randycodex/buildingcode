// Test-only fixture setup and independent assertions; no production SQL replaced.
@main struct VerifySavedQueue {
 static func check(_ condition: Bool, _ message: String) { if !condition { FileHandle.standardError.write(Data(("FAIL: " + message + "\n").utf8)); exit(1) } }
 static func main() throws {
  let url = URL(fileURLWithPath: CommandLine.arguments[1])
  let version = UserContentSyncCodeVersion.localNYC2022
  var store: UserDataStore? = try UserDataStore(databaseURL: url)
  do {
   let setup = try SQLiteConnection(path: url.path, readOnly: false)
   for id in 1...2 {
    try setup.execute("INSERT INTO folders(id,client_id,code_version,name,color_hex,created_at) VALUES(\(id),'synthetic-\(id)','\(version)','Fixture \(id)','#000000','2026-01-01T00:00:00Z');")
   }
  }
  try store!.saveSection(705,toFolderIDs:[1],codeVersion:version)
  let old = try store!.pendingSyncQueueItems(limit:100)
  check(old.count == 2,"Initial save must queue bookmark and membership")
  try store!.markSyncQueueItemsInFlight(ids:old.map(\.id))
  // Move away, then back while the original request is outstanding. The last
  // upsert addresses the SAME membership as the older acknowledgement.
  try store!.saveSection(705,toFolderIDs:[2],codeVersion:version)
  try store!.saveSection(705,toFolderIDs:[1],codeVersion:version)
  let newer = try store!.pendingSyncQueueItems(limit:100)
  check(newer.count == 4,"Two moves must persist four membership mutations")
  for item in old { try store!.markSyncQueueItemSynced(id:item.id) }
  func membershipState() throws -> String {
   let db = try SQLiteConnection(path:url.path,readOnly:true)
   let query = try db.prepare("SELECT sync_state FROM folder_sections WHERE section_id=705 AND folder_id=1;")
   defer { db.finalize(query) }
   check(try db.step(query) == SQLITE_ROW,"Current membership must survive")
   return db.string(at:0,in:query)
  }
  check(try membershipState() == "pendingUpload","Older acknowledgement must not mark newer assignment synced")
  try store!.markSyncQueueItemsInFlight(ids:newer.map(\.id))
  for item in newer { try store!.markSyncQueueItemFailed(id:item.id,errorMessage:"synthetic disconnected transport") }
  store = nil // Real close, then reopen from persisted WAL/SQLite state.
  store = try UserDataStore(databaseURL:url)
  do {
   let db = try SQLiteConnection(path:url.path,readOnly:true)
   for (sql, expected) in [("SELECT COUNT(*) FROM bookmarks WHERE section_id=705;",1), ("SELECT COUNT(*) FROM folder_sections WHERE section_id=705;",1), ("SELECT folder_id FROM folder_sections WHERE section_id=705;",1)] {
    let query = try db.prepare(sql)
    defer { db.finalize(query) }
    check(try db.step(query) == SQLITE_ROW && db.int(at:0,in:query) == expected,"Reopen retains exactly one saved passage in its final destination")
   }
  }
  let failed = try store!.failedSyncQueueItems(limit:100)
  check(Set(failed.map(\.id)) == Set(newer.map(\.id)),"All newer mutations survive reopen")
  check(failed.allSatisfy { $0.attemptCount == 1 },"Retry attempt persists")
  check(try membershipState() == "pendingUpload","Reopen preserves pending local assignment")
  try store!.prepareSyncQueueForProcessing(now:Date().addingTimeInterval(301))
  let retry = try store!.pendingSyncQueueItems(limit:100)
  check(retry.map(\.id) == newer.map(\.id),"Retry preserves original operation order")
  check(retry.map(\.payload) == newer.map(\.payload),"Retry preserves exact assignments")
  check(retry.map(\.mutationUpdatedAt) == newer.map(\.mutationUpdatedAt),"Transport retry must not rewrite edit timestamps")
  try store!.markSyncQueueItemsInFlight(ids:retry.map(\.id))
  for item in retry.dropLast() { try store!.markSyncQueueItemSynced(id:item.id) }
  check(try membershipState() == "pendingUpload","Pending last mutation prevents premature synced state")
  try store!.markSyncQueueItemSynced(id:retry.last!.id)
  check(try membershipState() == "synced","Final acknowledged assignment becomes synced")
  check(try store!.pendingSyncQueueItems(limit:100).isEmpty,"No work left pending")
  store = nil
  print("PASS: older acknowledgement preserves newer reassignment; failed retry survives SQLite reopen, order/payload/edit time preserved, final acknowledgement converges")
 }
}
