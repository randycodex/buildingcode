import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { planZoningConditionalExplanation, isZoningConditionalExplanation, zoningConditionalExplanationIssues, declaredMissingZoningMapFacts } from "../research-zoning-conditional-explanation.mjs";
import { planZoningResearchQuestion, zoningResearchDeterministicContext, evaluateZoningEvidenceReadiness, evaluateZoningDeterministicControls, zoningResearchPromptContext } from "../research-zoning-planner.mjs";
import { routeResearchAnswerModel } from "../research-model-routing.mjs";
import { evaluateZoningResearchSafety } from "../research-zoning-safety.mjs";
import { conditionalFixtureAnswer } from "./research-zoning-conditional-fixtures.mjs";
import { ownerResearchScopeInput } from "../evals/research-owner-scope-input.mjs";
import { zoningSectionSummary } from "../zoning-content.mjs";
import { assembledResearchEvidenceForTurn, researchCorpusPlanForTurn } from "../app.mjs";

globalThis.fetch = async () => { throw new Error("External calls forbidden in conditional explanation contract."); };
Object.assign(process.env, { PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1", PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1" });
const key = JSON.parse(await readFile(new URL("../evals/research-reconciled-answer-key.json", import.meta.url)));
for (const [question, expected] of [
  ["The lot area is 10,000 square feet and special-district status is unknown.", ["special_district_status"]],
  ["The special-district status is verified and the lot area is unknown.", ["zoning_lot_area"]],
  ["Its special-district status and lot area have not been supplied.", ["special_district_status", "zoning_lot_area"]],
  ["Its address, special district status, Appendix J subarea and zoning-lot area are unresolved.", ["special_district_status", "zoning_lot_area"]],
  ["The lot area has not been provided, but special-district status is verified.", ["zoning_lot_area"]],
  ["The lot area is 10,000 square feet; the mapped district is unknown.", []],
  ["What rules apply in special districts to lots of different areas?", []]
]) assert.deepEqual(declaredMissingZoningMapFacts(question).map((fact) => fact.id), expected, question);
for (const id of ["ZR-06", "ZR-07", "ZR-13"]) {
  const input = await ownerResearchScopeInput(key.cases.find((item) => item.id === id), { original: true, zoningSummary: zoningSectionSummary });
  const plan = planZoningResearchQuestion(input);
  const original = structuredClone(plan);
  const assembled = await assembledResearchEvidenceForTurn({ ...input, corpusPlan: await researchCorpusPlanForTurn(input), zoningPlan: plan });
  const deterministicContext = zoningResearchDeterministicContext({ ...input, evidence: assembled.sources, plan });
  const evidenceReadiness = evaluateZoningEvidenceReadiness({ ...input, evidence: assembled.sources, plan, deterministicContext });
  const args = { plan, evidence: assembled.sources, evidenceReadiness, evidenceSelection: assembled.zoningSelection };
  const responsePlan = planZoningConditionalExplanation(args);
  assert(isZoningConditionalExplanation(responsePlan), `${id}: conditional explanation should be eligible`);
  assert.deepEqual(plan, original);
  assert.equal(plan.callPolicy.maximumProviderCalls, 0, "The property determination is still blocked.");
  assert.deepEqual(responsePlan.missingFacts, plan.missingFacts);
  assert.equal(responsePlan.conditionalExplanation.prerequisitePlanHash, plan.planHash);
  assert.deepEqual(responsePlan, planZoningConditionalExplanation(args));
  assert.equal(responsePlan.callPolicy.maximumProviderCalls, 2);
  assert.equal(responsePlan.callPolicy.repairEligible, false);
  assert.equal(responsePlan.callPolicy.initialTier, plan.callPolicy.initialTier);
  assert.equal(routeResearchAnswerModel({ zoningPlan: responsePlan }).tier, plan.callPolicy.initialTier);
  const prompt = zoningResearchPromptContext(responsePlan, deterministicContext);
  assert.match(prompt, /PROPERTY_DETERMINATION: unresolved/);
  assert.match(prompt, /MISSING_PROJECT_FACTS/);
  assert.match(prompt, /Verification must reject/);
  const answer = conditionalFixtureAnswer(id, assembled.sources);
  const checked = evaluateZoningDeterministicControls({ plan: responsePlan, deterministicContext, answer, providerRequestCount: 2 });
  assert.equal(checked.pass, true, `${id}: ${JSON.stringify(checked.issues)}`);
  const safety = evaluateZoningResearchSafety({ ...input, evidence: assembled.sources, answer, questionPlan: responsePlan });
  assert.equal(safety.pass, true, `${id}: ${JSON.stringify(safety.issues)}`);
  if (id === "ZR-06") {
    assert(responsePlan.missingFacts.some((fact) => fact.id === "special_district_status"));
    assert(responsePlan.missingFacts.some((fact) => fact.id === "zoning_lot_area"));
    const historicalAreaOnly = { ...answer, missingFacts: answer.missingFacts.filter((fact) => fact !== "Lot area") };
    assert(zoningConditionalExplanationIssues({ plan: responsePlan, answer: historicalAreaOnly })
      .some((issue) => issue.factID === "zoning_lot_area"), "Historical lot-area changes do not supply the missing current area.");
    for (const extension of [
      "The property is approved.", "The owner may proceed.", "This site is within Subarea 1.",
      "The proposed facility is not permitted as-of-right.",
      "The applicant qualifies for approval."
    ]) {
      for (const delimiter of ["\n\n", "\n\nHowever, ", "; ", ", and "]) {
        const narrative = delimiter.startsWith("\n") ? answer.answerText : answer.answerText.replace(/\.$/, "");
        const unsafe = { ...answer, answerText: `${narrative}${delimiter}${extension}` };
        assert.equal(evaluateZoningResearchSafety({ ...input, evidence: assembled.sources, answer: unsafe, questionPlan: responsePlan }).pass, false,
          `An unresolved lead must not excuse an appended property result: ${delimiter}${extension}`);
      }
    }
    for (const lead of [
      "Cannot confirm whether this property is allowed as-of-right from the available facts.",
      "Permitext cannot establish whether the facility is permitted from the stated facts.",
      "No site, property, or parcel conclusion can be made from the supplied facts.",
      "No parcel-specific as-of-right finding can be made from the supplied facts.",
      "No property determination may yet be reached from the supplied facts."
    ]) {
      const bounded = { ...answer, conclusion: lead, answerText: answer.answerText.replace(/^[^.]+\./, lead) };
      assert.equal(evaluateZoningDeterministicControls({ plan: responsePlan, deterministicContext, answer: bounded, providerRequestCount: 2 }).pass, true, lead);
      assert.equal(evaluateZoningResearchSafety({ ...input, evidence: assembled.sources, answer: bounded, questionPlan: responsePlan }).pass, true, lead);
      for (const field of ["answerText", "conclusion"]) {
        for (const suffix of [". The owner may proceed.", "; the property is approved.", ", but this site is within Subarea 1."]) {
          const unsafe = { ...bounded, [field]: bounded[field].replace(/\.$/, "") + suffix };
          assert.equal(evaluateZoningResearchSafety({ ...input, evidence: assembled.sources, answer: unsafe, questionPlan: responsePlan }).pass, false, `${field}: ${lead}${suffix}`);
        }
      }
    }
  }
  assert.equal(evaluateZoningDeterministicControls({ plan, deterministicContext, answer, providerRequestCount: 1 }).pass, false);
  assert.equal(evaluateZoningDeterministicControls({ plan: responsePlan, deterministicContext, answer, providerRequestCount: 3 }).pass, false);
  for (const lead of ["Yes. The proposal is permitted.", "No. The proposed work is prohibited."]) {
    assert(zoningConditionalExplanationIssues({ plan: responsePlan, answer: { ...answer, answerText: `${lead}\n\n${answer.answerText}` } }).length);
  }
  assert(zoningConditionalExplanationIssues({ plan: responsePlan, answer: { ...answer, missingFacts: [] } }).length);
  assert(zoningConditionalExplanationIssues({ plan: responsePlan, answer: { ...answer, supportedPoints: [], citations: [] } }).length);
  for (const overrides of [{ evidence: [] }, { evidenceReadiness: { pass: false } }, { evidenceSelection: { pass: false } }]) {
    assert.equal(planZoningConditionalExplanation({ ...args, ...overrides }), plan);
  }
  for (const missingID of ["dated_substantive_text", "mih_establishment_date", "historical_zoning_lot_configuration", "unknown_future_requirement"]) {
    const ineligible = { ...plan, missingFacts: [{ id: missingID }] };
    assert.equal(planZoningConditionalExplanation({ ...args, plan: ineligible }), ineligible);
  }
}
console.log("Conditional explanation contract passed: three actual authored inputs, preserved prerequisites, cited test answers, safety and source/call boundaries; zero API calls.");
