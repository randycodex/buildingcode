// Synthetic reference-rendering fixtures from retained model content. No model
// regrade, no answer rewriting, no dispatch and no change to the original runs.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { guidanceSourceResolutionPacket, materializeGuidanceSourceResolutions, validateGuidanceSourceResolutions } from "../research-guidance-source-resolutions.mjs";
import { researchOfficialGuidanceSummaryPromptVersion } from "../research-official-guidance-summary.mjs";

globalThis.fetch = () => { throw new Error("Reference-rendering checks forbid provider/network calls."); };
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 2 && args[0] === "--output"), "Use no arguments or --output NEW_FILE; no live execution.");
assert.equal(researchOfficialGuidanceSummaryPromptVersion, "20260909-document-summary-v14");
const root = new URL("../", import.meta.url), hash = value => createHash("sha256").update(value).digest("hex");
const runFile = "evals/results/research-owner-api-round2-live-source-resolutions-2026-09-09.json";
const bytes = await readFile(new URL(runFile, root));
assert.equal(hash(bytes), "c673e5257eae56cb23587ca69d7be660f12c0eb77de5923a84e7e95e9e2494ed");
const run = JSON.parse(bytes), cases = [];
const compact = value => value.replace(/\s+/g, " ").trim();
for (const call of run.providerCalls) {
  const input = JSON.parse(call.retainedRequestBody.input);
  const draft = JSON.parse(call.output.flatMap(item => item.content || []).find(item => item.type === "output_text").text);
  const originalHash = hash(JSON.stringify({ input, draft }));
  assert(draft.sourceResolutions.relationships.every(record => !compact(draft.paragraphs[record.paragraphIndex].text).includes(compact(record.statement))));
  const currentInput = { ...input, sourceResolutionPacket: guidanceSourceResolutionPacket(input) };
  const fixture = {
    sourceResolutions: { packetSHA256: currentInput.sourceResolutionPacket.packetSHA256,
      relationships: draft.sourceResolutions.relationships.map(({ paragraphIndex, ...record }) => ({ ...record })) },
    paragraphs: draft.paragraphs.map(paragraph => ({ parts: [{ kind: "text", text: paragraph.text, relationshipIndex: null }], sourceUses: structuredClone(paragraph.sourceUses) })),
    missingFacts: [...draft.missingFacts], evidenceLimitations: [...draft.evidenceLimitations]
  };
  for (const record of draft.sourceResolutions.relationships) fixture.paragraphs[record.paragraphIndex].parts.push({ kind: "source_resolution", text: null, relationshipIndex: record.relationshipIndex });
  const fixtureBefore = hash(JSON.stringify(fixture));
  const rendered = materializeGuidanceSourceResolutions(currentInput, fixture);
  assert.equal(validateGuidanceSourceResolutions(currentInput, rendered).complete, true);
  assert.equal(hash(JSON.stringify(fixture)), fixtureBefore);
  for (const [index, paragraph] of draft.paragraphs.entries()) {
    assert(rendered.paragraphs[index].text.startsWith(paragraph.text), "Every original free-text claim must be preserved, including errors.");
    assert.deepEqual(rendered.paragraphs[index].sourceUses, paragraph.sourceUses);
  }
  for (const record of rendered.sourceResolutions.relationships) assert(rendered.paragraphs[record.paragraphIndex].text.includes(record.statement));
  assert.equal(hash(JSON.stringify({ input, draft })), originalHash);
  const missing = structuredClone(fixture);
  const record = draft.sourceResolutions.relationships[0];
  missing.paragraphs[record.paragraphIndex].parts = missing.paragraphs[record.paragraphIndex].parts.filter(part => part.relationshipIndex !== record.relationshipIndex);
  assert.throws(() => materializeGuidanceSourceResolutions(currentInput, missing), { code: "INVALID_RESEARCH_RESPONSE" });
  cases.push({ id: call.caseID, retainedDraftSHA256: hash(JSON.stringify(draft)), sourcePacketSHA256: hash(JSON.stringify(input.passages)),
    fixtureSHA256: fixtureBefore, renderedSHA256: hash(JSON.stringify(rendered)), relationshipsRendered: draft.sourceResolutions.relationships.length,
    allOriginalParagraphsAndFindingsPreserved: true, sourcesUnchanged: true, missingReferenceRejected: true,
    semanticAcceptance: "not-tested" });
}
const sourceFiles = ["app.mjs", "research-official-guidance-summary.mjs", "research-guidance-source-resolutions.mjs",
  "research-guidance-source-relationships.mjs", "research-guidance-qualification-review.mjs",
  "tests/research-guidance-source-resolutions-contract.mjs", "tests/research-official-pdf-http-contract.mjs",
  "evals/research-owner-http-request-binding.mjs", "tests/research-owner-http-request-binding-contract.mjs",
  "scripts/check-research-source-resolution-parts-20260909.mjs", "package.json"];
const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, hash(await readFile(new URL(file, root)))])));
const report = { schema: "permitext.research-source-resolution-parts-replay.v1", checkedAt: new Date().toISOString(),
  runFile, runSHA256: hash(bytes), sourceHashes,
  summary: { syntheticFixtures: 3, relationshipsRendered: 4, providerCalls: 0, networkCalls: 0, originalPaidResultsChanged: 0,
    freeTextClaimsRemovedOrRewritten: 0, liveQualityConfirmed: false, liveSpeedMeasured: false },
  limitations: ["The script mechanically adds references to retained model-authored statements. It does not claim the model generated these v14 parts.",
    "It deliberately preserves the original paragraphs as well, including repetitions and substantive errors; the resulting fixture is not an accepted user answer.",
    "The new renderer inserts statements by reference and preserves citations, but semantic correctness and real model format compliance remain unproven."], cases };
if (args.length) await writeFile(args[1], `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ ...report.summary, cases, ...(args.length ? { output: args[1] } : {}) }, null, 2));
