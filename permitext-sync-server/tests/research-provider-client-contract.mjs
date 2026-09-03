import assert from "node:assert/strict";
import { requestResearchProvider } from "../research-provider-client.mjs";
import {
  beginResearchSpendReservation, endResearchSpendReservation,
  reserveResearchProviderSpend, settleResearchProviderSpend
} from "../research-config.mjs";

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
  const environment = {
    VERCEL_ENV: "production",
    PERMITEXT_RESEARCH_MAX_REQUEST_USD: "0.02",
    PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "1",
    PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "7",
    PERMITEXT_RESEARCH_DAILY_CAP_USD: "10",
    PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "100",
    PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "10",
    PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: "1",
    PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "10",
    PERMITEXT_RESEARCH_PRICING_VERSION: "provider-cap-test"
  };
  let calls = 0;
  const phases = [];
  beginResearchSpendReservation({ id: "provider-retry-cap-test" }, environment);
  await assert.rejects(requestResearchProvider(requestOptions({
    requestBody: { model: "test-model", input: "PRIVATE_QUESTION", max_output_tokens: 100, service_tier: null },
    reserveProviderSpend: (body) => reserveResearchProviderSpend(body, environment),
    settleProviderSpend: (reservation, payload) => settleResearchProviderSpend(reservation, payload, environment),
    observePhase: (event) => phases.push(event),
    fetchImpl: async (url, options) => {
      calls += 1;
      assert.equal(JSON.parse(options.body).service_tier, "default");
      return providerResponse(503, { error: { code: "service_unavailable" } });
    }
  })), { code: "RESEARCH_SPEND_CAP" });
  const spend = endResearchSpendReservation();
  assert.equal(calls, 1, "A retry was dispatched after it could exceed the cumulative limit.");
  assert.equal(spend.providerRequestCount, 1);
  assert.equal(spend.pendingProviderReservationCount, 1);
  assert.equal(phases.length, 1);
  assert.equal(phases[0].outcome, "failed");
  assert.equal(phases[0].providerAttempts, 1);
  assert(phases[0].durationMilliseconds >= 0);
  assert.doesNotMatch(JSON.stringify(phases), /PRIVATE_QUESTION|test-key/);
}

{
  let fetchAttempts = 0;
  let evaluationReservations = 0;
  let evaluationSettlements = 0;
  let providerReservations = 0;
  let providerSettlements = 0;
  const result = await requestResearchProvider(requestOptions({
    fetchImpl: async () => {
      fetchAttempts += 1;
      return fetchAttempts === 1
        ? providerResponse(503, {
            model: "test-model",
            error: { code: "service_unavailable" },
            usage: {
              input_tokens: 10,
              input_tokens_details: { cached_tokens: 2 },
              output_tokens: 3,
              total_tokens: 13
            }
          })
        : providerResponse(200, {
            id: "response-after-retry",
            model: "test-model",
            usage: {
              input_tokens: 20,
              input_tokens_details: { cached_tokens: 5 },
              output_tokens: 7,
              total_tokens: 27
            }
          });
    },
    reserveEvaluationSpend: () => ({ active: true, reservationID: `evaluation-${++evaluationReservations}` }),
    settleEvaluationSpend: (reservation, payload) => {
      evaluationSettlements += 1;
      assert.equal(reservation.reservationID, `evaluation-${evaluationSettlements}`);
      assert(payload.error || payload.id);
    },
    reserveProviderSpend: () => ({
      active: true,
      reservationID: `request-${++providerReservations}`,
      maximumRequestUSD: 0.05
    }),
    settleProviderSpend: () => { providerSettlements += 1; }
  }));
  assert.equal(result.payload.id, "response-after-retry");
  assert.equal(result.attempts, 2);
  assert.equal(fetchAttempts, 2);
  assert.equal(evaluationReservations, 2);
  assert.equal(evaluationSettlements, 2);
  assert.equal(providerReservations, 2);
  assert.equal(providerSettlements, 2);
  assert.deepEqual(result.payload.usage, {
    input_tokens: 30,
    input_tokens_details: { cached_tokens: 7 },
    output_tokens: 10,
    total_tokens: 40
  });
  assert.deepEqual(result.payload.permitext_provider_accounting, {
    attempts: 2,
    unreconciled_cost_usd: 0
  });
}

