import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  requireActiveZoningRemediationSuccessor3V16ConfirmationPaidAuthorization,
  validateZoningRemediationSuccessor3V16ConfirmationPaidAuthorization,
  zoningRemediationSuccessor3V16ConfirmationAppSHA256,
  zoningRemediationSuccessor3V16ConfirmationAuthorizationPackageCommit,
  zoningRemediationSuccessor3V16ConfirmationConsumedAuthorizationSHA256,
  zoningRemediationSuccessor3V16ConfirmationEconomicsSHA256,
  zoningRemediationSuccessor3V16ConfirmationExecutionCommit,
  zoningRemediationSuccessor3V16ConfirmationLockedAuthorizationSHA256,
  zoningRemediationSuccessor3V16ConfirmationPreparedFromCommit,
  zoningRemediationSuccessor3V16ConfirmationResultJSONFile,
  zoningRemediationSuccessor3V16ConfirmationResultJSONSHA256,
  zoningRemediationSuccessor3V16ConfirmationResultMarkdownFile,
  zoningRemediationSuccessor3V16ConfirmationResultMarkdownSHA256,
  zoningRemediationSuccessor3V16ConfirmationRunID,
  zoningRemediationSuccessor3V16ConfirmationRunnerHandoffSHA256,
  zoningRemediationSuccessor3V16ConfirmationRunnerPublicKeySHA256,
  zoningRemediationSuccessor3V16ConfirmationSafetySHA256
} from "../evals/zoning-successor-remediation-3-v16-confirmation-paid-authorization.mjs";
import {
  zoningRemediationSuccessor3V15ConfirmationAuthorizationPackageCommit,
  zoningRemediationSuccessor3V15ConfirmationConsumedAuthorizationSHA256,
  zoningRemediationSuccessor3V15ConfirmationExecutionCommit,
  zoningRemediationSuccessor3V15ConfirmationResultJSONFile,
  zoningRemediationSuccessor3V15ConfirmationResultJSONSHA256,
  zoningRemediationSuccessor3V15ConfirmationResultMarkdownFile,
  zoningRemediationSuccessor3V15ConfirmationResultMarkdownSHA256,
  zoningRemediationSuccessor3V15ConfirmationRunID
} from "../evals/zoning-successor-remediation-3-v15-confirmation-paid-authorization.mjs";
import {
  zoningRemediationSuccessor3V11PaidRunEnvironment
} from "../scripts/run-zoning-successor.mjs";

const serverRoot = new URL("../", import.meta.url);
const authorizationPath = new URL(
  "../evals/zoning-successor-remediation-3-v16-confirmation-paid-authorization.json",
  import.meta.url
);
const runnerPath = new URL("../scripts/run-zoning-successor.mjs", import.meta.url);
const evaluatorPath = new URL("./research-evals.mjs", import.meta.url);
const resultsPath = new URL("../evals/results/", import.meta.url);
const exactAuthorizationID = "7eb2e708-3802-403f-95e6-4e594f3310da";
const exactCohortSHA256 =
  "852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc";
const exactLockedAuthorizationSHA256 =
  "33c8112e307ecde61ab1b8007d318e16a932875b5df3fba2202d53154ce180f6";
const exactConsumedAuthorizationSHA256 =
  "f841d27c4f664990305a28ac6d2cc2817a2c910f53f402be44d3c0e3959153e5";
const exactAuthorizationPackageCommit =
  "9751e50d1f830db527a822b1a515552465749907";
const exactExecutionCommit = "0e17527e218daeb0d8ab938a37f34c04ee10febf";
const exactRunID = "784648df-2d7b-4957-972a-1ef14a054c43";
const authorizationRelativePath =
  "evals/zoning-successor-remediation-3-v16-confirmation-paid-authorization.json";
