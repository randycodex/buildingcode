import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { researchWebSupportTrigger } from "../research-source-policy.mjs";
import { researchDOBWorkflowRoute } from "../research-dob-workflow-routing.mjs";
import { assembleResearchEvidence } from "../research-evidence-assembly.mjs";
import { planZoningResearchQuestion, zoningResearchDeterministicContext, evaluateZoningEvidenceReadiness } from "../research-zoning-planner.mjs";
import { immutableEvidenceSnapshot } from "../project-foundation-contract.mjs";

const pilot = JSON.parse(await readFile(new URL("../evals/results/research-owner-live-pilot-2026-09-07.json", import.meta.url)));
for (const [id, topic] of [["DOBNOW-019", "builders_pavement"], ["DOBNOW-018", "wetland_documents"]]) {
  const question = pilot.cases.find((item) => item.id === id).question;
  const route = researchWebSupportTrigger({ question }, {});
  assert.equal(route.useWeb, true);
  assert.equal(route.workflow.topic, topic);
  assert.equal(route.workflow.directDocumentRetrieval, true);
  assert(route.workflow.sources.every((source) => source.url.startsWith("https://www.nyc.gov/assets/buildings/pdf/")));
  assert.equal(researchWebSupportTrigger({ question: `Do not use the internet. ${question}` }, {}).useWeb, false);
}
assert.equal(researchWebSupportTrigger({ question: "Using only AC 28-105.4, explain the DOB filing exemption." }, {}).useWeb, false);
assert.equal(researchDOBWorkflowRoute("For a new BPP filing, use https://www.nyc.gov/assets/buildings/pdf/different.pdf.").directDocumentRetrieval, false);
assert.equal(researchDOBWorkflowRoute("For my DOB NOW application, does the proposed stair comply with BC 1007.1.1?").guidanceOnly, false);
assert.equal(researchWebSupportTrigger({ question: "What authorization step appears?", retrievalQuery: "A new Builders Pavement Plan application. What authorization step appears?" }, {}).workflow.topic, "builders_pavement");
assert.equal(researchWebSupportTrigger({ question: "What does PC 403.1 require?", retrievalQuery: "What does PC 403.1 require?" }, {}).workflow, undefined);
const originalCases = JSON.parse(await readFile(new URL("../evals/research-reconciled-answer-key.json", import.meta.url)));
const paaCase = originalCases.cases.find((item) => item.id === "DOBNOW-004");
const paaQuestion = [`Context: ${paaCase.questionContext}`, paaCase.scenario, paaCase.question].join("\n\n");
for (const [question, topic] of [
  [paaQuestion, "post_approval_amendments"],
  ["Explain post approval amendments in DOB NOW.", "post_approval_amendments"],
  ["Explain subsequent filings in DOB NOW.", "subsequent_filings"],
  ["How should the DOB NOW stormwater question be answered?", "stormwater_documents"],
  ["How should I submit the Loft Board request in DOB NOW for work affecting an IMD unit?", "loft_board_documents"],
  ["Can a filing representative attest for the owner and submit a DOB NOW filing?", "filing_stakeholder_roles"]
]) {
  const route = researchDOBWorkflowRoute(question);
  assert.equal(route.topic, topic);
  assert.equal(route.directDocumentRetrieval, true);
  assert.equal(researchDOBWorkflowRoute(`${question} Use https://www.nyc.gov/specific-other-source.page.`).directDocumentRetrieval, false);
  assert.equal(researchDOBWorkflowRoute(`${question} Does my project comply with BC 1007.1.1?`).guidanceOnly, false);
  assert.equal(researchWebSupportTrigger({ question: `Do not use the internet. ${question}` }, {}).useWeb, false);
}
const authorityQuestion = "Can the filing representative attest for the owner and submit the DOB NOW job filing?";
assert.equal(researchDOBWorkflowRoute(authorityQuestion).sources.find((source) => source.id === "dob-stakeholder-faq").faqQuestionFocus, "actor_authority");
for (const question of [
  `${authorityQuestion} How does the owner log in?`,
  "The filing representative entered an email address in DOB NOW. Why is the owner unable to attest?",
  "What are all the steps for a filing representative to prepare and submit a DOB NOW filing?",
  `${authorityQuestion} I need help with logging in.`,
  `${authorityQuestion} Is the filing ready to submit?`
]) assert.equal(researchDOBWorkflowRoute(question).sources.find((source) => source.id === "dob-stakeholder-faq").faqQuestionFocus, undefined,
  "Procedural and readiness questions retain the complete role FAQ selection.");