{
  let fetchAttempts = 0;
  const result = await requestResearchProvider(requestOptions({
    fetchImpl: async () => {
      fetchAttempts += 1;
      return fetchAttempts === 1
        ? providerResponse(503, { error: { code: "service_unavailable" } })
        : providerResponse(200, {
            id: "response-after-unreconciled-retry",
            model: "test-model",
            usage: { input_tokens: 12, output_tokens: 4, total_tokens: 16 }
          });
    },
    reserveProviderSpend: () => ({ active: true, maximumRequestUSD: 0.05 })
  }));
  assert.equal(fetchAttempts, 2);
  assert.equal(result.payload.usage.input_tokens, 12);
  assert.equal(result.payload.permitext_provider_accounting.attempts, 2);
  assert.equal(result.payload.permitext_provider_accounting.unreconciled_cost_usd, 0.05);
}

{
  let fallbackSettlements = 0;
  await requestResearchProvider(requestOptions({
    fetchImpl: async () => providerResponse(200, { id: "settled-by-reservation" }),
    reserveEvaluationSpend: () => ({
      active: true,
      settle: (payload) => {
        fallbackSettlements += 1;
        assert.equal(payload.id, "settled-by-reservation");
      }
    })
  }));
  assert.equal(fallbackSettlements, 1);
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
      assert.equal(error.providerUsage.permitext_provider_attempts, 1);
      assert.equal(error.providerUsage.permitext_unreconciled_cost_usd, 0);
      return true;
    }
  );
  assert.equal(fetchAttempts, 1);
}

{
  const networkFailure = new TypeError("fetch failed", {
    cause: Object.assign(new Error("headers timed out"), { code: "UND_ERR_HEADERS_TIMEOUT" })
  });
  await assert.rejects(
    requestResearchProvider(requestOptions({
      maximumAttempts: 1,
      fetchImpl: async () => { throw networkFailure; }
    })),
    (error) => {
      assert.equal(error.code, "RESEARCH_PROVIDER_ERROR");
      assert.equal(error.providerCause, "UND_ERR_HEADERS_TIMEOUT");
      return true;
    }
  );
}

{
  let fetchAttempts = 0;
  const result = await requestResearchProvider(requestOptions({
    fetchImpl: async () => {
      fetchAttempts += 1;
      if (fetchAttempts === 1) throw new TypeError("temporary connection failure");
      return providerResponse(200, {
        id: "network-recovered",
        usage: { input_tokens: 8, output_tokens: 2, total_tokens: 10 }
      });
    },
    reserveProviderSpend: () => ({ active: true, maximumRequestUSD: 0.04 })
  }));
  assert.equal(result.payload.id, "network-recovered");
  assert.equal(result.attempts, 2);
  assert.equal(result.payload.permitext_provider_accounting.unreconciled_cost_usd, 0.04);
}

for (const name of ["TimeoutError", "AbortError"]) {
  let fetchAttempts = 0;
  const original = new DOMException(`${name} from test`, name);
  await assert.rejects(
    requestResearchProvider(requestOptions({
      reserveProviderSpend: () => ({ active: true, maximumRequestUSD: 0.03 }),
      fetchImpl: async () => {
        fetchAttempts += 1;
        throw original;
      }
    })),
    (error) => {
      assert.equal(error, original);
      assert.equal(error.providerAttempts, 1);
      assert.equal(error.providerUsage.permitext_unreconciled_cost_usd, 0.03);
      return true;
    }
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
      reserveProviderSpend: () => ({ active: true, maximumRequestUSD: 0.06 }),
      fetchImpl: async () => providerResponse(502, {
        error: { code: "do not log this sentence" }
      }, { "x-request-id": "request id with spaces" })
    })),
    (error) => {
      assert.equal(error.providerCause, "http_502");
      assert.equal(error.providerRequestID, null);
      assert.equal(error.providerAttempts, 1);
      assert.equal(error.providerUsage.permitext_unreconciled_cost_usd, 0.06);
      return true;
    }
  );
}

console.log("Research provider client contract passed.");
