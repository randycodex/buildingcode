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
  attempts = 1
}) {
  const error = new Error(message);
  error.code = code;
  if (cause) error.cause = cause;
  const status = Number(response?.status || cause?.providerStatus || cause?.status || 0) || null;
  error.providerStatus = status;
  error.providerCause = providerCause({ cause, payload, status });
  error.providerRequestID = providerResponseHeader(response, "x-request-id");
  error.providerAttempts = Math.max(1, Number(attempts) || 1);
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
  reserveProviderSpend = () => ({ active: false }),
  settleProviderSpend = () => {}
}) {
  const attempts = Math.max(1, Math.min(2, Number(maximumAttempts) || 1));
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    reserveEvaluationSpend(requestBody);
    const providerSpendReservation = reserveProviderSpend(requestBody);
    let response;
    try {
      const timeoutSignal = AbortSignal.timeout(timeoutMilliseconds);
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
      if (signal?.aborted || ["RESEARCH_CANCELLED", "AbortError", "TimeoutError"].includes(providerErrorIdentity(error))) {
        throw error;
      }
      if (attempt < attempts && retryableProviderCause(error)) {
        await waitForProviderRetry(providerRetryDelay(attempt), signal);
        continue;
      }
      throw researchProviderFailure({
        message: failureMessage,
        code: failureCode,
        cause: error,
        attempts: attempt
      });
    }

    const payload = await response.json().catch(() => ({}));
    settleProviderSpend(providerSpendReservation, payload);
    if (response.ok) return { response, payload, attempts: attempt };
    if (attempt < attempts && transientProviderStatuses.has(response.status)) {
      await waitForProviderRetry(providerRetryDelay(attempt), signal);
      continue;
    }
    throw researchProviderFailure({
      message: failureMessage,
      code: failureCode,
      response,
      payload,
      attempts: attempt
    });
  }
  throw researchProviderFailure({ message: failureMessage, code: failureCode, attempts });
}