const combinedOutput = (result) => `${result.stdout || ""}\n${result.stderr || ""}`;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const noPaidEnvironment = {
  ...process.env,
  OPENAI_API_KEY: "",
  PERMITEXT_RUN_PAID_RESEARCH_EVALS: "",
  PERMITEXT_RESEARCH_EVAL_MAX_USD: ""
};

assert.equal(
  zoningRemediationSuccessor3V16ConfirmationLockedAuthorizationSHA256,
  exactLockedAuthorizationSHA256
);
assert.equal(
  zoningRemediationSuccessor3V16ConfirmationConsumedAuthorizationSHA256,
  exactConsumedAuthorizationSHA256
);
assert.equal(
  zoningRemediationSuccessor3V16ConfirmationAuthorizationPackageCommit,
  exactAuthorizationPackageCommit
);
assert.equal(
  zoningRemediationSuccessor3V16ConfirmationExecutionCommit,
  exactExecutionCommit
);
assert.equal(zoningRemediationSuccessor3V16ConfirmationRunID, exactRunID);
assert.equal(
  zoningRemediationSuccessor3V16ConfirmationPreparedFromCommit,
  "661eda3cc5f6eef5959851caeb35e198ea4eb911"
);
assert.equal(
  zoningRemediationSuccessor3V16ConfirmationSafetySHA256,
  "c3d1a470bb88314086f23acb04d5d40b3011f5ec35f7bda7341f1ef7bed8f7aa"
);
assert.equal(
  zoningRemediationSuccessor3V16ConfirmationEconomicsSHA256,
  "d4816da6162137e122355494a3f2954dca09fc9d8978b85eb682516d29ec5ae0"
);
assert.equal(
  zoningRemediationSuccessor3V16ConfirmationAppSHA256,
  "1b907f5db72f65248489b80801904a2011b2df91ce5d739a7e6dc39cce702797"
);
assert.equal(
  zoningRemediationSuccessor3V16ConfirmationRunnerHandoffSHA256,
  "e45975a2d028d5d9852032fe6c107aacf0d3e7d18586ba41ae7eac4a2b4df327"
);
assert.equal(
  zoningRemediationSuccessor3V16ConfirmationRunnerPublicKeySHA256,
  "7830127ce97437dcb85971faecfac4ad031288d4f98608837fa5c22aa2c64918"
);

const lockedAuthorizationBlob = spawnSync("git", [
  "show",
  `${exactAuthorizationPackageCommit}:permitext-sync-server/${authorizationRelativePath}`
], {
  cwd: serverRoot,
  encoding: "utf8",
  maxBuffer: 4 * 1024 * 1024
});
assert.equal(lockedAuthorizationBlob.status, 0,
  "The historical locked v16 authorization could not be read.");
const lockedAuthorizationText = lockedAuthorizationBlob.stdout;
assert.equal(sha256(lockedAuthorizationText), exactLockedAuthorizationSHA256);
const lockedAuthorization = JSON.parse(lockedAuthorizationText);

const consumedAuthorizationText = await readFile(authorizationPath, "utf8");
assert.equal(sha256(consumedAuthorizationText), exactConsumedAuthorizationSHA256);
const current =
  await validateZoningRemediationSuccessor3V16ConfirmationPaidAuthorization();
assert.equal(current.authorization.authorizationID, exactAuthorizationID);
assert.equal(current.authorization.status, "consumed");
assert.equal(current.active, false);
assert.equal(current.authorization.cohort.sha256, exactCohortSHA256);
assert.equal(current.cohort.cases.length, 30);
assert.equal(current.authorization.scope.caseCount, 30);
assert.equal(current.authorization.scope.repetitions, 1);
assert.equal(current.authorization.scope.maximumCumulativeSpendUSD, 5);
assert.equal(current.authorization.ownerDecision.authorizedBy, "Permitext owner");
const exactOwnerPhrase =
  `authorize exactly package commit ${exactAuthorizationPackageCommit} for all 30 ` +
  "ordered cases, one repetition, with a maximum cumulative API spend of $5.";
