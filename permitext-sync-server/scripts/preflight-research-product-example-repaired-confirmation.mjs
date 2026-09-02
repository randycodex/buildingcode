import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { evidenceDiscoveryVersion } from "../evidence-discovery.mjs";
import {
  researchSourcePolicyConfiguration,
  researchSourcePolicyVersion
} from "../research-source-policy.mjs";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(scriptRoot, "..");
const fixturePath = join(serverRoot, "evals", "research-product-example-cases.json");
const outputPath = join(
  serverRoot,
  "evals",
  "results",
  "research-product-example-repaired-confirmation-no-cost-preflight.json"
);
const boundInputPaths = [
  "app.mjs",
  "evidence-discovery.mjs",
  "research-answer-presentation.mjs",
  "research-corpus-registry.mjs",
  "research-source-policy.mjs",
  "evals/research-product-example-cases.json",
  "scripts/run-research-product-example-repaired-confirmation.mjs",
  "tests/research-product-example-acceptance-contract.mjs",
  "tests/research-product-example-runtime-contract.mjs"
];
const credentialKeys = [
  "OPENAI_API_KEY",
  "AZURE_OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "PERMITEXT_RUN_PAID_RESEARCH_EVALS",
  "PERMITEXT_RESEARCH_EVAL_MAX_USD"
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function inputHashes() {
  return Object.fromEntries(await Promise.all(boundInputPaths.map(async (relativePath) => [
    relativePath,
    sha256(await readFile(join(serverRoot, relativePath)))
  ])));
}

function scrubbedEnvironment() {
  const environment = { ...process.env };
  for (const key of credentialKeys) delete environment[key];
  return environment;
}

const fixtureText = await readFile(fixturePath, "utf8");
const fixture = JSON.parse(fixtureText);
assert.equal(fixture.schema, "permitext-research-product-examples-v1");
assert.equal(fixture.paidModelCallsAuthorized, false);
assert.equal(fixture.cases.length, 7);
assert.equal(fixture.cases.reduce((sum, item) => sum + item.turns.length, 0), 9);

const runtime = spawnSync(
  process.execPath,
  ["tests/research-product-example-runtime-contract.mjs"],
  {
    cwd: serverRoot,
    encoding: "utf8",
    env: scrubbedEnvironment(),
    maxBuffer: 32 * 1024 * 1024
  }
);
assert.equal(
  runtime.status,
  0,
  `The current owner-example runtime regression failed:\n${runtime.stdout}\n${runtime.stderr}`
);
assert.match(
  `${runtime.stdout}\n${runtime.stderr}`,
  /7 conversations, 9 ordered turns, 0 network attempts, 0 paid provider calls/i
);

const sourcePolicy = researchSourcePolicyConfiguration({
  PERMITEXT_RESEARCH_WEB_SUPPORT: "1"
});
for (const domain of ["ny.gov", "ada.gov"]) {
  assert(sourcePolicy.officialDomains.includes(domain));
}
assert.equal(sourcePolicy.webSupportEnabled, true);
assert.equal(evidenceDiscoveryVersion, "20260902-official-source-seeds-v21");
assert.equal(researchSourcePolicyVersion, "20260902-supporting-web-v12");

const report = {
  schema: "permitext-research-product-example-repaired-confirmation-preflight-v1",
  version: "2026-09-02",
  pass: true,
  purpose:
    "No-cost runtime preflight for one later repaired live confirmation of the owner's seven product examples across nine ordered turns.",
  fixtureSHA256: sha256(fixtureText),
  inputSHA256: await inputHashes(),
  scope: {
    conversationCount: 7,
    orderedTurnCount: 9,
    repetitions: 1,
    separateJudgeRequests: 0,
    liveWebSupportEnabledAfterAuthorizationOnly: true
  },
  supportingWeb: {
    sourcePolicyVersion: researchSourcePolicyVersion,
    evidenceDiscoveryVersion,
    officialDomains: sourcePolicy.officialDomains,
    requiredSeedURLs: [
      "https://omh.ny.gov/omhweb/policy_and_regulations/",
      "https://www.ada.gov/"
    ],
    authorityBoundary:
      "Attributable official supporting material remains separate from enacted Permitext code evidence."
  },
  safety: {
    networkAttempts: 0,
    paidProviderCalls: 0,
    productionWrites: 0,
    publicZoningResearchEnabled: false,
    releaseAuthorized: false,
    credentialVariablesPresent: credentialKeys.filter((key) =>
      Object.hasOwn(scrubbedEnvironment(), key)
    )
  },
  runtimeRegression: {
    passed: true,
    conversationCount: 7,
    orderedTurnCount: 9,
    networkAttempts: 0,
    paidProviderCalls: 0
  }
};
assert.deepEqual(report.safety.credentialVariablesPresent, []);

const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (process.argv.includes("--write")) {
  await writeFile(outputPath, serialized);
  console.log(`Wrote ${outputPath}`);
} else {
  assert.equal(
    await readFile(outputPath, "utf8"),
    serialized,
    "The retained repaired owner-example preflight is stale; rerun with --write after review."
  );
  console.log(
    "Permitext repaired owner-example preflight passed: 7 conversations, 9 ordered turns, 0 network attempts, 0 paid provider calls."
  );
}
