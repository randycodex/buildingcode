const transientProviderStatuses = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const transientProviderCauses = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ENETDOWN",
  "ENETRESET",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET"
]);

function sanitizedProviderToken(value, fallback = null) {
  const token = String(value || "").trim().slice(0, 120);
  if (!token) return fallback;
  return /^[a-z0-9_.:-]+$/i.test(token) ? token : fallback;
}

function providerResponseHeader(response, name) {
  return sanitizedProviderToken(response?.headers?.get?.(name));
}

function providerCause({ cause, payload, status }) {
  return sanitizedProviderToken(payload?.error?.code) ||
    sanitizedProviderToken(payload?.error?.type) ||
    sanitizedProviderToken(typeof cause?.code === "string" ? cause.code : null) ||
    sanitizedProviderToken(typeof cause?.cause?.code === "string" ? cause.cause.code : null) ||
    sanitizedProviderToken(cause?.name) ||
    (status ? `http_${status}` : "network_error");
}

function providerErrorIdentity(error) {
  return (typeof error?.code === "string" && error.code) || error?.name || "";
}

function retryableProviderCause(error) {
  if (error?.name === "TypeError") return true;
  const cause = [error?.code, error?.cause?.code].find((value) => typeof value === "string") || "";
  return transientProviderCauses.has(cause);
}

function providerRetryDelay(attempt) {
  return Math.min(750, 200 * (2 ** Math.max(0, attempt - 1)));
}