assert.equal(current.authorization.ownerDecision.exactAuthorizationPhrase,
  exactOwnerPhrase);
assert.equal(current.authorization.ownerDecision.exactSpendingCapPhrase,
  exactOwnerPhrase);
assert.equal(current.authorization.execution.authorizationPackageCommit,
  exactAuthorizationPackageCommit);
assert.equal(current.authorization.execution.executionCommit, exactExecutionCommit);
assert.equal(current.authorization.consumption.attemptID, exactRunID);
assert.equal(current.authorization.consumption.runID, exactRunID);
assert.equal(current.authorization.execution.webSupportEnabled, false);
assert.equal(current.authorization.execution.stopOnExecutionError, true);
assert.equal(current.authorization.publicResearchReleaseAuthorized, false);
assert.equal(current.authorization.professionalZoningSignoff, false);
assert.equal(current.authorization.deploymentAuthorized, false);
assert.equal(current.authorization.pricingOrAllowanceChangeAuthorized, false);
assert.equal(current.authorization.evidenceBudgetCandidateEnabled, false);
assert.throws(
  () => requireActiveZoningRemediationSuccessor3V16ConfirmationPaidAuthorization(
    current
  ),
  /requires a new explicit owner authorization and cumulative spend cap/
);

for (const [file, expectedHash] of [
  [zoningRemediationSuccessor3V16ConfirmationResultJSONFile,
    zoningRemediationSuccessor3V16ConfirmationResultJSONSHA256],
  [zoningRemediationSuccessor3V16ConfirmationResultMarkdownFile,
    zoningRemediationSuccessor3V16ConfirmationResultMarkdownSHA256]
]) {
  assert.equal(
    sha256(await readFile(new URL(`../evals/${file}`, import.meta.url), "utf8")),
    expectedHash,
    `The retained v16 result changed: ${file}`
  );
}

assert.equal(
  current.authorization.lineage.priorAuthorizationSHA256,
  zoningRemediationSuccessor3V15ConfirmationConsumedAuthorizationSHA256
);
assert.equal(
  current.authorization.lineage.priorAuthorizationPackageCommit,
  zoningRemediationSuccessor3V15ConfirmationAuthorizationPackageCommit
);
assert.equal(
  current.authorization.lineage.priorExecutionCommit,
  zoningRemediationSuccessor3V15ConfirmationExecutionCommit
);
assert.equal(
  current.authorization.lineage.priorRunID,
  zoningRemediationSuccessor3V15ConfirmationRunID
);
assert.equal(
  current.authorization.lineage.priorResultJSONFile,
  zoningRemediationSuccessor3V15ConfirmationResultJSONFile
);
assert.equal(
  current.authorization.lineage.priorResultJSONSHA256,
  zoningRemediationSuccessor3V15ConfirmationResultJSONSHA256
);
assert.equal(
  current.authorization.lineage.priorResultMarkdownFile,
  zoningRemediationSuccessor3V15ConfirmationResultMarkdownFile
);
assert.equal(
  current.authorization.lineage.priorResultMarkdownSHA256,
  zoningRemediationSuccessor3V15ConfirmationResultMarkdownSHA256
);

