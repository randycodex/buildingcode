import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { open, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  requireActiveZoningSuccessorPaidAuthorization,
  validateZoningSuccessorPaidAuthorization
} from "../evals/zoning-successor-paid-authorization.mjs";
import {
  requireActiveZoningRemediationSuccessor2PaidAuthorization,
  validateZoningRemediationSuccessor2PaidAuthorization
} from "../evals/zoning-successor-remediation-2-paid-authorization.mjs";
import {
  requireActiveZoningRemediationSuccessor3PaidAuthorization,
  validateZoningRemediationSuccessor3PaidAuthorization
} from "../evals/zoning-successor-remediation-3-paid-authorization.mjs";
import {
  zoningRemediationSuccessor3V8ConfirmationLockedAuthorizationSHA256,
  zoningRemediationSuccessor3V8ConfirmationPreparedFromCommit,
  zoningRemediationSuccessor3V8ConfirmationSafetySHA256
} from "../evals/zoning-successor-remediation-3-v8-confirmation-paid-authorization.mjs";
import {
  requireActiveZoningRemediationSuccessor3V9ConfirmationPaidAuthorization,
  validateZoningRemediationSuccessor3V9ConfirmationPaidAuthorization,
  zoningRemediationSuccessor3V9ConfirmationAppSHA256,
  zoningRemediationSuccessor3V9ConfirmationEconomicsSHA256,
  zoningRemediationSuccessor3V9ConfirmationLockedAuthorizationSHA256,
  zoningRemediationSuccessor3V9ConfirmationPreparedFromCommit,
  zoningRemediationSuccessor3V9ConfirmationSafetySHA256
} from "../evals/zoning-successor-remediation-3-v9-confirmation-paid-authorization.mjs";
import {
  requireActiveZoningRemediationSuccessor3V11ConfirmationPaidAuthorization,
  validateZoningRemediationSuccessor3V11ConfirmationPaidAuthorization,
  zoningRemediationSuccessor3V11ConfirmationAppSHA256,
  zoningRemediationSuccessor3V11ConfirmationEconomicsSHA256,
  zoningRemediationSuccessor3V11ConfirmationLockedAuthorizationSHA256,
  zoningRemediationSuccessor3V11ConfirmationPreparedFromCommit,
  zoningRemediationSuccessor3V11ConfirmationRunnerHandoffSHA256,
  zoningRemediationSuccessor3V11ConfirmationSafetySHA256
} from "../evals/zoning-successor-remediation-3-v11-confirmation-paid-authorization.mjs";
import {
  requireActiveZoningRemediationSuccessor3V12ConfirmationPaidAuthorization,
  validateZoningRemediationSuccessor3V12ConfirmationPaidAuthorization,
  zoningRemediationSuccessor3V12ConfirmationAppSHA256,
  zoningRemediationSuccessor3V12ConfirmationEconomicsSHA256,
  zoningRemediationSuccessor3V12ConfirmationLockedAuthorizationSHA256,
  zoningRemediationSuccessor3V12ConfirmationPreparedFromCommit,
  zoningRemediationSuccessor3V12ConfirmationRunnerHandoffSHA256,
  zoningRemediationSuccessor3V12ConfirmationSafetySHA256
} from "../evals/zoning-successor-remediation-3-v12-confirmation-paid-authorization.mjs";
import {
  respondToZoningV11RunnerChallenge,
  zoningV11RunnerPrivateKey
} from "../evals/zoning-v11-paid-runner-handoff.mjs";
import {
  researchCommercializationBenchmark,
  researchCommercializationBenchmarkEnvironment
} from "./run-research-commercialization-benchmark.mjs";
import {
  supportedResearchPromptVersions,
  validatePaidResearchEvaluationEnvironment
} from "../research-config.mjs";

const serverRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repositoryRoot = resolve(serverRoot, "..");
const resultsDirectory = resolve(serverRoot, "evals", "results");
const globalRunLockPath = resolve(serverRoot, "evals", ".paid-evaluation-run.lock");
const runnerInvokedDirectly = Boolean(
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
);
const runnerArguments = process.argv.slice(2);
assert(
  !runnerInvokedDirectly || runnerArguments.length <= 1 &&
    runnerArguments.every((argument) =>
      [
        "--remediation-2",
        "--remediation-3",
        "--remediation-3-v8-confirmation",
        "--remediation-3-v9-confirmation",
        "--remediation-3-v11-confirmation",
        "--remediation-3-v12-confirmation"
      ].includes(argument)),
  "Unsupported Zoning successor paid-run argument."
);
const remediationSuccessor2Mode = process.argv.includes("--remediation-2");
const remediationSuccessor3Mode = process.argv.includes("--remediation-3");
const remediationSuccessor3V8ConfirmationMode =
  process.argv.includes("--remediation-3-v8-confirmation");
