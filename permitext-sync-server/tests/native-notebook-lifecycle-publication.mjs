// Exercise the production coordinator publication callbacks on the main actor.
// No SwiftUI, WebKit, simulator, or device is needed.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const source = await readFile(new URL('../../NYC CC APP/permitext/Views/NotebookDocumentEditor.swift', import.meta.url), 'utf8');
function method(marker) {
  const start = source.indexOf(`        ${marker}`);
  const end = source.indexOf('\n        }', start) + 10;
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end);
}
const methods = ['private func publishReadinessAfterViewUpdate()', 'private func report(', 'func detach()'].map(method).join('\n');
const fixture = `
import Foundation
@MainActor final class Controller {
    weak var coordinator: Coordinator?
    var isReady = false { didSet { writes.append(isReady) } }
    var writes: [Bool] = []
}
@MainActor final class Parent {
    let controller: Controller
    var errors: [String] = []
    init(_ controller: Controller) { self.controller = controller }
    func onError(_ message: String) { errors.append(message) }
}
@MainActor final class Coordinator {
    let parent: Parent
    private var ready = false
    private var configuring = false
    private var detached = false
    private var tasks: [String: Task<Void, Never>] = [:]
    init(_ controller: Controller) { parent = Parent(controller) }
    func mount(ready: Bool, configuring: Bool = false) {
        self.ready = ready; self.configuring = configuring
        parent.controller.coordinator = self
        publishReadinessAfterViewUpdate()
    }
    func error(_ message: String) { report(message) }
${methods}
}
@main struct Verify {
    @MainActor static func settle() async { try? await Task.sleep(for: .milliseconds(20)) }
    @MainActor static func main() async {
        let controller = Controller()
        let old = Coordinator(controller)
        old.mount(ready: true)
        precondition(controller.writes.isEmpty, "Mount must not publish within rendering")
        await settle()
        precondition(controller.writes == [true])
        old.error("stale failure")
        precondition(old.parent.errors.isEmpty, "Errors must not mutate state within rendering")
        old.detach()
        let replacement = Coordinator(controller)
        replacement.mount(ready: true)
        precondition(controller.writes == [true], "Teardown must not synchronously publish")
        await settle()
        precondition(controller.writes == [true], "Stale teardown must not mark a ready replacement unready")
        precondition(old.parent.errors.isEmpty, "Detached editor must not deliver stale errors")
        replacement.detach()
        let loading = Coordinator(controller)
        loading.mount(ready: true, configuring: true)
        await settle()
        precondition(controller.writes == [true, false], "A replacement still configuring must become unready")
        loading.mount(ready: true)
        await settle()
        precondition(controller.writes == [true, false, true])
        loading.error("current failure")
        await settle()
        precondition(loading.parent.errors == ["current failure"])
        loading.detach()
        await settle()
        precondition(controller.isReady == false, "Final teardown must publish unready after rendering")
        print("PASS: deferred readiness/error publication, stale teardown isolation and configuring replacement readiness.")
    }
}
`;
const dir = await mkdtemp(join(tmpdir(), 'permitext-note-lifecycle-'));
try {
  await writeFile(join(dir, 'verify.swift'), fixture);
  execFileSync('xcrun', ['swiftc', '-parse-as-library', join(dir, 'verify.swift'), '-o', join(dir, 'verify')], {stdio: 'inherit'});
  execFileSync(join(dir, 'verify'), [], {stdio: 'inherit'});
} finally { await rm(dir, {recursive: true, force: true}); }
