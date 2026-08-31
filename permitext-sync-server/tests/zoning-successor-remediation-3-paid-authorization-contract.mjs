import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  requireActiveZoningRemediationSuccessor3PaidAuthorization,
  validateZoningRemediationSuccessor3PaidAuthorization
} from "../evals/zoning-successor-remediation-3-paid-authorization.mjs";

const serverRoot = new URL("../", import.meta.url);
const defaultAuthorizationPath = new URL(
  "../evals/zoning-successor-remediation-3-paid-authorization.json",
  import.meta.url
);
const runnerPath = new URL("../scripts/run-zoning-successor.mjs", import.meta.url);
const evaluatorPath = new URL("./research-evals.mjs", import.meta.url);
const exactCohortSHA256 =
  "852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc";
const paidEnvironment = {
  ...process.env,
  OPENAI_API_KEY: "",
  PERMITEXT_RUN_PAID_RESEARCH_EVALS: "",
  PERMITEXT_RESEARCH_EVAL_MAX_USD: ""
};
const combinedOutput = (result) => `${result.stdout || ""}\n${result.stderr || ""}`;

const runnerSource = await readFile(runnerPath, "utf8");
for (const requiredGuard of [
  "PERMITEXT_RESEARCH_WEB_SUPPORT: \"off\"",
  "--stop-on-execution-error",
  "--run-id",
  "beginAuthorizationAttempt",
  "authorization.status = \"running\"",
  "ls-files"
]) {
  assert(runnerSource.includes(requiredGuard),
    `The consuming runner is missing guard: ${requiredGuard}`);
}
const evaluatorSource = await readFile(evaluatorPath, "utf8");
assert(evaluatorSource.includes("rename(temporaryPath, jsonPath)"),
  "Evaluation snapshots must be replaced atomically.");

const remediation2AuthorizationText = await readFile(
  new URL(
    "../evals/zoning-successor-remediation-2-paid-authorization.json",
    import.meta.url
  ),
  "utf8"
);
const remediation2Authorization = JSON.parse(remediation2AuthorizationText);
assert.equal(
  createHash("sha256").update(remediation2AuthorizationText).digest("hex"),
  "671a88a1445f2c8c818fdf8746795cab95121fed425d916953cc8f4fa93511e0"
);
assert.equal(remediation2Authorization.status, "consumed");
assert.equal(
  remediation2Authorization.consumption.runID,
  "f35eed33-cb4e-4b7b-a719-86b072271660"
);

const current = await validateZoningRemediationSuccessor3PaidAuthorization();
assert.equal(current.authorization.cohort.sha256, exactCohortSHA256);
assert.equal(current.cohort.cases.length, 30);
assert.equal(current.authorization.publicResearchReleaseAuthorized, false);
assert.equal(current.authorization.evidenceBudgetCandidateEnabled, false);

const directLiveAttempt = spawnSync(process.execPath, [
  "tests/research-evals.mjs",
  "--zoning-successor-remediation-3",
  "--run-live"
], {
  cwd: serverRoot,
  encoding: "utf8",
  env: paidEnvironment
});
assert.equal(directLiveAttempt.status, 1);
assert.match(
  combinedOutput(directLiveAttempt),
  /must run through its consuming runner and active run lock/i
);

if (current.authorization.status === "authorized") {
  assert.equal(current.active, true);
  assert.equal(current.authorization.scope.caseCount, 30);
  assert.equal(current.authorization.scope.repetitions, 1);
  assert(current.authorization.scope.maximumCumulativeSpendUSD <= 5);
  assert.equal(
    requireActiveZoningRemediationSuccessor3PaidAuthorization(current),
    current
  );
} else {
  assert.equal(current.active, false);
  assert.throws(
    () => requireActiveZoningRemediationSuccessor3PaidAuthorization(current),
    /requires a new explicit owner authorization and cumulative spend cap/
  );

  const blockedRunner = spawnSync(process.execPath, [
    "scripts/run-zoning-successor.mjs",
    "--remediation-3"
  ], {
    cwd: serverRoot,
    encoding: "utf8",
    env: paidEnvironment
  });
  assert.equal(blockedRunner.status, 1);
  assert.match(
    combinedOutput(blockedRunner),
    /requires a new explicit owner authorization and cumulative spend cap/
  );
}

for (const args of [
  ["scripts/run-zoning-successor.mjs", "--remediation-3", "--remediation-3"],
  ["scripts/run-zoning-successor.mjs", "--unknown"]
]) {
  const unsupportedAttempt = spawnSync(process.execPath, args, {
    cwd: serverRoot,
    encoding: "utf8",
    env: paidEnvironment
  });
  assert.equal(unsupportedAttempt.status, 1);
  assert.match(combinedOutput(unsupportedAttempt), /unsupported Zoning successor paid-run argument/i);
}

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), "permitext-zoning-remediation-3-authorization-")
);
try {
  const fixturePath = join(temporaryDirectory, "authorization.json");
  const fixture = JSON.parse(await readFile(defaultAuthorizationPath, "utf8"));
  fixture.status = "authorized";
  fixture.scope.caseCount = 30;
  fixture.scope.repetitions = 1;
  fixture.scope.maximumCumulativeSpendUSD = 5;
  fixture.ownerDecision.authorizedAt = "2026-08-31T00:29:41Z";
  fixture.ownerDecision.authorizedBy = "Permitext owner";
  fixture.ownerDecision.exactAuthorizationPhrase = "I authorize it";
  fixture.ownerDecision.exactSpendingCapPhrase = "Use a $5 maximum";
  fixture.consumption.status = "not_started";
  fixture.consumption.attemptID = null;
  fixture.consumption.startedAt = null;
  fixture.consumption.runID = null;
  fixture.consumption.consumedAt = null;
  await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  const authorizedFixture =
    await validateZoningRemediationSuccessor3PaidAuthorization({
      authorizationPath: fixturePath
    });
  assert.equal(authorizedFixture.active, true);
  assert.equal(
    requireActiveZoningRemediationSuccessor3PaidAuthorization(authorizedFixture),
    authorizedFixture
  );

  fixture.status = "running";
  fixture.consumption.status = "running";
  fixture.consumption.attemptID = "11111111-1111-4111-8111-111111111111";
  fixture.consumption.startedAt = "2026-08-31T00:30:00.000Z";
  await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  const runningFixture =
    await validateZoningRemediationSuccessor3PaidAuthorization({
      authorizationPath: fixturePath
    });
  assert.equal(runningFixture.active, false);
  assert.throws(
    () => requireActiveZoningRemediationSuccessor3PaidAuthorization(runningFixture),
    /requires a new explicit owner authorization and cumulative spend cap/
  );

  fixture.scope.maximumCumulativeSpendUSD = 5.01;
  await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  await assert.rejects(
    validateZoningRemediationSuccessor3PaidAuthorization({
      authorizationPath: fixturePath
    }),
    /no higher than \$5/
  );
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log("Zoning remediation-successor-3 paid-authorization guard contract passed", {
  defaultStatus: current.authorization.status,
  exactCohortCases: current.cohort.cases.length,
  exactCohortSHA256,
  directLiveAttemptBlocked: true,
  priorAuthorizationUnchanged: true,
  maximumAllowedCapUSD: 5,
  publicResearchReleaseAuthorized:
    current.authorization.publicResearchReleaseAuthorized,
  paidRequests: 0
});