function nonnegativeProviderNumber(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function providerUsageFromPayload(payload) {
  const inputTokens = nonnegativeProviderNumber(payload?.usage?.input_tokens);
  const outputTokens = nonnegativeProviderNumber(payload?.usage?.output_tokens);
  if (inputTokens === null || outputTokens === null) return null;
  const cachedInputTokens = Math.min(
    inputTokens,
    nonnegativeProviderNumber(payload?.usage?.input_tokens_details?.cached_tokens) || 0
  );
  return {
    input_tokens: inputTokens,
    input_tokens_details: { cached_tokens: cachedInputTokens },
    output_tokens: outputTokens,
    total_tokens: nonnegativeProviderNumber(payload?.usage?.total_tokens) ?? inputTokens + outputTokens
  };
}

function emptyProviderUsage() {
  return {
    input_tokens: 0,
    input_tokens_details: { cached_tokens: 0 },
    output_tokens: 0,
    total_tokens: 0
  };
}

function addProviderUsage(total, usage) {
  if (!usage) return total;
  return {
    input_tokens: total.input_tokens + usage.input_tokens,
    input_tokens_details: {
      cached_tokens: total.input_tokens_details.cached_tokens + usage.input_tokens_details.cached_tokens
    },
    output_tokens: total.output_tokens + usage.output_tokens,
    total_tokens: total.total_tokens + usage.total_tokens
  };
}

function providerReservationAllowance(reservation) {
  if (!reservation?.active) return 0;
  return nonnegativeProviderNumber(reservation.maximumRequestUSD) || 0;
}

function providerUsageTelemetry(usage, attempts, unreconciledProviderCostUSD) {
  return {
    ...usage,
    permitext_provider_attempts: Math.max(0, Number(attempts) || 0),
    permitext_unreconciled_cost_usd: Number(
      Math.max(0, Number(unreconciledProviderCostUSD) || 0).toFixed(6)
    )
  };
}

function attachProviderAccounting(error, usage, attempts, unreconciledProviderCostUSD) {
  if (!error || (typeof error !== "object" && typeof error !== "function")) return error;
  try {
    error.providerAttempts = Math.max(0, Number(attempts) || 0);
    error.providerUsage = providerUsageTelemetry(usage, attempts, unreconciledProviderCostUSD);
  } catch {
    // Preserve the original provider/cancellation error even if it is non-extensible.
  }
  return error;
}

function providerPayloadWithAccounting(payload, usage, attempts, unreconciledProviderCostUSD) {
  return {
    ...payload,
    usage,
    permitext_provider_accounting: {
      attempts: Math.max(0, Number(attempts) || 0),
      unreconciled_cost_usd: Number(
        Math.max(0, Number(unreconciledProviderCostUSD) || 0).toFixed(6)
      )
    }
  };
}

async function waitForProviderRetry(milliseconds, signal) {
  if (signal?.aborted) throw signal.reason || new DOMException("Research was cancelled.", "AbortError");
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
  if (signal?.aborted) throw signal.reason || new DOMException("Research was cancelled.", "AbortError");
}

export function researchProviderFailure({
  message,
  code,
  cause = null,
  response = null,
  payload = null,
  attempts = 1,
  providerUsage = null
}) {
  const error = new Error(message);
  error.code = code;
  if (cause) error.cause = cause;
  const status = Number(response?.status || cause?.providerStatus || cause?.status || 0) || null;
  error.providerStatus = status;
  error.providerCause = providerCause({ cause, payload, status });
  error.providerRequestID = providerResponseHeader(response, "x-request-id");
  error.providerAttempts = Math.max(1, Number(attempts) || 1);
  error.providerUsage = providerUsage || payload?.usage || null;
  return error;
}

export async function requestResearchProvider({
  apiKey,
  requestBody,
  signal = null,
  timeoutMilliseconds,
  failureMessage,
  failureCode = "RESEARCH_PROVIDER_ERROR",
  maximumAttempts = 2,
  fetchImpl = globalThis.fetch,
  reserveEvaluationSpend = () => {},
  settleEvaluationSpend = null,
  reserveProviderSpend = () => ({ active: false }),
  settleProviderSpend = () => {}
}) {
  const attempts = Math.max(1, Math.min(2, Number(maximumAttempts) || 1));
  let aggregateUsage = emptyProviderUsage();
  let completedProviderAttempts = 0;
  let unreconciledProviderCostUSD = 0;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let evaluationSpendReservation;
    let providerSpendReservation;
    try {
      evaluationSpendReservation = reserveEvaluationSpend(requestBody);
      providerSpendReservation = reserveProviderSpend(requestBody);
    } catch (error) {
      if (completedProviderAttempts > 0) {
        throw attachProviderAccounting(
          error,
          aggregateUsage,
          completedProviderAttempts,
          unreconciledProviderCostUSD
        );
      }
      throw error;
    }
    let response;
    try {
      const timeoutSignal = AbortSignal.timeout(timeoutMilliseconds);
      completedProviderAttempts += 1;
      response = await fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify(requestBody),
        signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
      });
    } catch (error) {
      unreconciledProviderCostUSD += providerReservationAllowance(providerSpendReservation);
      if (signal?.aborted || ["RESEARCH_CANCELLED", "AbortError", "TimeoutError"].includes(providerErrorIdentity(error))) {
        throw attachProviderAccounting(
          error,
          aggregateUsage,
          completedProviderAttempts,
          unreconciledProviderCostUSD
        );
      }
      if (attempt < attempts && retryableProviderCause(error)) {
        try {
          await waitForProviderRetry(providerRetryDelay(attempt), signal);
        } catch (retryError) {
          throw attachProviderAccounting(
            retryError,
            aggregateUsage,
            completedProviderAttempts,
            unreconciledProviderCostUSD
          );
        }
        continue;
      }
      throw researchProviderFailure({
        message: failureMessage,
        code: failureCode,
        cause: error,
        attempts: completedProviderAttempts,
        providerUsage: providerUsageTelemetry(
          aggregateUsage,
          completedProviderAttempts,
          unreconciledProviderCostUSD
        )
      });
    }

    const payload = await response.json().catch(() => ({}));
    const attemptUsage = providerUsageFromPayload(payload);
    aggregateUsage = addProviderUsage(aggregateUsage, attemptUsage);
    if (!attemptUsage) {
      unreconciledProviderCostUSD += providerReservationAllowance(providerSpendReservation);
    }
    try {
      settleProviderSpend(providerSpendReservation, payload);
      if (typeof settleEvaluationSpend === "function") {
        settleEvaluationSpend(evaluationSpendReservation, payload);
      } else if (typeof evaluationSpendReservation?.settle === "function") {
        evaluationSpendReservation.settle(payload);
      }
    } catch (error) {
      throw attachProviderAccounting(
        error,
        aggregateUsage,
        completedProviderAttempts,
        unreconciledProviderCostUSD
      );
    }
    const accountedPayload = providerPayloadWithAccounting(
      payload,
      aggregateUsage,
      completedProviderAttempts,
      unreconciledProviderCostUSD
    );
    if (response.ok) return { response, payload: accountedPayload, attempts: completedProviderAttempts };
    if (attempt < attempts && transientProviderStatuses.has(response.status)) {
      try {
        await waitForProviderRetry(providerRetryDelay(attempt), signal);
      } catch (error) {
        throw attachProviderAccounting(
          error,
          aggregateUsage,
          completedProviderAttempts,
          unreconciledProviderCostUSD
        );
      }
      continue;
    }
    throw researchProviderFailure({
      message: failureMessage,
      code: failureCode,
      response,
      payload: accountedPayload,
      attempts: completedProviderAttempts,
      providerUsage: providerUsageTelemetry(
        aggregateUsage,
        completedProviderAttempts,
        unreconciledProviderCostUSD
      )
    });
  }
  throw researchProviderFailure({ message: failureMessage, code: failureCode, attempts });
}