const remediationSuccessor3V9ConfirmationMode =
  process.argv.includes("--remediation-3-v9-confirmation");
const remediationSuccessor3V11ConfirmationMode =
  process.argv.includes("--remediation-3-v11-confirmation");
const remediationSuccessor3V12ConfirmationMode =
  process.argv.includes("--remediation-3-v12-confirmation");
const remediationSuccessor3AuthenticatedConfirmationMode =
  remediationSuccessor3V11ConfirmationMode ||
  remediationSuccessor3V12ConfirmationMode;
const retiredPaidPathMessage =
  "Historical Zoning successor paid runner modes are retired. Each must run through " +
  "its consuming runner and active run lock, and each now requires a new explicit owner " +
  "authorization and cumulative spend cap in a new distinct package; this historical " +
  "path cannot dispatch.";
if (runnerInvokedDirectly && !remediationSuccessor3AuthenticatedConfirmationMode) {
  throw new Error(retiredPaidPathMessage);
}
const remediationSuccessor3FamilyMode = remediationSuccessor3Mode ||
  remediationSuccessor3V8ConfirmationMode || remediationSuccessor3V9ConfirmationMode ||
  remediationSuccessor3AuthenticatedConfirmationMode;
const authenticatedConfirmation = remediationSuccessor3V12ConfirmationMode
  ? {
      version: "v12",
      validate:
        validateZoningRemediationSuccessor3V12ConfirmationPaidAuthorization,
      requireActive:
        requireActiveZoningRemediationSuccessor3V12ConfirmationPaidAuthorization,
      appSHA256: zoningRemediationSuccessor3V12ConfirmationAppSHA256,
      economicsSHA256:
        zoningRemediationSuccessor3V12ConfirmationEconomicsSHA256,
      lockedAuthorizationSHA256:
        zoningRemediationSuccessor3V12ConfirmationLockedAuthorizationSHA256,
      preparedFromCommit:
        zoningRemediationSuccessor3V12ConfirmationPreparedFromCommit,
      runnerHandoffSHA256:
        zoningRemediationSuccessor3V12ConfirmationRunnerHandoffSHA256,
      safetySHA256: zoningRemediationSuccessor3V12ConfirmationSafetySHA256
    }
  : {
      version: "v11",
      validate:
        validateZoningRemediationSuccessor3V11ConfirmationPaidAuthorization,
      requireActive:
        requireActiveZoningRemediationSuccessor3V11ConfirmationPaidAuthorization,
      appSHA256: zoningRemediationSuccessor3V11ConfirmationAppSHA256,
      economicsSHA256:
        zoningRemediationSuccessor3V11ConfirmationEconomicsSHA256,
      lockedAuthorizationSHA256:
        zoningRemediationSuccessor3V11ConfirmationLockedAuthorizationSHA256,
      preparedFromCommit:
        zoningRemediationSuccessor3V11ConfirmationPreparedFromCommit,
      runnerHandoffSHA256:
        zoningRemediationSuccessor3V11ConfirmationRunnerHandoffSHA256,
      safetySHA256: zoningRemediationSuccessor3V11ConfirmationSafetySHA256
    };
