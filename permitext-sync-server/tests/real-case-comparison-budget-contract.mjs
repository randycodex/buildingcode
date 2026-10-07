import assert from "node:assert/strict";
import { reserveMicros, reserveRequest, settleRequest, chargedMicros, usageCosts, assertSchema } from "../scripts/real-case-comparison-budget.mjs";
const body = { model: "gpt-6-luna", store: false, service_tier: "default", reasoning: { effort: "low" }, max_output_tokens: 24000, input: "A question and evidence", instructions: "Answer", text: { format: { type: "json_schema", strict: true } } };
const reservedMicros = reserveMicros(body);
const ledger = { capMicros: 10000000, requests: [] };
reserveRequest(ledger, { id: "1", key: "A", reservedMicros });
reserveRequest(ledger, { id: "2", key: "B", reservedMicros });
assert.equal(chargedMicros(ledger), 2 * reservedMicros); // Concurrent reservations count.
assert.throws(() => reserveRequest(ledger, { id: "3", key: "A", reservedMicros }), /already exists/);
assert.throws(() => reserveRequest(ledger, { id: "3", key: "C", reservedMicros: 10000000 }), /cap reached/);
const payload = { service_tier: "default", usage: { input_tokens: 2000, output_tokens: 1000, input_tokens_details: { cached_tokens: 1000 } } };
settleRequest(ledger, "2", payload);
assert.equal(chargedMicros(ledger), reservedMicros + usageCosts(payload).costUpperMicros);
assert.throws(() => settleRequest(ledger, "1", { usage: { input_tokens: 2000 } }), /usage/);
assert.equal(ledger.requests[0].status, "pending");
ledger.requests[0].status = "unknown";
assert.throws(() => reserveRequest(ledger, { id: "3", key: "C", reservedMicros }), /unresolved/);
const carried = { capMicros: 10000000, requests: [{ id: "old", key: "discarded-setup:old", status: "settled", costUpperMicros: 9990000, reservedMicros: 9990000, discarded: true }] };
assert.throws(() => reserveRequest(carried, { id: "new", key: "new", reservedMicros }), /cap reached/); // Discarding answers never resets their spending.
assert.throws(() => usageCosts({ usage: { input_tokens: 2, output_tokens: 1, input_tokens_details: { cached_tokens: 3 } } }), /usage/);
assert.throws(() => usageCosts({ ...payload, service_tier: "unknown" }), /tier/);
assert.equal(usageCosts({ ...payload, service_tier: "fast" }).costUpperMicros, 2 * usageCosts(payload).costUpperMicros);
assert(usageCosts({ usage: { input_tokens: 273000, output_tokens: 1000 } }).costUpperMicros > 68000);
for (const mutation of [{ model: "gpt-6-sol" }, { store: true }, { service_tier: "priority" }, { tools: [{ type: "web_search" }] }, { previous_response_id: "old" }, { max_output_tokens: 64000 }, { input: [] }]) assert.throws(() => reserveMicros({ ...body, ...mutation }), /Unapproved/);
const schema = { type: "object", additionalProperties: false, required: ["name", "sources"], properties: { name: { type: "string" }, sources: { type: "array", maxItems: 0, items: { type: "string" } } } };
assertSchema({ name: "Example", sources: [] }, schema);
assert.throws(() => assertSchema({ name: "Example", sources: ["invented"] }, schema), /array/);
assert.throws(() => assertSchema({ name: "Example", sources: [], extra: true }, schema), /extra/);
console.log("real-case-comparison-budget-contract passed");
