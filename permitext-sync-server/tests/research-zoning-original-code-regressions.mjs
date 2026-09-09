import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ownerResearchScopeInput } from "../evals/research-owner-scope-input.mjs";
import { zoningSection, zoningSectionSummary } from "../zoning-content.mjs";
import { assembledResearchEvidenceForTurn, researchCorpusPlanForTurn } from "../app.mjs";
import { planZoningResearchQuestion, zoningResearchDeterministicContext, evaluateZoningEvidenceReadiness,
  evaluateZoningDeterministicControls } from "../research-zoning-planner.mjs";
import { planZoningConditionalExplanation } from "../research-zoning-conditional-explanation.mjs";
import { evaluateZoningResearchSafety } from "../research-zoning-safety.mjs";

globalThis.fetch = async () => { throw new Error("No network in retained original-code regressions."); };
Object.assign(process.env, { PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1", PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1" });
const retainedRuns = await Promise.all([
  "research-owner-api-round2-live-original-code-2026-09-09.json",
  "research-owner-api-round2-live-zoning-source-repair-v2-2026-09-09.json",
  "research-owner-api-round2-live-zoning-repair-preservation-2026-09-09.json"
].map(async (file) => JSON.parse(await readFile(new URL(`../evals/results/${file}`, import.meta.url)))));
const key = JSON.parse(await readFile(new URL("../evals/research-reconciled-answer-key.json", import.meta.url)));
const compact = (text) => text.replace(/\s+/g, " ").trim();
for (const [retained, id] of [[retainedRuns[0], "ZR-07"], [retainedRuns[0], "ZR-11"], [retainedRuns[1], "ZR-07"], [retainedRuns[1], "ZR-11"], [retainedRuns[2], "ZR-07"], [retainedRuns[2], "ZR-11"]]) {
  const call = retained.providerCalls.find((call) => call.caseID === id && call.phase === "permitext_code_interpretation");
  let answer = JSON.parse(call.output.flatMap((message) => message.content || []).find((part) => part.type === "output_text").text);
  if (retained === retainedRuns[2] && id === "ZR-11") answer = retained.results.find((item) => item.id === id).answer;
  const input = await ownerResearchScopeInput(key.cases.find((item) => item.id === id), { original: true, zoningSummary: zoningSectionSummary });
  // Recreate the actual full-section reader selections and their source IDs;
  // expected answers and grading concepts never become retrieval input.
  input.pinnedEvidence = await Promise.all(input.pinnedEvidence.map(async (pin) => ({ ...pin,
    sourceID: answer.citations.find((citation) => citation.sectionID === pin.sectionID).sourceIDs[0],
    selectedText: compact((await zoningSection(pin.sectionID)).blocks.map((block) => block.plainText || "").join("\n\n"))
  })));
  input.originSurface = "reader";
  const prerequisitePlan = planZoningResearchQuestion(input);
  const assembled = await assembledResearchEvidenceForTurn({ ...input, corpusPlan: await researchCorpusPlanForTurn(input), zoningPlan: prerequisitePlan });
  const deterministicContext = zoningResearchDeterministicContext({ ...input, evidence: assembled.sources, plan: prerequisitePlan });
  const plan = planZoningConditionalExplanation({ plan: prerequisitePlan, evidence: assembled.sources,
    evidenceReadiness: evaluateZoningEvidenceReadiness({ ...input, evidence: assembled.sources, plan: prerequisitePlan, deterministicContext }),
    evidenceSelection: assembled.zoningSelection });
  const controls = (candidate) => evaluateZoningDeterministicControls({ plan, deterministicContext, answer: candidate, providerRequestCount: 1 });
  const safety = (candidate) => evaluateZoningResearchSafety({ ...input, evidence: assembled.sources, answer: candidate, questionPlan: plan });
  if (id === "ZR-11" && retained === retainedRuns[1]) {
    assert(controls(answer).issues.some((issue) => issue.code === "NUMERIC_QUANTITIES_CONFLATED"),
      "The actually delivered malformed area equality must fail before another verifier call.");
    const bad = "the proposed **8,500 sq ft** is 500 sq ft (85%) and exceeds that basic cap";
    assert(answer.answerText.includes(bad));
    const replaceCalculation = (sentence) => ({ ...answer, answerText: answer.answerText.replace(bad, sentence) });
    for (const sentence of [
      "the proposed 8,500 square feet is 500 square feet below the basic cap and exceeds it",
      "the proposed 8,500 ft² is 500 ft² (85%) and exceeds the basic cap",
      "the proposed 8,500 sq ft is 600 sq ft over the basic cap and exceeds it"
    ]) assert(controls(replaceCalculation(sentence)).issues.some((issue) => issue.code === "NUMERIC_QUANTITIES_CONFLATED"), sentence);
    for (const sentence of [
      "the proposed 8,500 sq ft is 500 sq ft over the basic cap and therefore exceeds it",
      "the proposed 8,500 square feet is 85% of the lot and exceeds the cap by 500 square feet"
    ]) assert(controls(replaceCalculation(sentence)).pass, sentence);
    answer = replaceCalculation("the proposed 8,500 square feet is 85% of the lot and exceeds the cap by 500 square feet");
    for (const [quantity, difference, percent, relation] of [[7500, -500, 75, "below"], [8000, 0, 80, "equals"], [8500, 500, 85, "exceeds"]]) {
      const question = input.question.replace("8,500", quantity.toLocaleString("en-US"));
      const variantInput = { ...input, question };
      const context = zoningResearchDeterministicContext({ ...variantInput, evidence: assembled.sources, plan: planZoningResearchQuestion(variantInput) });
      const obligation = context.answerObligations.find((item) => item.id === "basic_lot_coverage_numerical_cap");
      assert.deepEqual(obligation.numericComparison, { proposedQuantity: quantity, maximumQuantity: 8000, difference, proposedPercent: percent, unit: "square feet" });
      assert(obligation.detail.includes(relation));
    }
  }
  const checked = controls(answer);
  assert(checked.pass, `${id}: ${JSON.stringify(checked.issues)}`);
  assert(safety(answer).pass, `${id}: ${JSON.stringify(safety(answer).issues)}`);
  if (id === "ZR-07") {
    for (const selection of ["maximum permitted residential FAR", "allowable commercial floor area ratio", "permitted FAR"]) {
      const candidate = { ...answer, answerText: answer.answerText.replace("maximum permitted residential FAR", selection) };
      assert(controls(candidate).pass, selection);
      assert(safety(candidate).pass, selection);
    }
    const lead = "The maximum permitted residential FAR cannot be determined from the supplied facts.";
    for (const unresolved of ["cannot be determined", "can't be established", "cannot be selected", "cannot be identified"]) {
      const withheld = `The maximum permitted residential FAR ${unresolved} from the supplied facts`;
      assert(safety({ ...answer, answerText: `${withheld}.` }).pass, withheld);
      for (const delimiter of [". ", "; ", ", and ", ", but ", " — "]) {
        for (const approval of ["the owner may proceed", "the property is approved", "the applicant has the green light"]) {
          assert(!safety({ ...answer, answerText: `${withheld}${delimiter}${approval}.` }).pass, `${withheld}${delimiter}${approval}`);
        }
      }
    }
    for (const qualifier of ["", " alone", " by itself"]) {
      for (const inference of ["does not establish that", "does not establish whether", "cannot show if", "doesn't prove whether"]) {
        const candidate = { ...answer, answerText: `${lead} The proposal ratio is 4.0 FAR. That calculation${qualifier} ${inference} 4.0 FAR is permitted.` };
        assert(controls(candidate).pass);
        assert(safety(candidate).pass, candidate.answerText);
        for (const suffix of [" The owner may proceed.", "; the property is approved.", ", but 4.0 FAR is permitted for this site."]) {
          assert(!safety({ ...candidate, answerText: candidate.answerText.replace(/\.$/, "") + suffix }).pass, suffix);
        }
      }
    }
    for (const extension of ["The owner may proceed.", "The proposed 4.0 FAR is permitted.", "The property is approved.", "The site is in an R7A district."]) {
      for (const delimiter of ["\n\n", "; ", ", and ", ", but "]) {
        const [lead, ...rest] = answer.answerText.split("\n\n");
        const candidate = { ...answer, answerText: `${lead.replace(/\.$/, "")}${delimiter}${extension}\n\n${rest.join("\n\n")}` };
        assert(!safety(candidate).pass, `The unresolved lead cannot excuse ${delimiter}${extension}: ${JSON.stringify(safety(candidate))}`);
      }
    }
    const approval = { ...answer, answerText: "Yes, the proposed FAR is permitted.\n\n" + answer.answerText };
    assert(!controls(approval).pass);
  } else {
    for (const hyphen of ["-", "\u2010", "\u2011"]) {
      const variant = JSON.parse(JSON.stringify(answer).replaceAll("shallow-lot", `shallow${hyphen}lot`).replaceAll("short-block", `short${hyphen}block`));
      assert(controls(variant).pass, `Word hyphen ${hyphen} must preserve the same obligation.`);
    }
    for (const [before, after] of [["shallow", "unrelated"], ["8,000", "9,000"], ["80 percent", "180 percent"]]) {
      const changed = JSON.stringify(answer).replaceAll(before, after);
      const wrong = JSON.parse(before === "80 percent" ? changed.replaceAll("80%", "180%") : changed);
      assert(!controls(wrong).pass, `Missing or changed rule must remain rejected: ${before}`);
    }
  }
}
console.log("Retained original-code regressions passed: equivalent uncertainty and word hyphens, with unsafe determinations and incorrect values rejected; no API calls.");
