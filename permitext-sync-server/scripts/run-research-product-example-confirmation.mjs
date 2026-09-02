import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  open,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  requireActiveResearchProductExampleConfirmationPaidAuthorization,
  researchProductExampleConfirmationLockedAuthorizationSHA256,
  validateResearchProductExampleConfirmationPaidAuthorization
} from "../evals/research-product-example-confirmation-paid-authorization.mjs";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(scriptRoot, "..");
const repositoryRoot = join(serverRoot, "..");
const authorizationRelativePath =
  "permitext-sync-server/evals/research-product-example-confirmation-paid-authorization.json";
const runLockPath = join(serverRoot, ".research-product-example-confirmation-paid-run.lock");
const resultsRoot = join(serverRoot, "evals", "results");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function git(args, { encoding = "utf8" } = {}) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding,
    maxBuffer: 32 * 1024 * 1024
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Git validation failed: git ${args.join(" ")}.`);
  }
  return result.stdout;
}

function validateExecutionCommit(authorization) {
  const packageCommit = authorization.execution.authorizationPackageCommit;
  const executionCommit = git(["rev-parse", "HEAD"]).trim();
  assert.equal(
    authorization.execution.executionCommit,
    executionCommit,
    "The active owner-example authorization must name the exact execution commit."
  );
  git(["merge-base", "--is-ancestor", packageCommit, executionCommit]);
  const lockedAuthorization = git([
    "show",
    `${packageCommit}:${authorizationRelativePath}`
  ]);
  assert.equal(
    sha256(lockedAuthorization),
    researchProductExampleConfirmationLockedAuthorizationSHA256,
    "The selected package commit does not contain the exact locked authorization."
  );
  const changedPaths = git([
    "diff",
    "--name-only",
    `${packageCommit}..${executionCommit}`,
    "--",
    "permitext-sync-server"
  ]).trim().split("\n").filter(Boolean);
  assert.deepEqual(
    changedPaths,
    [authorizationRelativePath],
    "Only the committed authorization record may differ from the locked package."
  );
  const dirtyServerPaths = git([
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "--",
    "permitext-sync-server"
  ]).trim();
  assert.equal(
    dirtyServerPaths,
    "",
    "The Permitext server tree must be clean before the one-time live confirmation."
  );
  return executionCommit;
}

async function jsonRequest(baseURL, path, options = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    method: options.method || "GET",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { error: text };
  }
  if (!response.ok) {
    const error = new Error(
      `${options.method || "GET"} ${path} failed (${response.status}): ` +
      `${payload?.error || "unknown error"}`
    );
    error.httpStatus = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function signInEvaluationUser(baseURL) {
  const result = await jsonRequest(baseURL, "/account/sign-in", {
    method: "POST",
    body: {
      credential: {
        provider: "web",
        providerUserID: `research-product-example-${randomUUID()}`,
        displayName: "Permitext Product Example Confirmation"
      }
    }
  });
  await jsonRequest(baseURL, "/admin/lifetime-grants/grant", {
    method: "POST",
    token: process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN,
    body: { userID: result.account.appUserID }
  });
  return result.account;
}

async function createConversation(baseURL, account) {
  const payload = await jsonRequest(baseURL, "/research/conversations/create", {
    method: "POST",
    token: account.backendSessionToken,
    body: { auth: { accountUserID: account.appUserID } }
  });
  assert(payload.conversation?.id, "Permitext did not create the evaluation conversation.");
  assert.equal(payload.conversation.origin?.kind, "chat");
  return payload.conversation.id;
}

async function askQuestion(baseURL, account, conversationID, question) {
  const startedAt = performance.now();
  const payload = await jsonRequest(baseURL, "/research/conversations/message", {
    method: "POST",
    token: account.backendSessionToken,
    body: {
      auth: { accountUserID: account.appUserID },
      conversationID,
      question,
      requestID: randomUUID()
    }
  });
  const assistantMessage = [...(payload.conversation?.messages || [])].reverse()
    .find((message) => message.role === "assistant");
  assert(assistantMessage?.answer, "Permitext returned no assistant answer.");
  return {
    answer: assistantMessage.answer,
    answerID: assistantMessage.id,
    responseTimeMilliseconds: Math.round(performance.now() - startedAt)
  };
}

const terminalStatuses = new Set([
  "completed",
  "failed",
  "cancelled",
  "rejected",
  "replayed"
]);

async function researchOperations(baseURL, account) {
  const payload = await jsonRequest(baseURL, "/internal/evaluations/data", {
    method: "POST",
    token: account.backendSessionToken,
    body: { auth: { accountUserID: account.appUserID } }
  });
  assert(Array.isArray(payload?.researchSpend?.operationMetrics));
  return payload.researchSpend.operationMetrics;
}

async function nextTerminalOperation(baseURL, account, seenOperationIDs) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const operation = (await researchOperations(baseURL, account)).find((candidate) =>
      terminalStatuses.has(candidate.status) && !seenOperationIDs.has(candidate.id)
    );
    if (operation) return operation;
    await new Promise((resolveRetry) => setTimeout(resolveRetry, 50));
  }
  throw new Error("The Research turn did not publish terminal private operation telemetry.");
}

function answerText(answer) {
  return String(
    answer?.answerText ||
      [answer?.conclusion, answer?.explanation].filter(Boolean).join("\n\n")
  ).trim();
}

function answerReferences(answer) {
  return Array.from(new Set((answer?.citations || []).map((citation) =>
    `${citation.codePrefix || ""} ${citation.sectionNumber || ""}`.trim()
  ).filter(Boolean)));
}

function presentationCheck(mode, text) {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const markdownTable = /^\s*\|.+\|\s*$/m.test(text) && /^\s*\|\s*[-:]+/m.test(text);
  if (["requirements-table", "comparison-table"].includes(mode)) {
    return { passed: markdownTable, detail: "A readable Markdown table is required." };
  }
  if (mode === "compact-paragraph") {
    return {
      passed: wordCount <= 140 && !markdownTable,
      detail: "The follow-up must remain one short, table-free explanation."
    };
  }
  if (mode === "edition-check") {
    return { passed: /\b2014\b/.test(text), detail: "The answer must confirm the 2014 edition." };
  }
  if (mode === "external-authority-boundary") {
    return {
      passed: /\b(?:OMH|14\s+NYCRR)\b/i.test(text) &&
        /\b(?:cannot|not supplied|need|provide|outside|unavailable|verify)\b/i.test(text),
      detail: "The answer must identify the unsupplied external authority boundary."
    };
  }
  if (mode === "definition-status") {
    return { passed: /\breserved\b/i.test(text), detail: "The current Appendix P status must be explicit." };
  }
  if (mode === "numeric-rule") {
    return { passed: /\d/.test(text), detail: "The direct numeric rule must appear in the answer." };
  }
  return { passed: text.length > 0, detail: "The answer must contain a direct response." };
}

function deterministicTurnReview(example, turn, answer) {
  const text = answerText(answer);
  const references = answerReferences(answer);
  const requiredReferencesPresent = example.requiredReferences.every((reference) =>
    references.includes(reference)
  );
  const forbiddenReferencesAbsent = (example.forbiddenReferences || []).every((reference) =>
    !references.includes(reference)
  );
  const presentation = presentationCheck(turn.presentationMode, text);
  return {
    passed:
      text.length > 0 && requiredReferencesPresent &&
      forbiddenReferencesAbsent && presentation.passed,
    answerTextPresent: text.length > 0,
    requiredReferencesPresent,
    missingRequiredReferences: example.requiredReferences.filter((reference) =>
      !references.includes(reference)
    ),
    forbiddenReferencesAbsent,
    returnedForbiddenReferences: (example.forbiddenReferences || []).filter((reference) =>
      references.includes(reference)
    ),
    presentationMode: turn.presentationMode,
    presentation,
    returnedReferences: references,
    humanReviewRequired: true
  };
}

function errorRecord(error) {
  return {
    name: error.name || "Error",
    message: error.message,
    httpStatus: error.httpStatus || null
  };
}

function resultMarkdown(result) {
  const rows = result.results.flatMap((example) => example.turns.map((turn) =>
    `| ${example.id} | ${turn.index} | ${turn.status} | ${turn.review?.passed === true ? "PASS" : "REVIEW"} |`
  ));
  const answers = result.results.flatMap((example) => example.turns.map((turn) => [
    `## ${example.id} — turn ${turn.index}`,
    "",
    `Question: ${turn.question}`,
    "",
    `Status: ${turn.status}; deterministic review: ${turn.review?.passed === true ? "PASS" : "REVIEW REQUIRED"}`,
    "",
    turn.answerText || turn.error?.message || "No answer was returned.",
    "",
    `Citations: ${(turn.review?.returnedReferences || []).join(", ") || "None"}`,
    ""
  ].join("\n")));
  return [
    "# Permitext owner-example live confirmation",
    "",
    `Run ID: ${result.runID}`,
    "",
    `Status: ${result.status}`,
    "",
    `Execution commit: ${result.executionCommit}`,
    "",
    `Spend: $${Number(result.spend.actualUSD || 0).toFixed(6)} actual; $${Number(result.spend.reservedUSD || 0).toFixed(6)} conservative reserved; $${Number(result.spend.capUSD || 0).toFixed(2)} cap; ${result.spend.pendingRequestCount || 0} pending.`,
    "",
    "| Example | Turn | Operation | Deterministic review |",
    "| --- | ---: | --- | --- |",
    ...rows,
    "",
    "Every answer still requires owner review. This confirmation is not an official code determination.",
    "",
    ...answers
  ].join("\n");
}