const authorizationPath = resolve(
  serverRoot,
  "evals",
  remediationSuccessor3V12ConfirmationMode
    ? "zoning-successor-remediation-3-v12-confirmation-paid-authorization.json"
    : remediationSuccessor3V11ConfirmationMode
    ? "zoning-successor-remediation-3-v11-confirmation-paid-authorization.json"
    : remediationSuccessor3V9ConfirmationMode
    ? "zoning-successor-remediation-3-v9-confirmation-paid-authorization.json"
    : remediationSuccessor3V8ConfirmationMode
    ? "zoning-successor-remediation-3-v8-confirmation-paid-authorization.json"
    : remediationSuccessor3Mode
    ? "zoning-successor-remediation-3-paid-authorization.json"
    : remediationSuccessor2Mode
    ? "zoning-successor-remediation-2-paid-authorization.json"
    : "zoning-successor-paid-authorization.json"
);
const authorizationModulePath = resolve(
  serverRoot,
  "evals",
  remediationSuccessor3V12ConfirmationMode
    ? "zoning-successor-remediation-3-v12-confirmation-paid-authorization.mjs"
    : remediationSuccessor3V11ConfirmationMode
    ? "zoning-successor-remediation-3-v11-confirmation-paid-authorization.mjs"
    : remediationSuccessor3V9ConfirmationMode
    ? "zoning-successor-remediation-3-v9-confirmation-paid-authorization.mjs"
    : remediationSuccessor3V8ConfirmationMode
    ? "zoning-successor-remediation-3-v8-confirmation-paid-authorization.mjs"
    : remediationSuccessor3Mode
    ? "zoning-successor-remediation-3-paid-authorization.mjs"
    : remediationSuccessor2Mode
    ? "zoning-successor-remediation-2-paid-authorization.mjs"
    : "zoning-successor-paid-authorization.mjs"
);
const runLockPath = resolve(
  serverRoot,
  "evals",
  remediationSuccessor3V12ConfirmationMode
    ? ".zoning-successor-remediation-3-v12-confirmation-paid-run.lock"
    : remediationSuccessor3V11ConfirmationMode
    ? ".zoning-successor-remediation-3-v11-confirmation-paid-run.lock"
    : remediationSuccessor3V9ConfirmationMode
    ? ".zoning-successor-remediation-3-v9-confirmation-paid-run.lock"
    : remediationSuccessor3V8ConfirmationMode
    ? ".zoning-successor-remediation-3-v8-confirmation-paid-run.lock"
    : remediationSuccessor3Mode
    ? ".zoning-successor-remediation-3-paid-run.lock"
    : remediationSuccessor2Mode
    ? ".zoning-successor-remediation-2-paid-run.lock"
    : ".zoning-successor-paid-run.lock"
);

async function acquireRunLock(lockPath, label, evidence) {
  let handle;
  try {
    handle = await open(lockPath, "wx");
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(
        `A ${label} paid run is already active or its fail-closed lock requires review.`
      );
    }
    throw error;
  }
  const serializedEvidence = `${JSON.stringify(evidence)}\n`;
  await handle.writeFile(serializedEvidence, "utf8");
  const acquiredIdentity = await handle.stat();
  return async () => {
    const currentIdentity = await stat(lockPath);
    const currentEvidence = await readFile(lockPath, "utf8");
    assert.equal(currentIdentity.dev, acquiredIdentity.dev,
      `The ${label} lock device changed; the runner will not remove it.`);
    assert.equal(currentIdentity.ino, acquiredIdentity.ino,
      `The ${label} lock instance changed; the runner will not remove it.`);
    assert.equal(currentEvidence, serializedEvidence,
      `The ${label} lock evidence changed; the runner will not remove it.`);
    await rm(lockPath);
    await handle.close();
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function gitOutput(arguments_, message) {
  const result = spawnSync("git", arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024
  });
  assert.equal(result.status, 0, message);
  return result.stdout;
}

function changedServerFiles(arguments_) {
  return gitOutput(arguments_, "Could not verify committed Zoning execution inputs.")
    .trim()
    .split("\n")
    .filter(Boolean);
}

function assertPinnedAuthenticatedRuntimeInputsAtCommit(
  commit,
  label,
  { includeRunnerHandoff = false } = {}
) {
  const inputs = [
    ["permitext-sync-server/research-zoning-safety.mjs",
      authenticatedConfirmation.safetySHA256, "Zoning safety"],
    ["permitext-sync-server/research-economics.mjs",
      authenticatedConfirmation.economicsSHA256,
      "Research economics"],
    ["permitext-sync-server/app.mjs",
      authenticatedConfirmation.appSHA256, "application"]
  ];
  if (includeRunnerHandoff) {
    inputs.push([
      "permitext-sync-server/evals/zoning-v11-paid-runner-handoff.mjs",
      authenticatedConfirmation.runnerHandoffSHA256,
      "signed runner handoff"
    ]);
  }
  for (const [path, expectedHash, inputLabel] of inputs) {
    const reviewedText = gitOutput(
      ["show", `${commit}:${path}`],
      `Could not read the ${label} ${authenticatedConfirmation.version} ${inputLabel} bytes.`
    );
    assert.equal(
      sha256(reviewedText),
      expectedHash,
      `The ${label} commit does not contain the pinned ${authenticatedConfirmation.version} ${inputLabel} bytes.`
    );
  }
}

