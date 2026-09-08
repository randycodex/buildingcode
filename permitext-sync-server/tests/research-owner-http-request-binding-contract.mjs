import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ownerHTTPResearchRequestHash } from "../evals/research-owner-http-request-binding.mjs";
const makeBody = (id, section = "20018521", text = "Canonical selected text.") => {
  const context = { sourceID: id, sectionID: section, text };
  return { model: "gpt-5.6-luna", safety_identifier: id, instructions: "Bind the claim.",
    input: `PASSAGE_ID: ${id}\nSECTION_ID: ${section}\nENACTED_TEXT: ${text}\nDETERMINISTIC_CONTEXT: ${JSON.stringify({ ...context, contextHash: createHash("sha256").update(JSON.stringify(context)).digest("hex") })}\nREQUIRED_CLAIM_SOURCE: ${id}`,
    text: { format: { name: "permitext_code_interpretation", sourceIDs: [id] } }, max_output_tokens: 1800, service_tier: "default" };
};
const first = "11111111-1111-4111-8111-111111111111", second = "22222222-2222-4222-8222-222222222222";
const a = makeBody(first), b = makeBody(second), expected = ownerHTTPResearchRequestHash(a);
assert.equal(ownerHTTPResearchRequestHash(b), expected);
assert.notEqual(ownerHTTPResearchRequestHash(makeBody(second, "20018102")), expected);
assert.notEqual(ownerHTTPResearchRequestHash(makeBody(second, "20018521", "Changed enacted text.")), expected);
for (const mutation of [
  { ...b, instructions: "Different instructions" }, { ...b, model: "gpt-5.6-terra" },
  { ...b, max_output_tokens: 3000 }, { ...b, service_tier: "fast" },
  { ...b, input: b.input.replace(`REQUIRED_CLAIM_SOURCE: ${second}`, `REQUIRED_CLAIM_SOURCE: ${first}`) }
]) assert.notEqual(ownerHTTPResearchRequestHash(mutation), expected);
assert.throws(() => ownerHTTPResearchRequestHash({ ...b, input: b.input.replace(/"contextHash":"[a-f0-9]+"/, '"contextHash":"invalid"') }), /Invalid deterministic context hash/);
assert.throws(() => ownerHTTPResearchRequestHash({ ...b, input: `${b.input}\nPASSAGE_ID: ${second}\nSECTION_ID: 20018102\n` }), /Repeated random passage/);
console.log("Owner HTTP request binding passed: isolated account/passage IDs normalize; source text, section identity, citation binding, instructions, model, tier and token ceilings remain bound.");
