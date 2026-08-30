import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  requireActiveZoningSuccessorPaidAuthorization,
  validateZoningSuccessorPaidAuthorization
} from "../evals/zoning-successor-paid-authorization.mjs";

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(testsDirectory, "..");
const defaultAuthorizationPath = resolve(
  serverRoot,
  "evals/zoning-successor-paid-authorization.json"
);

const current = await validateZoningSuccessorPaidAuthorization();
assert.equal(current.cohort.cases.length, 30);
if (current.authorization.status === "authorized") {
  assert.equal(current.active, true);
  assert.equal(current.authorization.scope.caseCount, 30);
  assert.equal(current.authorization.scope.repetitions, 1);
  assert(current.authorization.scope.maximumCumulativeSpendUSD <= 5);
  assert.equal(
    requireActiveZoningSuccessorPaidAuthorization(current),
    current
  );
} else {
  assert.equal(current.active, false);
  assert.throws(
    () => requireActiveZoningSuccessorPaidAuthorization(current),
    /requires a new explicit owner authorization and cumulative spend cap/
  );

  const directLiveAttempt = spawnSync(process.execPath, [
    "tests/research-evals.mjs",
    "--zoning-successor",
    "--run-live"
  ], {
    cwd: serverRoot,
    encoding: "utf8",
    env: { ...process.env, OPENAI_API_KEY: "" }
  });
  assert.equal(directLiveAttempt.status, 1);
  assert.match(
    `${directLiveAttempt.stdout}\n${directLiveAttempt.stderr}`,
    /requires a new explicit owner authorization and cumulative spend cap/
  );
}

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), "permitext-zoning-successor-authorization-")
);
try {
  const fixturePath = join(temporaryDirectory, "authorization.json");
  const fixture = JSON.parse(await readFile(defaultAuthorizationPath, "utf8"));
  fixture.status = "authorized";
  fixture.scope.caseCount = 30;
  fixture.scope.repetitions = 1;
  fixture.scope.maximumCumulativeSpendUSD = 5;
  fixture.ownerDecision.authorizedAt = "2026-08-30T20:00:00.000Z";
  fixture.ownerDecision.authorizedBy = "Permitext owner";
  fixture.ownerDecision.exactAuthorizationPhrase =
    "Test fixture only: authorize one run with a $5 cap.";
  fixture.consumption.status = "not_started";
  fixture.consumption.runID = null;
  fixture.consumption.consumedAt = null;
  await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  const authorizedFixture = await validateZoningSuccessorPaidAuthorization({
    authorizationPath: fixturePath
  });
  assert.equal(authorizedFixture.active, true);
  assert.equal(
    requireActiveZoningSuccessorPaidAuthorization(authorizedFixture),
    authorizedFixture
  );

  fixture.scope.maximumCumulativeSpendUSD = 5.01;
  await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  await assert.rejects(
    validateZoningSuccessorPaidAuthorization({ authorizationPath: fixturePath }),
    /no higher than \$5/
  );
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log("Zoning successor paid-authorization guard contract passed", {
  defaultStatus: current.authorization.status,
  exactCohortCases: current.cohort.cases.length,
  directLiveAttemptBlocked: current.authorization.status !== "authorized",
  maximumAllowedCapUSD: 5,
  publicResearchReleaseAuthorized:
    current.authorization.publicResearchReleaseAuthorized
});
