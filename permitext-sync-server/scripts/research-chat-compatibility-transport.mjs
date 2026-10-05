// Evaluation-only transport. Production continues to use Responses.
import assert from "node:assert/strict";

export function researchChatRequest(body) {
  assert.equal(body.model, "gpt-6-luna");
  assert.equal(body.store, false);
  assert(!body.tools?.length && !body.previous_response_id && !body.conversation);
  assert(Number.isSafeInteger(body.max_output_tokens) && body.max_output_tokens > 0);
  assert(["default", "priority"].includes(body.service_tier));
  assert(["low", "medium", "high"].includes(body.reasoning?.effort));
  const allowed = new Set(["model", "store", "service_tier", "reasoning", "max_output_tokens", "safety_identifier", "instructions", "input", "text"]);
  assert(Object.keys(body).every(key => allowed.has(key)), "Unsupported Responses field must not silently disappear");
  const messages = [];
  if (body.instructions) messages.push({ role: "developer", content: body.instructions });
  if (typeof body.input === "string") messages.push({ role: "user", content: body.input });
  else {
    assert(Array.isArray(body.input));
    for (const message of body.input) {
      assert(["user", "assistant", "developer", "system"].includes(message.role));
      const content = typeof message.content === "string" ? message.content : message.content.map(part => {
        assert(["input_text", "text"].includes(part.type), "Only text is supported in this evaluation transport");
        return { type: "text", text: part.text };
      });
      messages.push({ role: message.role, content });
    }
  }
  assert(messages.length && body.text?.format?.type === "json_schema" && body.text.format.strict === true);
  const { name, schema, strict } = body.text.format;
  const request = { model: body.model, store: false, service_tier: body.service_tier,
    reasoning_effort: body.reasoning.effort, max_completion_tokens: body.max_output_tokens,
    ...(body.safety_identifier ? { safety_identifier: body.safety_identifier } : {}),
    messages, response_format: { type: "json_schema", json_schema: { name, schema, strict } } };
  assert(Buffer.byteLength(JSON.stringify(request)) <= Buffer.byteLength(JSON.stringify(body)) + 8192,
    "Transport framing must remain inside the original reservation overhead");
  return request;
}

export function researchResponseFromChat(payload, request) {
  if (payload.error) return payload;
  const choice = payload.choices?.[0], message = choice?.message;
  const complete = choice?.finish_reason === "stop";
  const content = message?.refusal ? [{ type: "refusal", refusal: message.refusal }]
    : typeof message?.content === "string" ? [{ type: "output_text", text: message.content }] : [];
  const usage = payload.usage ? { input_tokens: payload.usage.prompt_tokens,
    output_tokens: payload.usage.completion_tokens, total_tokens: payload.usage.total_tokens,
    input_tokens_details: payload.usage.prompt_tokens_details,
    output_tokens_details: payload.usage.completion_tokens_details } : undefined;
  return { id: payload.id, model: payload.model, service_tier: payload.service_tier || request.service_tier,
    status: complete ? "completed" : "incomplete",
    ...(complete ? {} : { incomplete_details: { reason: choice?.finish_reason === "length" ? "max_output_tokens" : "unsupported_chat_finish_reason" } }),
    output: [{ type: "message", role: "assistant", content }], usage,
    permitext_evaluation_transport: "chat-completions" };
}
