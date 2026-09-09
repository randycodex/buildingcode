import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ownerResearchScopeInput } from "../evals/research-owner-scope-input.mjs";
import { zoningSection, zoningSectionSummary } from "../zoning-content.mjs";
import { assembledResearchEvidenceForTurn, researchCorpusPlanForTurn, researchAuthorityClassification, openAIResearchVerification } from "../app.mjs";
import { planZoningResearchQuestion, zoningResearchDeterministicContext, zoningResearchRepairPacket } from "../research-zoning-planner.mjs";

globalThis.fetch = async () => { throw new Error("No network in retained repair completeness checks."); };
Object.assign(process.env, { PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1", PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1" });
const retained = JSON.parse(await readFile(new URL("../evals/results/research-owner-api-round2-live-zoning-source-repair-v2-2026-09-09.json", import.meta.url)));
const key = JSON.parse(await readFile(new URL("../evals/research-reconciled-answer-key.json", import.meta.url)));
const output = (call) => JSON.parse(call.output.flatMap((message) => message.content || []).find((part) => part.type === "output_text").text);
const answer = output(retained.providerCalls.find((call) => call.caseID === "ZR-05" && call.phase === "permitext_code_interpretation"));
const issues = output(retained.providerCalls.find((call) => call.caseID === "ZR-05" && call.phase === "permitext_research_verification")).issues;
const input = await ownerResearchScopeInput(key.cases.find((item) => item.id === "ZR-05"), { original: true, zoningSummary: zoningSectionSummary });
input.originSurface = "reader";
input.pinnedEvidence = await Promise.all(input.pinnedEvidence.map(async (pin) => ({ ...pin,
  sourceID: answer.citations.find((citation) => citation.sectionID === pin.sectionID && citation.sourceIDs.some((id) => !id.startsWith("research-metadata-"))).sourceIDs[0],
  selectedText: (await zoningSection(pin.sectionID)).blocks.map((block) => block.plainText || "").join("\n\n").replace(/\s+/g, " ").trim()
})));
const plan = planZoningResearchQuestion(input);
const assembled = await assembledResearchEvidenceForTurn({ ...input, corpusPlan: await researchCorpusPlanForTurn(input), zoningPlan: plan });
const deterministicContext = zoningResearchDeterministicContext({ ...input, evidence: assembled.sources, plan });
const packet = zoningResearchRepairPacket({ ...input, issues, answer, evidence: assembled.sources, deterministicContext });
const source = assembled.sources.find((source) => source.richSourceKind === "amendment-history");
const repairedSource = packet.sources.find((item) => item.sourceID === source.sourceID);
assert(repairedSource);
const reports = source.richSourceGrids[0].rows.slice(1).map((row) => row.cells[1].text);
const missingReports = reports.filter((report) => !repairedSource.text.includes(report));
assert.deepEqual(missingReports, [], "A repair must retain the complete requested amendment record, including events unaffected by the failed checks.");
assert.equal(repairedSource.text, source.text);
assert.equal(repairedSource.authorityClass, "official_metadata");
assert.equal(repairedSource.metadataCurrentness, "not_refreshed_in_this_turn");
assert.equal(repairedSource.completeSuppliedPassage, true);
assert(packet.usage.characterCount <= packet.usage.maximumCharacters);
const tooSmall = zoningResearchRepairPacket({ ...input, issues, answer, evidence: [source], deterministicContext, maximumCharacters: source.text.length - 1 });
assert.equal(tooSmall.sources.length, 0);
assert.deepEqual(tooSmall.incompleteAtomicSources, [{ sourceID: source.sourceID, requiredCharacters: source.text.length }]);
assert.equal(researchAuthorityClassification({ citations: answer.citations, evidence: assembled.sources }).status, "enacted_text_with_official_metadata");
const metadataCitations = answer.citations.filter((citation) => citation.sourceIDs.every((id) => id === source.sourceID));
assert.equal(metadataCitations.length, 1);
assert.equal(researchAuthorityClassification({ citations: metadataCitations, evidence: assembled.sources }).status, "official_amendment_metadata");
assert.equal(researchAuthorityClassification({ citations: answer.citations.filter((citation) => !metadataCitations.includes(citation)), evidence: assembled.sources }).status, "supported_by_enacted_text");
process.env.OPENAI_API_KEY = "offline-verifier-contract";
process.env.PERMITEXT_RUN_PAID_RESEARCH_EVALS = "0";
delete process.env.PERMITEXT_RESEARCH_EVAL_MAX_USD;
let verifierRequests = 0;
globalThis.fetch = async (url, options) => {
  verifierRequests += 1;
  assert.equal(String(url), "https://api.openai.com/v1/responses");
  const body = JSON.parse(options.body);
  assert.equal(body.text.format.name, "permitext_research_verification");
  const passage = body.input.split(`PASSAGE_ID: ${source.sourceID}\n`)[1].split("\n\n---\n\n")[0];
  assert(passage.includes(`CODE_EDITION: ${source.codeEdition}`));
  assert(passage.includes(`APPLICABILITY_STATUS: ${source.applicabilityStatus}`));
  assert(passage.includes("SOURCE_CLASS: official_metadata; supplied corpus snapshot; not refreshed in this turn"));
  for (const report of reports) assert(passage.includes(report));
  // A transport double establishes request contents, not semantic acceptance.
  return Response.json({ model: body.model, usage: { input_tokens: 0, output_tokens: 0 },
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ pass: true, issues: [] }) }] }] });
};
await openAIResearchVerification(input.question, assembled.sources, answer, "offline-verifier-contract");
assert.equal(verifierRequests, 1);
console.log("Zoning repair completeness passed: complete canonical events, bounded atomic records, accurate authority classification and verifier source-basis context; all provider transport mocked.");
