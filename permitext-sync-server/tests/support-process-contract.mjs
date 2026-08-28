import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [operations, incident, tabletop, support, master] = await Promise.all([
  readFile(new URL("../../docs/BETA1_OPERATIONS_RUNBOOK.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/BETA1_INCIDENT_RECORD_TEMPLATE.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/BETA1_SUPPORT_TABLETOP_RECORD.md", import.meta.url), "utf8"),
  readFile(new URL("../public/support.html", import.meta.url), "utf8"),
  readFile(new URL("../../docs/PERMITEXT_BETA1_MASTER_PLAN.md", import.meta.url), "utf8")
]);

for (const document of [operations, incident, tabletop, support]) {
  assert.match(document, /Higinio Jimenez Manzano/);
  assert.match(document, /permitext@gmail\.com/);
}

assert.match(operations, /within one business day/i);
assert.match(operations, /within two business days/i);
assert.match(support, /urgent account, billing, security, or service-wide reports within one business day/i);
assert.match(support, /ordinary requests within two business days/i);
assert.match(support, /release or iOS build number/i);
assert.match(support, /Never send passwords, sign-in codes, full payment-card numbers, provider keys, or secret tokens/i);
assert.match(support, /does not provide an\s+official code interpretation/i);

for (const requiredIncidentField of [
  /Production release ID/,
  /Git commit/,
  /Immediate containment/,
  /Post-rollback `\/health` and `\/release` verification/,
  /User communication sent/,
  /Corrective actions, owner, and due date/
]) {
  assert.match(incident, requiredIncidentField);
}
assert.match(incident, /Do not include passwords, session tokens, OAuth secrets/i);

assert.match(tabletop, /Scenario A — active purchase but Pro is missing/);
assert.match(tabletop, /Scenario B — saved Project appears missing after sign-in/);
assert.match(tabletop, /Scenario C — Research answer overstates authority/);
assert.match(tabletop, /an email assertion alone never grants entitlement or triggers a refund/i);
assert.match(tabletop, /avoid destructive local cleanup/i);
assert.match(tabletop, /Research kill switch/i);
assert.match(tabletop, /Operator signature\/name/);
assert.match(tabletop, /Overall result: \*\*Pass\*\*/);
assert.match(tabletop, /Scenario A[\s\S]*Result: \*\*Pass\*\*/);
assert.match(tabletop, /Scenario B[\s\S]*Result: \*\*Pass\*\*/);
assert.match(tabletop, /Scenario C[\s\S]*Result: \*\*Pass\*\*/);
assert.match(tabletop, /Support-process master-plan gate: \*\*Satisfied\*\*/);

assert.match(master, /Complete the first timed Codex-assisted support tabletop and retain the operator record/);

console.log("Permitext support process contract passed.");
