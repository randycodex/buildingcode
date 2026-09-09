import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { planZoningResearchQuestion } from "../research-zoning-planner.mjs";
import { planZoningConditionalExplanation } from "../research-zoning-conditional-explanation.mjs";
import { createResearchCorpusRegistry, routeResearchCorpora } from "../research-corpus-registry.mjs";

globalThis.fetch = async () => { throw new Error("Historical-intent tests cannot use network or providers."); };
const registry = createResearchCorpusRegistry({ zoningResearchEligibility: true });
const missingHistoricalText = (question, extra = {}) => {
  const plan = planZoningResearchQuestion({ question, ...extra });
  assert(plan.missingFacts.some((fact) => fact.id === "dated_substantive_text"), question);
  assert.equal(plan.questionSignals.historicalSubstantiveTextRequested, true, question);
  assert.equal(plan.callPolicy.maximumProviderCalls, 0, question);
  assert.equal(plan.deterministicControls.effectiveDateEventBinding, true, question);
  assert.equal(planZoningConditionalExplanation({ plan, evidence: [{ codePrefix: "ZR", text: "Current consolidated text." }],
    evidenceReadiness: { pass: true }, evidenceSelection: { pass: true } }), plan,
  "A current-source explanation cannot waive missing historical substantive law.");
  return plan;
};

for (const date of [
  ...["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    .map((month) => `${month} 1, 2020`),
  "Jan. 1, 2020", "September 1st, 2020", "1 January 2020", "2020-01-01", "1/1/2020", "2020", "January 2020", "1/1/20"
]) {
  const plan = missingHistoricalText(`What did ZR Section 23-343 require on ${date}?`);
  assert.equal(plan.path, "effective_date_history");
}

const historicalQuestions = [
  "What did ZR Section 23-343 require on January 1, 2020? Reconstruct the rules in force.",
  "What did it require on January 1, 2020?",
  "Using current Zoning transition text, what did the rules require in 2020?",
  "Reconstruct the text in force under the NYC Zoning Resolution on January 1, 2020.",
  "What was the minimum rear yard depth under ZR Section 23-343 in 2020?",
  "Which ZR requirements applied on January 1, 2020?",
  "Under ZR Section 23-343 as of January 1, 2020, what minimum depth was required?",
  "Was self-service storage permitted under the Zoning Resolution in 2016?",
  "On January 1, 2020, did ZR Section 23-343 allow that reduction?",
  "What does ZR Section 23-343 require as of January 1, 2020?",
  "What does ZR Section 23-343 permit on January 1, 2020?",
  "Under the 2020 Zoning Resolution, what was the minimum rear yard depth?",
  "In the 2020 version of ZR Section 23-343, what minimum depth was required?",
  "What were the pre-2024 zoning rules?",
  "What did ZR Section 23-343 require before City of Yes?",
  "Explain the prior zoning rules.",
  "Quote the historical zoning text.",
  "What are the Zoning rules in effect on January 1, 2020?",
  "Can current amendment-history metadata reconstruct the text in force? What did ZR Section 23-343 require in 2020?",
  "Where can I find the prior zoning rules, and what did ZR Section 23-343 require in 2020?",
  "Can current transition text establish the old rules, and what did ZR Section 23-343 require in 2020?"
];
for (const question of historicalQuestions) missingHistoricalText(question);

const historicalQuestion = "Reconstruct the Zoning text in force on January 1, 2020";
for (const statement of [
  "without official archived substantive text",
  "official archived substantive text is unavailable",
  "no dated enacted substantive text has been provided",
  "official archived text has not been verified",
  "if official archived text is available",
  "the owner says official archived text is available",
  "official archived text is available",
  "dated enacted text is provided"
]) {
  missingHistoricalText(`${historicalQuestion}, ${statement}.`);
  missingHistoricalText(`${historicalQuestion}.`, { projectFacts: [statement] });
  for (const category of ["established", "hypothetical", "qualified", "unknown"]) {
    missingHistoricalText(`${historicalQuestion}.`, { conversationFactContext: { [category]: [statement] } });
  }
}

const mixed = missingHistoricalText("For this specific property with an unknown mapped district, what did ZR Section 23-343 require in 2020?");
assert.equal(mixed.path, "property_map_applicability");
assert(mixed.missingFacts.some((fact) => fact.id === "official_mapped_status"));

// Preserve useful current-law and source-boundary answers. A past project fact
// inside a current-rule question is not a request to reconstruct old law.
for (const question of [
  "What transition applies on December 5, 2024?",
  "May this project continue under the old zoning rules through the City of Yes transition?",
  "Can current amendment-history metadata reconstruct the Zoning text in force on January 1, 2020?",
  "Is the selected transition text enough to establish the rules in force on January 1, 2020?",
  "Why can't current amendment-history metadata reconstruct the Zoning text in force in 2020?",
  "Can current consolidated Zoning text establish the rules in force on January 1, 2020?",
  "Where can I retrieve the prior zoning rules?",
  "How do I find the historical zoning text?",
  "How should a professional verify the Zoning rules in force on January 1, 2020?",
  "What does NYC Planning's official amendment-history metadata currently identify for Section 42-00, and what must a professional still verify before reconstructing the text in force on a particular date?",
  "What does current ZR Section 23-343 require for a lot that was 150 feet deep on December 15, 1961?",
  "What is the current ZR Section 23-343 minimum for a lot that was established in 2020?",
  "What does current ZR Section 11-333 require for a permit on December 4, 2024?",
  "What was this lot's depth in 1961?",
  "What does ZR Section 23-343 require?"
]) {
  const plan = planZoningResearchQuestion({ question });
  assert.equal(plan.questionSignals.historicalSubstantiveTextRequested, false, question);
  assert(!plan.missingFacts.some((fact) => fact.id === "dated_substantive_text"), question);
}

const retainedCohort = JSON.parse(await readFile(new URL("../evals/zoning-cases-expanded-batch-1-successor-remediation-3.json", import.meta.url)));
const retainedTransition = retainedCohort.cases.find((item) => item.id === "zr-candidate-b1-city-of-yes-transition");
assert(retainedTransition);
assert.equal(planZoningResearchQuestion({ question: retainedTransition.question }).disposition, "ready",
  "The retained City of Yes application/permit/foundation scenario asks about the current transition, not reconstruction of old substantive text.");

for (const question of ["Using current Zoning transition text, what did the rules require in 2020?", "Explain the prior zoning rules.", "What can current zoning amendment metadata establish?"]) {
  const route = routeResearchCorpora({ question, registry });
  assert.deepEqual(route.selected.map((corpus) => corpus.id), ["nyc-zoning-resolution"],
    `Explicit Zoning history terminology must route to the Zoning corpus: ${question}`);
  const restricted = routeResearchCorpora({ question, registry: createResearchCorpusRegistry() });
  assert.deepEqual(restricted.selected, []);
  assert.deepEqual(restricted.unavailable.map((corpus) => corpus.id), ["nyc-zoning-resolution"]);
}
console.log("Historical Zoning intent passed: 20 date formats/months, 21 paraphrases, 40 archive-availability contexts, mixed parcel/history requests, 15 current-law/source-boundary controls and the retained transition scenario; no provider calls.");