async function assertAuthenticatedExecutionInputs({
  expectedStatus,
  executionCommit = null
}) {
  const expectedChanges = expectedStatus === "running"
    ? [relative(repositoryRoot, authorizationPath)]
    : [];
  assert.deepEqual(
    changedServerFiles(["diff", "--name-only", "--", "permitext-sync-server"]),
    expectedChanges,
    expectedStatus === "running"
      ? "Only the durable running authorization may differ immediately before provider dispatch."
      : `The authorized ${authenticatedConfirmation.version} confirmation execution inputs must be clean.`
  );
  assert.deepEqual(
    changedServerFiles(["diff", "--cached", "--name-only", "--", "permitext-sync-server"]),
    [],
    "No staged server change may exist immediately before provider dispatch."
  );
  const validation = await authenticatedConfirmation.validate();
  assert.equal(validation.authorization.status, expectedStatus,
    `The ${authenticatedConfirmation.version} confirmation authorization must be ${expectedStatus} at this checkpoint.`);
  if (expectedStatus === "running") {
    assert.equal(validation.authorization.execution.executionCommit, executionCommit,
      `The running ${authenticatedConfirmation.version} confirmation authorization changed before provider dispatch.`);
  }
  return validation;
}

function assertExactLockedAuthorizationPackage(authorizationPackageCommit) {
  const authorizationRelativePath = relative(repositoryRoot, authorizationPath);
  const lockedAuthorizationText = gitOutput(
    ["show", `${authorizationPackageCommit}:${authorizationRelativePath}`],
    "Could not read the locked authorization record from the authorized package commit."
  );
  assert.equal(
    sha256(lockedAuthorizationText),
    authenticatedConfirmation.lockedAuthorizationSHA256,
    "The authorized package commit does not contain the exact reviewed locked authorization record."
  );
  const lockedAuthorization = JSON.parse(lockedAuthorizationText);
  assert.equal(lockedAuthorization.status, "locked",
    "The authorized package commit did not preserve the locked package state.");
  assert.deepEqual(
    {
      caseCount: lockedAuthorization.scope?.caseCount,
      repetitions: lockedAuthorization.scope?.repetitions,
      maximumCumulativeSpendUSD:
        lockedAuthorization.scope?.maximumCumulativeSpendUSD,
      authorizedAt: lockedAuthorization.ownerDecision?.authorizedAt,
      authorizedBy: lockedAuthorization.ownerDecision?.authorizedBy,
      exactAuthorizationPhrase:
        lockedAuthorization.ownerDecision?.exactAuthorizationPhrase,
      exactSpendingCapPhrase:
        lockedAuthorization.ownerDecision?.exactSpendingCapPhrase,
      authorizationPackageCommit:
        lockedAuthorization.execution?.authorizationPackageCommit,
      executionCommit: lockedAuthorization.execution?.executionCommit
    },
    {
      caseCount: null,
      repetitions: null,
      maximumCumulativeSpendUSD: null,
      authorizedAt: null,
      authorizedBy: null,
      exactAuthorizationPhrase: null,
      exactSpendingCapPhrase: null,
      authorizationPackageCommit: null,
      executionCommit: null
    },
    "The authorized package commit contains authorizing values instead of the reviewed locked record."
  );
}

async function writeAuthorizationAtomically(authorization) {
  const temporaryPath = `${authorizationPath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify(authorization, null, 2)}\n`, "utf8");
  await rename(temporaryPath, authorizationPath);
}

async function beginAuthorizationAttempt(runID, executionCommit = null) {
  const authorization = JSON.parse(await readFile(authorizationPath, "utf8"));
  assert.equal(authorization.status, "authorized",
    "The one-time authorization was not active before provider dispatch.");
  authorization.status = "running";
  authorization.consumption = {
    status: "running",
    attemptID: runID,
    startedAt: new Date().toISOString(),
    runID: null,
    consumedAt: null
  };
  if (remediationSuccessor3AuthenticatedConfirmationMode) {
    authorization.execution.executionCommit = executionCommit;
  }
  authorization.notes =
    `One-time authorization entered fail-closed running state for attempt ${runID}. ` +
    "A crash or missing result requires manual review and may not be retried automatically.";
  await writeAuthorizationAtomically(authorization);
  return authorization;
}

