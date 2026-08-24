import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  researchProjectContextOnlyEligibility,
  researchProjectContextOnlyInterpretation,
  researchProjectInformation
} from "../app.mjs";
import { immutableResearchAnswer } from "../project-foundation-contract.mjs";

const createdAt = "2026-08-24T12:00:00.000Z";
const sourcedFact = (key, label, value) => ({
  id: `nyc-planning:${key}`,
  key,
  label,
  value,
  status: "sourced",
  source: "nyc-planning",
  sourceText: "NYC Department of City Planning data retrieved 2026-08-24.",
  updatedAt: createdAt
});

const projectInformation = researchProjectInformation("project-1", {
  address: "1 CENTRE STREET, Manhattan, NY 10007",
  description: "Imported NYC Planning test project.",
  updatedAt: createdAt,
  structuredFacts: [
    sourcedFact("address", "Address", "1 CENTRE STREET, Manhattan, NY 10007"),
    sourcedFact("bbl", "BBL", "1001210001"),
    sourcedFact("borough", "Borough", "Manhattan"),
    sourcedFact("block", "Block", "121"),
    sourcedFact("tax-lots", "Tax Lots", "1"),
    sourcedFact("zoning-districts", "Zoning Districts", "C6-4"),
    sourcedFact("zoning-map", "Zoning Map", "12c"),
    sourcedFact("community-district", "Community District", "1"),
    sourcedFact("year-built", "Year Built", "1914")
  ]
});

const failedLiveQuestion = "Summarize the imported Project context only, including the address and property identifiers. Do not determine zoning or code requirements.";
assert.equal(researchProjectContextOnlyEligibility({
  question: failedLiveQuestion,
  projectInformation
}), true, "The reproduced Project-context-only question must bypass code retrieval.");

assert.equal(researchProjectContextOnlyEligibility({
  question: "Identify the property address, BBL, zoning district, and limitations before relying on those facts.",
  projectInformation
}), true, "A sourced zoning-district lookup is factual, not a zoning-law conclusion.");

for (const question of [
  "What does C6-4 permit?",
  "What are the off-street parking requirements?",
  "Does this Project comply with Building Code section 304?",
  "Determine the applicable zoning requirements for this property.",
  "Calculate the permitted floor area ratio.",
  "Summarize the address. Do not determine zoning requirements; tell me what uses are permitted."
]) {
  assert.equal(researchProjectContextOnlyEligibility({ question, projectInformation }), false,
    `Substantive question must remain in governed Research: ${question}`);
}

assert.equal(researchProjectContextOnlyEligibility({
  question: failedLiveQuestion,
  projectInformation: null
}), false, "A Project-context-only answer requires a linked Project record.");

const interpretation = researchProjectContextOnlyInterpretation({
  question: failedLiveQuestion,
  projectInformation
});
assert.match(interpretation.answerText, /1 CENTRE STREET/);
assert.match(interpretation.answerText, /1001210001/);
assert.match(interpretation.answerText, /C6-4/);
assert.match(interpretation.answerText, /do not determine Construction Code or Zoning Resolution requirements/i);
assert.match(interpretation.conclusion, /1 CENTRE STREET/,
  "Compatibility clients that render conclusion and explanation must receive the Project facts.");
assert.match(interpretation.explanation, /do not determine Construction Code or Zoning Resolution requirements/i);
assert.ok(interpretation.projectFactsUsed.length >= 6);
assert.deepEqual(interpretation.citations, []);
assert.deepEqual(interpretation.supportedPoints, []);

const targetedInterpretation = researchProjectContextOnlyInterpretation({
  question: "Using this Project context, identify the property address, BBL, zoning district, and limitations before relying on those facts.",
  projectInformation
});
assert.deepEqual(
  targetedInterpretation.selectedFacts.map((fact) => fact.key),
  ["address", "bbl", "zoning-districts"],
  "A targeted factual request should not dump unrelated Project facts."
);

const projectContextAnswer = {
  mode: "project_context",
  model: "permitext-deterministic-project-context",
  ...interpretation,
  factUsage: {
    schemaVersion: 1,
    projectContext: interpretation.projectFactsUsed,
    conversation: [],
    other: []
  },
  verification: {
    status: "project_context",
    pass: true,
    reason: "PROJECT_CONTEXT_ONLY"
  }
};
const immutable = immutableResearchAnswer({
  id: "project-context-answer-1",
  owner: { kind: "user", id: "user-1" },
  conversationID: "conversation-1",
  projectID: "project-1",
  question: failedLiveQuestion,
  answer: projectContextAnswer,
  evidence: [],
  citations: [],
  model: "permitext-deterministic-project-context",
  researchSystemVersion: "project-context-v1",
  createdAt
});
assert.equal(immutable.evidenceSetVersion, 0);
assert.deepEqual(immutable.passageToCitationMapping, []);
assert.equal(immutable.verification.status, "project_context");

assert.throws(() => immutableResearchAnswer({
  id: "ordinary-answer-without-evidence",
  owner: { kind: "user", id: "user-1" },
  conversationID: "conversation-1",
  projectID: "project-1",
  question: "What is required?",
  answer: { conclusion: "A requirement applies." },
  evidence: [],
  citations: [],
  model: "test",
  researchSystemVersion: "test",
  createdAt
}), /require evidence/, "Ordinary answers must still require enacted evidence.");

const appSource = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
const handlerSource = appSource.slice(appSource.indexOf("async function handleResearchConversationMessage"));
assert.ok(
  handlerSource.indexOf("researchProjectContextOnlyEligibility") < handlerSource.indexOf("researchCorpusPlanForTurn"),
  "Project-context-only routing must occur before corpus retrieval and model reservation."
);

console.log("Research Project-context summary contract passed.");