const scrubbedEnvironment = zoningRemediationSuccessor3V11PaidRunEnvironment({
  ...process.env,
  NODE_ENV: "test",
  NODE_OPTIONS: "--import=/tmp/hostile-loader.mjs",
  HTTP_PROXY: "http://127.0.0.1:9001",
  HTTPS_PROXY: "http://127.0.0.1:9002",
  PERMITEXT_SYNC_DATABASE_URL: "postgres://must-not-be-used",
  PERMITEXT_TEST_RESEARCH_MOCK: "1",
  PERMITEXT_RESEARCH_MODEL_EVIDENCE_ANALYSIS: "1",
  PERMITEXT_RESEARCH_REASONING_EFFORT: "xhigh",
  PERMITEXT_RESEARCH_WEB_SUPPORT: "on"
}, 5);
assert.equal(scrubbedEnvironment.NODE_ENV, "production");
assert.equal(scrubbedEnvironment.NODE_OPTIONS, "");
assert.equal(scrubbedEnvironment.HTTP_PROXY, "");
assert.equal(scrubbedEnvironment.HTTPS_PROXY, "");
assert.equal(scrubbedEnvironment.PERMITEXT_SYNC_DATABASE_URL, "");
assert.equal(scrubbedEnvironment.PERMITEXT_TEST_RESEARCH_MOCK, "");
assert.equal(scrubbedEnvironment.PERMITEXT_RESEARCH_WEB_SUPPORT, "off");
assert.equal(scrubbedEnvironment.PERMITEXT_RESEARCH_MODEL_EVIDENCE_ANALYSIS, "0");
assert.equal(scrubbedEnvironment.PERMITEXT_RESEARCH_REASONING_EFFORT, "medium");

const runnerSource = await readFile(runnerPath, "utf8");
for (const requiredGuard of [
  "--remediation-3-v16-confirmation",
  ".zoning-successor-remediation-3-v16-confirmation-paid-run.lock",
  "validateZoningRemediationSuccessor3V16ConfirmationPaidAuthorization",
  "zoningRemediationSuccessor3V16ConfirmationLockedAuthorizationSHA256",
  "assertPinnedAuthenticatedRuntimeInputsAtCommit",
  "assertExactLockedAuthorizationPackage",
  "respondToZoningV11RunnerChallenge",
  "Only the locked authorization record may change",
  "pendingPaidRequestCount",
  "--stop-on-execution-error",
  "PERMITEXT_RESEARCH_WEB_SUPPORT: \"off\""
]) {
  assert(runnerSource.includes(requiredGuard),
    `The v16 confirmation runner is missing guard: ${requiredGuard}`);
}

const evaluatorSource = await readFile(evaluatorPath, "utf8");
for (const requiredGuard of [
  "--zoning-successor-remediation-3-v16-confirmation",
  ".zoning-successor-remediation-3-v16-confirmation-paid-run.lock",
  "validateZoningRemediationSuccessor3V16ConfirmationPaidAuthorization",
  "zoningRemediationSuccessor3V16ConfirmationLockedAuthorizationSHA256",
  "assertAuthenticatedConfirmationChildExecutionInputs",
  "requireAuthenticatedZoningV11RunnerHandoff",
  "server changes other than the authorization",
  "globalRunnerLock?.executionCommit === runnerLock?.executionCommit",
  "may not expose its runner authentication in the environment"
]) {
  assert(evaluatorSource.includes(requiredGuard),
    `The v16 confirmation evaluator is missing guard: ${requiredGuard}`);
}

const resultsBefore = (await readdir(resultsPath)).sort();
for (const args of [
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v16-confirmation", "--run-live"],
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v16-confirmation", "--run-live",
    "--repeat", "2"],
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v16-confirmation", "--run-live",
    "--case", "zr-rules-of-construction"],
  ["scripts/run-zoning-successor.mjs", "--remediation-3-v16-confirmation"]
]) {
  const blocked = spawnSync(process.execPath, args, {
    cwd: serverRoot,
    encoding: "utf8",
    env: noPaidEnvironment,
    maxBuffer: 20 * 1024 * 1024
  });
  assert.equal(blocked.status, 1, `${args.join(" ")} unexpectedly ran.`);
}
assert.deepEqual((await readdir(resultsPath)).sort(), resultsBefore,
  "A consumed or malformed v16 attempt created a result file.");

