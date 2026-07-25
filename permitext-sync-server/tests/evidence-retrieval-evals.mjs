import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateEvaluationDataset } from "../evals/evaluation-schema.mjs";
import { evidenceDiscoveryVersion } from "../evidence-discovery.mjs";

const serverRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const retrievalCasesPath = join(serverRoot, "evals", "evidence-retrieval-cases.json");
const researchCasesPath = join(serverRoot, "evals", "research-cases.json");

function normalizedText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tokenSet(value) {
  return new Set(normalizedText(value).match(/[a-z0-9]+(?:[.-][a-z0-9]+)*/g) || []);
}

function passageOverlap(left, right) {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  const common = Array.from(leftTokens).filter((token) => rightTokens.has(token)).length;
  return common / Math.min(leftTokens.size, rightTokens.size);
}

function validateRetrievalDataset(dataset, researchDataset) {
  assert.equal(dataset.schemaVersion, 1, "Evidence retrieval dataset must use schemaVersion 1.");
  assert.equal(dataset.retrievalVersion, evidenceDiscoveryVersion, "Retrieval dataset version does not match the implementation.");
  assert(Array.isArray(dataset.coverageGaps) && dataset.coverageGaps.length, "Retrieval dataset must disclose coverage gaps.");
  assert(Array.isArray(dataset.cases) && dataset.cases.length, "Retrieval dataset has no cases.");
  const researchByID = new Map(researchDataset.cases.map((testCase) => [testCase.id, testCase]));
  const ids = new Set();
  for (const testCase of dataset.cases) {
    assert(testCase.id && !ids.has(testCase.id), `Invalid or duplicate retrieval case ${testCase.id}.`);
    ids.add(testCase.id);
    assert(
      ["draft", "reviewed", "approved", "rejected"].includes(testCase.status),
      `${testCase.id} has an invalid human-review status.`
    );
    const hasReviewer = Boolean(String(testCase.reviewer || "").trim());
    const hasReviewDate = Number.isFinite(Date.parse(testCase.reviewedAt || ""));
    assert.equal(hasReviewer, hasReviewDate, `${testCase.id} has incomplete reviewer metadata.`);
    if (["reviewed", "approved", "rejected"].includes(testCase.status)) {
      assert(hasReviewer, `${testCase.id} needs reviewer metadata for status ${testCase.status}.`);
    }
    assert(researchByID.has(testCase.sourceResearchCaseID), `${testCase.id} has no canonical Research source case.`);
    assert(
      ["candidate-recall", "insufficient-query"].includes(testCase.expectedBehavior),
      `${testCase.id} has an invalid expected behavior.`
    );
    assert(
      Number.isSafeInteger(testCase.evaluationDepth) &&
        testCase.evaluationDepth >= 1 &&
        testCase.evaluationDepth <= 12,
      `${testCase.id} has an invalid evaluation depth.`
    );
    assert(Array.isArray(testCase.scenarioCategories) && testCase.scenarioCategories.length, `${testCase.id} needs scenario categories.`);
    assert(typeof testCase.notes === "string" && testCase.notes.trim(), `${testCase.id} needs review notes.`);
  }
  return researchByID;
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
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${payload?.error || text}`);
  }
  return payload;
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), "permitext-evidence-retrieval-"));
const previousEnvironment = new Map();
const environment = {
  NODE_ENV: "test",
  PERMITEXT_SYNC_DATA_PATH: join(temporaryDirectory, "sync-store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(temporaryDirectory, "private-assets"),
  PERMITEXT_SYNC_DATABASE_URL: "",
  DATABASE_URL: "",
  STORAGE_URL: "",
  POSTGRES_URL: "",
  NEON_DATABASE_URL: "",
  PERMITEXT_RESEARCH_MOCK: "1",
  PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1",
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: "retrieval-eval-grant-token"
};
for (const [key, value] of Object.entries(environment)) {
  previousEnvironment.set(key, process.env[key]);
  process.env[key] = value;
}

let server;
try {
  const [{ handleRequest }, retrievalText, researchText] = await Promise.all([
    import(`../app.mjs?evidence-retrieval-eval=${Date.now()}`),
    readFile(retrievalCasesPath, "utf8"),
    readFile(researchCasesPath, "utf8")
  ]);
  const retrievalDataset = JSON.parse(retrievalText);
  const researchDataset = validateEvaluationDataset(JSON.parse(researchText));
  const researchByID = validateRetrievalDataset(retrievalDataset, researchDataset);
  server = createServer(handleRequest);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const baseURL = `http://127.0.0.1:${address.port}`;
  const signedIn = await jsonRequest(baseURL, "/account/sign-in", {
    method: "POST",
    body: {
      credential: {
        provider: "web",
        providerUserID: "evidence-retrieval-eval",
        displayName: "Evidence Retrieval Eval"
      }
    }
  });
  await jsonRequest(baseURL, "/admin/lifetime-grants/grant", {
    method: "POST",
    token: environment.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN,
    body: { userID: signedIn.account.appUserID }
  });
  const account = (await jsonRequest(baseURL, "/account/sign-in", {
    method: "POST",
    body: {
      credential: {
        provider: "web",
        providerUserID: "evidence-retrieval-eval",
        displayName: "Evidence Retrieval Eval"
      }
    }
  })).account;

  const results = [];
  for (const retrievalCase of retrievalDataset.cases.filter((testCase) => testCase.status !== "rejected")) {
    const researchCase = researchByID.get(retrievalCase.sourceResearchCaseID);
    const discovery = await jsonRequest(baseURL, "/research/evidence/discover", {
      method: "POST",
      token: account.backendSessionToken,
      body: {
        auth: { accountUserID: account.appUserID },
        question: researchCase.question,
        limit: retrievalCase.evaluationDepth
      }
    });
    assert.equal(discovery.retrievalVersion, evidenceDiscoveryVersion);
    assert.equal(discovery.generatedAnswer, false);
    assert.equal(discovery.paidModelCall, false);
    assert(
      discovery.candidates.every((candidate) =>
        candidate.candidateState === "candidate" &&
        candidate.selectedText &&
        candidate.whyRelevant &&
        candidate.signals &&
        !candidate.approved
      ),
      `${retrievalCase.id} returned an approved, unexplained, or passage-free candidate.`
    );
    assert(
      discovery.coverageLimitations.some((item) => item.kind === "candidate-review-required"),
      `${retrievalCase.id} did not disclose the human approval boundary.`
    );

    if (retrievalCase.expectedBehavior === "insufficient-query") {
      assert(
        discovery.coverageLimitations.some((item) => item.kind === "query-context-required"),
        `${retrievalCase.id} did not identify its missing section context.`
      );
      results.push({
        id: retrievalCase.id,
        behavior: "insufficient-query",
        recall: null,
        passageRecall: null,
        topRelevant: null,
        candidateCount: discovery.candidates.length
      });
      continue;
    }

    const expectedSources = researchCase.selectedEvidence;
    const rankByID = new Map(discovery.candidates.map((candidate) => [
      String(candidate.sectionID),
      candidate.rank
    ]));
    const recalledSources = expectedSources.filter((source) => rankByID.has(String(source.sectionID)));
    const passageHits = recalledSources.filter((source) => {
      const candidate = discovery.candidates.find((item) =>
        String(item.sectionID) === String(source.sectionID)
      );
      return source.exactPassages.some((passage) =>
        passageOverlap(candidate.selectedText, passage) >= 0.42
      );
    });
    const expectedIDs = new Set(expectedSources.map((source) => String(source.sectionID)));
    results.push({
      id: retrievalCase.id,
      behavior: "candidate-recall",
      recall: recalledSources.length / expectedSources.length,
      passageRecall: passageHits.length / expectedSources.length,
      topRelevant: expectedIDs.has(String(discovery.candidates[0]?.sectionID || "")),
      candidateCount: discovery.candidates.length,
      missedSections: expectedSources
        .filter((source) => !rankByID.has(String(source.sectionID)))
        .map((source) => source.reference),
      ranks: expectedSources.map((source) => ({
        reference: source.reference,
        rank: rankByID.get(String(source.sectionID)) || null
      }))
    });
  }

  console.log("Permitext evidence retrieval draft diagnostics");
  for (const result of results) {
    if (result.behavior === "insufficient-query") {
      console.log(`DRAFT ${result.id}: correctly disclosed insufficient query context; ${result.candidateCount} unapproved candidates.`);
      continue;
    }
    console.log(
      `DRAFT ${result.id}: section recall@12 ${(result.recall * 100).toFixed(0)}%; ` +
      `passage recall ${(result.passageRecall * 100).toFixed(0)}%; ` +
      `top result ${result.topRelevant ? "relevant" : "not expected"}; ` +
      `missed ${result.missedSections.join(", ") || "none"}; ` +
      `expected ranks ${result.ranks.map(({ reference, rank }) => `${reference}=${rank || "missed"}`).join(", ")}.`
    );
  }
  const recallResults = results.filter((result) => result.recall !== null);
  const meanRecall = recallResults.reduce((sum, result) => sum + result.recall, 0) / recallResults.length;
  const meanPassageRecall = recallResults.reduce((sum, result) => sum + result.passageRecall, 0) / recallResults.length;
  const draftCases = retrievalDataset.cases.filter((testCase) => testCase.status === "draft");
  const approvedCases = retrievalDataset.cases.filter((testCase) => testCase.status === "approved");
  const rejectedCases = retrievalDataset.cases.filter((testCase) => testCase.status === "rejected");
  console.log(
    `Summary: ${draftCases.length} draft cases, ${approvedCases.length} approved retrieval gates, ` +
    `${rejectedCases.length} rejected cases, ` +
    `${(meanRecall * 100).toFixed(1)}% mean section recall@12, ` +
    `${(meanPassageRecall * 100).toFixed(1)}% mean passage recall.`
  );
  console.log("Public launch remains blocked pending knowledgeable-human review and approved scenario coverage. No paid model calls were made.");
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(temporaryDirectory, { recursive: true, force: true });
  for (const [key, value] of previousEnvironment) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
