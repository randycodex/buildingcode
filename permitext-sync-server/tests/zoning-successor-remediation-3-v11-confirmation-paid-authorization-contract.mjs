import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  requireActiveZoningRemediationSuccessor3V11ConfirmationPaidAuthorization,
  validateZoningRemediationSuccessor3V11ConfirmationPaidAuthorization,
  zoningRemediationSuccessor3V11ConfirmationAppSHA256,
  zoningRemediationSuccessor3V11ConfirmationAuthorizationPackageCommit,
  zoningRemediationSuccessor3V11ConfirmationConsumedAuthorizationSHA256,
  zoningRemediationSuccessor3V11ConfirmationEconomicsSHA256,
  zoningRemediationSuccessor3V11ConfirmationExecutionCommit,
  zoningRemediationSuccessor3V11ConfirmationLockedAuthorizationSHA256,
  zoningRemediationSuccessor3V11ConfirmationPreparedFromCommit,
  zoningRemediationSuccessor3V11ConfirmationResultJSONFile,
  zoningRemediationSuccessor3V11ConfirmationResultJSONSHA256,
  zoningRemediationSuccessor3V11ConfirmationResultMarkdownFile,
  zoningRemediationSuccessor3V11ConfirmationResultMarkdownSHA256,
  zoningRemediationSuccessor3V11ConfirmationRunID,
  zoningRemediationSuccessor3V11ConfirmationRunnerHandoffSHA256,
  zoningRemediationSuccessor3V11ConfirmationRunnerPublicKeySHA256,
  zoningRemediationSuccessor3V11ConfirmationSafetySHA256
} from "../evals/zoning-successor-remediation-3-v11-confirmation-paid-authorization.mjs";
import {
  zoningRemediationSuccessor3V9ConfirmationAuthorizationPackageCommit,
  zoningRemediationSuccessor3V9ConfirmationConsumedAuthorizationSHA256,
  zoningRemediationSuccessor3V9ConfirmationExecutionCommit,
  zoningRemediationSuccessor3V9ConfirmationResultJSONFile,
  zoningRemediationSuccessor3V9ConfirmationResultJSONSHA256,
  zoningRemediationSuccessor3V9ConfirmationResultMarkdownFile,
  zoningRemediationSuccessor3V9ConfirmationResultMarkdownSHA256,
  zoningRemediationSuccessor3V9ConfirmationRunID
} from "../evals/zoning-successor-remediation-3-v9-confirmation-paid-authorization.mjs";
import {
  zoningRemediationSuccessor3V11PaidRunEnvironment
} from "../scripts/run-zoning-successor.mjs";
import {
  signZoningV11RunnerHandoff,
  respondToZoningV11RunnerChallenge,
  verifyZoningV11RunnerHandoff,
  zoningV11RunnerHandoffPayload,
  zoningV11RunnerHandoffProtocol
} from "../evals/zoning-v11-paid-runner-handoff.mjs";

const serverRoot = new URL("../", import.meta.url);
const authorizationPath = new URL(
  "../evals/zoning-successor-remediation-3-v11-confirmation-paid-authorization.json",
  import.meta.url
);
const runnerPath = new URL("../scripts/run-zoning-successor.mjs", import.meta.url);
const evaluatorPath = new URL("./research-evals.mjs", import.meta.url);
const handoffRelativePath = "evals/zoning-v11-paid-runner-handoff.mjs";
const resultsPath = new URL("../evals/results/", import.meta.url);
const globalRunLockPath = new URL("../evals/.paid-evaluation-run.lock", import.meta.url);
const v11RunLockPath = new URL(
  "../evals/.zoning-successor-remediation-3-v11-confirmation-paid-run.lock",
  import.meta.url
);
const exactAuthorizationID = "ee72ca2f-5410-4ce9-a6d6-30deb8ff5169";
const exactCohortSHA256 =
  "852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc";
const exactRepairCommit = "cd1f3a99f32a3648dd8f0d7a8b1d540e5db29bf5";
const exactSafetySHA256 =
  "8003374fb8302a69bdcb924e2e6fe66855c11f52444f045dfb6e75bff1b476f7";
