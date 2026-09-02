import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  requireActiveResearchProductExampleRepairedV2ConfirmationPaidAuthorization,
  researchProductExampleRepairedV2ConfirmationAuthorizationID,
  researchProductExampleRepairedV2ConfirmationLockedAuthorizationSHA256,
  researchProductExampleRepairedV2ConfirmationMaximumSpendUSD,
  researchProductExampleRepairedV2ConfirmationPreparedFromCommit,
  validateResearchProductExampleRepairedV2ConfirmationPaidAuthorization
} from "../evals/research-product-example-repaired-v2-confirmation-paid-authorization.mjs";

const testRoot = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(testRoot, "..");
const authorizationPath = join(
  serverRoot,
  "evals",
  "research-product-example-repaired-v2-confirmation-paid-authorization.json"
);
const runLockPath = join(
  serverRoot,
  ".research-product-example-repaired-v2-confirmation-paid-run.lock"
);
const retainedResultPath = join(
  serverRoot,
  "evals",
  "results",
  "2026-09-02T17-28-08-506Z-9e81b093-5075-4e76-8cdf-ae75ffd38e50-product-example-repaired-v2-confirmation.json"
);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const validation =
  await validateResearchProductExampleRepairedV2ConfirmationPaidAuthorization();
assert.equal(
  validation.authorization.authorizationID,
  researchProductExampleRepairedV2ConfirmationAuthorizationID
);
assert.equal(validation.authorization.status, "consumed");
assert.equal(
  validation.authorization.consumption.runID,
  "9e81b093-5075-4e76-8cdf-ae75ffd38e50"
);
assert.equal(
  validation.authorization.execution.executionCommit,
  "188d35e59ed5a55c0f4aacee055bff2dc2bac831"
);
assert.equal(
  validation.authorization.lineage.preparedFromCommit,
  researchProductExampleRepairedV2ConfirmationPreparedFromCommit
);
assert.equal(validation.authorization.plannedScope.conversationCount, 7);
assert.equal(validation.authorization.plannedScope.orderedTurnCount, 9);
assert.equal(validation.authorization.plannedScope.repetitions, 1);
assert.equal(
  validation.authorization.plannedScope.maximumCumulativeSpendUSD,
  researchProductExampleRepairedV2ConfirmationMaximumSpendUSD
);
assert.equal(validation.authorization.plannedScope.separateJudgeRequests, 0);
assert.equal(validation.authorization.execution.maximumProviderRequestUSD, 1);
assert.equal(validation.authorization.execution.isolatedUserMonthlyCapUSD, 2);
assert.equal(validation.authorization.execution.isolatedSystemMonthlyCapUSD, 2);
assert.equal(
  validation.authorization.execution.validateBothSpendControlLayersBeforeLock,
  true
);
assert.throws(
  () => requireActiveResearchProductExampleRepairedV2ConfirmationPaidAuthorization(validation),
  /locked and no provider call is authorized/i
);

const retainedResult = JSON.parse(await readFile(retainedResultPath, "utf8"));
assert.equal(retainedResult.runID, validation.authorization.consumption.runID);
assert.equal(retainedResult.executionCommit, validation.authorization.execution.executionCommit);
assert.equal(retainedResult.status, "completed");
assert.equal(retainedResult.scope.expectedConversationCount, 7);
assert.equal(retainedResult.scope.completedConversationCount, 7);
assert.equal(retainedResult.scope.expectedOrderedTurnCount, 9);
assert.equal(retainedResult.scope.attemptedTurnCount, 9);
assert.equal(retainedResult.scope.completedTurnCount, 9);
assert.equal(retainedResult.scope.repetitions, 1);
assert.equal(retainedResult.scope.separateJudgeRequests, 0);
assert.equal(retainedResult.spend.capUSD, 2);
assert.equal(retainedResult.spend.actualUSD, 1.289404);
assert.equal(retainedResult.spend.reservedUSD, 1.289404);
assert.equal(retainedResult.spend.pendingRequestCount, 0);
assert.equal(retainedResult.results.length, 7);
assert.equal(
  retainedResult.results.reduce((sum, example) => sum + example.turns.length, 0),
  9
);
assert.equal(
  retainedResult.results.flatMap((example) => example.turns)
    .filter((turn) => turn.review?.passed === true).length,
  7
);
assert.equal(retainedResult.allDeterministicChecksPassed, false);
assert.equal(retainedResult.ownerReviewRequired, true);
assert.equal(retainedResult.publicReleaseAuthorized, false);

