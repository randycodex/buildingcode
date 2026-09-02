import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { researchBodyForCatalogSection } from "../app.mjs";
import { discoverRelevantEvidence } from "../evidence-discovery.mjs";
import {
  historicalConstructionSearchIndex,
  historicalConstructionSection,
  historicalConstructionSectionCatalog
} from "../historical-construction-content.mjs";
import {
  evaluateResearchAnswerQuality,
  researchAnswerQualityRevisionIssues
} from "../research-answer-quality.mjs";
import {
  applyResearchOutsideAuthorityStartingPoints,
  researchAnswerPresentationContract,
  researchRequestedAreaConversions
} from "../research-answer-presentation.mjs";
import {
  createResearchCorpusRegistry,
  routeResearchCorpora
} from "../research-corpus-registry.mjs";
import {
  assembleResearchEvidence,
  researchEvidenceRetrievalQuery
} from "../research-evidence-assembly.mjs";
import {
  classifyResearchWebSource,
  researchDiscoveryNeedsAutomaticWebSupport,
  researchSourcePolicyConfiguration,
  researchWebSupportTrigger
} from "../research-source-policy.mjs";
import {
  planZoningResearchQuestion,
  selectZoningResearchEvidence,
  zoningResearchEvidenceLimits
} from "../research-zoning-planner.mjs";
import {
  zoningSearchIndex,
  zoningSection,
  zoningSectionCatalog
} from "../zoning-content.mjs";

const testRoot = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(testRoot, "..");
const workspaceRoot = join(serverRoot, "..");
const constructionPreparedRoot = join(
  workspaceRoot,
  "NYC CC APP",
  "permitext",
  "Resources",
  "CodeContent",
  "authored",
  "new-york-city",
  "2022-construction-codes",
  "prepared"
);

async function currentBuildingCodeResources() {
  const manifest = JSON.parse(await readFile(join(constructionPreparedRoot, "manifest.json"), "utf8"));
  const searchIndex = JSON.parse(await readFile(join(constructionPreparedRoot, "searchIndex.json"), "utf8"));
  const catalog = [];
  for (const chapterRecord of manifest.chapters || []) {
    if (chapterRecord.codeSectionID !== 1) continue;
    const chapter = JSON.parse(await readFile(
      join(constructionPreparedRoot, "chapters", `${chapterRecord.chapterID}.json`),
      "utf8"
    ));
    for (const group of chapter.groups || []) {
      for (const section of group.sections || []) {
        catalog.push({
          ...section,
          chapterID: chapter.chapterID,
          chapterNumber: String(chapter.chapterNumber || ""),
          codePrefix: "BC",
          corpusID: "nyc-2022-construction-codes",
          codeEdition: "2022 New York City Construction Codes",
          codeVersion: "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1",
          headerLine: group.headerLine,
          headingLine: group.headingLine
        });
      }
    }
  }
  return {
    catalog,
    invertedIndex: new Map(Object.entries(searchIndex.tokens || {})),
    readSectionBody: researchBodyForCatalogSection,
    availableCodePrefixes: ["BC"]
  };
}

async function resourcesForCorpus(corpusID, currentBuildingCode) {
  if (corpusID === "nyc-2022-construction-codes") return currentBuildingCode;
  if (corpusID === "nyc-2014-construction-codes") {
    return {
      catalog: await historicalConstructionSectionCatalog(),
      invertedIndex: await historicalConstructionSearchIndex(),
      readSectionBody: (section) => historicalConstructionSection(section.id),
      availableCodePrefixes: ["AC", "BC", "PC", "MC", "FGC"]
    };
  }
  if (corpusID === "nyc-zoning-resolution") {
    return {
      catalog: await zoningSectionCatalog(),
      invertedIndex: await zoningSearchIndex(),
      readSectionBody: (section) => zoningSection(section.id),
      availableCodePrefixes: ["ZR"]
    };
  }
  throw new Error(`Unsupported product-example corpus: ${corpusID}`);
}

function referenceFor(source) {
  return `${source.codePrefix} ${source.sectionNumber}`;
}

async function discover(resources, question, limit = 14) {
  return discoverRelevantEvidence({
    question,
    catalog: resources.catalog,
    invertedIndex: resources.invertedIndex,
    readSectionBody: resources.readSectionBody,
    availableCodePrefixes: resources.availableCodePrefixes,
    limit
  });
}

const originalFetch = globalThis.fetch;
let networkAttempts = 0;
let orderedTurnCount = 0;
globalThis.fetch = async () => {
  networkAttempts += 1;
  throw new Error("The product-example runtime contract forbids network access.");
};

