import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { planZoningResearchQuestion, zoningResearchDeterministicContext, evaluateZoningDeterministicControls, zoningResearchPromptContext, zoningResearchRepairPacket } from "../research-zoning-planner.mjs";
import { zoningTemporalApplicationObligations, zoningTemporalApplicationIssues } from "../research-zoning-temporal-application.mjs";

globalThis.fetch = async () => { throw new Error("Network forbidden in temporal-application regressions."); };
const retained = JSON.parse(await readFile(new URL("../evals/results/research-owner-live-zoning-expansion-2026-09-08.json", import.meta.url)));
const original = retained.results.find((item) => item.id === "ZR-18");
const evidence = original.answer.zoningArchitecture.evidenceSelection.sources;
const plan = planZoningResearchQuestion({ question: original.question });
const context = zoningResearchDeterministicContext({ question: original.question, evidence, plan });
const condition = context.answerObligations.find((item) => item.temporalApplication);
assert(condition);
assert.equal(condition.temporalApplication.status, "unresolved");
const before = evaluateZoningDeterministicControls({ plan, deterministicContext: context, answer: original.answer, providerRequestCount: 1 });
assert(before.issues.some((issue) => issue.code === "TEMPORAL_APPLICATION_NOT_ESTABLISHED" && issue.field === "supportedPoints[1]"));
assert(!before.issues.some((issue) => issue.field === "answerText"), "The original main answer correctly keeps the date-dependent rule conditional.");
assert.match(zoningResearchPromptContext(plan, context), /formation year alone/);
const repaired = structuredClone(original.answer);
repaired.supportedPoints[1].explanation = "Section 77-02 generally regulates each portion under its own district. For this lot, that application depends on confirming that it did not exist on the applicable effective or amendment date; the assembly year alone does not settle that date condition.";
repaired.supportedPoints[0].heading = "Section 77-11 is available subject to its conditions";
repaired.citations[0].relevance = repaired.citations[0].relevance.replace("discretionary, ", "");
const after = evaluateZoningDeterministicControls({ plan, deterministicContext: context, answer: repaired, providerRequestCount: 1 });
assert(after.pass, JSON.stringify(after.issues));
const packet = zoningResearchRepairPacket({ question: original.question, evidence, answer: original.answer, deterministicContext: context, issues: before.issues });
assert(packet.sources.some((source) => source.sectionNumber === "77-02"));
assert(packet.answerObligations.some((item) => item.id === condition.id));
assert(packet.usage.characterCount <= packet.usage.maximumCharacters);

const boundID = condition.sourceIDs[0];
const answer = (text, field = "point") => field === "point"
  ? { supportedPoints: [{ heading: "Application", explanation: text, sourceIDs: [boundID] }] }
  : { [field]: text };
const issues = (text, field = "point", obligation = condition) => zoningTemporalApplicationIssues({ obligation, answer: answer(text, field) });
for (const text of [
  "On the stated premise that the lot was assembled in 2031, this is the applicable supplied rule.",
  "Section 77-02 applies to this zoning lot because it was formed recently.",
  "Each portion of this lot must follow its district's regulations.",
  "Under Section 77-02, your lot is regulated portion by portion.",
  "If the lot did not exist on the applicable amendment date, each portion is regulated separately. Therefore, Section 77-02 applies to this lot because of its formation year.",
  "The applicable amendment date is unresolved, but Section 77-02 applies to this lot.",
  "If the owner prefers it, Section 77-02 applies to this lot.",
  "The stated 2031 assembly therefore does not qualify for the Section 77-11 option.",
  "This lot does not qualify for Section 77-11 because it was formed in 2029."
]) assert(issues(text).length, text);
for (const text of [
  "If this lot did not exist on the applicable amendment date, each portion is regulated under its own district.",
  "For a zoning lot that did not exist on the relevant effective date, Section 77-02 regulates each portion separately.",
  "Generally, Section 77-02 regulates each portion separately; verify the applicable amendment date before applying that rule here.",
  "Section 77-02 applies if this zoning lot was formed after the applicable amendment date.",
  "Section 77-02 applies subject to confirming its date condition.",
  "Whenever a lot did not exist on the applicable amendment date, Section 77-02 applies.",
  "That is the supplied governing rule absent facts establishing that the lot qualifies under the existence-date language.",
  "The formation year does not establish that Section 77-02 applies.",
  "We cannot conclude that Section 77-02 applies to this lot.",
  "Majority area alone does not automatically extend use regulations over the entire lot.",
  "The lot does not qualify under Section 77-11 because the measured distance exceeds 25 feet."
]) assert.equal(issues(text).length, 0, text);
for (const field of ["answerText", "conclusion", "explanation"]) {
  assert(issues("Section 77-02 provides a conditional rule. This is the applicable governing rule for our lot.", field).length, field);
  assert(issues("Each portion of this lot must follow its own district's regulations.", field).length, "Main conclusions also need the condition when the section number appears only in citations.");
  assert.equal(issues("If the lot was formed after the applicable amendment date, Section 77-02 applies.", field).length, 0, field);
}
const elsewhere = answer("This is the applicable governing rule for our lot.");
elsewhere.answerText = "If the lot did not exist on the applicable amendment date, Section 77-02 applies.";
elsewhere.evidenceLimitations = ["The amendment date is unknown."];
assert(zoningTemporalApplicationIssues({ obligation: condition, answer: elsewhere }).length, "A qualification elsewhere must not mask the supporting application.");

