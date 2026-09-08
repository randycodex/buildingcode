import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { planZoningResearchQuestion, zoningResearchDeterministicContext, zoningResearchPromptContext } from "../research-zoning-planner.mjs";
import { buildResearchRequestEnvelopeBuilders } from "./research-request-envelope-preflight.mjs";

globalThis.fetch = async () => { throw new Error("Network forbidden in Zoning prompt compaction check."); };
const retained = JSON.parse(await readFile(new URL("../evals/results/2026-09-01T16-49-32-263Z-9f67f4ba-3944-46a4-b438-fcec082144e3.json", import.meta.url)));
const { buildAnswerRequest, buildVerifierRequest } = await buildResearchRequestEnvelopeBuilders();
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const observations = [];
for (const result of retained.results) {
  const question = result.testCase.question;
  const evidence = result.testCase.selectedEvidence.map((selected, index) => ({
    sectionID: selected.sectionID, sourceID: `retained-${result.testCase.id}-${index}`,
    codePrefix: "ZR", sectionNumber: selected.reference.replace(/^ZR\s+/i, ""),
    codeEdition: "NYC Zoning Resolution — retained source fixture", codeVersion: "retained-source-fixture",
    text: selected.exactPassages.join("\n"), evidencePriority: { evidenceRole: "governing", claimCoverageRequired: true }
  }));
  const plan = planZoningResearchQuestion({ question });
  const context = zoningResearchDeterministicContext({ question, plan, evidence });
  const original = structuredClone(context);
  const prompt = zoningResearchPromptContext(plan, context);
  const records = prompt.split("\n").flatMap((line) => {
    const match = line.match(/^[A-Z_]+: ([{\[].*)$/);
    return match ? [JSON.parse(match[1])] : [];
  });
  const representedObligations = records.flatMap((record) => Array.isArray(record) ? record : record.answerObligations || []);
  assert.deepEqual(representedObligations, context.answerObligations,
    `${result.testCase.id}: every complete obligation must appear exactly once, including machine checks and source bindings.`);
  const representedContext = records.find((record) => record.contextHash);
  assert.deepEqual(representedContext, original);
  const { contextHash, ...withoutHash } = representedContext;
  assert.equal(hash(withoutHash), contextHash);
  assert.deepEqual(context, original, "Rendering must not mutate the verification context.");
  for (const phrase of ["Preserve exact table symbols, dates, arithmetic inputs", "supported point bound to its supplied source", "Do not infer property or mapped applicability"])
    assert(prompt.includes(phrase));
  const options = { model: "gpt-5.6-luna", responseStyle: "conversational", zoningPlan: plan, zoningDeterministicContext: context };
  const bodies = [buildAnswerRequest(question, evidence, "offline-prompt-compaction", options),
    buildVerifierRequest(question, evidence, result.answer || { answerText: "Retained unavailable-answer fixture." }, "offline-prompt-compaction", options)];
  for (const body of bodies) {
    assert.equal(typeof body.input, "string");
    assert.equal(body.input.split(prompt).length, 2, "The actual draft/verifier must each contain the execution plan once.");
    assert.equal(body.model, "gpt-5.6-luna");
    assert(body.max_output_tokens > 0 && body.text.format.strict);
    assert(body.input.includes(question));
    for (const source of evidence) assert(body.input.includes(source.text), "Compaction must retain all supplied enacted evidence.");
    const serialized = JSON.stringify(body);
    // Reconstruct only the exact formerly duplicated line. All other request
    // bytes stay fixed; this is a size comparison, not an old-runtime replay.
    const repeated = context.answerObligations.length ? body.input.replace(
      "MANDATORY_ANSWER_OBLIGATIONS: DETERMINISTIC_CONTEXT.answerObligations",
      `MANDATORY_ANSWER_OBLIGATIONS: ${JSON.stringify(context.answerObligations)}`) : body.input;
    const savedBytes = Buffer.byteLength(JSON.stringify({ ...body, input: repeated })) - Buffer.byteLength(serialized);
    assert(savedBytes >= 0);
    observations.push({ id: result.testCase.id, phase: body.text.format.name, savedBytes });
  }
}
assert.equal(retained.results.length, 30);
assert(observations.some((item) => item.savedBytes > 1000));
assert.equal(zoningResearchPromptContext(null, null), "");
console.log(JSON.stringify({ cases: retained.results.length, actualDraftAndVerifierRequestsChecked: observations.length,
  requestsWithSmallerPrompts: observations.filter((item) => item.savedBytes > 0).length,
  totalDuplicateBytesRemoved: observations.reduce((sum, item) => sum + item.savedBytes, 0),
  maximumBytesRemovedFromOneRequest: Math.max(...observations.map((item) => item.savedBytes)),
  evidenceAndContextPreserved: true, latencyMeasured: false, providerCalls: 0 }));
