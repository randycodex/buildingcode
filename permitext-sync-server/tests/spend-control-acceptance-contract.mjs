import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [record, operations, master] = await Promise.all([
  readFile(new URL("../../docs/BETA1_SPEND_CONTROL_ACCEPTANCE_RECORD.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/BETA1_OPERATIONS_RUNBOOK.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/PERMITEXT_BETA1_MASTER_PLAN.md", import.meta.url), "utf8")
]);

for (const requiredBoundary of [
  /Status: \*\*Prepared; not executed\*\*/,
  /Do not deliberately consume the \$20 on-demand amount/,
  /Do not lower the team spend amount to or below current spend/,
  /without explicit owner authorization immediately before the change/,
  /must not be performed while the user is unavailable/,
  /Stop on unexpected spend, an unintended project pause, a release mismatch, inability to resume, or any customer-impact signal/
]) {
  assert.match(record, requiredBoundary);
}

assert.match(record, /Delivered notification:[\s\S]*Pause\/recovery behavior:[\s\S]*Automatic threshold linkage:/);
assert.match(record, /A manual project pause can prove result 2 only/);
assert.match(record, /503 DEPLOYMENT_PAUSED/);
assert.match(record, /same URL recovers without a redeploy/);
assert.match(record, /exact pre-pause release ID and Git commit/);
assert.match(record, /Every team Production project inventory and paused state captured/);
assert.match(record, /must not be mislabeled as automatic Spend Management proof/);

assert.match(operations, /BETA1_SPEND_CONTROL_ACCEPTANCE_RECORD\.md/);
assert.match(operations, /Do not manufacture on-demand usage or lower the team spend amount merely to make the gate pass/);
assert.match(master, /Exercise a delivered spend notification and actual hard-stop behavior without exposing customers or incurring an uncontrolled overage/);

console.log("Permitext spend-control acceptance contract passed.");
