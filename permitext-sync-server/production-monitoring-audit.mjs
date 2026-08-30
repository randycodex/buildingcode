const DATABASE_FAILURE_PATTERN = /\b(?:database|postgres|postgresql|neon|storage)\b/i;

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizedPath(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  try {
    return new URL(text, "https://permitext.invalid").pathname;
  } catch {
    return text.split(/[?#]/, 1)[0] || null;
  }
}

function structuredMessage(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  const text = String(value || "").trim();
  if (!text.startsWith("{") || !text.endsWith("}")) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function structuredMessages(entry) {
  const candidates = [entry?.message];
  for (const nested of Array.isArray(entry?.logs) ? entry.logs : []) {
    candidates.push(nested?.message, nested?.text);
  }
  return candidates.map(structuredMessage).filter(Boolean);
}

function percentile(values, percentileValue) {
  if (!values.length) return null;
  const sorted = values.slice().sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * percentileValue) - 1);
  return sorted[index];
}

function increment(record, key) {
  record[key] = (record[key] || 0) + 1;
}

export function auditProductionMonitoringEntries(entries, {
  researchLatencyTargetMilliseconds = 45_000
} = {}) {
  const counts = {
    productionEntries: 0,
    nonProductionEntriesIgnored: 0,
    healthRequests: 0,
    healthFailures: 0,
    serverErrors: 0,
    billingEndpointFailures: 0,
    clientErrors: 0,
    requestErrors: 0,
    databaseFailureEvents: 0,
    billingLifecycleWarnings: 0,
    researchSpendGuardrailRejections: 0,
    researchConversationFailures: 0
  };
  const structuredEventCounts = {};
  const researchDurations = [];

  for (const entry of Array.isArray(entries) ? entries : []) {
    if (entry?.environment && entry.environment !== "production") {
      counts.nonProductionEntriesIgnored += 1;
      continue;
    }
    counts.productionEntries += 1;

    const path = normalizedPath(entry?.requestPath);
    const statusCode = finiteNumber(entry?.responseStatusCode ?? entry?.statusCode ?? entry?.status);
    if (path === "/health") {
      counts.healthRequests += 1;
      if (statusCode !== null && statusCode >= 500) counts.healthFailures += 1;
    }
    if (statusCode !== null && statusCode >= 500) counts.serverErrors += 1;
    if (path?.startsWith("/billing/") && statusCode !== null && statusCode >= 400) {
      counts.billingEndpointFailures += 1;
    }

    for (const message of structuredMessages(entry)) {
      const event = String(message.event || "").trim();
      if (!event) continue;
      increment(structuredEventCounts, event);

      if (event === "client_error") counts.clientErrors += 1;
      if (event === "request_error") {
        counts.requestErrors += 1;
        if (DATABASE_FAILURE_PATTERN.test(String(message.message || ""))) {
          counts.databaseFailureEvents += 1;
        }
      }
      if (event === "stripe_invoice_payment_failed") counts.billingLifecycleWarnings += 1;
      if (event === "research_spend_guardrail_rejection") {
        counts.researchSpendGuardrailRejections += 1;
      }
      if (event === "research_conversation_failure") counts.researchConversationFailures += 1;
      if (
        event === "dynamic_route_observation" &&
        String(message.route || "").startsWith("research/conversations")
      ) {
        const duration = finiteNumber(message.durationMilliseconds);
        if (duration !== null && duration >= 0) researchDurations.push(duration);
      }
    }
  }

  const researchLatencyP95Milliseconds = percentile(researchDurations, 0.95);
  const actionableCategories = [];
  if (counts.healthFailures) actionableCategories.push("health_failure");
  if (counts.serverErrors) actionableCategories.push("server_error");
  if (counts.billingEndpointFailures) actionableCategories.push("billing_endpoint_failure");
  if (counts.clientErrors) actionableCategories.push("client_error");
  if (counts.requestErrors) actionableCategories.push("request_error");
  if (counts.databaseFailureEvents) actionableCategories.push("database_failure");
  if (counts.billingLifecycleWarnings) actionableCategories.push("billing_lifecycle_warning");
  if (counts.researchSpendGuardrailRejections) actionableCategories.push("research_spend_guardrail_rejection");
  if (counts.researchConversationFailures) actionableCategories.push("research_conversation_failure");
  if (
    researchLatencyP95Milliseconds !== null &&
    researchLatencyP95Milliseconds > researchLatencyTargetMilliseconds
  ) {
    actionableCategories.push("research_p95_latency");
  }

  return {
    schema: "permitext-production-monitoring-audit-v1",
    generatedAt: new Date().toISOString(),
    counts,
    healthCoverage: {
      observed: counts.healthRequests > 0,
      requestCount: counts.healthRequests,
      failureCount: counts.healthFailures
    },
    researchLatency: {
      sampleCount: researchDurations.length,
      p95Milliseconds: researchLatencyP95Milliseconds,
      targetMilliseconds: researchLatencyTargetMilliseconds,
      overTarget: researchLatencyP95Milliseconds !== null
        ? researchLatencyP95Milliseconds > researchLatencyTargetMilliseconds
        : null
    },
    structuredEventCounts,
    actionable: {
      count: actionableCategories.length,
      categories: actionableCategories
    },
    privacy: {
      rawMessagesEmitted: false,
      customerIdentifiersEmitted: false
    }
  };
}
