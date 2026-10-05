// These requests cannot generate an answer or an embedding.
export async function researchProviderReadiness({ apiKey, fetchImpl = globalThis.fetch }) {
  const result = { checkedAt: new Date().toISOString(), keyPresent: Boolean(apiKey), billableRequests: 0 };
  if (!apiKey) return { ...result, ready: false, reason: "missing_key" };
  for (const [name, path, method] of [
    ["models", "/v1/models", "GET"],
    ["responses", "/v1/responses", "POST"],
    ["embeddings", "/v1/embeddings", "POST"]
  ]) {
    try {
      const response = await fetchImpl(`https://api.openai.com${path}`, {
        method, headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        ...(method === "POST" ? { body: "{}" } : {}), signal: AbortSignal.timeout(15_000)
      });
      const payload = await response.json();
      // Never retain provider error messages: authentication errors can echo credentials.
      result[name] = { status: response.status, code: payload.error?.code ?? null,
        type: payload.error?.type ?? null, usagePresent: Boolean(payload.usage) };
      if (name === "models") {
        const available = new Set((payload.data || []).map(model => model.id));
        result.models.available = Object.fromEntries(["gpt-6-luna", "gpt-6.1-sol", "text-embedding-3-small"]
          .map(model => [model, available.has(model)]));
      } else {
        const message = String(payload.error?.message || "");
        result[name].expectedValidationFailure = response.status === 400 && !payload.usage &&
          payload.error?.type === "invalid_request_error" &&
          /missing|must provide|required|you must specify/i.test(message) &&
          /model|input/i.test(message);
      }
    } catch (error) {
      result[name] = { status: null, error: error.name };
    }
  }
  result.ready = result.models.status === 200 &&
    Object.values(result.models.available || {}).every(Boolean) &&
    result.responses.expectedValidationFailure === true && result.embeddings.expectedValidationFailure === true;
  return result;
}
