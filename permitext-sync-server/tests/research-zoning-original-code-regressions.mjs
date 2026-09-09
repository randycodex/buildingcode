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
const retained = JSON.parse(await readFile(new URL("../evals/results/research-owner-api-round2-live-original-code-2026-09-09.json", import.meta.url)));
const key = JSON.parse(await readFile(new URL("../evals/research-reconciled-answer-key.json", import.meta.url)));
const compact = (text) => text.replace(/\s+/g, " ").trim();
for (const id of ["ZR-07", "ZR-11"]) {
  const call = retained.providerCalls.find((call) => call.caseID === id && call.phase === "permitext_code_interpretation");
  const answer = JSON.parse(call.output.flatMap((message) => message.content || []).find((part) => part.type === "output_text").text);
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
  const checked = controls(answer);
  assert(checked.pass, `${id}: ${JSON.stringify(checked.issues)}`);
  assert(safety(answer).pass, `${id}: ${JSON.stringify(safety(answer).issues)}`);
  if (id === "ZR-07") {
    for (const selection of ["maximum permitted residential FAR", "allowable commercial floor area ratio", "permitted FAR"]) {
      const candidate = { ...answer, answerText: answer.answerText.replace("maximum permitted residential FAR", selection) };
      assert(controls(candidate).pass, selection);
      assert(safety(candidate).pass, selection);
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
