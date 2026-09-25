#!/usr/bin/env python3
"""Compile the production limiter on the host; no device or simulator required."""
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
source = (root / "NYC CC APP/permitext/Views/SearchView.swift").read_text()
limiter = source[source.index("actor SearchPreviewLimiter {"):]
harness = r'''
actor Counter {
    var active = 0
    var peak = 0
    var total = 0
    func start() { active += 1; total += 1; peak = max(peak, active) }
    func end() { active -= 1 }
    func count() -> Int { total }
    func verify() { precondition(active == 0 && peak <= 2 && total > 0) }
}
actor Gate {
    private var opened = false
    private var waiters: [CheckedContinuation<Void, Never>] = []
    func wait() async {
        if opened { return }
        await withCheckedContinuation { waiters.append($0) }
    }
    func open() { opened = true; for waiter in waiters { waiter.resume() }; waiters.removeAll() }
}
@main struct Check {
    static func main() async {
        let limiter = SearchPreviewLimiter(limit: 2)
        let counter = Counter()
        // Occupy both slots before enqueuing work; cancelled consumers must
        // leave the queue without releasing another consumer's active permit.
        let first = await limiter.acquire()
        let second = await limiter.acquire()
        precondition(first && second)
        let cancelled = Task { await limiter.acquire() }
        try? await Task.sleep(for: .milliseconds(20))
        cancelled.cancel()
        let acquiredCancelled = await cancelled.value
        precondition(!acquiredCancelled)
        await limiter.release()
        await limiter.release()
        let tasks = (0..<100).map { _ in Task {
            guard await limiter.acquire() else { return }
            if !Task.isCancelled {
                await counter.start()
                // Mirrors production detached synchronous extraction: UI task
                // cancellation cannot free capacity before this work finishes.
                await Task.detached {
                    try? await Task.sleep(for: .milliseconds(2))
                }.value
                await counter.end()
            }
            await limiter.release()
        }}
        for (index, task) in tasks.enumerated() where index % 3 == 0 { task.cancel() }
        for task in tasks { await task.value }
        await counter.verify()
        let gate = Gate()
        let inFlightCounter = Counter()
        let workers = (0..<2).map { _ in Task {
            guard await limiter.acquire() else { preconditionFailure() }
            await inFlightCounter.start()
            await Task.detached { await gate.wait() }.value
            await inFlightCounter.end()
            await limiter.release()
        }}
        while await inFlightCounter.count() < 2 { await Task.yield() }
        for worker in workers { worker.cancel() }
        let third = Task {
            guard await limiter.acquire() else { preconditionFailure() }
            await inFlightCounter.start()
            await inFlightCounter.end()
            await limiter.release()
        }
        try? await Task.sleep(for: .milliseconds(20))
        let beforeGate = await inFlightCounter.count()
        precondition(beforeGate == 2)
        await gate.open()
        for worker in workers { await worker.value }
        await third.value
        await inFlightCounter.verify()
        // Repeated cancellation at permit handoff must neither leak slots nor
        // double-release a permit accepted by a cancelled consumer.
        for _ in 0..<100 {
            let occupiedA = await limiter.acquire()
            let occupiedB = await limiter.acquire()
            precondition(occupiedA && occupiedB)
            let waiting = Task {
                if await limiter.acquire() { await limiter.release() }
            }
            await Task.yield()
            await limiter.release()
            waiting.cancel()
            await limiter.release()
            await waiting.value
        }
        // Capacity remains reusable after cancellation and contention.
        let again = await limiter.acquire()
        precondition(again)
        await limiter.release()
        print("PASS: preview limit, queued cancellation, contention and permit reuse")
    }
}
'''
with tempfile.TemporaryDirectory(prefix="permitext-preview-test-") as directory:
    swift = Path(directory) / "Contract.swift"
    executable = Path(directory) / "contract"
    swift.write_text("import Foundation\n" + limiter + harness)
    subprocess.run(["swiftc", "-parse-as-library", str(swift), "-o", str(executable)], check=True, timeout=60)
    subprocess.run([str(executable)], check=True, timeout=30)