async function consumeAuthorization({
  runID,
  cohort,
  cohortSHA256,
  executionCommit = null
}) {
  const resultNames = (await readdir(resultsDirectory))
    .filter((name) => name.endsWith(`-${runID}.json`));
  assert.equal(resultNames.length, 1,
    "The paid run did not produce exactly one result bound to its durable attempt ID; authorization remains fail-closed for manual review.");
  const resultFile = resolve(resultsDirectory, resultNames[0]);
  const result = JSON.parse(await readFile(resultFile, "utf8"));
  const authorization = JSON.parse(await readFile(authorizationPath, "utf8"));
  assert.equal(result.configuration?.runID, runID,
    "The new result is not bound to the pre-dispatch attempt ID.");
  assert.equal(result.configuration?.datasetSHA256, cohortSHA256,
    "The new result is not bound to the authorized successor SHA.");
  assert.equal(result.configuration?.repeat, 1,
    "The new result does not record the authorized one repetition.");
  assert.deepEqual(result.configuration?.caseIDs, cohort.cases.map((item) => item.id),
    "The new result does not contain the exact authorized case order.");
  assert.match(result.configuration?.runID || "", /^[0-9a-f-]{36}$/i,
    "The new result has no valid run ID.");
  if (remediationSuccessor3AuthenticatedConfirmationMode) {
    assert(["completed", "partial"].includes(result.status),
      `The ${authenticatedConfirmation.version} confirmation result is not a completed or paid partial terminal snapshot.`);
    assert(Array.isArray(result.results) && result.results.length > 0,
      `The ${authenticatedConfirmation.version} confirmation result contains no completed paid case operation.`);
    assert(Number.isInteger(result.configuration?.paidRequestCount) &&
      result.configuration.paidRequestCount > 0,
    `The ${authenticatedConfirmation.version} confirmation result records no paid provider request.`);
    assert.equal(result.configuration?.gitCommit, executionCommit,
      `The ${authenticatedConfirmation.version} confirmation result is not bound to the clean execution commit.`);
    assert.equal(
      result.configuration?.approvedSpendCapUSD,
      authorization.scope.maximumCumulativeSpendUSD,
      `The ${authenticatedConfirmation.version} confirmation result does not retain its authorized spend cap.`
    );
    assert(Number.isFinite(result.configuration?.conservativeReservedUSD) &&
      result.configuration.conservativeReservedUSD <=
        result.configuration.approvedSpendCapUSD,
    `The ${authenticatedConfirmation.version} confirmation result exceeded its conservative spend reservation cap.`);
    assert(Number.isFinite(result.configuration?.actualUSD) &&
      result.configuration.actualUSD <= result.configuration.approvedSpendCapUSD,
    `The ${authenticatedConfirmation.version} confirmation result exceeded its actual spend cap.`);
    assert.equal(result.configuration?.pendingPaidRequestCount, 0,
      `The ${authenticatedConfirmation.version} confirmation result retained unresolved paid requests.`);
    const observedCaseIDs = result.results.map((item) => item.testCase?.id);
    assert.equal(new Set(observedCaseIDs).size, observedCaseIDs.length,
      `The ${authenticatedConfirmation.version} confirmation result contains a duplicate case operation.`);
    assert.deepEqual(
      observedCaseIDs,
      cohort.cases.slice(0, observedCaseIDs.length).map((item) => item.id),
      `The ${authenticatedConfirmation.version} confirmation result operations are not an ordered cohort prefix.`
    );
    for (const item of result.results) {
      assert.equal(item.operationMetric?.webSupportRequested, false,
        `A ${authenticatedConfirmation.version} confirmation operation requested unbudgeted web support.`);
      assert.equal(item.operationMetric?.webSupportSearched, false,
        `A ${authenticatedConfirmation.version} confirmation operation used unbudgeted web support.`);
    }
  }
  if (remediationSuccessor3FamilyMode) {
    assert.equal(result.configuration?.webSupportEnabled, false,
      "The capped remediation-successor-3 result unexpectedly enabled unbudgeted web-search fees.");
    assert.equal(result.configuration?.stopOnExecutionError, true,
      "The remediation-successor-3 result did not retain its fail-fast execution policy.");
  }

  assert.equal(authorization.status, "running",
    "The one-time authorization was not in its fail-closed running state when the run completed.");
  assert.equal(authorization.consumption?.attemptID, runID,
    "The running authorization does not match the completed attempt.");
  authorization.status = "consumed";
  authorization.consumption = {
    ...authorization.consumption,
    status: "consumed",
    runID: result.configuration.runID,
    consumedAt: new Date().toISOString()
  };
  authorization.notes =
    `One-time authorization consumed by ${resultNames[0]}. ` +
    "The result still requires quality, cost, and release-gate review.";
  await writeAuthorizationAtomically(authorization);
  return { resultFile, result };
}

