import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const source = join(root, 'NYC CC APP/permitext/Diagnostics/LocalPerformanceRecorder.swift');
const dir = mkdtempSync(join(tmpdir(), 'permitext-local-timing-'));
const main = join(dir, 'main.swift');
try {
  writeFileSync(main, `import Foundation
#if PERMITEXT_LOCAL_PERFORMANCE
let directory = URL(fileURLWithPath: CommandLine.arguments[1]).appendingPathComponent("capture")
let store = LocalPerformanceRecorder.Storage(directory: directory, build: "41.test", flushDelay: 0.02)
DispatchQueue.concurrentPerform(iterations: 20000) { _ in store.record(.passageDataReady) }
func readSnapshot(_ expectedDrops: UInt64) throws -> LocalPerformanceRecorder.Storage.Snapshot {
    let deadline = Date().addingTimeInterval(5)
    repeat {
        if let data = try? Data(contentsOf: directory.appendingPathComponent("current.json")),
           let snapshot = try? JSONDecoder().decode(LocalPerformanceRecorder.Storage.Snapshot.self, from: data),
           snapshot.droppedEvents == expectedDrops { return snapshot }
        Thread.sleep(forTimeInterval: 0.01)
    } while Date() < deadline
    fatalError("No complete coalesced foreground snapshot")
}
let first = try readSnapshot(17952)
precondition(first.events.count == 2048 && first.eventCapacity == 2048)
precondition(first.appBuild == "41.test" && UUID(uuidString: first.runUUID) != nil)
for (offset, event) in first.events.enumerated() {
    precondition(event.sequence == UInt64(offset + 1))
    precondition(event.milestone == .passageDataReady)
    if offset > 0 { precondition(event.uptimeSeconds >= first.events[offset - 1].uptimeSeconds) }
}
store.record(.passageContentAppeared)
_ = try readSnapshot(17953)
let files = try FileManager.default.contentsOfDirectory(atPath: directory.path)
precondition(files == ["current.json"])
let data = try Data(contentsOf: directory.appendingPathComponent("current.json"))
precondition(data.count < 400000)
let object = try JSONSerialization.jsonObject(with: data) as! [String: Any]
precondition(Set(object.keys) == Set(["schemaVersion", "runUUID", "appBuild", "eventCapacity", "droppedEvents", "events"]))
let event = (object["events"] as! [[String: Any]])[0]
precondition(Set(event.keys) == Set(["sequence", "uptimeSeconds", "milestone"]))
let replacement = LocalPerformanceRecorder.Storage(directory: directory, build: "42", flushDelay: 0.02)
replacement.record(.searchInputScheduled)
let next = try readSnapshot(0)
precondition(next.runUUID != first.runUUID && next.events.count == 1 && next.appBuild == "42")
print("Enabled: bounded concurrency, monotonic sequence, delayed flush, fixed schema, disk cap, run replacement PASS")
#else
LocalPerformanceRecorder.record(.searchInputScheduled)
print("Disabled: API compiles and runs without recorder storage PASS")
#endif
`);
  for (const enabled of [false, true]) {
    const binary = join(dir, enabled ? 'enabled' : 'disabled');
    execFileSync('swiftc', ['-swift-version', '6', '-O', ...(enabled ? ['-D', 'PERMITEXT_LOCAL_PERFORMANCE'] : []), source, main, '-o', binary], { stdio: 'pipe' });
    console.log(execFileSync(binary, [dir], { encoding: 'utf8' }).trim());
    if (!enabled) {
      const bytes = readFileSync(binary);
      assert.equal(bytes.includes(Buffer.from('PermitextPerformance')), false, 'default executable must omit recorder path');
      assert.equal(bytes.includes(Buffer.from('current.json')), false, 'default executable must omit snapshot writer');
    }
  }
} finally { rmSync(dir, { recursive: true, force: true }); }
