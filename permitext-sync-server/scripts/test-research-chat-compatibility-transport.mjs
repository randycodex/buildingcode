import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { researchChatRequest, researchResponseFromChat } from "./research-chat-compatibility-transport.mjs";
import { buildResearchRequestEnvelopeBuilders } from "../tests/research-request-envelope-preflight.mjs";
import { validationReservation, validationCost } from "./research-validation-pricing-20261005.mjs";
globalThis.fetch = () => { throw Error("Transport contracts forbid provider calls"); };
const policy = JSON.parse(await readFile(new URL("../evals/retrieval-validation-2026-10-05/luna-model-policy.json", import.meta.url)));
const builders = await buildResearchRequestEnvelopeBuilders(policy.configuration);
const evidence = [{ sourceID: "synthetic-source", sectionID: "synthetic-section", codePrefix: "MC", sectionNumber: "999.1",
  title: "Synthetic controlled requirement", text: "The valve shall remain accessible. Exception: listed enclosed equipment is exempt." }];
const question = "Does the valve have to remain accessible?", answer = { answerText: "The valve must remain accessible unless the exception applies." };
const bodies = [builders.buildAnswerRequest(question, evidence, "offline", { responseStyle: "conversational" }),
  builders.buildAnswerRequest(question, evidence, "offline", { responseStyle: "conversational", previousInterpretation: answer,
    revisionFeedback: [{ type: "misstated_provision", detail: "Include the exception" }] }),
  builders.buildVerifierRequest(question, evidence, answer, "offline", {})];
for (const body of bodies) {
  const chat = researchChatRequest(body);
  assert.equal(chat.messages[0].content, body.instructions);
  assert.equal(chat.messages[1].content, body.input);
  assert.deepEqual(chat.response_format.json_schema, { name: body.text.format.name, schema: body.text.format.schema, strict: true });
  assert.equal(chat.max_completion_tokens, body.max_output_tokens);
  assert.equal(chat.reasoning_effort, body.reasoning.effort);
  assert.equal(chat.service_tier, body.service_tier);
  const normalized = researchResponseFromChat({ model: "gpt-6-luna", choices: [{ finish_reason: "stop", message: { content: '{"synthetic":true}' } }],
    usage: { prompt_tokens: 30, completion_tokens: 50, total_tokens: 80, prompt_tokens_details: { cached_tokens: 10 }, completion_tokens_details: { reasoning_tokens: 15 } } }, chat);
  assert.equal(normalized.status, "completed");
  assert.equal(normalized.output[0].content[0].text, '{"synthetic":true}');
  assert.equal(normalized.usage.output_tokens, 50, "Reasoning tokens remain inside the billed output count");
  assert.equal(normalized.usage.input_tokens_details.cached_tokens, 10);
  assert.equal(normalized.service_tier, body.service_tier, "Missing assigned tier retains conservative requested-tier pricing");
  assert(validationCost(normalized) <= validationReservation(body));
}
const base = bodies[0];
for (const patch of [{ model: "gpt-6.1-sol" }, { store: true }, { tools: [{ type: "web_search" }] }, { previous_response_id: "prior" },
  { unsupported_field: true }, { text: { format: { type: "text" } } }, { input: [{ role: "user", content: [{ type: "input_image", image_url: "ignored" }] }] }]) {
  assert.throws(() => researchChatRequest({ ...base, ...patch }), "Unsupported data must fail before dispatch");
}
const length = researchResponseFromChat({ choices: [{ finish_reason: "length", message: { content: "partial" } }] }, researchChatRequest(base));
assert.equal(length.status, "incomplete"); assert.equal(length.incomplete_details.reason, "max_output_tokens");
const refusal = researchResponseFromChat({ choices: [{ finish_reason: "stop", message: { refusal: "declined" } }] }, researchChatRequest(base));
assert.equal(refusal.output[0].content[0].type, "refusal");
const error = { error: { code: "invalid_api_key" } }; assert.strictEqual(researchResponseFromChat(error, researchChatRequest(base)), error);
console.log("Chat transport passed: actual writer/reviewer/repair prompts and strict schemas, output bounds, billing, refusals and incomplete output; zero provider calls.");
