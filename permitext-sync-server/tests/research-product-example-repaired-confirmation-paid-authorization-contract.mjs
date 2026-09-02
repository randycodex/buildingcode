import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  requireActiveResearchProductExampleRepairedConfirmationPaidAuthorization,
  researchProductExampleRepairedConfirmationAuthorizationID,
  researchProductExampleRepairedConfirmationLockedAuthorizationSHA256,
  researchProductExampleRepairedConfirmationMaximumSpendUSD,
  researchProductExampleRepairedConfirmationPreparedFromCommit,
  validateResearchProductExampleRepairedConfirmationPaidAuthorization
} from "../evals/research-product-example-repaired-confirmation-paid-authorization.mjs";
import { researchSpendGuardrails } from "../research-config.mjs";
import {
  researchProductExampleRepairedRuntimeEnvironment,
  researchProductExampleRepairedRuntimeEnvironmentVersion
} from "../research-product-example-repaired-runtime-environment.mjs";

const testRoot = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(testRoot, "..");
const runLockPath = join(
  serverRoot,
  ".research-product-example-repaired-confirmation-paid-run.lock"
);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const validation =
  await validateResearchProductExampleRepairedConfirmationPaidAuthorization();
assert.equal(
  validation.authorization.authorizationID,
  researchProductExampleRepairedConfirmationAuthorizationID
);
assert.equal(validation.authorization.status, "consumed");
assert.equal(
  validation.authorization.consumption.runID,
  "fa52cca6-d28f-4d16-968a-0d8c06d596e9"
);
assert.equal(
  validation.authorization.execution.executionCommit,
  "6911154ad7f5a4c7852a96cd96bdc868432bc851"
);
assert.equal(validation.authorization.plannedScope.conversationCount, 7);
assert.equal(validation.authorization.plannedScope.orderedTurnCount, 9);
assert.equal(validation.authorization.plannedScope.repetitions, 1);
assert.equal(
  validation.authorization.plannedScope.maximumCumulativeSpendUSD,
  researchProductExampleRepairedConfirmationMaximumSpendUSD
);
assert.equal(validation.authorization.plannedScope.separateJudgeRequests, 0);
assert.equal(
  validation.authorization.lineage.preparedFromCommit,
  researchProductExampleRepairedConfirmationPreparedFromCommit
);
assert.equal(validation.authorization.execution.webSupportEnabled, true);
assert(validation.authorization.execution.officialDomains.includes("ny.gov"));
assert(validation.authorization.execution.officialDomains.includes("ada.gov"));
assert.throws(
  () => requireActiveResearchProductExampleRepairedConfirmationPaidAuthorization(validation),
  /locked and no provider call is authorized/i
);

const retainedResult = JSON.parse(await readFile(join(
  serverRoot,
  "evals",
  "results",
  "2026-09-02T16-56-49-594Z-fa52cca6-d28f-4d16-968a-0d8c06d596e9-product-example-repaired-confirmation.json"
), "utf8"));
assert.equal(retainedResult.runID, validation.authorization.consumption.runID);
assert.equal(retainedResult.status, "failed");
assert.equal(retainedResult.scope.attemptedTurnCount, 7);
assert.equal(retainedResult.scope.completedTurnCount, 0);
assert.equal(retainedResult.spend.actualUSD, 0);
assert.equal(retainedResult.spend.reservedUSD, 0);
assert.equal(retainedResult.spend.pendingRequestCount, 0);
assert(retainedResult.results.every((example) =>
  example.turns.every((turn) =>
    turn.status === "failed" &&
    turn.operation?.charged === false &&
    turn.operation?.pendingProviderRequestCount === 0
  )
));

const simulatedRuntimeEnvironment = researchProductExampleRepairedRuntimeEnvironment({
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2.00",
  PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: "0.20",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12.00",
  PERMITEXT_RESEARCH_PRICING_VERSION: "openai-gpt-5.6-terra-2026-08-30"
}, { maximumCumulativeSpendUSD: 2 });
const simulatedSpendGuardrails = researchSpendGuardrails(simulatedRuntimeEnvironment);
assert.equal(
  researchProductExampleRepairedRuntimeEnvironmentVersion,
  "20260902-isolated-spend-guardrails-v1"
);
assert.equal(simulatedSpendGuardrails.ready, true);
assert.equal(simulatedSpendGuardrails.maximumRequestUSD, 1);
assert.equal(simulatedSpendGuardrails.userMonthlyCapUSD, 2);
assert.equal(simulatedSpendGuardrails.monthlyCapUSD, 2);