const exactEconomicsSHA256 =
  "d4816da6162137e122355494a3f2954dca09fc9d8978b85eb682516d29ec5ae0";
const exactAppSHA256 =
  "1b907f5db72f65248489b80801904a2011b2df91ce5d739a7e6dc39cce702797";
const exactLockedAuthorizationSHA256 =
  "c5b89c1dd7dca9109e0be01ab78763e6da108cace19dc2fb92f4cc6aed56c024";
const exactConsumedAuthorizationSHA256 =
  "3625175f43ec9d0977183569e8809fa838ad4a19504ac1222b2a7cd845a8df0a";
const exactAuthorizationPackageCommit =
  "8d075b442083db3536de0ff9e90372802ddeadaa";
const exactExecutionCommit = "42f1429cc8f32f987788474e955f36918aef2658";
const exactRunID = "eea4db77-5144-47b8-9a89-b364d1e973ca";
const authorizationRelativePath =
  "evals/zoning-successor-remediation-3-v11-confirmation-paid-authorization.json";
const paidEnvironment = {
  ...process.env,
  OPENAI_API_KEY: "",
  PERMITEXT_RUN_PAID_RESEARCH_EVALS: "",
  PERMITEXT_RESEARCH_EVAL_MAX_USD: ""
};
const combinedOutput = (result) => `${result.stdout || ""}\n${result.stderr || ""}`;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const hostileEnvironment = zoningRemediationSuccessor3V11PaidRunEnvironment({
  ...process.env,
  NODE_ENV: "test",
  NODE_OPTIONS: "--import=/tmp/hostile-loader.mjs",
  NODE_PATH: "/tmp/hostile-node-path",
  NODE_EXTRA_CA_CERTS: "/tmp/hostile-ca.pem",
  NODE_USE_ENV_PROXY: "1",
  NODE_TLS_REJECT_UNAUTHORIZED: "0",
  HTTP_PROXY: "http://127.0.0.1:9001",
  HTTPS_PROXY: "http://127.0.0.1:9002",
  ALL_PROXY: "socks5://127.0.0.1:9003",
  NO_PROXY: "api.openai.com",
  PERMITEXT_SYNC_DATABASE_URL: "postgres://production-must-not-be-used",
  DATABASE_URL: "postgres://production-must-not-be-used",
  STORAGE_URL: "postgres://production-must-not-be-used",
  POSTGRES_URL: "postgres://production-must-not-be-used",
  NEON_DATABASE_URL: "postgres://production-must-not-be-used",
  VERCEL: "1",
  VERCEL_ENV: "production",
  PERMITEXT_TEST_RESEARCH_MOCK: "1",
  PERMITEXT_TEST_RESEARCH_MOCK_WEB_FIXTURE: "bb-2022-013",
  PERMITEXT_TEST_RESEARCH_MOCK_DELAY_MS: "100",
  PERMITEXT_TEST_RESEARCH_MAX_SUPPLEMENTAL_EVIDENCE_CHARACTERS: "24000",
  PERMITEXT_TEST_RESEARCH_EVIDENCE_PACKAGE_ONLY: "1",
  PERMITEXT_ZONING_PAID_RUNNER_NONCE: "hostile-runner-nonce",
  PERMITEXT_RESEARCH_MODEL_EVIDENCE_ANALYSIS: "1",
  PERMITEXT_RESEARCH_REASONING_EFFORT: "xhigh",
  PERMITEXT_RESEARCH_WEB_SUPPORT: "on"
}, 5);
assert.equal(hostileEnvironment.NODE_ENV, "production");
assert.equal(hostileEnvironment.PERMITEXT_RESEARCH_WEB_SUPPORT, "off");
assert.equal(hostileEnvironment.PERMITEXT_ZONING_PAID_RUNNER_NONCE, "");
assert.equal(hostileEnvironment.PERMITEXT_RESEARCH_MODEL_EVIDENCE_ANALYSIS, "0");
assert.equal(hostileEnvironment.PERMITEXT_RESEARCH_REASONING_EFFORT, "medium");
for (const key of [
  "NODE_OPTIONS",
  "NODE_PATH",
  "NODE_EXTRA_CA_CERTS",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "PERMITEXT_SYNC_DATABASE_URL",
  "DATABASE_URL",
  "STORAGE_URL",
  "POSTGRES_URL",
  "NEON_DATABASE_URL",
  "VERCEL",
  "VERCEL_ENV"
]) assert.equal(hostileEnvironment[key], "", `${key} was not scrubbed.`);
assert.equal(hostileEnvironment.NODE_USE_ENV_PROXY, "0");
assert.equal(hostileEnvironment.NODE_TLS_REJECT_UNAUTHORIZED, "1");
for (const key of [
  "PERMITEXT_TEST_RESEARCH_MOCK",
  "PERMITEXT_TEST_RESEARCH_MOCK_WEB_FIXTURE",
  "PERMITEXT_TEST_RESEARCH_MOCK_DELAY_MS",
  "PERMITEXT_TEST_RESEARCH_MAX_SUPPLEMENTAL_EVIDENCE_CHARACTERS",
  "PERMITEXT_TEST_RESEARCH_EVIDENCE_PACKAGE_ONLY"
]) assert.equal(hostileEnvironment[key], "", `${key} was not scrubbed.`);

