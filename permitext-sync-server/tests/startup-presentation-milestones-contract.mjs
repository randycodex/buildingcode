// Run the actual platform-independent Swift gate on macOS without installing
// an iOS test runner over the owner's app. XCTest also covers this in-app.
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const directory = await mkdtemp(join(tmpdir(), "permitext-startup-gate-"));
try {
  const main = join(directory, "main.swift");
  await writeFile(main, `
let milestones = StartupPresentationMilestones.Milestone.allCases
var orders = 0
for first in milestones {
    for second in milestones where first != second {
        let third = milestones.first { $0 != first && $0 != second }!
        var gate = StartupPresentationMilestones()
        precondition(!gate.record(first))
        precondition(!gate.record(first))
        precondition(!gate.record(second))
        precondition(!gate.hasReportedPresentation)
        precondition(gate.record(third))
        precondition(gate.hasReportedPresentation)
        for duplicate in milestones { precondition(!gate.record(duplicate)) }
        orders += 1
    }
}
precondition(orders == 6)
print("PASS: all six startup milestone orderings, duplicate signals, and one-shot completion")
`);
  const source = fileURLToPath(new URL("../../NYC CC APP/permitext/Diagnostics/StartupPresentationMilestones.swift", import.meta.url));
  const binary = join(directory, "verify-startup");
  execFileSync("xcrun", ["swiftc", source, main, "-o", binary], { stdio: "pipe" });
  const result = execFileSync(binary, [], { encoding: "utf8" });
  assert.match(result, /^PASS:/);
  console.log(result.trim());
} finally {
  await rm(directory, { recursive: true, force: true });
}
