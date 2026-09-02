import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateResearchProductExampleConfirmationPaidAuthorization } from
  "../evals/research-product-example-confirmation-paid-authorization.mjs";

const testRoot = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(testRoot, "..");
const resultBase =
  "2026-09-02T15-01-27-878Z-2063e712-5a7a-4799-9d4e-fa25c3782dcf-product-example-confirmation";
const result = JSON.parse(
  await readFile(join(serverRoot, "evals", "results", `${resultBase}.json`), "utf8")
);
const report = await readFile(
  join(serverRoot, "evals", "results", `${resultBase}.md`),
  "utf8"
);
const authorization =
  (await validateResearchProductExampleConfirmationPaidAuthorization()).authorization;

assert.equal(result.schema, "permitext-research-product-example-live-confirmation-v1");
assert.equal(result.runID, "2063e712-5a7a-4799-9d4e-fa25c3782dcf");
assert.equal(result.status, "partial");
assert.equal(result.packageCommit, "41b4f2612b1c982fca60de6400fe802aded5a193");
assert.equal(result.executionCommit, "6433bc130ff245215e5d30ab492f32f8b443b4d4");
assert.deepEqual(result.scope, {
  expectedConversationCount: 7,
  completedConversationCount: 7,
  expectedOrderedTurnCount: 9,
  attemptedTurnCount: 9,
  completedTurnCount: 8,
  repetitions: 1,
  separateJudgeRequests: 0,
  webSupportEnabled: false
});
assert.equal(result.fatalFailure, null);
assert.equal(result.allDeterministicChecksPassed, false);
assert.equal(result.spend.capUSD, 2);
assert.equal(result.spend.requestCount, 19);
assert.equal(result.spend.pendingRequestCount, 0);
assert.equal(result.spend.actualUSD, 1.023256);
assert.equal(result.spend.reservedUSD, 1.023256);

const turns = result.results.flatMap((example) =>
  example.turns.map((turn) => ({ exampleID: example.id, ...turn }))
);
assert.equal(turns.length, 9);
assert.equal(turns.filter((turn) => turn.status === "completed").length, 8);
assert.equal(turns.filter((turn) => turn.review?.passed === true).length, 6);
assert.equal(
  turns.reduce((sum, turn) => sum + Number(turn.operation?.providerRequestCount || 0), 0),
  19
);
assert.equal(
  turns.reduce((sum, turn) => sum + Number(turn.operation?.pendingProviderRequestCount || 0), 0),
  0
);
assert.equal(
  Number(
    turns
      .reduce((sum, turn) => sum + Number(turn.operation?.actualProviderCostUSD || 0), 0)
      .toFixed(6)
  ),
  result.spend.actualUSD
);

const appendix = turns.find((turn) => turn.exampleID === "product-example-appendix-p");
assert.equal(appendix.status, "rejected");
assert.equal(appendix.operation.charged, false);
assert.equal(appendix.operation.providerRequestCount, 0);
assert.equal(appendix.operation.pendingProviderRequestCount, 0);
assert.equal(appendix.operation.failureCode, "RESEARCH_EVIDENCE_NOT_FOUND");

const c4Turns = turns.filter((turn) => turn.exampleID === "product-example-c4-4d-r8a");
assert.equal(c4Turns.length, 2);
assert(c4Turns.every((turn) => turn.status === "completed"));
assert(c4Turns.every((turn) => turn.review.passed === false));
assert.deepEqual(c4Turns[0].review.missingRequiredReferences, ["ZR 23-432"]);
assert.deepEqual(
  c4Turns[1].review.missingRequiredReferences,
  ["ZR 34-112", "ZR 23-22", "ZR 23-432", "ZR 33-122"]
);

assert.equal(authorization.status, "consumed");
assert.equal(authorization.consumption.status, "consumed");
assert.equal(authorization.consumption.runID, result.runID);
assert.equal(authorization.consumption.attemptID, result.runID);
assert.equal(authorization.execution.authorizationPackageCommit, result.packageCommit);
assert.equal(authorization.execution.executionCommit, result.executionCommit);

assert.match(report, new RegExp(result.runID));
assert.match(report, /Status: partial/);
assert.match(report, /\$1\.023256 actual/);
assert.match(report, /0 pending/);

console.log(
  "Permitext product-example result contract passed: 9/9 turns attempted once, 8 delivered, 19/19 provider requests settled, $1.023256 spent under the $2 cap, authorization consumed."
);
