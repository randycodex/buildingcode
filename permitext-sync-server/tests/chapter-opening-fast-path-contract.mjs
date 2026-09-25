import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const source=await readFile(new URL('../../NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift',import.meta.url),'utf8');
const start=source.indexOf('    func prepareChapterForOpening(');
const end=source.indexOf('    private func cancelSpeculativeChapterWork()',start);
assert.ok(start>0 && end>start);
const dir=await mkdtemp(join(tmpdir(),'permitext-native-open-'));
try {
 const path=join(dir,'check.swift');
 await writeFile(path,`import Foundation
struct CodeChapter {}
struct Route {}
struct Prepared {}
struct NativeReaderPreparedOpening { let route: Route; let prepared: Prepared }
enum Failure: Error { case invalid }
@MainActor class NativeReaderDocumentStore {
 static let shared = NativeReaderDocumentStore()
 var available = true
 var valid = true
 var checkConsumerAlive: (() -> Void)?
 func rolloutRoute(for url: URL) async -> Route? { available ? Route() : nil }
 func loadPreparedDocument(for route: Route, onAcquired: (@Sendable () async -> Void)? = nil) async throws -> Prepared {
  try Task.checkCancellation()
  checkConsumerAlive?()
  await onAcquired?()
  if !valid { throw Failure.invalid }
  return Prepared()
 }
}
@MainActor class Harness {
 var fallback = 0
 var cancellations = 0
 func authoredHTMLWarmupTarget(for chapter: CodeChapter) -> (chapterURL: URL, readAccessURL: URL)? {
  (URL(fileURLWithPath:"/fixture"), URL(fileURLWithPath:"/fixture"))
 }
 func cancelSpeculativeChapterWork() { cancellations += 1 }
 func warmChapterReaderEntry(chapter: CodeChapter, sectionLimit: Int) async { fallback += 1 }
${source.slice(start,end)}
}
@main struct Run {
 @MainActor static func main() async throws {
  let h = Harness()
  NativeReaderDocumentStore.shared.checkConsumerAlive = { precondition(h.cancellations == 0, "Selected warmup was cancelled before navigation acquired it") }
  let native = try await h.prepareChapterForOpening(CodeChapter())
  precondition(native != nil && h.fallback == 0 && h.cancellations == 2)
  NativeReaderDocumentStore.shared.checkConsumerAlive = nil
  NativeReaderDocumentStore.shared.available = false
  let missing = try await h.prepareChapterForOpening(CodeChapter())
  precondition(missing == nil && h.fallback == 1)
  NativeReaderDocumentStore.shared.available = true
  NativeReaderDocumentStore.shared.valid = false
  let invalid = try await h.prepareChapterForOpening(CodeChapter())
  precondition(invalid == nil && h.fallback == 2)
  let task = Task { () -> Bool in
   withUnsafeCurrentTask { $0?.cancel() }
   do { _ = try await h.prepareChapterForOpening(CodeChapter()); return false }
   catch is CancellationError { return true }
   catch { return false }
  }
  let cancelled = await task.value
  precondition(cancelled && h.fallback == 2)
  print("PASS: validated native skips fallback; missing/invalid native retains fallback; cancellation prevents opening")
 }
}
`);
 const binary=join(dir,'verify');
 execFileSync('xcrun',['swiftc','-swift-version','6','-strict-concurrency=complete','-parse-as-library',path,'-o',binary],{stdio:'pipe'});
 console.log(execFileSync(binary,[],{encoding:'utf8'}).trim());
} finally { await rm(dir,{recursive:true,force:true}); }
