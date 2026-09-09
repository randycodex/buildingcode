import assert from "node:assert/strict";
import { zoningExplicitAttributionIssues, zoningAttributionPrompt } from "../research-zoning-attribution.mjs";
import { zoningResearchDeterministicContext, zoningResearchPromptContext } from "../research-zoning-planner.mjs";

globalThis.fetch = async () => { throw new Error("No network in explicit source-attribution tests."); };
const passages = [
  { sourceID: "existing", codePrefix: "ZR", sectionNumber: "42-192" },
  { sourceID: "performance", codePrefix: "ZR", sectionNumber: "42-193" },
  { sourceID: "cross-reference", codePrefix: "ZR", sectionNumber: "42-40" },
  { sourceID: "other-code", codePrefix: "BC", sectionNumber: "42-192" }
];
const answer = (explanation, sourceIDs = ["performance"]) => ({
  supportedPoints: [{ heading: "Conditions", explanation, sourceIDs }],
  citations: passages.map((source) => ({ sourceIDs: [source.sourceID] }))
});
const issues = (candidate, sources = passages) => zoningExplicitAttributionIssues({ answer: candidate, passages: sources });

for (const text of [
  "ZR § 42-192 treats an existing facility as conforming subject to documentation.",
  "ZR Section 42-192 requires documentation.",
  "**ZR § 42‑192(a)** expressly requires documentation.",
  "ZR 42-192 does not permit an undocumented historical conclusion.",
  "ZR §§ 42-192 and 42-193 impose conditions.",
  "ZR Sections 42-192, 42-193 and 42-40 impose conditions.",
  "ZR § 42-192 and ZR § 42-193 jointly require the stated conditions."
]) {
  assert(issues(answer(text)).some((issue) => issue.sectionNumber === "42-192"), text);
  assert.equal(issues(answer(text, passages.map((source) => source.sourceID))).length, 0, text);
}
const mixed = "ZR § 42-193 requires conformity with performance standards. Separately, ZR § 42-192 treats historical facilities as conforming only under its conditions.";
assert.deepEqual(issues(answer(mixed)).map((issue) => issue.sectionNumber), ["42-192"]);
assert.deepEqual(issues(answer(mixed, ["existing"])).map((issue) => issue.sectionNumber), ["42-193"]);
assert.equal(issues(answer(mixed, ["existing", "performance"])).length, 0);
assert.equal(issues({ supportedPoints: [
  answer("ZR § 42-193 requires conformity with performance standards.").supportedPoints[0],
  answer("ZR § 42-192 treats historical facilities as conforming only under its conditions.", ["existing"]).supportedPoints[0]
] }).length, 0);
assert.equal(issues(answer(mixed, ["performance", "other-code"])).length, 1,
  "A matching number in a different corpus cannot bind the ZR rule.");
assert.equal(issues(answer(mixed, ["performance", "invented-source"])).length, 1);
assert.equal(issues(answer("ZR 42-192 requires documentation. ZR 42-192 also requires evidence.")).length, 1,
  "Report each misbound provision once per point.");
const second = answer("ZR 42-193 requires performance standards.");
second.supportedPoints.push(answer("ZR 42-192 requires documentation.").supportedPoints[0]);
assert.equal(issues(second)[0].pointIndex, 1);
assert.equal(issues({ supportedPoints: [{ heading: "ZR 42-192 requires documentation", explanation: "", sourceIDs: ["performance"] }] }).length, 1);

// These are intentionally outside this bounded subject-attribution check. The
// semantic verifier must still assess their actual support and completeness.
for (const text of [
  "ZR § 42-193 incorporates ZR § 42-40 through 42-48.",
  "ZR § 42-193 incorporates the standards of ZR § 42-40.",
  "The conditions refer to Section 12-10.",
  "ZR § 12-10 defines the term, but that source is not supplied.",
  "BC 42-192 requires documentation.",
  "ZR 42-1921 requires documentation.",
  "ZR 42-1920-1 requires documentation."
]) assert.equal(issues(answer(text)).length, 0, text);
assert.equal(issues(answer("ZR 42-192 requires documentation."), passages.filter((source) => source.codePrefix !== "ZR")).length, 0,
  "Never resolve a ZR subject against a different corpus.");
assert.equal(issues({ supportedPoints: [{ heading: "ZR 42-192", explanation: "Requires further research.", sourceIDs: ["performance"] }] }).length, 0);
assert.equal(issues({ supportedPoints: null }).length, 0);

const context = zoningResearchDeterministicContext({ evidence: passages, question: "What conditions apply?" });
assert(context.passages.every((source, index) => source.codePrefix === passages[index].codePrefix));
assert(zoningResearchPromptContext({ disposition: "ready" }, context).includes(zoningAttributionPrompt));
console.log("Explicit zoning rule attribution checks passed; zero API calls.");
