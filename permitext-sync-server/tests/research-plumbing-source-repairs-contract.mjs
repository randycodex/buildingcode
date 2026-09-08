import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { applyResearchDeterministicAnswerRepairs as repair } from "../research-answer-quality.mjs";

process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = "1";
let networkAttempts = 0;
globalThis.fetch = async () => { networkAttempts += 1; throw new Error("No external calls allowed."); };
const { assembledResearchEvidenceForTurn } = await import("../app.mjs");
const run = JSON.parse(await readFile(new URL("../evals/results/research-owner-live-fountain-expansion-2026-09-08.json", import.meta.url)));
const draft = (id) => JSON.parse(run.providerCalls.find((call) => call.caseID === id && call.phase === "permitext_code_interpretation")
  .output.flatMap((message) => message.content || []).find((content) => content.type === "output_text").text);
const question = (id) => run.cases.find((item) => item.id === id).question;
const evidence = async (id) => (await assembledResearchEvidenceForTurn({ question: question(id), messages: [], pinnedEvidence: [], projectFacts: [] })).sources;

const fountain = draft("PC-03");
const fountainSources = await evidence("PC-03");
const options = { question: question("PC-03") };
const fixed = repair(fountain, fountainSources, options);
assert.match(fixed.answerText, /Each replacement bottle-filling fixture.*at least 10 inches \(254 mm\) high/);
assert.deepEqual(fixed.citations, fountain.citations);
assert.deepEqual(fixed.supportedPoints, fountain.supportedPoints);
assert.equal(repair(fixed, fountainSources, options).answerText, fixed.answerText, "Repair is idempotent.");
assert(!fountain.answerText.includes("254 mm"), "Recorded evidence must remain unchanged.");
const compatibility = repair({ ...fountain, conclusion: "old", explanation: "old" }, fountainSources, options);
assert.equal([compatibility.conclusion, compatibility.explanation].join("\n\n"), compatibility.answerText);
for (const text of [
  "Replacement fixtures must accommodate containers at least 10 inches tall.",
  "Dedicated container-filling fixtures must fill a container at least 254 mm high.",
  "Each substituted fixture must have a faucet designed to fill a container at least 10 inches high and be adjacent to or readily visible from a drinking fountain that conforms to PC § 410.1 (PC § 410.3)."
]) {
  const answer = { ...fountain, answerText: text };
  assert.equal(repair(answer, fountainSources, options).answerText, text);
}
for (const text of [
  "Replacement fixtures may substitute half the fountains. The retained drinking fountains must fill a container at least 10 inches high.",
  "Replacement fixtures must be next to drinking fountains that fill containers at least 10 inches high.",
  "Replacement fixtures must accept containers 10 inches in diameter."
]) assert.match(repair({ ...fountain, answerText: text }, fountainSources, options).answerText, /Each replacement bottle-filling fixture/);

const changeFountainSource = (change) => fountainSources.map((source) => source.sectionNumber === "410.3" && source.codePrefix === "PC" ? change(source) : source);
const changedDimension = repair(fountain, changeFountainSource((source) => ({ ...source, text: source.text.replace("10 inches (254 mm)", "12 inches (304.8 mm)") })), options);
assert.match(changedDimension.answerText, /at least 12 inches \(304.8 mm\) high/, "Dimensions come from supplied evidence.");
for (const sources of [
  fountainSources.filter((source) => source.sectionNumber !== "410.3"),
  changeFountainSource((source) => ({ ...source, text: "Up to 50 percent may be substituted." })),
  changeFountainSource((source) => ({ ...source, evidenceRole: "contextual" })),
  changeFountainSource((source) => ({ ...source, evidencePriority: { ...source.evidencePriority, claimCoverageRequired: false } })),
  [...fountainSources, fountainSources.find((source) => source.sectionNumber === "410.3")]
]) assert.equal(repair(fountain, sources, options).answerText, fountain.answerText);
assert.equal(repair({ ...fountain, citations: [] }, fountainSources, options).answerText, fountain.answerText);
assert.equal(repair(fountain, fountainSources, { question: "Does this restaurant need drinking fountains?" }).answerText, fountain.answerText);

const laundry = draft("PC-04");
const laundrySources = await evidence("PC-04");
const laundryOptions = { question: question("PC-04") };
const lintSource = laundrySources.find((source) => source.codePrefix === "PC" && source.sectionNumber === "412.4");
const lintPoint = laundry.supportedPoints.findIndex((point) => /lint strainers/i.test(point.explanation));
const bound = repair(laundry, laundrySources, laundryOptions);
assert.deepEqual(bound.supportedPoints[lintPoint].sourceIDs, [...laundry.supportedPoints[lintPoint].sourceIDs, lintSource.sourceID]);
assert.equal(bound.answerText, laundry.answerText);
assert.deepEqual(bound.citations, laundry.citations);
assert.equal(bound.supportedPoints[lintPoint].explanation, laundry.supportedPoints[lintPoint].explanation);
assert.deepEqual(repair(bound, laundrySources, laundryOptions), bound);
for (const sources of [
  laundrySources.filter((source) => source !== lintSource),
  laundrySources.map((source) => source === lintSource ? { ...source, text: "Floor drains shall have 3-inch outlets." } : source),
  laundrySources.map((source) => source === lintSource ? { ...source, evidenceRole: "irrelevant" } : source)
]) assert.deepEqual(repair(laundry, sources, laundryOptions).supportedPoints, laundry.supportedPoints);
const uncited = { ...laundry, citations: laundry.citations.filter((citation) => !citation.sourceIDs.includes(lintSource.sourceID)) };
assert.deepEqual(repair(uncited, laundrySources, laundryOptions).supportedPoints, laundry.supportedPoints);
assert.equal(networkAttempts, 0);
console.log("Plumbing repair replay passed: exact cited evidence supplies missing condition/binding; no invention, context promotion, source mutation or external requests.");