const testHandoffKeys = generateKeyPairSync("ed25519");
const testHandoffPayload = zoningV11RunnerHandoffPayload({
  runID: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  executionCommit: "b".repeat(40),
  parentPID: process.pid,
  childPID: process.pid + 1,
  challenge: "c".repeat(43)
});
const testHandoffSignature = signZoningV11RunnerHandoff({
  privateKey: testHandoffKeys.privateKey,
  payload: testHandoffPayload
});
const testHandoffPublicKey = testHandoffKeys.publicKey.export({
  type: "spki",
  format: "der"
}).toString("base64");
verifyZoningV11RunnerHandoff({
  payload: testHandoffPayload,
  signature: testHandoffSignature,
  publicKeyDERBase64: testHandoffPublicKey
});
assert.throws(
  () => verifyZoningV11RunnerHandoff({
    payload: { ...testHandoffPayload, runID: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" },
    signature: testHandoffSignature,
    publicKeyDERBase64: testHandoffPublicKey
  }),
  /authenticated runner handoff/i,
  "A v11 runner signature was replayed for a different run."
);
assert.equal(zoningV11RunnerHandoffProtocol,
  "permitext-zoning-remediation-3-v11-runner-handoff-v1");

const handoffRunID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const handoffExecutionCommit = "f".repeat(40);
const handoffModuleURL = new URL(
  "../evals/zoning-v11-paid-runner-handoff.mjs",
  import.meta.url
).href;
const handoffChildSource = `
  import { requireAuthenticatedZoningV11RunnerHandoff } from ${JSON.stringify(handoffModuleURL)};
  await requireAuthenticatedZoningV11RunnerHandoff({
    runID: ${JSON.stringify(handoffRunID)},
    executionCommit: ${JSON.stringify(handoffExecutionCommit)},
    publicKeyDERBase64: ${JSON.stringify(testHandoffPublicKey)}
  });
`;
const authenticatedHandoffChild = spawn(
  process.execPath,
  ["--input-type=module", "--eval", handoffChildSource],
  {
    cwd: serverRoot,
    env: { ...process.env, NODE_OPTIONS: "" },
    stdio: ["ignore", "pipe", "pipe", "ipc"]
  }
);
let authenticatedHandoffOutput = "";
authenticatedHandoffChild.stdout.on("data", (chunk) => {
  authenticatedHandoffOutput += chunk;
});
authenticatedHandoffChild.stderr.on("data", (chunk) => {
  authenticatedHandoffOutput += chunk;
});
authenticatedHandoffChild.once("message", (message) => {
  const response = respondToZoningV11RunnerChallenge({
    message,
    childPID: authenticatedHandoffChild.pid,
    runID: handoffRunID,
    executionCommit: handoffExecutionCommit,
    privateKey: testHandoffKeys.privateKey
  });
  authenticatedHandoffChild.send(response);
});
const authenticatedHandoffExit = await new Promise((resolveExit, rejectExit) => {
  authenticatedHandoffChild.once("error", rejectExit);
  authenticatedHandoffChild.once("exit", (code, signal) => {
    resolveExit({ code, signal });
  });
});
assert.deepEqual(authenticatedHandoffExit, { code: 0, signal: null },
  `The authenticated v11 runner IPC handoff failed: ${authenticatedHandoffOutput}`);

assert.equal(zoningRemediationSuccessor3V11ConfirmationPreparedFromCommit,
  exactRepairCommit);
assert.equal(zoningRemediationSuccessor3V11ConfirmationSafetySHA256,
  exactSafetySHA256);
assert.equal(zoningRemediationSuccessor3V11ConfirmationEconomicsSHA256,
  exactEconomicsSHA256);
assert.equal(zoningRemediationSuccessor3V11ConfirmationAppSHA256,
  exactAppSHA256);
assert.equal(zoningRemediationSuccessor3V11ConfirmationRunnerHandoffSHA256,
  "e45975a2d028d5d9852032fe6c107aacf0d3e7d18586ba41ae7eac4a2b4df327");
assert.equal(zoningRemediationSuccessor3V11ConfirmationRunnerPublicKeySHA256,
  "7830127ce97437dcb85971faecfac4ad031288d4f98608837fa5c22aa2c64918");
assert.equal(zoningRemediationSuccessor3V11ConfirmationLockedAuthorizationSHA256,
  exactLockedAuthorizationSHA256);
assert.equal(zoningRemediationSuccessor3V11ConfirmationConsumedAuthorizationSHA256,
  exactConsumedAuthorizationSHA256);
assert.equal(zoningRemediationSuccessor3V11ConfirmationAuthorizationPackageCommit,
  exactAuthorizationPackageCommit);
assert.equal(zoningRemediationSuccessor3V11ConfirmationExecutionCommit,
  exactExecutionCommit);
assert.equal(zoningRemediationSuccessor3V11ConfirmationRunID, exactRunID);

const lockedAuthorizationBlob = spawnSync("git", [
  "show",
  `${exactAuthorizationPackageCommit}:permitext-sync-server/${authorizationRelativePath}`
], {
  cwd: serverRoot,
  encoding: "utf8",
  maxBuffer: 4 * 1024 * 1024
});
assert.equal(lockedAuthorizationBlob.status, 0,
  "The historical locked v11 authorization could not be read.");
const lockedAuthorizationText = lockedAuthorizationBlob.stdout;
assert.equal(sha256(lockedAuthorizationText), exactLockedAuthorizationSHA256);
const lockedAuthorization = JSON.parse(lockedAuthorizationText);

const consumedAuthorizationText = await readFile(authorizationPath, "utf8");
assert.equal(sha256(consumedAuthorizationText), exactConsumedAuthorizationSHA256);
const current =
  await validateZoningRemediationSuccessor3V11ConfirmationPaidAuthorization();
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
assert.equal(current.authorization.execution.executionCommit,
  exactExecutionCommit);
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
  () => requireActiveZoningRemediationSuccessor3V11ConfirmationPaidAuthorization(current),
  /requires a new explicit owner authorization and cumulative spend cap/
);