const derive = (facts, supplied = evidence) => zoningTemporalApplicationObligations({ question: "How do the use rules apply to this divided zoning lot?", evidence: supplied, facts })[0];
const factCases = [
  ["The zoning lot was formed in 2031.", "unresolved"],
  ["The zoning lot was assembled in 2026. The applicable amendment took effect in 2024.", "not-existing"],
  ["The lot was created in 2024. The applicable amendment occurred in 2026.", "existing"],
  ["The lot was formed in 2026. The applicable amendment took effect in 2026.", "unresolved"],
  ["The lot was formed on 2026-01-02. The applicable amendment took effect on 2026-01-01.", "not-existing"],
  ["The lot was formed on January 1, 2026. The applicable amendment took effect on January 2, 2026.", "existing"],
  ["The lot was formed on 2026-01-01. The applicable amendment took effect on 2026-01-01.", "existing"],
  ["The lot was formed on 2026-02-30. The applicable amendment took effect on 2026-02-01.", "unresolved"],
  ["The lot did not exist on the applicable amendment date.", "not-existing"],
  ["The zoning lot existed on the relevant effective or amendment date.", "existing"],
  ["The lot was assembled after the last applicable amendment.", "not-existing"],
  ["The lot was assembled before the applicable subsequent amendment.", "existing"],
  ["If the lot did not exist on the applicable amendment date, what happens?", "unresolved"],
  ["Did the lot exist on the applicable amendment date?", "unresolved"],
  ["The lot was formed in 2026. The applicable amendment took effect in 2024, but this date is unverified.", "unresolved"],
  ["The lot was formed in 2026. The applicable amendment took effect in 2024. That amendment date is unverified.", "unresolved"],
  ["Section 77-02 says the lot did not exist on the applicable amendment date.", "unresolved"],
  ["When the lot did not exist on the applicable amendment date, the provision governs its portions.", "unresolved"],
  ["The lot existed on the applicable amendment date. The lot did not exist on the applicable amendment date.", "unresolved"],
  ["The lot was formed in 2025. The applicable amendment occurred in 2024. The applicable amendment occurred in 2026.", "unresolved"]
];
for (const [facts, expected] of factCases) {
  const obligation = derive(facts);
  assert.equal(obligation.temporalApplication.status, expected, facts);
  const checked = issues("Section 77-02 applies to this lot.", "point", obligation);
  assert.equal(checked.length === 0, expected === "not-existing", facts);
  if (expected === "existing") assert.equal(checked[0].code, "TEMPORAL_APPLICATION_CONTRADICTS_FACTS");
}
for (const projectFacts of [["The applicable amendment took effect in 2024."], []]) {
  const updated = zoningResearchDeterministicContext({ question: original.question, evidence, plan, projectFacts });
  assert.equal(updated.answerObligations.find((item) => item.temporalApplication).temporalApplication.status, projectFacts.length ? "not-existing" : "unresolved");
}
const established = zoningResearchDeterministicContext({ question: original.question, evidence, plan, conversationFactContext: { established: ["The applicable amendment took effect in 2024."] } });
assert.equal(established.answerObligations.find((item) => item.temporalApplication).temporalApplication.status, "not-existing");
const unknown = zoningResearchDeterministicContext({ question: original.question, evidence, plan, conversationFactContext: { unknown: ["The applicable amendment took effect in 2024."] } });
assert.equal(unknown.answerObligations.find((item) => item.temporalApplication).temporalApplication.status, "unresolved");
const disputed = zoningResearchDeterministicContext({ question: `${original.question} The applicable amendment took effect in 2024. That amendment date is unverified.`, evidence, plan });
assert.equal(disputed.answerObligations.find((item) => item.temporalApplication).temporalApplication.status, "unresolved");
const contradicted = zoningResearchDeterministicContext({ question: original.question, evidence, plan, conversationFactContext: { established: ["The applicable amendment took effect in 2024."], unknown: ["The applicable amendment date."] } });
assert.equal(contradicted.answerObligations.find((item) => item.temporalApplication).temporalApplication.status, "unresolved");
assert.equal(derive("The lot was formed in 2026.", evidence.filter((item) => item.sectionNumber !== "77-02")), undefined);
assert.equal(derive("The lot was formed in 2026.", evidence.map((item) => ({ ...item, text: "An incomplete selected heading." }))), undefined);
assert.equal(derive("The lot was formed in 2026.", evidence.map((item) => ({ ...item, evidencePriority: { evidenceRole: "supporting" } }))), undefined);
const unchangedCase = retained.results.find((item) => item.id === "ZR-21");
const otherPlan = planZoningResearchQuestion({ question: unchangedCase.question });
const otherContext = zoningResearchDeterministicContext({ question: unchangedCase.question, evidence: unchangedCase.answer.zoningArchitecture.evidenceSelection.sources, plan: otherPlan });
assert(!otherContext.answerObligations.some((item) => item.temporalApplication));
assert(evaluateZoningDeterministicControls({ plan: otherPlan, deterministicContext: otherContext, answer: unchangedCase.answer, providerRequestCount: 1 }).pass);
console.log(`Temporal application checks passed: retained unsupported claim rejected, corrected answer accepted, clause and field isolation, ${factCases.length} date/fact cases, source and unknown-fact boundaries; no provider calls or project workflow.`);
