import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { planZoningResearchQuestion, zoningResearchDeterministicContext, evaluateZoningDeterministicControls } from "../research-zoning-planner.mjs";
import { assembleResearchEvidence } from "../research-evidence-assembly.mjs";
import { assembledResearchEvidenceForTurn, researchCorpusPlanForTurn } from "../app.mjs";
import { zoningSection } from "../zoning-content.mjs";
import { immutableEvidenceSnapshot } from "../project-foundation-contract.mjs";

globalThis.fetch = async () => { throw new Error("Network forbidden in retained direct-rule regressions."); };
Object.assign(process.env, { PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1", PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1" });
const retained = JSON.parse(await readFile(new URL("../evals/results/research-owner-live-zoning-small-confirmation-2026-09-08.json", import.meta.url)));
const resultFor = (id) => retained.results.find((item) => item.id === id);
function evaluate(id, answer, question = resultFor(id).question, evidence = resultFor(id).answer.zoningArchitecture.evidenceSelection.sources) {
  const plan = planZoningResearchQuestion({ question });
  const deterministicContext = zoningResearchDeterministicContext({ question, evidence, plan });
  return { plan, deterministicContext, controls: evaluateZoningDeterministicControls({ plan, deterministicContext, answer, providerRequestCount: 1 }) };
}
function corrected(id, text, explanations) {
  const answer = structuredClone(resultFor(id).answer);
  answer.answerText = text;
  answer.conclusion = text;
  answer.supportedPoints = explanations.map((explanation) => ({ ...answer.supportedPoints[0], explanation }));
  return answer;
}
const rules = corrected("ZR-01",
  "The particular controls the general. The enacted text controls conflicting captions, illustrations, summary tables and illustrative tables. ZR 12-01(a)-(b).",
  ["The particular controls the general. The enacted text controls conflicting captions, illustrations, summary tables and illustrative tables."]);
const spacing = corrected("ZR-14",
  "No under the stated basic rule. ZR 23-371 requires 40 feet between the closest points of these unconnected buildings for portions below 125 feet. The 30-foot separation is 10 feet short. The rear yard equivalent exception can change that result if it applies.",
  ["For the stated buildings, 40 feet is required between the closest points below 125 feet; 40 minus 30 leaves a 10-foot shortfall.",
    "The rear yard equivalent exception makes the section inapplicable when the buildings are separated by that equivalent."]);
assert(evaluate("ZR-01", resultFor("ZR-01").answer).controls.issues.some((issue) => issue.obligationID === "construction_particular_controls_general"));
assert(evaluate("ZR-14", resultFor("ZR-14").answer).controls.issues.some((issue) => issue.obligationID === "separate_buildings_requested_height_scope"));
for (const [id, answer] of [["ZR-01", rules], ["ZR-14", spacing]]) {
  const checked = evaluate(id, answer);
  assert(checked.controls.pass, JSON.stringify(checked.controls.issues));
  const misbound = structuredClone(answer);
  misbound.supportedPoints.forEach((point) => { point.sourceIDs = ["another-section"]; });
  assert(!evaluate(id, misbound).controls.pass, "Matching prose must remain bound to its governing source.");
}
for (const phrase of ["Specific provisions take precedence over general provisions.", "The specific rule governs the general rule.", "The particular shall control the general."]) {
  const text = `${phrase} The enacted text controls conflicting illustrations and summary tables. ZR 12-01.`;
  assert(evaluate("ZR-01", corrected("ZR-01", text, [text])).controls.pass, phrase);
}
for (const phrase of ["The particular does not control the general.", "It is not true that the particular controls the general."]) {
  const text = `${phrase} The enacted text controls illustrations and summary tables.`;
  assert(!evaluate("ZR-01", corrected("ZR-01", text, [text])).controls.pass, phrase);
}
for (const [phrase, pass] of [["must give controlling effect to the text", true], ["must not give controlling effect to the text", false]]) {
  const text = `The particular controls the general. For conflicting illustrations or summary tables, the reader ${phrase}.`;
  assert.equal(evaluate("ZR-01", corrected("ZR-01", text, [text])).controls.pass, pass, phrase);
}
const fiveFootQuestion = resultFor("ZR-14").question.replace("30 feet apart", "35 feet apart");
assert(evaluate("ZR-14", spacing, fiveFootQuestion).controls.issues.some((issue) => issue.obligationID === "separate_buildings_spacing_shortfall"));
const fiveFootAnswer = JSON.parse(JSON.stringify(spacing).replaceAll("30", "35").replaceAll("10", "5"));
assert(evaluate("ZR-14", fiveFootAnswer, fiveFootQuestion).controls.pass);
const explicitComparison = `${resultFor("ZR-14").question} Compare the 80-foot upper-height standard too.`;
assert(evaluate("ZR-14", spacing, explicitComparison).deterministicContext.answerObligations.some((item) => item.id === "separate_buildings_requested_height_scope"),
  "An explicitly requested height comparison still needs its qualifications.");
