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
assert.equal(validation.authorization.status, "locked");
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

const temporaryDirectory = await mkdtemp(join(tmpdir(), "permitext-owner-example-repaired-auth-"));
try {
  const lockedPath = join(temporaryDirectory, "locked.json");
  await writeFile(
    lockedPath,
    `${JSON.stringify(validation.authorization, null, 2)}\n`
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

  const tampered = structuredClone(validation.authorization);
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
assert.match(runnerSource, /0\\\.69\(\?:4\)\?/);
assert.doesNotMatch(runnerSource, /judgeAnswer|PERMITEXT_RESEARCH_EVAL_JUDGE_MODEL/);

console.log(
  "Permitext repaired owner-example confirmation authorization contract passed; locked execution refused before provider access, official-only web support is bounded, seven conversations and nine turns remain exact, and no separate paid judge is configured."
);
