import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const source = await readFile(new URL('../../NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift', import.meta.url), 'utf8');
const view = await readFile(new URL('../../NYC CC APP/permitext/Views/BrowseView.swift', import.meta.url), 'utf8');
const start = source.indexOf('    func prewarmCodeSectionForBrowsing(');
const end = source.indexOf('    func prewarmChapterForBrowsing(', start);
const gateStart = view.indexOf('    private var canResumeChapterWarmups: Bool {');
const gateEnd = view.indexOf('    private var chapterWarmupScope:', gateStart);
assert.ok(start > 0 && end > start && gateStart > 0 && gateEnd > gateStart);
assert.match(view, /\.task\(id: chapterWarmupScope\)/);
assert.match(view, /chapterPreparationScope\)\|\\\(canResumeChapterWarmups/);
const dir = await mkdtemp(join(tmpdir(), 'permitext-warmup-resume-'));
try {
 const path = join(dir, 'check.swift');
 await writeFile(path, `import Foundation
struct CodeChapter { let id: Int64 }
@MainActor final class Harness {
 var isInitialContentLoaded = true
 var isSearchInProgress = false
 var speculativeChapterIDs: Set<Int64> = [999]
 var codeSectionWarmupTask: Task<Void, Never>?
 var cancellations = 0
 var warmed: [Int64] = []
 // Default library category differs from the visible Reader category.
 var chapters = [CodeChapter(id: 11)]
 func chapters(for category: Int64?) -> [CodeChapter] {
  category == 2 ? [CodeChapter(id: 21), CodeChapter(id: 22)] : []
 }
 func startupPriorityChapters(from chapters: [CodeChapter]) -> [CodeChapter] { chapters }
 func suspendReaderWarmups() {
  cancellations += 1
  codeSectionWarmupTask?.cancel()
  codeSectionWarmupTask = nil
  speculativeChapterIDs.removeAll()
 }
 func warmChapterReaderEntry(chapter: CodeChapter, sectionLimit: Int) async { warmed.append(chapter.id) }
${source.slice(start, end)}
}
@MainActor final class ViewHarness {
 let library = Harness()
 var isBrowserTabActive = true
 var hasSeededBrowseSection = true
 var openedChapter: Int? = nil
 var preparingChapter: Int? = nil
${view.slice(gateStart, gateEnd).replace('private var', 'var')}
}
@main struct Run {
 @MainActor static func main() async {
  let h = Harness()
  h.prewarmCodeSectionForBrowsing(id: 2)
  // A second cards activation joins the existing shortlist without cancellation.
  h.prewarmCodeSectionForBrowsing(id: 2)
  precondition(h.cancellations == 1)
  await h.codeSectionWarmupTask?.value
  precondition(h.warmed == [21,22] && h.speculativeChapterIDs == [21,22])
  h.prewarmCodeSectionForBrowsing(id: 2)
  precondition(h.cancellations == 1 && h.warmed == [21,22])
  // Simulate startup owning the identical shortlist before cards activation.
  let startup = Harness()
  startup.speculativeChapterIDs = [21,22]
  startup.prewarmCodeSectionForBrowsing(id: 2)
  precondition(startup.cancellations == 0 && startup.codeSectionWarmupTask == nil)
  h.prewarmCodeSectionForBrowsing(id: 99)
  precondition(h.codeSectionWarmupTask == nil && h.speculativeChapterIDs.isEmpty && h.cancellations == 2)
  h.isSearchInProgress = true
  h.prewarmCodeSectionForBrowsing(id: 2)
  precondition(h.speculativeChapterIDs.isEmpty && h.cancellations == 2)
  h.isSearchInProgress = false
  h.prewarmCodeSectionForBrowsing(id: 2)
  await h.codeSectionWarmupTask?.value
  precondition(h.speculativeChapterIDs == [21,22])
  let v = ViewHarness()
  precondition(v.canResumeChapterWarmups)
  v.isBrowserTabActive = false; precondition(!v.canResumeChapterWarmups)
  v.isBrowserTabActive = true; v.openedChapter = 1; precondition(!v.canResumeChapterWarmups)
  v.openedChapter = nil; v.preparingChapter = 1; precondition(!v.canResumeChapterWarmups)
  v.preparingChapter = nil; v.library.isSearchInProgress = true; precondition(!v.canResumeChapterWarmups)
  v.library.isSearchInProgress = false; precondition(v.canResumeChapterWarmups)
  v.library.isInitialContentLoaded = false; precondition(!v.canResumeChapterWarmups)
  print("PASS: requested-category warming, empty-category cancellation, search suppression and Reader return eligibility")
 }
}
`);
 const binary = join(dir, 'verify');
 execFileSync('xcrun', ['swiftc', '-parse-as-library', path, '-o', binary], {stdio:'pipe'});
 console.log(execFileSync(binary, [], {encoding:'utf8'}).trim());
} finally { await rm(dir, {recursive:true, force:true}); }