const temporaryDirectory = await mkdtemp(join(tmpdir(), "permitext-owner-example-repaired-v2-"));
try {
  const locked = structuredClone(validation.authorization);
  locked.status = "locked";
  locked.scope = {
    conversationCount: null,
    orderedTurnCount: null,
    repetitions: null,
    maximumCumulativeSpendUSD: null
  };
  locked.ownerDecision = {
    required: true,
    authorizedAt: null,
    authorizedBy: null,
    exactAuthorizationPhrase: null,
    exactSpendingCapPhrase: null
  };
  locked.consumption = {
    status: "not_started",
    attemptID: null,
    startedAt: null,
    runID: null,
    consumedAt: null
  };
  locked.execution.authorizationPackageCommit = null;
  locked.execution.executionCommit = null;
  locked.networkOrModelCallAuthorized = false;
  const lockedPath = join(temporaryDirectory, "locked.json");
  await writeFile(lockedPath, `${JSON.stringify(locked, null, 2)}\n`);
  const lockedValidation =
    await validateResearchProductExampleRepairedV2ConfirmationPaidAuthorization({
      authorizationPath: lockedPath
    });
  assert.equal(
    sha256(await readFile(lockedPath)),
    researchProductExampleRepairedV2ConfirmationLockedAuthorizationSHA256
  );
  assert.throws(
    () => requireActiveResearchProductExampleRepairedV2ConfirmationPaidAuthorization(
      lockedValidation
    ),
    /locked and no provider call is authorized/i
  );

  const tampered = structuredClone(locked);
  tampered.notes = `${tampered.notes} changed`;
  const tamperedPath = join(temporaryDirectory, "tampered.json");
  await writeFile(tamperedPath, `${JSON.stringify(tampered, null, 2)}\n`);
  await assert.rejects(
    validateResearchProductExampleRepairedV2ConfirmationPaidAuthorization({
      authorizationPath: tamperedPath
    }),
    /locked repaired-v2 authorization changed/i
  );

  const packageCommit = "a".repeat(40);
  const phrase =
    `authorize exactly package commit ${packageCommit} for all 9 ordered turns ` +
    "in 7 conversations, one repetition, with a maximum cumulative API spend of $2.";
  const authorized = structuredClone(locked);
  authorized.status = "authorized";
  authorized.scope = {
    conversationCount: 7,
    orderedTurnCount: 9,
    repetitions: 1,
    maximumCumulativeSpendUSD: 2
  };
  authorized.ownerDecision = {
    required: true,
    authorizedAt: "2026-09-02T00:00:00Z",
    authorizedBy: "Permitext owner",
    exactAuthorizationPhrase: phrase,
    exactSpendingCapPhrase: phrase
  };
  authorized.execution.authorizationPackageCommit = packageCommit;
  authorized.execution.executionCommit = null;
  authorized.networkOrModelCallAuthorized = true;
  const authorizedPath = join(temporaryDirectory, "authorized.json");
  await writeFile(authorizedPath, `${JSON.stringify(authorized, null, 2)}\n`);
  const authorizedValidation =
    await validateResearchProductExampleRepairedV2ConfirmationPaidAuthorization({
      authorizationPath: authorizedPath
    });
  assert.deepEqual(
    requireActiveResearchProductExampleRepairedV2ConfirmationPaidAuthorization(
      authorizedValidation
    ),
    {
      authorizationID: researchProductExampleRepairedV2ConfirmationAuthorizationID,
      packageCommit,
      conversationCount: 7,
      orderedTurnCount: 9,
      repetitions: 1,
      maximumCumulativeSpendUSD: 2
    }
  );
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

let runLockBefore = null;
try {
  runLockBefore = await readFile(runLockPath, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const lockedRun = spawnSync(
  process.execPath,
  ["scripts/run-research-product-example-repaired-v2-confirmation.mjs"],
  {
    cwd: serverRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      OPENAI_API_KEY: "must-not-be-used",
      PERMITEXT_RUN_PAID_RESEARCH_EVALS: "1",
      PERMITEXT_RESEARCH_EVAL_MAX_USD: "2",
      PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2.00",
      PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: "0.20",
      PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12.00",
      PERMITEXT_RESEARCH_PRICING_VERSION: "no-cost-test"
    }
  }
);
assert.notEqual(lockedRun.status, 0);
assert.match(
  `${lockedRun.stdout}\n${lockedRun.stderr}`,
  /locked and no provider call is authorized/i
);
let runLockAfter = null;
try {
  runLockAfter = await readFile(runLockPath, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
assert.equal(
  runLockAfter,
  runLockBefore,
  "The locked repaired-v2 refusal must not create or alter its permanent run lock."
);

const runnerSource = await readFile(
  join(serverRoot, "scripts", "run-research-product-example-repaired-v2-confirmation.mjs"),
  "utf8"
);
assert.match(runnerSource, /researchProductExampleRepairedV2Confirmation/);
assert.match(runnerSource, /product-example-repaired-v2-confirmation/);
assert.doesNotMatch(runnerSource, /judgeAnswer|PERMITEXT_RESEARCH_EVAL_JUDGE_MODEL/);

console.log(
  "Permitext repaired-v2 owner-example confirmation contract passed; the one-use authorization is consumed, the 9/9-turn $1.289404 result is retained with zero pending requests, and repeat dispatch is refused."
);
