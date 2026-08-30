import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  requireActiveZoningRemediationSuccessor2PaidAuthorization,
  validateZoningRemediationSuccessor2PaidAuthorization
} from "../evals/zoning-successor-remediation-2-paid-authorization.mjs";

const serverRoot = new URL("../", import.meta.url);
const defaultAuthorizationPath = new URL(
  "../evals/zoning-successor-remediation-2-paid-authorization.json",
  import.meta.url
);
const exactCohortSHA256 =
  "459b2273b7ebd209d4519bf9206b6135dc2fc7706052fa9b333c4bf5e63e8a8b";

const current = await validateZoningRemediationSuccessor2PaidAuthorization();
assert.equal(current.authorization.cohort.sha256, exactCohortSHA256);
assert.equal(current.cohort.cases.length, 30);
if (current.authorization.status === "authorized") {
  assert.equal(current.active, true);
  assert.equal(current.authorization.scope.caseCount, 30);
  assert.equal(current.authorization.scope.repetitions, 1);
  assert(current.authorization.scope.maximumCumulativeSpendUSD <= 5);
  assert.equal(
    requireActiveZoningRemediationSuccessor2PaidAuthorization(current),
    current
  );
} else {
  assert.equal(current.active, false);
  assert.throws(
    () => requireActiveZoningRemediationSuccessor2PaidAuthorization(current),
    /requires a new explicit owner authorization and cumulative spend cap/
  );

  for (const args of [
    ["tests/research-evals.mjs", "--zoning-successor-remediation-2", "--run-live"],
    ["scripts/run-zoning-successor.mjs", "--remediation-2"]
  ]) {
    const blockedAttempt = spawnSync(process.execPath, args, {
      cwd: serverRoot,
      encoding: "utf8",
      env: { ...process.env, OPENAI_API_KEY: "" }
    });
    assert.equal(blockedAttempt.status, 1);
    assert.match(
      `${blockedAttempt.stdout}\n${blockedAttempt.stderr}`,
      /requires a new explicit owner authorization and cumulative spend cap/
    );
  }
}

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), "permitext-zoning-remediation-2-authorization-")
);
try {
  const fixturePath = join(temporaryDirectory, "authorization.json");
  const fixture = JSON.parse(await readFile(defaultAuthorizationPath, "utf8"));
  fixture.status = "authorized";
  fixture.scope.caseCount = 30;
  fixture.scope.repetitions = 1;
  fixture.scope.maximumCumulativeSpendUSD = 5;
  fixture.ownerDecision.authorizedAt = "2026-08-30T22:00:00.000Z";
  fixture.ownerDecision.authorizedBy = "Permitext owner";
  fixture.ownerDecision.exactAuthorizationPhrase =
    "Test fixture only: authorize remediation successor 2 once with a $5 cap.";
  fixture.consumption.status = "not_started";
  fixture.consumption.runID = null;
  fixture.consumption.consumedAt = null;
  await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  const authorizedFixture =
    await validateZoningRemediationSuccessor2PaidAuthorization({
      authorizationPath: fixturePath
    });
  assert.equal(authorizedFixture.active, true);
  assert.equal(
    requireActiveZoningRemediationSuccessor2PaidAuthorization(authorizedFixture),
    authorizedFixture
  );

  fixture.scope.maximumCumulativeSpendUSD = 5.01;
  await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  await assert.rejects(
    validateZoningRemediationSuccessor2PaidAuthorization({
      authorizationPath: fixturePath
    }),
    /no higher than \$5/
  );
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log("Zoning remediation-successor-2 paid-authorization guard contract passed", {
  defaultStatus: current.authorization.status,
  exactCohortCases: current.cohort.cases.length,
  exactCohortSHA256,
  directLiveAttemptBlocked: current.authorization.status !== "authorized",
  maximumAllowedCapUSD: 5,
  publicResearchReleaseAuthorized:
    current.authorization.publicResearchReleaseAuthorized
});