for (const [file, expectedHash] of [
  [zoningRemediationSuccessor3V11ConfirmationResultJSONFile,
    zoningRemediationSuccessor3V11ConfirmationResultJSONSHA256],
  [zoningRemediationSuccessor3V11ConfirmationResultMarkdownFile,
    zoningRemediationSuccessor3V11ConfirmationResultMarkdownSHA256]
]) {
  assert.equal(
    sha256(await readFile(new URL(`../evals/${file}`, import.meta.url), "utf8")),
    expectedHash,
    `The retained v11 result changed: ${file}`
  );
}

assert.equal(current.authorization.lineage.priorAuthorizationSHA256,
  zoningRemediationSuccessor3V9ConfirmationConsumedAuthorizationSHA256);
assert.equal(current.authorization.lineage.priorAuthorizationPackageCommit,
  zoningRemediationSuccessor3V9ConfirmationAuthorizationPackageCommit);
assert.equal(current.authorization.lineage.priorExecutionCommit,
  zoningRemediationSuccessor3V9ConfirmationExecutionCommit);
assert.equal(current.authorization.lineage.priorRunID,
  zoningRemediationSuccessor3V9ConfirmationRunID);
assert.equal(current.authorization.lineage.priorResultJSONFile,
  zoningRemediationSuccessor3V9ConfirmationResultJSONFile);
