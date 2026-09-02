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
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const validation =
  await validateResearchProductExampleRepairedV2ConfirmationPaidAuthorization();
assert.equal(
  validation.authorization.authorizationID,
  researchProductExampleRepairedV2ConfirmationAuthorizationID
);
assert.equal(validation.authorization.status, "locked");
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
assert.equal(
  sha256(await readFile(authorizationPath)),
  researchProductExampleRepairedV2ConfirmationLockedAuthorizationSHA256
);
assert.throws(
  () => requireActiveResearchProductExampleRepairedV2ConfirmationPaidAuthorization(validation),
  /locked and no provider call is authorized/i
);

const temporaryDirectory = await mkdtemp(join(tmpdir(), "permitext-owner-example-repaired-v2-"));
try {
  const tampered = structuredClone(validation.authorization);
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
  const authorized = structuredClone(validation.authorization);
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
  "Permitext repaired-v2 owner-example confirmation contract passed; the consumed zero-spend predecessor is immutable, both spend-control layers are bound, locked dispatch is refused, and no paid model call was made."
);