try {
  const fixture = JSON.parse(await readFile(
    join(serverRoot, "evals", "research-product-example-cases.json"),
    "utf8"
  ));
  const currentBuildingCode = await currentBuildingCodeResources();

  const appendixQuestion = "what BC-Appendix P";
  assert.deepEqual(
    routeResearchCorpora({
      question: appendixQuestion,
      registry: createResearchCorpusRegistry()
    }).selected.map((corpus) => corpus.id),
    ["nyc-2022-construction-codes", "nyc-2014-construction-codes"]
  );
  const [currentAppendixResult, historicalAppendixResult] = await Promise.all([
    discover(currentBuildingCode, appendixQuestion),
    resourcesForCorpus("nyc-2014-construction-codes", currentBuildingCode)
      .then((resources) => discover(resources, appendixQuestion))
  ]);
  assert(
    currentAppendixResult.candidates.some((candidate) => referenceFor(candidate) === "BC P"),
    "The current Appendix P Reserved status must remain available."
  );
  const historicalAppendixReferences = new Set(
    historicalAppendixResult.candidates.map(referenceFor)
  );
  assert(historicalAppendixReferences.has("BC P101.1"));
  assert(historicalAppendixReferences.has("BC P102.1"));

  for (const example of fixture.cases) {
    const resources = await resourcesForCorpus(example.corpusID, currentBuildingCode);
    const previousMessages = [];
    for (const turn of example.turns) {
      orderedTurnCount += 1;
      const query = researchEvidenceRetrievalQuery({
        question: turn.question,
        previousMessages
      });
      const result = await discover(resources, query.retrievalQuery);
      const requiredReferenceSet = new Set(example.requiredReferences || []);
      const presentationCandidates = example.outsideAuthorityRequired
        ? result.candidates
        : result.candidates.filter((candidate) => requiredReferenceSet.has(referenceFor(candidate)));
      const presentation = researchAnswerPresentationContract({
        question: turn.question,
        evidence: presentationCandidates.map((candidate) => ({
          sectionID: candidate.sectionID,
          sourceID: candidate.sourceID,
          text: candidate.selectedText
        }))
      });
      assert.equal(presentation.mode, turn.presentationMode, `${example.id} presentation drifted.`);

      if (example.outsideAuthorityRequired) {
        const omh = result.outsideCurrentLibrary.find((source) =>
          source.label === "NYS Office of Mental Health requirements"
        );
        assert.equal(
          omh?.sourceURL,
          "https://omh.ny.gov/omhweb/policy_and_regulations/"
        );
        assert.equal(
          result.outsideCurrentLibrary.find((source) =>
            source.label === "federal accessibility requirements"
          )?.sourceURL,
          "https://www.ada.gov/"
        );
        assert.equal(researchDiscoveryNeedsAutomaticWebSupport(result), true);
        const trigger = researchWebSupportTrigger({
          question: turn.question,
          outsideLibraryRequired: researchDiscoveryNeedsAutomaticWebSupport(result)
        }, {});
        assert.equal(trigger.useWeb, true);
        assert(trigger.reasons.includes("outside_library_support_needed"));
        assert(researchSourcePolicyConfiguration({}).officialDomains.includes("ny.gov"));
        assert.equal(
          classifyResearchWebSource({
            url: "https://omh.ny.gov/omhweb/policy_and_regulations/"
          }).sourceClassification,
          "official_guidance"
        );

        const startingPointAnswer = applyResearchOutsideAuthorityStartingPoints({
          answerText: "The supplied enacted evidence does not establish an OMH program-specific fixture ratio.",
          supportingSources: [{ url: "https://www.ada.gov/" }],
          evidenceLimitations: []
        }, result.outsideCurrentLibrary);
        assert.match(
          startingPointAnswer.answerText,
          /\[New York State Office of Mental Health\]\(https:\/\/omh\.ny\.gov\/omhweb\/policy_and_regulations\/\)/
        );
        assert.doesNotMatch(
          startingPointAnswer.answerText,
          /\[federal accessibility requirements\]/,
          "An already retained supporting source must not be duplicated as a starting-point link."
        );
        assert.match(
          startingPointAnswer.evidenceLimitations.at(-1),
          /not a source-bound substantive rule/i
        );
        assert.deepEqual(
          applyResearchOutsideAuthorityStartingPoints(
            startingPointAnswer,
            result.outsideCurrentLibrary
          ),
          startingPointAnswer,
          "Outside-authority starting-point repair must be idempotent."
        );
      } else {
        const candidateReferences = new Set(result.candidates.map(referenceFor));
        for (const reference of example.requiredReferences) {
          assert(candidateReferences.has(reference), `${example.id} runtime retrieval is missing ${reference}.`);
        }
      }

      if (example.id === "product-example-appendix-p") {
        const appendix = result.candidates.find((candidate) => referenceFor(candidate) === "BC P");
        assert.match(appendix?.selectedText || "", /Appendix P:\s*Reserved/i);
      }

      if (example.id === "product-example-c4-4d-r8a") {
        assert.equal(query.previousTopicApplied, previousMessages.length > 0);
        if (previousMessages.length > 0) {
          assert.equal(query.topicDecision.signals.formatTransformation, true);
          assert.match(query.retrievalQuery, /C4-4D/i);
          assert.match(query.retrievalQuery, /R8A/i);
        }
      }

      if (example.id === "product-example-vision-lite-2014" && previousMessages.length === 0) {
        const vision = result.candidates.find((candidate) => referenceFor(candidate) === "BC 715.4.7.1");
        const evidence = [{
          sourceID: "vision-lite-runtime",
          sectionID: vision.sectionID,
          codePrefix: vision.codePrefix,
          sectionNumber: vision.sectionNumber,
          text: vision.selectedText,
          evidencePriority: { evidenceRole: "governing", topicRouteRelationship: "aligned" }
        }];
        assert.deepEqual(
          researchRequestedAreaConversions({ question: turn.question, evidence })
            .map(({ squareInches, squareFeet }) => [squareInches, Number(squareFeet.toFixed(3))]),
          [[100, 0.694]]
        );
        const missingConversion = evaluateResearchAnswerQuality({
          question: turn.question,
          evidence,
          answer: {
            answerText: "The cited condition limits the glazing to 100 square inches.",
            supportedPoints: [{ sourceIDs: ["vision-lite-runtime"] }],
            citations: [{ sourceIDs: ["vision-lite-runtime"] }]
          }
        });
        assert.equal(missingConversion.pass, false);
        assert.match(researchAnswerQualityRevisionIssues(missingConversion)[0].detail, /0\.694 square feet/);
      }

      previousMessages.push(
        { role: "user", question: turn.question },
        { role: "assistant", content: "Prior answer retained for deterministic follow-up routing." }
      );
    }
  }

  const c4 = fixture.cases.find((example) => example.id === "product-example-c4-4d-r8a");
  const zoningResources = await resourcesForCorpus(c4.corpusID, currentBuildingCode);
  const zoningQuestion = c4.turns[0].question;
  const zoningPlan = planZoningResearchQuestion({ question: zoningQuestion });
  const catalogByID = new Map(zoningResources.catalog.map((section) => [String(section.id), section]));
  const assembled = await assembleResearchEvidence({
    question: zoningQuestion,
    limits: zoningResearchEvidenceLimits(zoningPlan),
    discover: ({ question, limit, retrievalContext }) => discoverRelevantEvidence({
      question,
      retrievalContext,
      catalog: zoningResources.catalog,
      invertedIndex: zoningResources.invertedIndex,
      readSectionBody: zoningResources.readSectionBody,
      availableCodePrefixes: zoningResources.availableCodePrefixes,
      limit
    }),
    resolveSection: async (request) => {
      const section = catalogByID.get(String(request.sectionID || "")) ||
        zoningResources.catalog.find((candidate) =>
          candidate.codePrefix === request.codePrefix &&
          candidate.sectionNumber === request.sectionNumber
        );
      if (!section) return null;
      const body = await zoningResources.readSectionBody(section);
      return {
        ...section,
        sectionID: String(section.id),
        text: (body?.blocks || []).map((block) => block.plainText || "").filter(Boolean).join("\n\n")
      };
    }
  });
  const zoningSelection = selectZoningResearchEvidence({
    question: zoningQuestion,
    evidence: assembled.sources,
    plan: zoningPlan
  });
  const selectedReferences = new Set(zoningSelection.sources.map(referenceFor));
  for (const reference of c4.requiredReferences) {
    assert(selectedReferences.has(reference), `C4/R8A model-visible evidence is missing ${reference}.`);
  }

  assert.equal(fixture.cases.length, 7);
  assert.equal(orderedTurnCount, 9);
  assert.equal(networkAttempts, 0);
  console.log(
    "Permitext owner-example runtime contract passed: 7 conversations, 9 ordered turns, 0 network attempts, 0 paid provider calls."
  );
} finally {
  globalThis.fetch = originalFetch;
}