const temporaryDirectory = await mkdtemp(join(tmpdir(), "permitext-owner-example-repaired-auth-"));
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
  await writeFile(
    lockedPath,
    `${JSON.stringify(locked, null, 2)}\n`
  );
  const lockedValidation =
    await validateResearchProductExampleRepairedConfirmationPaidAuthorization({
      authorizationPath: lockedPath
    });
  assert.equal(
    sha256(await readFile(lockedPath)),
    researchProductExampleRepairedConfirmationLockedAuthorizationSHA256
  );
  assert.throws(
    () => requireActiveResearchProductExampleRepairedConfirmationPaidAuthorization(
      lockedValidation
    ),
    /locked and no provider call is authorized/i
  );

  const tampered = structuredClone(locked);
  tampered.notes = `${tampered.notes} changed`;
  const tamperedPath = join(temporaryDirectory, "tampered.json");
  await writeFile(tamperedPath, `${JSON.stringify(tampered, null, 2)}\n`);
  await assert.rejects(
    validateResearchProductExampleRepairedConfirmationPaidAuthorization({
      authorizationPath: tamperedPath
    }),
    /locked repaired owner-example confirmation authorization changed/i
  );

  const packageCommit = "a".repeat(40);
  const exactAuthorizationPhrase =
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
    exactAuthorizationPhrase,
    exactSpendingCapPhrase: exactAuthorizationPhrase
  };
  authorized.execution.authorizationPackageCommit = packageCommit;
  authorized.execution.executionCommit = null;
  authorized.networkOrModelCallAuthorized = true;
  const authorizedPath = join(temporaryDirectory, "authorized.json");
  await writeFile(authorizedPath, `${JSON.stringify(authorized, null, 2)}\n`);
  const authorizedValidation =
    await validateResearchProductExampleRepairedConfirmationPaidAuthorization({
      authorizationPath: authorizedPath
    });
  assert.deepEqual(
    requireActiveResearchProductExampleRepairedConfirmationPaidAuthorization(
      authorizedValidation
    ),
    {
      authorizationID: researchProductExampleRepairedConfirmationAuthorizationID,
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
  ["scripts/run-research-product-example-repaired-confirmation.mjs"],
  {
    cwd: serverRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      OPENAI_API_KEY: "must-not-be-used",
      PERMITEXT_RUN_PAID_RESEARCH_EVALS: "1",
      PERMITEXT_RESEARCH_EVAL_MAX_USD: "2"
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
  "The refusal path must not create or alter the repaired permanent run lock."
);

const runnerSource = await readFile(
  join(serverRoot, "scripts", "run-research-product-example-repaired-confirmation.mjs"),
  "utf8"
);
assert.match(runnerSource, /open\(runLockPath, "wx"\)/);
assert.match(runnerSource, /separateJudgeRequests:\s*0/);
assert.match(runnerSource, /PERMITEXT_RESEARCH_WEB_SUPPORT = "1"/);
assert.match(runnerSource, /PERMITEXT_RESEARCH_OFFICIAL_DOMAINS/);
assert.match(runnerSource, /nyc\.gov,ny\.gov,rules\.cityofnewyork\.us,ada\.gov/);
assert.match(runnerSource, /PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS = "1"/);
assert.match(runnerSource, /Only the committed repaired authorization record may differ/);
assert.match(runnerSource, /PERMITEXT_SYNC_DATA_PATH = join\(temporaryDirectory/);
assert.match(runnerSource, /process\.env\.PERMITEXT_SYNC_DATABASE_URL = ""/);
assert.match(runnerSource, /researchProductExampleRepairedRuntimeEnvironment/);
assert.match(runnerSource, /researchSpendGuardrails/);
assert.match(runnerSource, /0\\\.69\(\?:4\)\?/);
assert.doesNotMatch(runnerSource, /judgeAnswer|PERMITEXT_RESEARCH_EVAL_JUDGE_MODEL/);

console.log(
  "Permitext repaired owner-example confirmation authorization contract passed; locked execution refused before provider access, official-only web support is bounded, seven conversations and nine turns remain exact, and no separate paid judge is configured."
);
