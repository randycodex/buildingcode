import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const evalRoot = dirname(fileURLToPath(import.meta.url));
const serverRoot = dirname(evalRoot);
const defaultAuthorizationPath = join(
  evalRoot,
  "zoning-architecture-v1-confirmation-paid-authorization.json"
);

export const zoningArchitectureV1ConfirmationAuthorizationID =
  "d79db463-bc42-47c6-9e74-5931875cab50";
export const zoningArchitectureV1ConfirmationLockedAuthorizationSHA256 =
  "d0e2dc05ffbb1e7ebd9b52e0e82159892bc8e69b0151c04507d8d17d0276e412";
export const zoningArchitectureV1ConfirmationCohortSHA256 =
  "852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc";

const expectedFiles = Object.freeze({
  "evals/results/zoning-architecture-v1-no-cost-preflight.json":
    "0c1337c26c237f774d7320cc95bb034f2b6bb6e6f6a6a19016814d141b6b5c88",
  "research-zoning-planner.mjs":
    "e9ec4d986ad7c150af51bcfb1f60ec87b03ce2d6d723b1296726c865af1fa500",
  "research-model-routing.mjs":
    "acd1c85f3f88ffda919a24138035d458791c216ef1f06e0f44964037b7e8aa65",
  "research-evidence-assembly.mjs":
    "a5f094303fd72fb011ea858d5539b2cf4ff2f60b8e84d291c606156b453cdcb1",
  "research-zoning-safety.mjs":
    "e0c5f298e9cfbeaed9ed6d084df30b77643f29f011cfe5f309a0fb59a11277df",
  "app.mjs":
    "e33bf343a987980cc993274d5783bd1d84389bd32c1e8cbe12d89135ce833f4b",
  "scripts/preflight-zoning-architecture-v1.mjs":
    "3b191d855061b91ea2efe4ab1a5f5e281c4a7466a26707886659eeb2c0052211",
  "tests/research-zoning-planner-contract.mjs":
    "dd5e130beefab2897c71209e8f103125668492a5d88b23375d6dfdb41a45d4c3",
  "evals/zoning-successor-remediation-3-v17-full-cohort-paid-authorization.json":
    "5474123dc94e2c934eb556bc05e1bce823f743d1db39cde8f65cecfade1487aa"
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function validateBoundFiles() {
  for (const [relativePath, expectedHash] of Object.entries(expectedFiles)) {
    const value = await readFile(join(serverRoot, relativePath));
    assert(sha256(value) === expectedHash,
      `The locked Architecture V1 input changed: ${relativePath}.`);
  }
}

export async function validateZoningArchitectureV1ConfirmationPaidAuthorization({
  authorizationPath = defaultAuthorizationPath
} = {}) {
  const [authorizationText, cohortText, preflightText, priorAuthorizationText] = await Promise.all([
    readFile(authorizationPath, "utf8"),
    readFile(join(evalRoot, "zoning-cases-expanded-batch-1-successor-remediation-3.json"), "utf8"),
    readFile(join(evalRoot, "results", "zoning-architecture-v1-no-cost-preflight.json"), "utf8"),
    readFile(join(evalRoot, "zoning-successor-remediation-3-v17-full-cohort-paid-authorization.json"), "utf8")
  ]);
  const authorization = JSON.parse(authorizationText);
  const cohort = JSON.parse(cohortText);
  const preflight = JSON.parse(preflightText);
  const priorAuthorization = JSON.parse(priorAuthorizationText);
  await validateBoundFiles();

  assert(authorization.authorizationID === zoningArchitectureV1ConfirmationAuthorizationID,
    "The Architecture V1 confirmation has the wrong authorization identity.");
  assert(authorization.cohort?.sha256 === zoningArchitectureV1ConfirmationCohortSHA256 &&
    sha256(cohortText) === zoningArchitectureV1ConfirmationCohortSHA256,
  "The Architecture V1 confirmation is not bound to the frozen cohort.");
  assert(authorization.cohort?.caseCount === 30 && cohort.cases?.length === 30,
    "The Architecture V1 confirmation must retain all 30 ordered cases.");
  assert(authorization.cohort?.ordered === true,
    "The Architecture V1 confirmation must preserve cohort order.");
  assert(preflight.summary?.pass === true &&
    Object.values(preflight.aggregateGates || {}).every(Boolean),
  "The locked Architecture V1 no-cost preflight is not fully green.");
  assert(preflight.summary?.productionCost?.nominalUSDPerHundred <= 6 &&
    preflight.summary?.productionCost?.adverseUSDPerHundred <= 6,
  "The Architecture V1 production projection exceeds the owner-directed cost ceiling.");
  assert(preflight.summary?.judgeCost?.nominalUSDPerHundred === 0 &&
    preflight.summary?.judgeCost?.adverseUSDPerHundred === 0,
  "The no-cost Architecture V1 preflight must retain a separate zero judge ledger.");
  assert(preflight.summary?.providerRequests?.p50 <= 1 &&
    preflight.summary?.providerRequests?.maximum <= 2,
  "The Architecture V1 request-count projection changed.");
  assert(priorAuthorization.status === "consumed" &&
    priorAuthorization.consumption?.runID === authorization.lineage?.priorV17RunID,
  "The Architecture V1 package lost its consumed V17 lineage.");
  assert(authorization.execution?.webSupportEnabled === false,
    "The Architecture V1 confirmation may not enable web support.");
  assert(authorization.execution?.lunaFirst === true,
    "The Architecture V1 confirmation must remain Luna-first.");
  assert(authorization.execution?.fullAnswerRewriteAllowed === false,
    "The Architecture V1 confirmation may not enable full-answer rewrites.");
  assert(authorization.execution?.maximumProviderRequestsPerCase === 2,
    "The Architecture V1 confirmation must retain its two-request maximum.");
  assert(authorization.execution?.judgeLedgerSeparate === true,
    "The Architecture V1 confirmation must keep production and judge ledgers separate.");
  for (const field of [
    "publicResearchReleaseAuthorized",
    "professionalZoningSignoff",
    "deploymentAuthorized",
    "pricingOrAllowanceChangeAuthorized",
    "evidenceBudgetCandidateEnabled"
  ]) {
    assert(authorization[field] === false,
      `The Architecture V1 confirmation may not authorize ${field}.`);
  }

  const allowedStatuses = new Set(["locked", "authorized", "running", "consumed"]);
  assert(allowedStatuses.has(authorization.status),
    "The Architecture V1 confirmation has an unsupported status.");
  const packageCommit = authorization.execution?.authorizationPackageCommit;
  if (authorization.status === "locked") {
    assert(authorization.scope?.caseCount === null &&
      authorization.scope?.repetitions === null &&
      authorization.scope?.maximumCumulativeSpendUSD === null,
    "Locked Architecture V1 scope fields must remain null.");
    assert(authorization.ownerDecision?.authorizedAt === null &&
      authorization.ownerDecision?.authorizedBy === null &&
      authorization.ownerDecision?.exactAuthorizationPhrase === null &&
      authorization.ownerDecision?.exactSpendingCapPhrase === null,
    "Locked Architecture V1 owner-decision fields must remain null.");
    assert(packageCommit === null && authorization.execution?.executionCommit === null,
      "Locked Architecture V1 execution fields must remain null.");
    assert(authorization.networkOrModelCallAuthorized === false,
      "Locked Architecture V1 cannot authorize a network or model call.");
  } else {
    assert(/^[0-9a-f]{40}$/i.test(packageCommit || ""),
      "An active Architecture V1 authorization must name the exact package commit.");
    assert(authorization.scope?.caseCount === 30 &&
      authorization.scope?.repetitions === 1 &&
      authorization.scope?.maximumCumulativeSpendUSD === 5,
    "Architecture V1 authorization must retain the 30-case, one-repetition, $5 scope.");
    const exactPhrase = `authorize exactly package commit ${packageCommit} for all 30 ordered cases, one repetition, with a maximum cumulative API spend of $5.`;
    assert(authorization.ownerDecision?.exactAuthorizationPhrase === exactPhrase &&
      authorization.ownerDecision?.exactSpendingCapPhrase === exactPhrase,
    "Architecture V1 authorization must retain the exact owner package and spend-cap sentence.");
    assert(authorization.networkOrModelCallAuthorized === true,
      "Only the exact active owner authorization may permit a provider call.");
  }
  const active = authorization.status === "authorized" &&
    authorization.networkOrModelCallAuthorized === true;
  return {
    authorization,
    cohort,
    preflight,
    active,
    authorizationSHA256: sha256(authorizationText)
  };
}

export function requireActiveZoningArchitectureV1ConfirmationPaidAuthorization(validation) {
  if (validation?.active) return validation;
  const error = new Error(
    "Zoning Architecture V1 requires the exact locked-package authorization sentence and cumulative spend cap before any provider request."
  );
  error.code = "ZONING_ARCHITECTURE_V1_AUTHORIZATION_REQUIRED";
  throw error;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const validation = await validateZoningArchitectureV1ConfirmationPaidAuthorization();
  if (process.argv.includes("--require-active")) {
    requireActiveZoningArchitectureV1ConfirmationPaidAuthorization(validation);
  }
  console.log("Zoning Architecture V1 confirmation authorization guard passed", {
    status: validation.authorization.status,
    active: validation.active,
    cohortCases: validation.cohort.cases.length,
    productionAdverseUSDPerHundred:
      validation.preflight.summary.productionCost.adverseUSDPerHundred,
    judgeUSDPerHundred:
      validation.preflight.summary.judgeCost.adverseUSDPerHundred,
    networkOrModelCallAuthorized:
      validation.authorization.networkOrModelCallAuthorized
  });
}
