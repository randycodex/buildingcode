// Execute the production deletion coordinator on the host, without a Simulator.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const view = await readFile(new URL('../../NYC CC APP/permitext/Views/ResearchView.swift', import.meta.url), 'utf8');
const start = view.indexOf('struct ResearchDeletionBatchResult:');
const end = view.indexOf('struct ResearchProjectContextDisclosure:', start);
assert.ok(start >= 0 && end > start);

const fixture = String.raw`
enum Failure: Error { case rejected }
func check(_ value: Bool, _ message: String) { if !value { fatalError(message) } }

@main struct Verify {
    @MainActor static func main() async {
        var requested: [String] = []
        var published: [String] = []
        var active = 0
        var maxActive = 0
        let partial = await ResearchDeletionBatch.run(
            conversationIDs: ["first", "failed", "first", "", "last"],
            canContinue: { true },
            delete: { id in
                requested.append(id)
                active += 1
                maxActive = max(maxActive, active)
                defer { active -= 1 }
                await Task.yield()
                if id == "failed" { throw Failure.rejected }
            },
            didDelete: { published.append($0) }
        )
        check(requested == ["first", "failed", "last"], "Request each nonempty ID once in selection order")
        check(maxActive == 1, "Avoid concurrent account mutations")
        check(partial.deletedIDs == ["first", "last"], "Continue after a rejected deletion")
        check(partial.failedIDs == ["failed"], "Retain only failed IDs for retry")
        check(published == partial.deletedIDs, "Publish only confirmed successes")

        var ownerCurrent = false
        requested = []
        published = []
        let staleStart = await ResearchDeletionBatch.run(
            conversationIDs: ["old-owner"], canContinue: { ownerCurrent },
            delete: { requested.append($0) }, didDelete: { published.append($0) }
        )
        check(requested.isEmpty && published.isEmpty && staleStart.deletedIDs.isEmpty, "Never start a mutation for a stale session")

        ownerCurrent = true
        let staleResponse = await ResearchDeletionBatch.run(
            conversationIDs: ["in-flight", "next"], canContinue: { ownerCurrent },
            delete: { id in
                requested.append(id)
                await Task.yield()
                ownerCurrent = false
            }, didDelete: { published.append($0) }
        )
        check(requested == ["in-flight"], "Stop subsequent requests after account switching")
        check(published.isEmpty && staleResponse.deletedIDs.isEmpty, "A late response must not update the new account's list or cache")

        requested = []
        ownerCurrent = true
        let staleFailure = await ResearchDeletionBatch.run(
            conversationIDs: ["in-flight", "next"], canContinue: { ownerCurrent },
            delete: { id in
                requested.append(id)
                await Task.yield()
                ownerCurrent = false
                throw Failure.rejected
            }, didDelete: { published.append($0) }
        )
        check(requested == ["in-flight"] && staleFailure.failedIDs.isEmpty, "Old-account errors must not be presented as new-account failures")

        let cancelled = await Task { @MainActor in
            var requested: [String] = []
            var published: [String] = []
            let result = await ResearchDeletionBatch.run(
                conversationIDs: ["in-flight", "next"], canContinue: { true },
                delete: { id in
                    requested.append(id)
                    withUnsafeCurrentTask { $0?.cancel() }
                    await Task.yield()
                }, didDelete: { published.append($0) }
            )
            return requested == ["in-flight"] && published.isEmpty && result.deletedIDs.isEmpty
        }.value
        check(cancelled, "Cancellation stops further mutations and suppresses late publication")
        print("PASS: serial bulk deletion, deduplication, partial-failure retry, account switching, and cancellation")
    }
}
`;

const directory = await mkdtemp(join(tmpdir(), 'permitext-bulk-deletion-'));
try {
  const source = join(directory, 'verify.swift');
  const executable = join(directory, 'verify');
  await writeFile(source, `import Foundation\n${view.slice(start, end)}\n${fixture}`);
  execFileSync('xcrun', ['swiftc', '-parse-as-library', source, '-o', executable], { stdio: 'inherit' });
  execFileSync(executable, [], { stdio: 'inherit' });
} finally { await rm(directory, { recursive: true, force: true }); }