async function main() {
  const validation = await validateResearchProductExampleConfirmationPaidAuthorization();
  const active = requireActiveResearchProductExampleConfirmationPaidAuthorization(validation);
  assert.equal(
    process.env.PERMITEXT_RUN_PAID_RESEARCH_EVALS,
    "1",
    "Set PERMITEXT_RUN_PAID_RESEARCH_EVALS=1 only after the exact package authorization is committed."
  );
  const configuredCap = Number(process.env.PERMITEXT_RESEARCH_EVAL_MAX_USD || active.maximumCumulativeSpendUSD);
  assert.equal(
    configuredCap,
    active.maximumCumulativeSpendUSD,
    "The runtime cumulative spend cap must exactly match the owner-authorized $2 cap."
  );
  process.env.PERMITEXT_RESEARCH_EVAL_MAX_USD = String(active.maximumCumulativeSpendUSD);
  const executionCommit = validateExecutionCommit(validation.authorization);

  const { validatePaidResearchEvaluationEnvironment } = await import("../research-config.mjs");
  validatePaidResearchEvaluationEnvironment(process.env);

  const runID = randomUUID();
  const startedAt = new Date().toISOString();
  let lockHandle;
  try {
    lockHandle = await open(runLockPath, "wx");
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error("The one-time owner-example confirmation was already attempted; the run lock is permanent.");
    }
    throw error;
  }
  await lockHandle.writeFile(`${JSON.stringify({
    authorizationID: active.authorizationID,
    packageCommit: active.packageCommit,
    executionCommit,
    runID,
    startedAt,
    status: "running"
  }, null, 2)}\n`);

  const temporaryDirectory = await mkdtemp(join(tmpdir(), "permitext-product-example-confirmation-"));
  const originalEnvironment = { ...process.env };
  let server;
  const results = [];
  let fatalFailure = null;
  try {
    process.env.PERMITEXT_SYNC_DATA_PATH = join(temporaryDirectory, "sync-store.json");
    process.env.PERMITEXT_SYNC_DATABASE_URL = "";
    process.env.DATABASE_URL = "";
    process.env.STORAGE_URL = "";
    process.env.POSTGRES_URL = "";
    process.env.NEON_DATABASE_URL = "";
    process.env.VERCEL = "";
    process.env.VERCEL_ENV = "";
    process.env.PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN = "1";
    process.env.PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS = "1";
    process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN = `product-example-${runID}`;
    process.env.PERMITEXT_RESEARCH_WEB_SUPPORT = "0";
    process.env.PERMITEXT_RESEARCH_MONTHLY_REQUEST_LIMIT = "9";
    process.env.PERMITEXT_TEST_RESEARCH_MOCK = "";
    process.env.NODE_ENV = "";

    const [{ handleRequest }, { researchEvaluationSpendStatus }] = await Promise.all([
      import(`../app.mjs?product-example-confirmation=${Date.now()}`),
      import("../research-config.mjs")
    ]);
    server = createServer(handleRequest);
    await new Promise((resolveListening, rejectListening) => {
      server.once("error", rejectListening);
      server.listen(0, "127.0.0.1", resolveListening);
    });
    const address = server.address();
    assert(address && typeof address === "object");
    const baseURL = `http://127.0.0.1:${address.port}`;
    const account = await signInEvaluationUser(baseURL);
    const seenOperationIDs = new Set();

    exampleLoop:
    for (const example of validation.fixture.cases) {
      const conversationID = await createConversation(baseURL, account);
      const exampleResult = { id: example.id, corpusID: example.corpusID, conversationID, turns: [] };
      results.push(exampleResult);
      for (const [turnOffset, turn] of example.turns.entries()) {
        const turnResult = {
          index: turnOffset + 1,
          question: turn.question,
          expectedPresentationMode: turn.presentationMode,
          status: "running"
        };
        exampleResult.turns.push(turnResult);
        try {
          const response = await askQuestion(
            baseURL,
            account,
            conversationID,
            turn.question
          );
          const operation = await nextTerminalOperation(baseURL, account, seenOperationIDs);
          seenOperationIDs.add(operation.id);
          assert.equal(operation.status, "completed");
          assert.equal(operation.charged, true);
          Object.assign(turnResult, {
            status: "completed",
            answerID: response.answerID,
            responseTimeMilliseconds: response.responseTimeMilliseconds,
            answerText: answerText(response.answer),
            answer: response.answer,
            operation,
            review: deterministicTurnReview(example, turn, response.answer)
          });
        } catch (error) {
          let operation = null;
          try {
            operation = await nextTerminalOperation(baseURL, account, seenOperationIDs);
            seenOperationIDs.add(operation.id);
          } catch (telemetryError) {
            fatalFailure = {
              exampleID: example.id,
              turn: turnOffset + 1,
              error: errorRecord(error),
              telemetryError: errorRecord(telemetryError)
            };
          }
          Object.assign(turnResult, {
            status: operation?.status || "failed",
            operation,
            error: errorRecord(error),
            review: { passed: false, humanReviewRequired: true, returnedReferences: [] }
          });
          const settledUnchargedFailure =
            operation && operation.charged === false &&
            operation.pendingProviderRequestCount === 0;
          if (!settledUnchargedFailure || fatalFailure) {
            fatalFailure ||= {
              exampleID: example.id,
              turn: turnOffset + 1,
              error: errorRecord(error)
            };
            break exampleLoop;
          }
          break;
        }
      }
    }

    const spend = researchEvaluationSpendStatus();
    assert(spend.actualUSD <= active.maximumCumulativeSpendUSD);
    assert(spend.reservedUSD <= active.maximumCumulativeSpendUSD);
    assert.equal(spend.pendingRequestCount, 0);
    const completedTurnCount = results.reduce(
      (sum, example) => sum + example.turns.filter((turn) => turn.status === "completed").length,
      0
    );
    const attemptedTurnCount = results.reduce((sum, example) => sum + example.turns.length, 0);
    const allDeterministicChecksPassed = results.every((example) =>
      example.turns.every((turn) => turn.review?.passed === true)
    );
    const status =
      !fatalFailure && attemptedTurnCount === 9 && completedTurnCount === 9
        ? "completed"
        : completedTurnCount > 0 ? "partial" : "failed";
    const result = {
      schema: "permitext-research-product-example-live-confirmation-v1",
      runID,
      status,
      startedAt,
      completedAt: new Date().toISOString(),
      authorizationID: active.authorizationID,
      packageCommit: active.packageCommit,
      executionCommit,
      scope: {
        expectedConversationCount: 7,
        completedConversationCount: results.length,
        expectedOrderedTurnCount: 9,
        attemptedTurnCount,
        completedTurnCount,
        repetitions: 1,
        separateJudgeRequests: 0,
        webSupportEnabled: false
      },
      spend,
      allDeterministicChecksPassed,
      ownerReviewRequired: true,
      publicReleaseAuthorized: false,
      fatalFailure,
      results
    };
    await mkdir(resultsRoot, { recursive: true });
    const stamp = startedAt.replace(/[:.]/g, "-");
    const resultBase = `${stamp}-${runID}-product-example-confirmation`;
    const jsonPath = join(resultsRoot, `${resultBase}.json`);
    const markdownPath = join(resultsRoot, `${resultBase}.md`);
    await Promise.all([
      writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`),
      writeFile(markdownPath, `${resultMarkdown(result)}\n`)
    ]);
    await writeFile(runLockPath, `${JSON.stringify({
      authorizationID: active.authorizationID,
      packageCommit: active.packageCommit,
      executionCommit,
      runID,
      startedAt,
      completedAt: result.completedAt,
      status,
      resultJSON: `evals/results/${resultBase}.json`,
      resultMarkdown: `evals/results/${resultBase}.md`,
      actualSpendUSD: spend.actualUSD,
      reservedSpendUSD: spend.reservedUSD,
      pendingRequestCount: spend.pendingRequestCount
    }, null, 2)}\n`);
    console.log(
      `Owner-example confirmation ${status}: ${completedTurnCount}/9 turns completed; ` +
      `$${Number(spend.actualUSD || 0).toFixed(6)} actual under the $${active.maximumCumulativeSpendUSD.toFixed(2)} cap; ` +
      "no separate judge requests. Owner review remains required."
    );
    if (fatalFailure) process.exitCode = 2;
  } finally {
    if (server) await new Promise((resolveClose) => server.close(resolveClose));
    await rm(temporaryDirectory, { recursive: true, force: true });
    await lockHandle.close();
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnvironment)) delete process.env[key];
    }
    Object.assign(process.env, originalEnvironment);
  }
}

await main();
