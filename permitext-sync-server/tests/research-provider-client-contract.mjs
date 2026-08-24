import assert from "node:assert/strict";
import { requestResearchProvider } from "../research-provider-client.mjs";

function providerResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers }
  });
}

function requestOptions(overrides = {}) {
  return {
    apiKey: "test-key",
    requestBody: { model: "test-model", input: "test" },
    timeoutMilliseconds: 1_000,
    failureMessage: "Research provider failed.",
    ...overrides
  };
}

{
  let fetchAttempts = 0;
  let evaluationReservations = 0;
  let providerReservations = 0;
  const result = await requestResearchProvider(requestOptions({
    fetchImpl: async () => {
      fetchAttempts += 1;
      return fetchAttempts === 1
        ? providerResponse(503, { error: { code: "service_unavailable" } })
        : providerResponse(200, { id: "response-after-retry" });
    },
    reserveEvaluationSpend: () => { evaluationReservations += 1; },
    reserveProviderSpend: () => { providerReservations += 1; }
  }));
  assert.equal(result.payload.id, "response-after-retry");
  assert.equal(result.attempts, 2);
  assert.equal(fetchAttempts, 2);
  assert.equal(evaluationReservations, 2);
  assert.equal(providerReservations, 2);
}

{
  let fetchAttempts = 0;
  await assert.rejects(
    requestResearchProvider(requestOptions({
      fetchImpl: async () => {
        fetchAttempts += 1;
        return providerResponse(400, {
          error: { code: "unsafe cause with spaces", type: "invalid_request_error" }
        }, { "x-request-id": "req_test_400" });
      }
    })),
    (error) => {
      assert.equal(error.code, "RESEARCH_PROVIDER_ERROR");
      assert.equal(error.providerStatus, 400);
      assert.equal(error.providerCause, "invalid_request_error");
      assert.equal(error.providerRequestID, "req_test_400");
      assert.equal(error.providerAttempts, 1);
      return true;
    }
  );
  assert.equal(fetchAttempts, 1);
}

{
  let fetchAttempts = 0;
  const result = await requestResearchProvider(requestOptions({
    fetchImpl: async () => {
      fetchAttempts += 1;
      if (fetchAttempts === 1) throw new TypeError("temporary connection failure");
      return providerResponse(200, { id: "network-recovered" });
    }
  }));
  assert.equal(result.payload.id, "network-recovered");
  assert.equal(result.attempts, 2);
}

for (const name of ["TimeoutError", "AbortError"]) {
  let fetchAttempts = 0;
  const original = new DOMException(`${name} from test`, name);
  await assert.rejects(
    requestResearchProvider(requestOptions({
      fetchImpl: async () => {
        fetchAttempts += 1;
        throw original;
      }
    })),
    (error) => error === original
  );
  assert.equal(fetchAttempts, 1);
}

{
  const spendLimit = new Error("Research provider budget reached.");
  spendLimit.code = "RESEARCH_SPEND_CAP";
  let fetchAttempts = 0;
  await assert.rejects(
    requestResearchProvider(requestOptions({
      reserveProviderSpend: () => { throw spendLimit; },
      fetchImpl: async () => {
        fetchAttempts += 1;
        return providerResponse(200, { id: "must-not-run" });
      }
    })),
    (error) => error === spendLimit
  );
  assert.equal(fetchAttempts, 0);
}

{
  await assert.rejects(
    requestResearchProvider(requestOptions({
      maximumAttempts: 1,
      fetchImpl: async () => providerResponse(502, {
        error: { code: "do not log this sentence" }
      }, { "x-request-id": "request id with spaces" })
    })),
    (error) => {
      assert.equal(error.providerCause, "http_502");
      assert.equal(error.providerRequestID, null);
      assert.equal(error.providerAttempts, 1);
      return true;
    }
  );
}

console.log("Research provider client contract passed.");
