#!/usr/bin/env python3
"""Execute the actual Reader reference method and task decision with deferred I/O."""
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
source = (root / 'NYC CC APP/permitext/Views/ReaderView.swift').read_text()
state = source[source.index('struct ReaderReferenceLoadState'):source.index('struct ReaderView: View')]
method = source[source.index('    private func resumeReferences'):source.index('    private func syncUserContentState')].replace('private func', 'func', 1)
start = source.index('            if let detail, let loadedVersionFileName {')
end = source.index('            await prepareNewDestination()', start) + len('            await prepareNewDestination()')
decision = source[start:end]
program = '''import Foundation
typealias ReaderSectionDetail = Int
typealias ResolvedCodeReference = Int
@MainActor final class Library {
    var selectedVersionFileName = "edition-a"
    var privateRequestIdentity: String? = "account-a-session-1"
    var pending: [CheckedContinuation<[Int], Never>] = []
    var calls = 0
    func resolveReferencesAsync(for detail: Int) async -> [Int] {
        calls += 1
        return await withCheckedContinuation { pending.append($0) }
    }
}
''' + state + '''
@MainActor final class Harness {
    let library = Library()
    var referenceLoadState = ReaderReferenceLoadState()
    var references: [Int] = []
    var detail: Int? = 123
    var loadedVersionFileName: String? = "edition-a"
    var bodyLoads = 0
    func prepareNewDestination() async { bodyLoads += 1 }
    func runTaskDecision() async {
''' + decision + '''
    }
''' + method + '''
}
@main struct Test {
    @MainActor static func waitForCalls(_ h: Harness, _ count: Int) async {
        for _ in 0..<10000 {
            if h.library.calls >= count { return }
            await Task.yield()
        }
        fatalError("Resolver did not start")
    }
    @MainActor static func main() async {
        let h = Harness()
        let first = Task { await h.runTaskDecision() }
        await waitForCalls(h, 1)
        // The published body survives disappearance; reference work is invalidated.
        h.referenceLoadState.invalidate()
        first.cancel()
        let resumed = Task { await h.runTaskDecision() }
        await waitForCalls(h, 2)
        h.library.pending[0].resume(returning: [111])
        await first.value
        precondition(h.references.isEmpty, "Cancelled completion published")
        h.library.pending[1].resume(returning: [222])
        await resumed.value
        precondition(h.references == [222])
        precondition(h.bodyLoads == 0 && h.detail == 123, "Body was reloaded")
        h.referenceLoadState.invalidate()
        await h.runTaskDecision()
        precondition(h.library.calls == 2, "Completed references repeated")

        let empty = Harness()
        let emptyTask = Task { await empty.runTaskDecision() }
        await waitForCalls(empty, 1)
        empty.library.pending[0].resume(returning: [])
        await emptyTask.value
        empty.referenceLoadState.invalidate()
        await empty.runTaskDecision()
        precondition(empty.library.calls == 1, "Completed empty references repeated")

        let changed = Harness()
        let changedTask = Task { await changed.runTaskDecision() }
        await waitForCalls(changed, 1)
        changed.library.privateRequestIdentity = "account-b-session-2"
        changed.library.pending[0].resume(returning: [333])
        await changedTask.value
        precondition(changed.references.isEmpty && !changed.referenceLoadState.isComplete,
            "Another account's completion published")
        print("PASS: restored body, deferred resume, stale cancellation, completed empty, account guard")
    }
}
'''
with tempfile.TemporaryDirectory(prefix='permitext-reference-resume-') as tmp:
    swift = Path(tmp) / 'ReferenceResume.swift'
    binary = Path(tmp) / 'reference-resume'
    swift.write_text(program)
    subprocess.run(['swiftc', '-parse-as-library', str(swift), '-o', str(binary)], check=True)
    subprocess.run([str(binary)], check=True)
