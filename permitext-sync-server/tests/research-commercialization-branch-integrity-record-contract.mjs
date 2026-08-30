import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [record, master, currentPlan, acceptance] = await Promise.all([
  readFile(new URL("../../docs/PERMITEXT_RESEARCH_COMMERCIALIZATION_BRANCH_INTEGRITY_AUDIT_2026-08-30.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/PERMITEXT_BETA1_MASTER_PLAN.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/PERMITEXT_RESEARCH_COMMERCIALIZATION_CURRENT_PLAN.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/BETA1_PUBLIC_RELEASE_ACCEPTANCE_RECORD.md", import.meta.url), "utf8")
]);

for (const requiredBoundary of [
  /Passed for the no-input checkpoint; final release review remains open/,
  /c1393d4a0d3806dd75263eb8adad23f19dfc106a/,
  /85c02555e7686131b5d12c20669fb147c5560d12/,
  /Commits in the audited range: 70/,
  /intentionally left untouched, unstaged, and uncommitted/,
  /`npm run check` passed/,
  /no paid model calls were made/,
  /audit:release-branch/,
  /never emits matched credential values or diff content/,
  /not a semantic, line-by-line human review/,
  /Master-plan release-sequence step 1 remains open/
]) {
  assert.match(record, requiredBoundary);
}

assert.match(master, /PERMITEXT_RESEARCH_COMMERCIALIZATION_BRANCH_INTEGRITY_AUDIT_2026-08-30\.md/);
assert.match(master, /1\. \[ \] Review the full branch diff/);
assert.match(currentPlan, /PERMITEXT_RESEARCH_COMMERCIALIZATION_BRANCH_INTEGRITY_AUDIT_2026-08-30\.md/);
assert.match(acceptance, /PERMITEXT_RESEARCH_COMMERCIALIZATION_BRANCH_INTEGRITY_AUDIT_2026-08-30\.md/);

console.log("Permitext Research commercialization interim branch-integrity record contract passed.");
