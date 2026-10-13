// Isolated text-only Responses API accounting. No application imports.
export const pricing = Object.freeze({
  model: "gpt-6-luna", inputPerMillion: .10, cachedPerMillion: .01,
  cacheWritePerMillion: .125, outputPerMillion: .50,
  verifiedAt: "2026-10-06", source: "https://developers.openai.com/api/docs/models/gpt-6-luna"
});

export function validatePaidRequest(body) {
  if (body.model !== pricing.model || body.store !== false || body.service_tier !== "default" ||
      !["low", "medium"].includes(body.reasoning?.effort) ||
      ![8000, 24000].includes(body.max_output_tokens) ||
      typeof body.input !== "string" || typeof body.instructions !== "string" ||
      body.text?.format?.type !== "json_schema" || !body.text.format.strict ||
      body.tools?.length || body.previous_response_id || body.conversation || body.background || body.stream) {
    throw Error("Unapproved or unbounded comparison request.");
  }
}

export function reserveMicros(body) {
  validatePaidRequest(body);
  // UTF-8 bytes overbound text tokens. Include framing, cache-write and long
  // context premiums, and even an unexpected Fast tier (although requesting
  // Standard). All in-flight reservations count against the same $10 cap.
  return Math.ceil(2 * ((Buffer.byteLength(JSON.stringify(body)) + 8192) * .125 * 2 + body.max_output_tokens * .50 * 1.5));
}

export function usageCosts(payload) {
  const u = payload?.usage;
  const i = u?.input_tokens, o = u?.output_tokens, c = u?.input_tokens_details?.cached_tokens ?? 0;
  const w = u?.input_tokens_details?.cache_write_tokens ?? 0;
  if (![i, o, c, w].every(n => Number.isSafeInteger(n) && n >= 0) || c + w > i) throw Error("Missing or invalid provider usage; retain reservation and stop.");
  if (payload.service_tier && !["default", "priority", "fast", "flex", "batch"].includes(payload.service_tier)) throw Error("Unknown returned service tier; retain reservation and stop.");
  const tier = ["priority", "fast"].includes(payload.service_tier) ? 2 : 1;
  const long = i > 272000;
  return {
    costUpperMicros: Math.ceil(tier * (((i - c) * .125 + c * .01) * (long ? 2 : 1) + o * .50 * (long ? 1.5 : 1))),
    estimatedCostMicros: Math.ceil(tier * (((i - c - w) * .10 + w * .125 + c * .01) * (long ? 2 : 1) + o * .50 * (long ? 1.5 : 1)))
  };
}

export function chargedMicros(ledger) {
  return ledger.requests.reduce((total, row) => total + (row.costUpperMicros ?? row.reservedMicros), 0);
}

export function reserveRequest(ledger, row) {
  if (ledger.capMicros !== 10000000 || ledger.requests.some(r => r.status === "unknown")) throw Error("Invalid cap or unresolved provider outcome.");
  if (ledger.requests.some(r => r.key === row.key)) throw Error("A first answer or grade already exists for this key.");
  if (chargedMicros(ledger) + row.reservedMicros > ledger.capMicros) throw Object.assign(Error("$10 cumulative cap reached before dispatch."), { code: "SPEND_CAP" });
  ledger.requests.push({ ...row, status: "pending" });
}

export function settleRequest(ledger, id, payload) {
  const row = ledger.requests.find(r => r.id === id);
  if (!row || row.status !== "pending") throw Error("Settlement does not match a pending request.");
  const costs = usageCosts(payload);
  if (costs.costUpperMicros > row.reservedMicros) throw Error("Provider cost exceeded its conservative reservation; stop.");
  Object.assign(row, costs, { status: "settled", usage: payload.usage, returnedServiceTier: payload.service_tier ?? "default" });
}

export function assertSchema(value, schema, path = "answer") {
  if (schema.enum && !schema.enum.includes(value)) throw Error(`${path}: invalid enum.`);
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw Error(`${path}: expected object.`);
    for (const name of schema.required ?? []) if (!(name in value)) throw Error(`${path}: missing ${name}.`);
    for (const [name, child] of Object.entries(value)) {
      if (!schema.properties?.[name]) { if (schema.additionalProperties === false) throw Error(`${path}: extra ${name}.`); }
      else assertSchema(child, schema.properties[name], `${path}.${name}`);
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(value) || value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) throw Error(`${path}: invalid array.`);
    value.forEach((child, index) => assertSchema(child, schema.items, `${path}[${index}]`));
  } else if (schema.type === "string") {
    if (typeof value !== "string" || value.length < (schema.minLength ?? 0)) throw Error(`${path}: invalid string.`);
  } else if (schema.type === "boolean") {
    if (typeof value !== "boolean") throw Error(`${path}: invalid boolean.`);
  } else if (schema.type === "integer") {
    if (!Number.isSafeInteger(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity)) throw Error(`${path}: invalid integer.`);
  }
}