function runEvaluation({
  environment,
  repetitions,
  runID,
  executionCommit,
  v11RunnerPrivateKey
}) {
  return new Promise((resolveRun, rejectRun) => {
    const childArguments = [
      "tests/research-evals.mjs",
      remediationSuccessor3V12ConfirmationMode
        ? "--zoning-successor-remediation-3-v12-confirmation"
        : remediationSuccessor3V11ConfirmationMode
        ? "--zoning-successor-remediation-3-v11-confirmation"
        : remediationSuccessor3Mode
        ? "--zoning-successor-remediation-3"
        : remediationSuccessor2Mode
        ? "--zoning-successor-remediation-2"
        : "--zoning-successor",
      "--run-live",
      "--repeat",
      String(repetitions),
      "--run-id",
      runID,
      ...(remediationSuccessor3FamilyMode ? ["--stop-on-execution-error"] : [])
    ];
    const child = spawn(process.execPath, childArguments, {
      cwd: serverRoot,
      env: environment,
      stdio: remediationSuccessor3AuthenticatedConfirmationMode
        ? ["inherit", "inherit", "inherit", "ipc"]
        : "inherit"
    });
    if (remediationSuccessor3AuthenticatedConfirmationMode) {
      child.once("message", (message) => {
        try {
          const response = respondToZoningV11RunnerChallenge({
            message,
            childPID: child.pid,
            runID,
            executionCommit,
            privateKey: v11RunnerPrivateKey
          });
          child.send(response, (error) => {
            if (!error) return;
            child.kill();
            rejectRun(error);
          });
        } catch (error) {
          child.kill();
          rejectRun(error);
        }
      });
    }
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => resolveRun({ code, signal }));
  });
}

export function zoningRemediationSuccessor3V11PaidRunEnvironment(
  sourceEnvironment,
  maximumCumulativeSpendUSD
) {
  return {
    ...researchCommercializationBenchmarkEnvironment(sourceEnvironment),
    NODE_ENV: "production",
    NODE_OPTIONS: "",
    NODE_PATH: "",
    NODE_EXTRA_CA_CERTS: "",
    NODE_USE_ENV_PROXY: "0",
    NODE_TLS_REJECT_UNAUTHORIZED: "1",
    HTTP_PROXY: "",
    HTTPS_PROXY: "",
    ALL_PROXY: "",
    NO_PROXY: "",
    PERMITEXT_SYNC_DATABASE_URL: "",
    DATABASE_URL: "",
    STORAGE_URL: "",
    POSTGRES_URL: "",
    NEON_DATABASE_URL: "",
    VERCEL: "",
    VERCEL_ENV: "",
    PERMITEXT_TEST_RESEARCH_MOCK: "",
    PERMITEXT_TEST_RESEARCH_MOCK_WEB_FIXTURE: "",
    PERMITEXT_TEST_RESEARCH_MOCK_DELAY_MS: "",
    PERMITEXT_TEST_RESEARCH_MAX_SUPPLEMENTAL_EVIDENCE_CHARACTERS: "",
    PERMITEXT_TEST_RESEARCH_EVIDENCE_PACKAGE_ONLY: "",
    PERMITEXT_ZONING_PAID_RUNNER_NONCE: "",
    PERMITEXT_RESEARCH_MODEL_EVIDENCE_ANALYSIS: "0",
    PERMITEXT_RESEARCH_REASONING_EFFORT: "medium",
    PERMITEXT_RESEARCH_EVAL_MAX_USD: String(maximumCumulativeSpendUSD),
    PERMITEXT_RESEARCH_PROMPT_VERSION: supportedResearchPromptVersions[0],
    PERMITEXT_RESEARCH_PRICING_VERSION: "openai-gpt-5.6-terra-2026-08-30",
    PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "openai-gpt-5.6-luna-2026-08-30",
    PERMITEXT_RESEARCH_EVAL_JUDGE_MODEL:
      researchCommercializationBenchmark.accurateModel,
    PERMITEXT_RESEARCH_EVAL_JUDGE_REASONING_EFFORT: "medium",
    PERMITEXT_RESEARCH_EVAL_JUDGE_PROMPT_VERSION:
      "20260826-established-facts-v3",
    PERMITEXT_RESEARCH_WEB_SUPPORT: "off"
  };
}

