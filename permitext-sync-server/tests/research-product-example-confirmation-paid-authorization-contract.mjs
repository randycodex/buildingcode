import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
assert.equal(validation.authorization.status, "locked");
assert.equal(validation.authorization.networkOrModelCallAuthorized, false);
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
assert.equal(
  sha256(await readFile(authorizationPath)),
  researchProductExampleConfirmationLockedAuthorizationSHA256
);
assert.throws(
  () => requireActiveResearchProductExampleConfirmationPaidAuthorization(validation),
  /locked and no provider call is authorized/i
);

const temporaryDirectory = await mkdtemp(join(tmpdir(), "permitext-owner-example-auth-"));
try {
  const tampered = structuredClone(validation.authorization);
  tampered.notes = `${tampered.notes} changed`;
  const tamperedPath = join(temporaryDirectory, "authorization.json");
  await writeFile(tamperedPath, `${JSON.stringify(tampered, null, 2)}\n`);
  await assert.rejects(
    validateResearchProductExampleConfirmationPaidAuthorization({
      authorizationPath: tamperedPath
    }),
    /locked owner-example confirmation authorization changed/i
  );
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
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
await assert.rejects(access(runLockPath), /ENOENT/);

const runnerSource = await readFile(
  join(serverRoot, "scripts", "run-research-product-example-confirmation.mjs"),
  "utf8"
);
assert.match(runnerSource, /open\(runLockPath, "wx"\)/);
assert.match(runnerSource, /separateJudgeRequests:\s*0/);
assert.match(runnerSource, /PERMITEXT_RESEARCH_WEB_SUPPORT = "0"/);
assert.match(runnerSource, /PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS = "1"/);
assert.match(runnerSource, /Only the committed authorization record may differ/);
assert.doesNotMatch(runnerSource, /judgeAnswer|PERMITEXT_RESEARCH_EVAL_JUDGE_MODEL/);

console.log(
  "Permitext owner-example confirmation authorization contract passed; locked execution refused before provider access, seven conversations and nine turns remain exact, and no separate paid judge is configured."
);