const spelledExtra = structuredClone(spacing);
spelledExtra.supportedPoints.push({ ...spacing.supportedPoints[0], explanation: "Above 125 feet, eighty feet is always required." });
assert(!evaluate("ZR-14", spelledExtra).controls.pass);
const qualifiedExtra = structuredClone(spacing);
qualifiedExtra.supportedPoints[0].explanation += " Portions above 125 feet have a separate 80-foot rule, subject to the stated proviso in the passage.";
assert(evaluate("ZR-14", qualifiedExtra).controls.pass, "A qualified comparison must not be rejected merely for mentioning another height range.");
const negatedQualification = structuredClone(qualifiedExtra);
negatedQualification.supportedPoints[0].explanation = negatedQualification.supportedPoints[0].explanation.replace("subject to", "not subject to");
assert(!evaluate("ZR-14", negatedQualification).controls.pass, "A negated qualification must not satisfy the check.");
const sourceBoundArithmetic = structuredClone(spacing);
sourceBoundArithmetic.supportedPoints[0].explanation = "For the stated buildings, 40 feet is required between the closest points below 125 feet.";
assert(evaluate("ZR-14", sourceBoundArithmetic).controls.pass, "The arithmetic may be in the main explanation when its governing rule is source-bound.");

const compact = (text) => text.replace(/\s+/g, " ").trim();
const canonicalSources = [];
for (const [id, sectionID] of [["ZR-01", "20018521"], ["ZR-14", "20018102"]]) {
  const section = await zoningSection(sectionID);
  const selectedText = compact(section.blocks.map((block) => block.plainText || "").join("\n\n"));
  const input = { question: resultFor(id).question, projectFacts: [], messages: [], pinnedEvidence: [{ sectionID, sourceID: `reader-${id}`, selectedText, codePrefix: "ZR", sectionNumber: id === "ZR-01" ? "12-01" : "23-371" }] };
  const plan = planZoningResearchQuestion(input);
  const assembled = await assembledResearchEvidenceForTurn({ ...input, corpusPlan: await researchCorpusPlanForTurn(input), zoningPlan: plan });
  const supplied = assembled.sources.find((source) => source.sectionID === sectionID);
  assert.equal(supplied.text, selectedText);
  assert.equal(supplied.canonicalContextComplete, true);
  assert.equal(supplied.truncated, false);
  assert.equal(supplied.pinnedSelectionExact, true);
  assert.equal(assembled.zoningSelection.pass, true);
  assert(assembled.usage.characterCount <= 8000);
  const snapshot = immutableEvidenceSnapshot({ source: supplied, approvedAt: "2026-09-08T12:00:00.000Z", evidenceSetVersion: 1, sourceLibraryVersion: supplied.codeVersion });
  assert.equal(snapshot.passageText, selectedText);
  assert.equal(snapshot.provenance.userSelectedText, selectedText);
  if (id === "ZR-14") {
    assert.match(supplied.text, /need not exceed 40 feet/);
    assert.match(supplied.text, /18,501 to 19,999 41/);
    assert.match(supplied.text, /obstructions permitted in Section 23-311/);
  }
  canonicalSources.push({ ...supplied, canonicalText: supplied.text });
}
const source = canonicalSources[1];
const single = { sectionID: source.sectionID, sourceID: "selected-spacing", selectedText: source.text };
const assemble = (pins, maximumCharacters = 8000) => assembleResearchEvidence({ question: resultFor("ZR-14").question, pinnedEvidence: pins,
  resolveSection: async (reference) => canonicalSources.find((item) => item.sectionID === reference.sectionID),
  discover: async () => ({ candidates: [] }), limits: { maximumCharacters, maximumCharactersPerSource: 4000 } });
const limited = await assemble([single], 5000);
assert(limited.sources[0].text.length <= 4000 && limited.sources[0].truncated);
const partial = await assemble([{ ...single, selectedText: source.text.slice(0, 2500) }]);
assert.equal(partial.sources[0].text, source.text.slice(0, 2500));
assert.equal(partial.sources[0].canonicalContextComplete, false);
const changed = await assemble([{ ...single, selectedText: `${source.text} Invented sentence.` }]);
assert.equal(changed.limits.maximumCompletePinnedSectionCharacters, undefined);
const multiple = await assemble(canonicalSources.map((item) => ({ sectionID: item.sectionID, selectedText: item.text })));
assert.equal(multiple.sources.length, 2);
assert(multiple.sources.every((item) => item.canonicalContextComplete && !item.truncated));
assert(multiple.usage.characterCount <= 8000);
console.log("Direct-rule regressions passed: both retained misses rejected, corrected source-bound answers accepted, wording/arithmetic controls, complete single/multiple Reader sections, unchanged total budget, partial/oversized/changed selection boundaries; no provider calls.");