async function main() {
  const validation = remediationSuccessor3AuthenticatedConfirmationMode
    ? authenticatedConfirmation.requireActive(
        await authenticatedConfirmation.validate()
      )
    : remediationSuccessor3Mode
    ? requireActiveZoningRemediationSuccessor3PaidAuthorization(
        await validateZoningRemediationSuccessor3PaidAuthorization()
      )
    : remediationSuccessor2Mode
    ? requireActiveZoningRemediationSuccessor2PaidAuthorization(
        await validateZoningRemediationSuccessor2PaidAuthorization()
      )
    : requireActiveZoningSuccessorPaidAuthorization(
        await validateZoningSuccessorPaidAuthorization()
      );
  const { authorization, cohort } = validation;
  assert.equal(cohort.cases.length, authorization.scope.caseCount,
    "Frozen successor case count does not match the authorization.");
  assert(process.env.OPENAI_API_KEY,
    "Set OPENAI_API_KEY before running the paid Zoning successor diagnostic.");

  const requiredTrackedPaths = [
    resolve(serverRoot, "scripts", "run-zoning-successor.mjs"),
    resolve(serverRoot, "tests", "research-evals.mjs"),
    resolve(serverRoot, "evals", "zoning-successor-paid-authorization.mjs"),
    authorizationModulePath,
    authorizationPath,
    resolve(serverRoot, "evals", "zoning-v11-paid-runner-handoff.mjs"),
    validation.cohortPath
  ].map((path) => relative(repositoryRoot, path));
  const trackedStatus = spawnSync(
    "git",
    ["ls-files", "--error-unmatch", "--", ...requiredTrackedPaths],
    { cwd: repositoryRoot, stdio: "ignore" }
  );
  assert.equal(trackedStatus.status, 0,
    "Every paid-run input, authorization, and guard must be tracked at HEAD before dispatch.");

  for (const args of [
    ["diff", "--quiet", "--", "permitext-sync-server"],
    ["diff", "--cached", "--quiet", "--", "permitext-sync-server"]
  ]) {
    const status = spawnSync("git", args, {
      cwd: repositoryRoot,
      stdio: "ignore"
    });
    assert.equal(status.status, 0,
      "Commit tracked server changes before running the Zoning successor diagnostic.");
  }

  let executionCommit = null;
  let v11RunnerPrivateKey = null;
  if (remediationSuccessor3AuthenticatedConfirmationMode) {
    const authorizationPackageCommit =
      authorization.execution.authorizationPackageCommit;
    const repairAncestry = spawnSync(
      "git",
      [
        "merge-base",
        "--is-ancestor",
        authenticatedConfirmation.preparedFromCommit,
        authorizationPackageCommit
      ],
      { cwd: repositoryRoot, stdio: "ignore" }
    );
    assert.equal(repairAncestry.status, 0,
      `The independently reviewed ${authenticatedConfirmation.version} repair is not an ancestor of the authorized package commit.`);
    assertPinnedAuthenticatedRuntimeInputsAtCommit(
      authenticatedConfirmation.preparedFromCommit,
      "reviewed repair"
    );
    assertExactLockedAuthorizationPackage(authorizationPackageCommit);
    assertPinnedAuthenticatedRuntimeInputsAtCommit(
      authorizationPackageCommit,
      "owner-selected package",
      { includeRunnerHandoff: true }
    );
    const ancestry = spawnSync(
      "git",
      ["merge-base", "--is-ancestor", authorizationPackageCommit, "HEAD"],
      { cwd: repositoryRoot, stdio: "ignore" }
    );
    assert.equal(ancestry.status, 0,
      `The authorized ${authenticatedConfirmation.version} confirmation package commit is not an ancestor of HEAD.`);
    const changedServerFiles = spawnSync(
      "git",
      [
        "diff",
        "--name-only",
        `${authorizationPackageCommit}..HEAD`,
        "--",
        "permitext-sync-server"
      ],
      { cwd: repositoryRoot, encoding: "utf8" }
    );
    assert.equal(changedServerFiles.status, 0,
      `Could not verify the exact authorized ${authenticatedConfirmation.version} confirmation package.`);
    assert.deepEqual(
      changedServerFiles.stdout.trim().split("\n").filter(Boolean),
      [relative(repositoryRoot, authorizationPath)],
      `Only the locked authorization record may change after the exact ${authenticatedConfirmation.version} confirmation package commit.`
    );
    const executionHead = spawnSync(
      "git",
      ["rev-parse", "HEAD"],
      { cwd: repositoryRoot, encoding: "utf8" }
    );
    assert.equal(executionHead.status, 0,
      `Could not resolve the clean ${authenticatedConfirmation.version} confirmation execution commit.`);
    executionCommit = executionHead.stdout.trim();
    assert.match(executionCommit, /^[0-9a-f]{40}$/i,
      `The clean ${authenticatedConfirmation.version} confirmation execution commit is invalid.`);
    await assertAuthenticatedExecutionInputs({ expectedStatus: "authorized" });
    const commonGitDirectory = gitOutput(
      ["rev-parse", "--git-common-dir"],
      "Could not resolve the common Git directory for the local v11 runner handoff key."
    ).trim();
    const resolvedRunnerPrivateKeyPath = resolve(
      repositoryRoot,
      commonGitDirectory,
      "permitext-zoning-v11-runner-ed25519.pem"
    );
    const runnerPrivateKeyStat = await stat(resolvedRunnerPrivateKeyPath);
    assert.equal(runnerPrivateKeyStat.mode & 0o077, 0,
      "The local v11 runner handoff key must be accessible only to its owner.");
    v11RunnerPrivateKey = zoningV11RunnerPrivateKey(
      await readFile(resolvedRunnerPrivateKeyPath, "utf8")
    );
  }

  const environment = zoningRemediationSuccessor3V11PaidRunEnvironment(
    process.env,
    authorization.scope.maximumCumulativeSpendUSD
  );
  const paidEnvironment = validatePaidResearchEvaluationEnvironment(environment);
  assert.equal(
    paidEnvironment.approvedSpendCapUSD,
    authorization.scope.maximumCumulativeSpendUSD
  );
  const runID = randomUUID();
  const runnerNonce = randomUUID();
  if (!remediationSuccessor3AuthenticatedConfirmationMode) {
    environment.PERMITEXT_ZONING_PAID_RUNNER_NONCE = runnerNonce;
  }
  const lockEvidence = {
    pid: process.pid,
    runID,
    nonce: runnerNonce,
    executionCommit
  };
  const releaseGlobalRunLock = await acquireRunLock(
    globalRunLockPath,
    "global Permitext evaluation",
    lockEvidence
  );
  let releaseRunLock;
  let result;
  let consumed;
  try {
    releaseRunLock = await acquireRunLock(
      runLockPath,
      "Zoning successor",
      lockEvidence
    );
    await beginAuthorizationAttempt(runID, executionCommit);
    console.log(
      `Running the exact frozen ${cohort.cases.length}-case owner-approved Zoning ` +
      `${remediationSuccessor3AuthenticatedConfirmationMode
        ? `remediation successor 3 ${authenticatedConfirmation.version} confirmation`
        : remediationSuccessor3Mode ? "remediation successor 3"
        : remediationSuccessor2Mode ? "remediation successor 2" : "successor"} ` +
      `once with a $${paidEnvironment.approvedSpendCapUSD.toFixed(2)} maximum cumulative cap. ` +
      "The 24,000-character candidate remains disabled."
    );
    await assertAuthenticatedExecutionInputs({
      expectedStatus: "running",
      executionCommit
    });
    result = await runEvaluation({
      environment,
      repetitions: authorization.scope.repetitions,
      runID,
      executionCommit,
      v11RunnerPrivateKey
    });
    if (result.signal) {
      throw new Error(`Zoning successor diagnostic stopped by ${result.signal}.`);
    }
    if (![0, 3].includes(result.code)) {
      throw new Error(`Zoning successor diagnostic exited with status ${result.code}.`);
    }
    consumed = await consumeAuthorization({
      runID,
      cohort,
      cohortSHA256: authorization.cohort.sha256,
      executionCommit
    });
    console.log(
      `Consumed the one-time authorization for run ${consumed.result.configuration.runID}.`
    );
  } finally {
    const releaseErrors = [];
    if (releaseRunLock) {
      try {
        await releaseRunLock();
      } catch (error) {
        releaseErrors.push(error);
      }
    }
    try {
      await releaseGlobalRunLock();
    } catch (error) {
      releaseErrors.push(error);
    }
    if (releaseErrors.length) {
      throw new AggregateError(
        releaseErrors,
        "One or more paid-run locks changed and were retained for manual review."
      );
    }
  }
  if (result.code === 3) {
    console.error(
      "The complete cohort finished, but one or more cases failed quality or execution checks."
    );
    process.exitCode = 3;
  }
}

if (runnerInvokedDirectly) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