const mockPreflight = spawnSync(process.execPath, [
  "tests/research-evals.mjs",
  "--zoning-successor-remediation-3-v16-confirmation"
], {
  cwd: serverRoot,
  encoding: "utf8",
  env: noPaidEnvironment,
  maxBuffer: 20 * 1024 * 1024
});
assert.equal(mockPreflight.status, 0, combinedOutput(mockPreflight));
assert.match(combinedOutput(mockPreflight), /30\/30/,
  "The no-cost v16 confirmation preflight did not cover the full frozen cohort.");
assert.deepEqual((await readdir(resultsPath)).sort(), resultsBefore,
  "The no-cost v16 confirmation preflight created a paid result file.");

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), "permitext-zoning-remediation-3-v16-confirmation-")
);
try {
  const fixturePath = join(temporaryDirectory, "authorization.json");
  const authorizedFixture = structuredClone(lockedAuthorization);
  authorizedFixture.status = "authorized";
  authorizedFixture.scope.caseCount = 30;
  authorizedFixture.scope.repetitions = 1;
  authorizedFixture.scope.maximumCumulativeSpendUSD = 5;
  authorizedFixture.ownerDecision.authorizedAt = "2026-08-31T22:00:00.000Z";
  authorizedFixture.ownerDecision.authorizedBy = "Permitext owner";
  const packageCommit = "1".repeat(40);
  const ownerPhrase =
    `authorize exactly package commit ${packageCommit} for all 30 ordered ` +
    "cases, one repetition, with a maximum cumulative API spend of $5.";
  authorizedFixture.ownerDecision.exactAuthorizationPhrase = ownerPhrase;
  authorizedFixture.ownerDecision.exactSpendingCapPhrase = ownerPhrase;
  authorizedFixture.execution.authorizationPackageCommit = packageCommit;
  await writeFile(fixturePath,
    `${JSON.stringify(authorizedFixture, null, 2)}\n`, "utf8");
  const authorized =
    await validateZoningRemediationSuccessor3V16ConfirmationPaidAuthorization({
      authorizationPath: fixturePath
    });
  assert.equal(authorized.active, true);

  for (const [mutate, expected] of [
    [(fixture) => {
      fixture.scope.maximumCumulativeSpendUSD = 4;
    }, /exact 30-case, one-repetition, \$5 scope/],
    [(fixture) => {
      fixture.ownerDecision.exactAuthorizationPhrase =
        fixture.ownerDecision.exactAuthorizationPhrase.replace("all 30", "all 29");
    }, /bind the owner's exact phrase/],
    [(fixture) => {
      fixture.ownerDecision.exactSpendingCapPhrase = null;
    }, /same exact package-bound spending-cap phrase/],
    [(fixture) => {
      fixture.execution.webSupportEnabled = true;
    }, /may not enable unbudgeted web search/],
    [(fixture) => {
      fixture.lineage.zoningSafetySHA256 = "0".repeat(64);
    }, /wrong Zoning safety SHA/],
    [(fixture) => {
      fixture.lineage.priorAuthorizationSHA256 = "0".repeat(64);
    }, /wrong historical v15 authorization SHA/],
    [(fixture) => {
      fixture.deploymentAuthorized = true;
    }, /may not authorize deployment/]
  ]) {
    const malformed = structuredClone(authorizedFixture);
    mutate(malformed);
    await writeFile(fixturePath, `${JSON.stringify(malformed, null, 2)}\n`,
      "utf8");
    await assert.rejects(
      validateZoningRemediationSuccessor3V16ConfirmationPaidAuthorization({
        authorizationPath: fixturePath
      }),
      expected
    );
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

assert.equal(sha256(await readFile(authorizationPath, "utf8")),
  exactConsumedAuthorizationSHA256);
assert.deepEqual((await readdir(resultsPath)).sort(), resultsBefore,
  "The v16 authorization contract created a paid result file.");
console.log(
  "Zoning remediation-successor-3 v16 confirmation authorization contract passed; consumed run/result integrity, immutable locked-package history, consumed v15 lineage, hostile-runtime scrubbing, paid-dispatch blocks, and 30/30 no-cost preflight remain intact."
);