assert.equal(current.authorization.lineage.priorResultJSONSHA256,
  zoningRemediationSuccessor3V9ConfirmationResultJSONSHA256);
assert.equal(current.authorization.lineage.priorResultMarkdownFile,
  zoningRemediationSuccessor3V9ConfirmationResultMarkdownFile);
assert.equal(current.authorization.lineage.priorResultMarkdownSHA256,
  zoningRemediationSuccessor3V9ConfirmationResultMarkdownSHA256);

const runnerSource = await readFile(runnerPath, "utf8");
const trackedHandoff = spawnSync(
  "git",
  ["ls-files", "--error-unmatch", "--", handoffRelativePath],
  { cwd: serverRoot, stdio: "ignore" }
);
assert.equal(trackedHandoff.status, 0,
  "The signed v11 runner handoff must be tracked in the locked package.");
for (const requiredGuard of [
  "--remediation-3-v11-confirmation",
  ".zoning-successor-remediation-3-v11-confirmation-paid-run.lock",
  "validateZoningRemediationSuccessor3V11ConfirmationPaidAuthorization",
  "zoningRemediationSuccessor3V11ConfirmationLockedAuthorizationSHA256",
  "zoningRemediationSuccessor3V11ConfirmationPreparedFromCommit",
  "zoningRemediationSuccessor3V11ConfirmationSafetySHA256",
  "zoningRemediationSuccessor3V11ConfirmationEconomicsSHA256",
  "zoningRemediationSuccessor3V11ConfirmationAppSHA256",
  "zoningRemediationSuccessor3V11ConfirmationRunnerHandoffSHA256",
  handoffRelativePath,
  "assertPinnedV11RuntimeInputsAtCommit",
  "zoningRemediationSuccessor3V11PaidRunEnvironment",
  "NODE_ENV: \"production\"",
  "NODE_OPTIONS: \"\"",
  "PERMITEXT_SYNC_DATABASE_URL: \"\"",
  "PERMITEXT_TEST_RESEARCH_MAX_SUPPLEMENTAL_EVIDENCE_CHARACTERS: \"\"",
  "PERMITEXT_RESEARCH_MODEL_EVIDENCE_ANALYSIS: \"0\"",
  "PERMITEXT_RESEARCH_REASONING_EFFORT: \"medium\"",
  "respondToZoningV11RunnerChallenge",
  "assertExactLockedAuthorizationPackage",
  "Only the locked authorization record may change",
  "pendingPaidRequestCount",
  "webSupportRequested",
  "webSupportSearched",
  "--stop-on-execution-error",
  "PERMITEXT_RESEARCH_WEB_SUPPORT: \"off\"",
  "beginAuthorizationAttempt",
  "AggregateError"
]) {
  assert(runnerSource.includes(requiredGuard),
    `The v11 confirmation runner is missing guard: ${requiredGuard}`);
}
assert.match(runnerSource,
  /if \(runnerInvokedDirectly && !remediationSuccessor3V11ConfirmationMode\)[\s\S]{0,120}retiredPaidPathMessage/,
  "Every historical paid runner mode must remain retired.");

