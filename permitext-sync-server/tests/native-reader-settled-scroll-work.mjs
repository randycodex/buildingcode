// Execute the production scheduling/phase methods with real Swift tasks and
// their 250ms delay. Only SwiftUI's phase/document and persistence endpoints are
// replaced; no app build, device, network, or user-storage access is involved.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const source = await readFile(new URL('../../NYC CC APP/permitext/Views/NativeChapterTextReaderView.swift', import.meta.url), 'utf8');
function method(name) {
  const start = source.indexOf(`    private func ${name}(`);
  const end = source.indexOf('\n    }', start);
  assert.ok(start >= 0 && end > start, `Production method ${name}`);
  return source.slice(start, end + 6).replace('private func', 'func');
}
const fixture = `import Foundation
enum ScrollPhase: CaseIterable {
    case idle, tracking, interacting, decelerating, animating
    var isScrolling: Bool { self == .interacting || self == .decelerating || self == .animating }
}
struct NativeReaderRuntimeDocument { let id: String }
@MainActor final class ScrollState {
    var isScrollActive = false
    var isDecelerating = false
    var visibleBlockID: String? = "long-paragraph"
}
@MainActor final class ReaderHarness {
    let scrollState = ScrollState()
    var settledScrollTask: Task<Void, Never>?
    var isBrowserTabActive = true
    var pendingInitialBlockID: String?
    var initialTargetIsVisible = false
    var persisted: [String] = []
    var media: [String] = []
    var textPrefetches = 0
    var releasedLeases = 0
    var rememberedSectionUpdates: [Bool] = []
    func traceRestoration(_ event: String, phase: String) {}
    func releaseRestorationLease(reason: String) { releasedLeases += 1 }
    func persistLocation(blockID: String?, document: NativeReaderRuntimeDocument) {
        persisted.append("\\(document.id):\\(blockID ?? "nil")")
    }
    func scheduleNearbyMediaPrefetch(around blockID: String?, document: NativeReaderRuntimeDocument) {
        media.append("\\(document.id):\\(blockID ?? "nil")")
    }
    func scheduleNearbyTextPrefetch(around blockID: String, previousBlockID: String?) { textPrefetches += 1 }
    func updateCurrentSectionPresentation(blockID: String, document: NativeReaderRuntimeDocument, updatesRememberedSection: Bool = true) {
        rememberedSectionUpdates.append(updatesRememberedSection)
    }
    ${method('visibleBlockDidChange')}
    ${method('scheduleSettledScrollWork')}
    ${method('scrollPhaseDidChange')}
}
func check(_ value: @autoclosure () -> Bool, _ message: String) {
    if !value() { FileHandle.standardError.write(Data((message + "\\n").utf8)); exit(1) }
}
@main struct Verify {
    @MainActor static func main() async {
        let document = NativeReaderRuntimeDocument(id: "chapter-a")
        // A new gesture can begin without crossing the top paragraph. Tracking
        // itself reports isScrolling=false. Reader's active flag must include
        // it, and leaving idle must immediately cancel the old task.
        for phase in ScrollPhase.allCases where phase != .idle {
            let reader = ReaderHarness()
            reader.scrollPhaseDidChange(.idle, document: document)
            let pending = reader.settledScrollTask!
            reader.scrollPhaseDidChange(phase, document: document)
            check(pending.isCancelled && reader.settledScrollTask == nil,
                  "Idle to \\(phase) in the same block must immediately cancel settled work")
            check(reader.scrollState.isScrollActive &&
                  reader.scrollState.isDecelerating == (phase == .decelerating),
                  "Every non-idle phase is active; deceleration retains its exact meaning")
            check(reader.releasedLeases == 1, "Non-idle phases must still release restoration")
            await pending.value
            check(reader.persisted.isEmpty && reader.media.isEmpty,
                  "A resumed same-block gesture must neither persist nor prefetch media")
        }
        let tracking = ReaderHarness()
        tracking.scrollPhaseDidChange(.tracking, document: document)
        // Run the real late geometry publication path, not just the scheduling
        // helper: the top block changes while a touch is down before movement.
        tracking.visibleBlockDidChange("late-layout-block", document: document)
        check(tracking.scrollState.visibleBlockID == "late-layout-block" && tracking.settledScrollTask == nil,
              "Tracking plus a late block update must not queue another idle timer")
        check(tracking.rememberedSectionUpdates == [false],
              "Tracking cannot persist a remembered section through geometry publication")
        try? await Task.sleep(for: .milliseconds(300))
        check(tracking.persisted.isEmpty && tracking.media.isEmpty,
              "Late geometry during tracking must not cause delayed persistence or media prefetch")
        tracking.scrollPhaseDidChange(.idle, document: document)
        await tracking.settledScrollTask!.value
        check(tracking.persisted == ["chapter-a:late-layout-block"] && tracking.media == tracking.persisted,
              "After touch ends, the final observed block persists once")
        let idle = ReaderHarness()
        idle.scrollPhaseDidChange(.idle, document: document)
        check(idle.persisted.isEmpty && idle.media.isEmpty, "Settled work remains deferred")
        await idle.settledScrollTask!.value
        check(idle.persisted == ["chapter-a:long-paragraph"] && idle.media == idle.persisted,
              "Uninterrupted idle persists the exact passage and prefetches once")
        check(idle.settledScrollTask == nil && idle.textPrefetches == 1,
              "Successful settled work clears its task and retains idle text prefetch")

        // Exercise wake-time protections independently of phase cancellation.
        // These changes happen after scheduling but before the actual timer runs.
        for change in ["active", "inactive-tab", "navigation", "new-block", "cancelled"] {
            let reader = ReaderHarness()
            reader.scrollPhaseDidChange(.idle, document: document)
            let pending = reader.settledScrollTask!
            switch change {
            case "active": reader.scrollState.isScrollActive = true
            case "inactive-tab": reader.isBrowserTabActive = false
            case "navigation": reader.pendingInitialBlockID = "new-target"
            case "new-block": reader.scrollState.visibleBlockID = "different-paragraph"
            default: pending.cancel()
            }
            await pending.value
            check(reader.persisted.isEmpty && reader.media.isEmpty,
                  "Wake-time \\(change) must reject stale persistence and media work")
        }
        let resumed = ReaderHarness()
        resumed.scrollPhaseDidChange(.idle, document: document)
        let old = resumed.settledScrollTask!
        resumed.scrollPhaseDidChange(.tracking, document: document)
        resumed.scrollPhaseDidChange(.idle, document: document)
        let current = resumed.settledScrollTask!
        await old.value
        await current.value
        check(resumed.persisted.count == 1 && resumed.media.count == 1,
              "Returning to idle starts fresh work without losing or duplicating the save")
        print("PASS: actual Reader phase/timer methods reject same-block gestures, cancellation, inactive tabs, navigation and stale blocks; uninterrupted/new idle saves exactly once")
    }
}
`;
const directory = await mkdtemp(join(tmpdir(), 'permitext-settled-scroll-'));
try {
  const path = join(directory, 'verify.swift'), binary = join(directory, 'verify');
  await writeFile(path, fixture);
  execFileSync('xcrun', ['swiftc', '-swift-version', '6', '-parse-as-library', path, '-o', binary], {stdio: 'pipe'});
  console.log(execFileSync(binary, [], {encoding: 'utf8', timeout: 15_000}).trim());
} finally { await rm(directory, {recursive: true, force: true}); }