for (const [id, topic] of [["DOBNOW-014", "rent_regulation_attestation"], ["DOBNOW-017", "adu_certificate_documents"]]) {
  const item = originalCases.cases.find((item) => item.id === id);
  const question = [`Context: ${item.questionContext}`, item.scenario, item.question].join("\n\n");
  const route = researchDOBWorkflowRoute(question);
  assert.equal(route.topic, topic);
  assert.equal(route.directDocumentRetrieval, true);
  assert.equal(route.sources.length, 1);
  assert.equal(researchDOBWorkflowRoute(`${question} Use https://www.nyc.gov/another-source.pdf.`).directDocumentRetrieval, false);
  assert.equal(researchDOBWorkflowRoute(`${question} Is the proposed occupancy legally permitted?`).guidanceOnly, false);
  assert.equal(researchWebSupportTrigger({ question: `Do not use the internet. ${question}` }, {}).useWeb, false);
}
assert.equal(researchDOBWorkflowRoute("Which DOB NOW documents apply to an ADU?").directDocumentRetrieval, false,
  "A general ADU-document question is broader than the known certificate source group.");
for (const question of [paaQuestion,
  "The DOB NOW filing includes legalization. Which filing action changes the drawings?",
  "The DOB NOW filing does not include legalization. How do I submit a PAA?"
]) {
  assert.equal(researchDOBWorkflowRoute(question).guidanceOnly, true,
    "Legalization names a portal filing status, not a request for a legal determination.");
  assert.equal(researchWebSupportTrigger({ question }, {}).workflow.guidanceOnly, true);
}
for (const question of [
  `${paaQuestion} Is the proposed alteration legal?`,
  `${paaQuestion} Can I legally proceed with the work?`,
  `${paaQuestion} Does the legalization comply with BC 1007.1.1?`
]) assert.equal(researchDOBWorkflowRoute(question).guidanceOnly, false,
  "A separate request for legal or enacted-code applicability must retain the enacted-evidence path.");
for (const id of ["DOBNOW-007", "DOBNOW-016"]) {
  const item = originalCases.cases.find((item) => item.id === id);
  const question = [item.scenario, item.question].filter(Boolean).join("\n\n");
  const route = researchWebSupportTrigger({ question }, {});
  assert.equal(route.useWeb, true, `${id}: an explicit portal form question needs official workflow material.`);
  assert.equal(route.workflow.guidanceOnly, true);
  assert.equal(route.workflow.topic, id === "DOBNOW-016" ? "loft_board_documents" : "dob_now_workflow");
  assert.equal(route.workflow.directDocumentRetrieval, id === "DOBNOW-016",
    "Only a known workflow catalog bypasses source discovery.");
  assert.equal(researchWebSupportTrigger({ question: `Do not use the web. ${question}` }, {}).useWeb, false);
}
assert.equal(researchDOBWorkflowRoute("How should the roof question be answered?"), null,
  "A form question without an identified portal must not be assumed to concern DOB NOW.");
assert.equal(researchDOBWorkflowRoute("How should the DOB NOW roof question be answered, and does the work comply with BC 1507.1? ").guidanceOnly, false);
assert.equal(researchWebSupportTrigger({ question: "Using only the selected code text, how should the DOB NOW roof question be answered?" }, {}).useWeb, false);
const safetyCase = originalCases.cases.find((item) => item.id === "DOBNOW-008");
const safetyQuestion = [`Context: ${safetyCase.questionContext}`, safetyCase.scenario, safetyCase.question].join("\n\n");
const safetyRoute = researchDOBWorkflowRoute(safetyQuestion);
assert.equal(safetyRoute.topic, "site_safety_documents");
assert.equal(safetyRoute.directDocumentRetrieval, true);
assert.deepEqual(safetyRoute.sources.map((source) => source.id), ["dob-application-guide", "dob-2022-code-changes", "dob-family-site-safety-notice"]);
assert.equal(researchDOBWorkflowRoute(`${safetyQuestion} Use https://www.nyc.gov/another-specific-notice.pdf.`).directDocumentRetrieval, false);
assert.equal(researchDOBWorkflowRoute(`${safetyQuestion} Is my project legally compliant with BC 3301.13?`).guidanceOnly, false);
assert.equal(researchWebSupportTrigger({ question: `Do not use the web. ${safetyQuestion}` }, {}).useWeb, false);
const reviewCase = originalCases.cases.find((item) => item.id === "DOBNOW-021");
const reviewQuestion = [`Context: ${reviewCase.questionContext}`, reviewCase.scenario, reviewCase.question].join("\n\n");
for (const question of [reviewQuestion,
  "I have only the address. Which Building Code review year should I select in DOB NOW?",
  "What information is needed for the Building Code review edition field in DOB NOW?",
  "Explain the Building Code version dropdown in my DOB NOW application."
]) {
  assert.equal(researchDOBWorkflowRoute(question).guidanceOnly, true, question);
  assert.equal(researchDOBWorkflowRoute(question).directDocumentRetrieval, false);
  assert.equal(researchWebSupportTrigger({ question: `Do not use the internet. ${question}` }, {}).useWeb, false);
}
for (const question of [
  "Which Building Code review year legally applies to my DOB NOW alteration?",
  "Which Building Code edition governs the required stair width in my DOB NOW filing?",
  "Which Building Code review year is permitted for my DOB NOW alteration?",
  `${reviewQuestion} Does the stair comply with BC 1007.1.1?`,
  `${reviewQuestion} Which Building Code applies to the alteration?`,
  `${reviewQuestion} Is this alteration exempt from the required upgrades?`,
  "Which Building Code edition applies to this building?"
]) assert.notEqual(researchDOBWorkflowRoute(question)?.guidanceOnly, true, question);
const intake = JSON.parse(await readFile(new URL("../evals/research-owner-code-candidates.json", import.meta.url)));
assert.equal(intake.cases.length, 60);
assert.equal(new Set(intake.cases.map((item) => item.id)).size, 60);
assert(intake.cases.every((item) => item.reviewStatus === "candidate-unverified"));
for (const item of intake.cases) {
  assert.notEqual(researchDOBWorkflowRoute(item.question)?.guidanceOnly, true,
    `${item.id} is a technical or legal question, not a guidance-only portal workflow.`);
}