const evaluatorSource = await readFile(evaluatorPath, "utf8");
for (const requiredGuard of [
  "--zoning-successor-remediation-3-v11-confirmation",
  ".zoning-successor-remediation-3-v11-confirmation-paid-run.lock",
  "validateZoningRemediationSuccessor3V11ConfirmationPaidAuthorization",
  "zoningRemediationSuccessor3V11ConfirmationLockedAuthorizationSHA256",
  "zoningRemediationSuccessor3V11ConfirmationPreparedFromCommit",
  ".paid-evaluation-run.lock",
  "PERMITEXT_ZONING_PAID_RUNNER_NONCE",
  "Paid v11 confirmation requires the exact clean execution commit",
  "Only the durable running authorization may differ in the child",
  "globalRunnerLock?.nonce === runnerLock?.nonce",
  "globalRunnerLock?.executionCommit === runnerLock?.executionCommit",
  "server changes other than the authorization",
  "The paid v11 child must run with a non-test NODE_ENV",
  "PERMITEXT_TEST_RESEARCH_MAX_SUPPLEMENTAL_EVIDENCE_CHARACTERS",
  "requireAuthenticatedZoningV11RunnerHandoff",
  "PERMITEXT_RESEARCH_MODEL_EVIDENCE_ANALYSIS",
  "locked answer reasoning effort",
  "may not expose its runner authentication in the environment"
]) {
  assert(evaluatorSource.includes(requiredGuard),
    `The v11 confirmation evaluator is missing guard: ${requiredGuard}`);
}

const resultsBefore = (await readdir(resultsPath)).sort();
for (const args of [
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v11-confirmation", "--run-live"],
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v11-confirmation", "--run-live",
    "--repeat", "2"],
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v11-confirmation", "--run-live",
    "--case", "zr-rules-of-construction"],
  ["scripts/run-zoning-successor.mjs", "--remediation-3-v11-confirmation"]
]) {
  const blocked = spawnSync(process.execPath, args, {
    cwd: serverRoot,
    encoding: "utf8",
    env: paidEnvironment,
    maxBuffer: 20 * 1024 * 1024
  });
  assert.equal(blocked.status, 1, `${args.join(" ")} unexpectedly ran.`);
  assert.match(combinedOutput(blocked),
    /(?:authenticated runner IPC handoff|consuming runner and active run lock|requires a new explicit owner authorization and cumulative spend cap)/i);
}
for (const args of [
  ["scripts/run-zoning-successor.mjs",
    "--remediation-3-v11-confirmation", "--remediation-3-v11-confirmation"],
  ["scripts/run-zoning-successor.mjs", "--unknown-v11-confirmation"]
]) {
  const unsupported = spawnSync(process.execPath, args, {
    cwd: serverRoot,
    encoding: "utf8",
    env: paidEnvironment
  });
  assert.equal(unsupported.status, 1);
  assert.match(combinedOutput(unsupported),
    /unsupported Zoning successor paid-run argument/i);
}
for (const args of [
  ["scripts/run-zoning-successor.mjs"],
  ["scripts/run-zoning-successor.mjs", "--remediation-2"],
  ["scripts/run-zoning-successor.mjs", "--remediation-3"],
  ["scripts/run-zoning-successor.mjs", "--remediation-3-v8-confirmation"],
  ["scripts/run-zoning-successor.mjs", "--remediation-3-v9-confirmation"],
  ["tests/research-evals.mjs", "--zoning-successor", "--run-live"],
  ["tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v9-confirmation", "--run-live"]
]) {
  const retired = spawnSync(process.execPath, args, {
    cwd: serverRoot,
    encoding: "utf8",
    env: paidEnvironment,
    maxBuffer: 20 * 1024 * 1024
  });
  assert.equal(retired.status, 1, `${args.join(" ")} unexpectedly ran.`);
  assert.match(combinedOutput(retired),
    /historical Zoning successor paid runner modes are retired/i);
}
assert.deepEqual((await readdir(resultsPath)).sort(), resultsBefore,
  "A locked, malformed, or historical attempt created a result file.");

