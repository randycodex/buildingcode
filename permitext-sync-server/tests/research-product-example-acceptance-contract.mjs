import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
import {
  historicalConstructionSection,
  historicalConstructionSectionCatalog
} from "../historical-construction-content.mjs";
import {
  zoningSection,
  zoningSectionCatalog
} from "../zoning-content.mjs";

const testRoot = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(testRoot, "..");
const workspaceRoot = join(serverRoot, "..");
const fixture = JSON.parse(await readFile(
  join(serverRoot, "evals/research-product-example-cases.json"),
  "utf8"
));
const constructionBundle = JSON.parse(await readFile(
  join(
    workspaceRoot,
    "NYC CC APP/NYCCCApp/Resources/CodeContent/authored/new-york-city/2022-construction-codes/bundle.json"
  ),
  "utf8"
));

assert.equal(fixture.schema, "permitext-research-product-examples-v1");
assert.equal(fixture.paidModelCallsAuthorized, false);
assert.equal(fixture.cases.length, 7);
assert.equal(new Set(fixture.cases.map((item) => item.id)).size, fixture.cases.length);
assert.equal(researchAnswerPresentationVersion, "20260902-product-example-contract-v1");

const codeSectionNames = new Map(
  (constructionBundle.codeSections || []).map((section) => [section.id, section.name])
);
const constructionEvidence = new Map();
for (const chapter of constructionBundle.chapters || []) {
  const codeSectionName = String(codeSectionNames.get(chapter.codeSectionID) || "");
  for (const group of chapter.groups || []) {
    const headerPrefix = String(group.headerLine || "").match(/^SECTION\s+([A-Z]+)/i)?.[1];
    const inferredPrefix = headerPrefix || (codeSectionName === "Building Code" ? "BC" : "");
    for (const section of group.sections || []) {
      if (!inferredPrefix) continue;
      const reference = `${inferredPrefix} ${section.sectionNumber}`;
      if (!constructionEvidence.has(reference)) {
        constructionEvidence.set(
          reference,
          `${section.title || ""} ${section.officialText || ""}`.replace(/\s+/g, " ").trim()
        );
      }
    }
  }
}

async function evidenceMap(catalog, readSection) {
  const result = new Map();
  for (const section of catalog) {
    const reference = `${section.codePrefix} ${section.sectionNumber}`;
    if (result.has(reference)) continue;
    const body = await readSection(section.id);
    const text = [
      section.title,
      ...(body?.blocks || []).map((block) => block.plainText || "")
    ].join(" ").replace(/\s+/g, " ").trim();
    result.set(reference, text);
  }
  return result;
}

const [historicalEvidence, zoningEvidence] = await Promise.all([
  historicalConstructionSectionCatalog().then((catalog) =>
    evidenceMap(catalog, historicalConstructionSection)
  ),
  zoningSectionCatalog().then((catalog) => evidenceMap(catalog, zoningSection))
]);

const evidenceByCorpus = new Map([
  ["nyc-2022-construction-codes", constructionEvidence],
  ["nyc-2014-construction-codes", historicalEvidence],
  ["nyc-zoning-resolution", zoningEvidence]
]);
const registry = createResearchCorpusRegistry();

for (const item of fixture.cases) {
  const corpusEvidence = evidenceByCorpus.get(item.corpusID);
  assert(corpusEvidence, `${item.id} names an unknown acceptance corpus.`);

  const firstTurn = item.turns[0];
  const routed = routeResearchCorpora({
    question: firstTurn.question,
    registry
  });
  const routedCorpusIDs = new Set([
    ...routed.selected.map((corpus) => corpus.id),
    ...routed.unavailable.map((corpus) => corpus.id)
  ]);
  assert(
    routedCorpusIDs.has(item.corpusID),
    `${item.id} must route to or explicitly disclose ${item.corpusID}.`
  );

  const presentationEvidence = item.requiredReferences.map((reference) => ({
    sectionID: reference,
    sourceID: `${reference}-passage`
  }));
  for (const turn of item.turns) {
    const presentation = researchAnswerPresentationContract({
      question: turn.question,
      evidence: presentationEvidence
    });
    assert.equal(
      presentation.mode,
      turn.presentationMode,
      `${item.id} has the wrong answer presentation mode for ${JSON.stringify(turn.question)}.`
    );
    assert.equal(presentation.directAnswerFirst, true);
    assert(presentation.requiredElements.length > 0);
    assert(presentation.universalRules.length >= 4);
  }

  if (item.outsideAuthorityRequired) {
    assert.equal(item.requiredReferences.length, 0);
    assert.match(item.answerBoundary, /Do not state .* from memory/i);
    continue;
  }

  for (const reference of item.requiredReferences) {
    assert(
      corpusEvidence.has(reference),
      `${item.id} references unavailable enacted evidence ${reference}.`
    );
  }
  for (const [reference, phrases] of Object.entries(item.requiredEvidencePhrases)) {
    const text = corpusEvidence.get(reference) || "";
    for (const phrase of phrases) {
      assert(
        text.toLocaleLowerCase("en-US").includes(phrase.toLocaleLowerCase("en-US")),
        `${item.id} expected ${JSON.stringify(phrase)} in ${reference}.`
      );
    }
  }
}

const historicalVision = fixture.cases.find((item) =>
  item.id === "product-example-vision-lite-2014"
);
assert.deepEqual(historicalVision.forbiddenReferences, ["BC 716.5.8.1.1"]);
assert.match(historicalVision.answerBoundary, /specific fire-protection-rated glazing conditions/);

const ramp = fixture.cases.find((item) => item.id === "product-example-ramp-2022");
assert.match(ramp.answerBoundary, /must not be invented/);
assert.equal(
  researchAnswerPresentationContract({
    question: ramp.turns[0].question,
    evidence: ramp.requiredReferences.slice(0, 3).map((sectionID) => ({ sectionID }))
  }).mode,
  "requirements-checklist",
  "A requirements table must not be forced when the supplied evidence does not contain enough parallel rules."
);

console.log("Permitext owner-example Research acceptance contract passed; paid model calls: no.");