// Exercise the application's actual corpus routing, discovery and canonical
// assembly. No supplied answer key, source IDs or table grids enter retrieval.
process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = "1";
process.env.PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS = "1";
const { assembledResearchEvidenceForTurn } = await import("../app.mjs");
const question = pilot.cases.find((item) => item.id === "ZR-08").question;
const plan = planZoningResearchQuestion({ question });
assert.equal(plan.path, "calculation_scenario");
assert.equal(planZoningResearchQuestion({ question: "What is the FAR definition in Section 12-10?" }).path, "definition_cross_reference");
const assembled = await assembledResearchEvidenceForTurn({ question, messages: [], pinnedEvidence: [], projectFacts: [], zoningPlan: plan });
const table = assembled.sources.find((source) => source.sectionNumber === "23-22");
assert(table?.richSourceGrids?.length);
assert.equal(table.canonicalContextComplete, true);
assert.match(table.text, /standard residences/);
assert.match(table.text, /within 100 feet of a wide street/);
assert(table.richSourceText && table.richSourceText !== table.text);
const snapshots = assembled.sources.map((source) => immutableEvidenceSnapshot({ source }));
const tableSnapshot = snapshots.find((snapshot) => snapshot.sectionNumber === "23-22");
assert.equal(tableSnapshot.structuredSource.text, table.richSourceText);
assert.equal(tableSnapshot.structuredSource.contentHash, table.richSourceContentHash);
assert.equal(tableSnapshot.passageText, table.text);
assert.throws(() => immutableEvidenceSnapshot({ source: { ...table, richSourceText: `${table.richSourceText} altered` } }), /integrity hash/);
const alteredGrid = structuredClone(table);
alteredGrid.richSourceGrids[0].rows[0].cells[0].text += " altered";
assert.throws(() => immutableEvidenceSnapshot({ source: alteredGrid }), /integrity hash/);
const definition = assembled.sources.find((source) => source.sectionNumber === "12-10");
assert(definition?.targetedDefinition?.labels.includes("floor area ratio"));
assert.match(definition.text, /total floor area on a zoning lot, divided by the lot area/);
assert.match(definition.text, /two or more buildings/);
assert.doesNotMatch(definition.text, /above-grade mass transit station/);
const context = zoningResearchDeterministicContext({ question, evidence: assembled.sources, plan });
assert.equal(evaluateZoningEvidenceReadiness({ question, evidence: assembled.sources, plan, deterministicContext: context }).pass, true);
assert(context.answerObligations.find((item) => item.id === "table_standard_floor_area_ceiling").values.includes("40,000"));
assert.equal(context.arithmetic.calculations.find((item) => item.id === "proposed_floor_area_far").result, 4.2);
const withoutGrid = assembled.sources.map(({ richSourceGrids, ...source }) => source);
const missingContext = zoningResearchDeterministicContext({ question, evidence: withoutGrid, plan });
assert.equal(evaluateZoningEvidenceReadiness({ question, evidence: withoutGrid, plan, deterministicContext: missingContext }).pass, false);

// A neighboring table with the same chapter prefix must never satisfy the row.
const neighboring = await assembleResearchEvidence({
  question: "Use Table 23-22.",
  discover: async () => ({ candidates: [{ sectionID: "mismatch", codePrefix: "ZR", sectionNumber: "23-22" }] }),
  resolveSection: async () => ({ codePrefix: "ZR", sectionNumber: "23-22", text: "See Table 23-22.", richSources: [{ id: "wrong-grid", kind: "table", reference: "ZR Table 23-23", text: "Wrong table", contentHash: "a".repeat(64), rowCount: 1, grids: [{ rows: [{ cells: [{ text: "wrong" }] }] }] }] })
});
assert.equal(neighboring.sources[0].richSourceGrids, undefined);
console.log("Research source-selection contracts passed: ordinary DOB workflows, 60 technical-question boundaries, actual FAR retrieval and missing-grid rejection; no paid calls.");
