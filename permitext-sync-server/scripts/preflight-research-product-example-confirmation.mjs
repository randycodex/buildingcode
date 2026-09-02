import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  researchAnswerPresentationContract,
  researchAnswerPresentationVersion
} from "../research-answer-presentation.mjs";
import {
  createResearchCorpusRegistry,
  routeResearchCorpora
} from "../research-corpus-registry.mjs";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(scriptRoot, "..");
const fixturePath = join(serverRoot, "evals", "research-product-example-cases.json");
const outputPath = join(
  serverRoot,
  "evals",
  "results",
  "research-product-example-confirmation-no-cost-preflight.json"
);
const boundInputPaths = [
  "app.mjs",
  "research-answer-presentation.mjs",
  "research-corpus-registry.mjs",
  "evals/research-product-example-cases.json",
  "tests/research-product-example-acceptance-contract.mjs"
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

const originalFetch = globalThis.fetch;
let networkAttempts = 0;
globalThis.fetch = async () => {
  networkAttempts += 1;
  throw new Error("The no-cost owner-example preflight forbids network access.");
};

try {
  const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  assert.equal(fixture.schema, "permitext-research-product-examples-v1");
  assert.equal(fixture.paidModelCallsAuthorized, false);
  assert.equal(fixture.cases.length, 7);
  assert.equal(new Set(fixture.cases.map((item) => item.id)).size, 7);
  assert.equal(researchAnswerPresentationVersion, "20260902-product-example-contract-v1");

  const registry = createResearchCorpusRegistry();
  const cases = fixture.cases.map((item) => {
    const presentationEvidence = item.requiredReferences.map((sectionID) => ({ sectionID }));
    const turns = item.turns.map((turn) => {
      const presentation = researchAnswerPresentationContract({
        question: turn.question,
        evidence: presentationEvidence
      });
      assert.equal(presentation.mode, turn.presentationMode);
      assert.equal(presentation.directAnswerFirst, true);
      assert(presentation.requiredElements.length > 0);
      return {
        question: turn.question,
        expectedPresentationMode: turn.presentationMode,
        actualPresentationMode: presentation.mode,
        directAnswerFirst: presentation.directAnswerFirst
      };
    });
    const routed = routeResearchCorpora({
      question: item.turns[0].question,
      registry
    });
    const routedCorpusIDs = new Set([
      ...routed.selected.map((corpus) => corpus.id),
      ...routed.unavailable.map((corpus) => corpus.id)
    ]);
    assert(routedCorpusIDs.has(item.corpusID));
    return {
      id: item.id,
      corpusID: item.corpusID,
      turnCount: turns.length,
      turns,
      corpusRoutedOrDisclosed: true,
      outsideAuthorityRequired: item.outsideAuthorityRequired === true
    };
  });
  const turnCount = cases.reduce((sum, item) => sum + item.turnCount, 0);
  assert.equal(turnCount, 9);
  assert.equal(networkAttempts, 0);

  const report = {
    schema: "permitext-research-product-example-confirmation-preflight-v1",
    version: "2026-09-02",
    pass: true,
    purpose: "Static no-cost preflight for one later live confirmation of the owner's seven product examples across nine ordered turns.",
    fixtureSHA256: sha256(await readFile(fixturePath)),
    inputSHA256: await inputHashes(),
    scope: {
      conversationCount: cases.length,
      orderedTurnCount: turnCount,
      repetitions: 1,
      separateJudgeRequests: 0,
      webSupportEnabled: false
    },
    safety: {
      networkAttempts,
      paidProviderCalls: 0,
      productionWrites: 0,
      publicZoningResearchEnabled: false,
      releaseAuthorized: false
    },
    cases
  };
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (process.argv.includes("--write")) {
    await writeFile(outputPath, serialized);
    console.log(`Wrote ${outputPath}`);
  } else {
    assert.equal(
      await readFile(outputPath, "utf8"),
      serialized,
      "The retained owner-example no-cost preflight is stale; rerun with --write after review."
    );
    console.log("Permitext owner-example no-cost confirmation preflight passed; provider calls: none.");
  }
} finally {
  globalThis.fetch = originalFetch;
}