const exactHead = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: serverRoot,
  encoding: "utf8"
}).stdout.trim();
const forgedRunID = "11111111-1111-4111-8111-111111111111";
const forgedNonce = "22222222-2222-4222-8222-222222222222";
const forgedOwnerPhrase =
  `authorize exactly package commit ${exactHead} for all 30 ordered cases, one ` +
  "repetition, with a maximum cumulative API spend of $5.";
const forgedAuthorization = structuredClone(lockedAuthorization);
forgedAuthorization.status = "running";
forgedAuthorization.scope.caseCount = 30;
forgedAuthorization.scope.repetitions = 1;
forgedAuthorization.scope.maximumCumulativeSpendUSD = 5;
forgedAuthorization.ownerDecision.authorizedAt = "2026-08-31T20:00:00.000Z";
forgedAuthorization.ownerDecision.authorizedBy = "Permitext owner";
forgedAuthorization.ownerDecision.exactAuthorizationPhrase = forgedOwnerPhrase;
forgedAuthorization.ownerDecision.exactSpendingCapPhrase = forgedOwnerPhrase;
forgedAuthorization.consumption = {
  status: "running",
  attemptID: forgedRunID,
  startedAt: "2026-08-31T20:00:01.000Z",
  runID: null,
  consumedAt: null
};
forgedAuthorization.execution.authorizationPackageCommit = exactHead;
forgedAuthorization.execution.executionCommit = exactHead;
const forgedLock = `${JSON.stringify({
  pid: process.pid,
  runID: forgedRunID,
  nonce: forgedNonce,
  executionCommit: exactHead
})}\n`;
let globalLockCreated = false;
let cohortLockCreated = false;
try {
  await writeFile(globalRunLockPath, forgedLock, { encoding: "utf8", flag: "wx" });
  globalLockCreated = true;
  await writeFile(v11RunLockPath, forgedLock, { encoding: "utf8", flag: "wx" });
  cohortLockCreated = true;
  await writeFile(
    authorizationPath,
    `${JSON.stringify(forgedAuthorization, null, 2)}\n`,
    "utf8"
  );
  const forgedDirectAttempt = spawnSync(process.execPath, [
    "tests/research-evals.mjs",
    "--zoning-successor-remediation-3-v11-confirmation",
    "--run-live",
    "--repeat", "1",
    "--stop-on-execution-error",
    "--run-id", forgedRunID
  ], {
    cwd: serverRoot,
    encoding: "utf8",
    env: {
      ...hostileEnvironment,
      OPENAI_API_KEY: "forged-direct-attempt-must-not-dispatch",
      PERMITEXT_RUN_PAID_RESEARCH_EVALS: "1",
      PERMITEXT_ZONING_PAID_RUNNER_NONCE: forgedNonce
    },
    maxBuffer: 20 * 1024 * 1024
  });
  assert.equal(forgedDirectAttempt.status, 1,
    "A forged direct-evaluator parent unexpectedly dispatched.");
  assert.match(combinedOutput(forgedDirectAttempt),
    /authenticated runner IPC handoff/i);
} finally {
  await writeFile(authorizationPath, consumedAuthorizationText, "utf8");
  if (cohortLockCreated) await rm(v11RunLockPath, { force: true });
  if (globalLockCreated) await rm(globalRunLockPath, { force: true });
}
assert.equal(sha256(await readFile(authorizationPath, "utf8")),
  exactConsumedAuthorizationSHA256,
"The forged-lock regression did not restore the consumed authorization.");
assert.deepEqual((await readdir(resultsPath)).sort(), resultsBefore,
  "The forged-lock regression created a paid result file.");

const mockPreflight = spawnSync(process.execPath, [
  "tests/research-evals.mjs",
  "--zoning-successor-remediation-3-v11-confirmation"
], {
  cwd: serverRoot,
  encoding: "utf8",
  env: paidEnvironment,
  maxBuffer: 20 * 1024 * 1024
});
assert.equal(mockPreflight.status, 0, combinedOutput(mockPreflight));
assert.match(combinedOutput(mockPreflight), /30\/30/,
  "The no-cost v11 confirmation preflight did not cover the full frozen cohort.");
