import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  requireActiveResearchProductExampleConfirmationPaidAuthorization,
  researchProductExampleConfirmationAuthorizationID,
  researchProductExampleConfirmationLockedAuthorizationSHA256,
  researchProductExampleConfirmationMaximumSpendUSD,
  researchProductExampleConfirmationPreparedFromCommit,
  validateResearchProductExampleConfirmationPaidAuthorization
} from "../evals/research-product-example-confirmation-paid-authorization.mjs";

const testRoot = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(testRoot, "..");
const authorizationPath = join(
  serverRoot,
  "evals",
  "research-product-example-confirmation-paid-authorization.json"
);
const runLockPath = join(serverRoot, ".research-product-example-confirmation-paid-run.lock");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const validation = await validateResearchProductExampleConfirmationPaidAuthorization();
assert.equal(validation.authorization.authorizationID, researchProductExampleConfirmationAuthorizationID);
assert(
  ["locked", "consumed"].includes(validation.authorization.status),
  "The committed owner-example authorization must be either the pristine package lock or the retained consumed result."
);
assert.equal(validation.authorization.plannedScope.conversationCount, 7);
assert.equal(validation.authorization.plannedScope.orderedTurnCount, 9);
assert.equal(validation.authorization.plannedScope.repetitions, 1);
assert.equal(
  validation.authorization.plannedScope.maximumCumulativeSpendUSD,
  researchProductExampleConfirmationMaximumSpendUSD
);
assert.equal(validation.authorization.plannedScope.separateJudgeRequests, 0);
assert.equal(
  validation.authorization.lineage.preparedFromCommit,
  researchProductExampleConfirmationPreparedFromCommit
);
assert.throws(
  () => requireActiveResearchProductExampleConfirmationPaidAuthorization(validation),
  /locked and no provider call is authorized/i
);

const temporaryDirectory = await mkdtemp(join(tmpdir(), "permitext-owner-example-auth-"));
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
    await validateResearchProductExampleConfirmationPaidAuthorization({
      authorizationPath: lockedPath
    });
  assert.equal(
    sha256(await readFile(lockedPath)),
    researchProductExampleConfirmationLockedAuthorizationSHA256
  );
  assert.throws(
    () => requireActiveResearchProductExampleConfirmationPaidAuthorization(lockedValidation),
    /locked and no provider call is authorized/i
  );

  const tampered = structuredClone(locked);
  tampered.notes = `${tampered.notes} changed`;
  const tamperedPath = join(temporaryDirectory, "authorization.json");
  await writeFile(tamperedPath, `${JSON.stringify(tampered, null, 2)}\n`);
  await assert.rejects(
    validateResearchProductExampleConfirmationPaidAuthorization({
      authorizationPath: tamperedPath
    }),
    /locked owner-example confirmation authorization changed/i
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
    await validateResearchProductExampleConfirmationPaidAuthorization({
      authorizationPath: authorizedPath
    });
  assert.deepEqual(
    requireActiveResearchProductExampleConfirmationPaidAuthorization(authorizedValidation),
    {
      authorizationID: researchProductExampleConfirmationAuthorizationID,
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
  ["scripts/run-research-product-example-confirmation.mjs"],
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
assert.match(`${lockedRun.stdout}\n${lockedRun.stderr}`, /locked and no provider call is authorized/i);
let runLockAfter = null;
try {
  runLockAfter = await readFile(runLockPath, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
assert.equal(runLockAfter, runLockBefore, "The refusal path must not create or alter the permanent run lock.");

const runnerSource = await readFile(
  join(serverRoot, "scripts", "run-research-product-example-confirmation.mjs"),
  "utf8"
);
assert.match(runnerSource, /open\(runLockPath, "wx"\)/);
assert.match(runnerSource, /separateJudgeRequests:\s*0/);
assert.match(runnerSource, /PERMITEXT_RESEARCH_WEB_SUPPORT = "0"/);
assert.match(runnerSource, /PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS = "1"/);
assert.match(runnerSource, /Only the committed authorization record may differ/);
assert.match(runnerSource, /authorization\.execution\.executionCommit,\s*null/);
assert.doesNotMatch(runnerSource, /must name the exact execution commit/);
assert.doesNotMatch(runnerSource, /judgeAnswer|PERMITEXT_RESEARCH_EVAL_JUDGE_MODEL/);

console.log(
  "Permitext owner-example confirmation authorization contract passed; locked execution refused before provider access, seven conversations and nine turns remain exact, and no separate paid judge is configured."
);
