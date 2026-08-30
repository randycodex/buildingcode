import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  publicBetaReleaseGateDefinitions,
  publicBetaReleaseGateSchema,
  publicBetaReleaseReadiness
} from "../public-beta-readiness.mjs";

const commit = "0123456789abcdef0123456789abcdef01234567";
const timestamp = "2026-08-30T18:00:00Z";

function completeEvidence(definition) {
  return {
    complete: true,
    observedAt: timestamp,
    reference: `docs/${definition.key}.md`,
    gitCommit: definition.releaseBound ? commit : null
  };
}

const completeRecord = {
  schema: publicBetaReleaseGateSchema,
  expectedGitCommit: commit,
  gates: Object.fromEntries(
    publicBetaReleaseGateDefinitions.map((definition) => [
      definition.key,
      completeEvidence(definition)
    ])
  )
};

const complete = publicBetaReleaseReadiness({ record: completeRecord });
assert.equal(complete.ready, true);
assert.deepEqual(complete.openGateIDs, []);
assert.equal(complete.privacy.evidenceContentsEmitted, false);
assert.equal(complete.privacy.secretValuesEmitted, false);
assert.equal(complete.privacy.customerIdentifiersEmitted, false);

const earlyOwnerDecision = structuredClone(completeRecord);
earlyOwnerDecision.gates.productionClients.complete = false;
const earlyOwnerReport = publicBetaReleaseReadiness({ record: earlyOwnerDecision });
assert.equal(earlyOwnerReport.ready, false);
assert(earlyOwnerReport.openGateIDs.includes("production-web-testflight-iphone"));
assert(earlyOwnerReport.openGateIDs.includes("owner-go-no-go"));

const mismatchedCommit = structuredClone(completeRecord);
mismatchedCommit.gates.productionAuthentication.gitCommit = "abcdef0123456789abcdef0123456789abcdef01";
const mismatchedReport = publicBetaReleaseReadiness({ record: mismatchedCommit });
assert.equal(mismatchedReport.ready, false);
assert(mismatchedReport.openGateIDs.includes("production-auth-account-lifecycle"));

const incompleteEvidence = structuredClone(completeRecord);
incompleteEvidence.gates.monitoringDelivery.observedAt = null;
incompleteEvidence.gates.spendControl.reference = "https://example.com/evidence?token=secret";
const incompleteReport = publicBetaReleaseReadiness({ record: incompleteEvidence });
assert(incompleteReport.openGateIDs.includes("monitoring-delivery"));
assert(incompleteReport.openGateIDs.includes("spend-notification-hard-stop"));

const paidContinuation = publicBetaReleaseReadiness({
  record: completeRecord,
  paidResearchTurnsEnabled: true
});
assert.equal(paidContinuation.ready, false);
assert(paidContinuation.openGateIDs.includes("additional-research-turns-disabled"));

const defaultRecord = JSON.parse(await readFile(
  new URL("../../docs/BETA1_PUBLIC_RELEASE_GATE_RECORD.json", import.meta.url),
  "utf8"
));
const current = publicBetaReleaseReadiness({ record: defaultRecord });
assert.equal(current.ready, false, "The prepared but unexecuted release record must fail closed.");
for (const definition of publicBetaReleaseGateDefinitions) {
  assert(current.openGateIDs.includes(definition.id), `${definition.id} was not retained as open.`);
}

const master = await readFile(
  new URL("../../docs/PERMITEXT_BETA1_MASTER_PLAN.md", import.meta.url),
  "utf8"
);
const checklistItems = Array.from(master.matchAll(/^(?:-|\d+\.) \[([x ])\]/gm));
const completedCount = checklistItems.filter((match) => match[1] === "x").length;
const openCount = checklistItems.filter((match) => match[1] === " ").length;
assert.match(master, new RegExp(`Checklist snapshot: \\*\\*${completedCount} completed, ${openCount} open\\*\\*`));

console.log("Permitext public Beta readiness contract passed.");