assert.deepEqual((await readdir(resultsPath)).sort(), resultsBefore,
  "The no-cost v11 confirmation preflight created a paid result file.");

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), "permitext-zoning-remediation-3-v11-confirmation-")
);
try {
  const fixturePath = join(temporaryDirectory, "authorization.json");
  const authorizedFixture = structuredClone(lockedAuthorization);
  authorizedFixture.status = "authorized";
  authorizedFixture.scope.caseCount = 30;
  authorizedFixture.scope.repetitions = 1;
  authorizedFixture.scope.maximumCumulativeSpendUSD = 5;
  authorizedFixture.ownerDecision.authorizedAt = "2026-08-31T20:00:00.000Z";
  authorizedFixture.ownerDecision.authorizedBy = "Permitext owner";
  const fixturePackageCommit = "1".repeat(40);
  const fixtureOwnerPhrase =
    `authorize exactly package commit ${fixturePackageCommit} for all 30 ordered ` +
    "cases, one repetition, with a maximum cumulative API spend of $5.";
  authorizedFixture.ownerDecision.exactAuthorizationPhrase =
    fixtureOwnerPhrase;
  authorizedFixture.ownerDecision.exactSpendingCapPhrase =
    fixtureOwnerPhrase;
  authorizedFixture.execution.authorizationPackageCommit = fixturePackageCommit;
  await writeFile(fixturePath, `${JSON.stringify(authorizedFixture, null, 2)}\n`, "utf8");
  const authorized =
    await validateZoningRemediationSuccessor3V11ConfirmationPaidAuthorization({
      authorizationPath: fixturePath
    });
  assert.equal(authorized.active, true);
  assert.equal(authorized.authorization.scope.caseCount, 30);
  assert.equal(authorized.authorization.scope.repetitions, 1);
  assert.equal(authorized.authorization.scope.maximumCumulativeSpendUSD, 5);

  for (const [label, mutate, expected] of [
    ["wrong safety SHA", (fixture) => {
      fixture.lineage.zoningSafetySHA256 = "0".repeat(64);
    }, /wrong Zoning safety SHA/],
    ["wrong prior authorization", (fixture) => {
      fixture.lineage.priorAuthorizationSHA256 = "0".repeat(64);
    }, /wrong historical v9 authorization SHA/],
    ["web enabled", (fixture) => {
      fixture.execution.webSupportEnabled = true;
    }, /may not enable unbudgeted web search/],
    ["candidate enabled", (fixture) => {
      fixture.evidenceBudgetCandidateEnabled = true;
    }, /24,000-character evidence candidate must remain disabled/],
    ["missing exact cap phrase", (fixture) => {
      fixture.ownerDecision.exactSpendingCapPhrase = null;
    }, /same exact package-bound spending-cap phrase/],
    ["mismatched phrase package", (fixture) => {
      fixture.ownerDecision.exactAuthorizationPhrase =
        fixture.ownerDecision.exactAuthorizationPhrase.replace("1".repeat(40), "2".repeat(40));
    }, /bind the owner's exact phrase to the selected package and scope/],
    ["mismatched phrase scope", (fixture) => {
      fixture.ownerDecision.exactAuthorizationPhrase =
        fixture.ownerDecision.exactAuthorizationPhrase.replace("all 30", "all 29");
    }, /bind the owner's exact phrase to the selected package and scope/],
    ["mismatched structured cap", (fixture) => {
      fixture.scope.maximumCumulativeSpendUSD = 4;
    }, /exact 30-case, one-repetition, \$5 scope/]
  ]) {
    const fixture = structuredClone(authorizedFixture);
    mutate(fixture);
    await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
    await assert.rejects(
      validateZoningRemediationSuccessor3V11ConfirmationPaidAuthorization({
        authorizationPath: fixturePath
      }),
      expected,
      label
    );
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

assert.deepEqual((await readdir(resultsPath)).sort(), resultsBefore,
  "The v11 authorization contract created a paid result file.");
console.log(
  "Consumed Zoning remediation-successor-3 v11 confirmation authorization contract passed for 30 ordered cases. No paid model calls were made."
);
