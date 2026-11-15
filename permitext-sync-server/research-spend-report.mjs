// Owner-only accounting views. Inputs contain counters and account identifiers,
// never questions, generated answers, evidence, or Project facts.
const money = value => Number(value.toFixed(6));
const number = value => value != null && typeof value !== "boolean" && String(value).trim() !== "" &&
  Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const count = value => Number.isSafeInteger(number(value)) ? number(value) : null;
const tokenFields = ["inputTokens", "cachedInputTokens", "cacheWriteInputTokens", "outputTokens", "totalTokens"];

export function researchSpendRange(filters = {}, now = new Date()) {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) throw new TypeError("Choose valid report filters.");
  const period = filters.period || "month";
  let start, end;
  if (period === "month" || period === "last-month") {
    const offset = period === "last-month" ? -1 : 0;
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 1));
  } else if (period === "all") {
    start = new Date(0);
    end = new Date("9999-12-31T00:00:00.000Z");
  } else if (period === "custom") {
    const date = value => {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError("Choose a start and end date.");
      const parsed = new Date(`${value}T00:00:00.000Z`);
      if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new TypeError("Choose valid calendar dates.");
      return parsed;
    };
    start = date(filters.startDate);
    const last = date(filters.endDate);
    if (start > last) throw new TypeError("The end date must be on or after the start date.");
    end = new Date(last.getTime() + 86_400_000);
    if (end.getUTCFullYear() > 9999) throw new TypeError("The end date is too far in the future.");
  } else throw new TypeError("Choose a supported date range.");
  const status = filters.status || "all";
  if (!["all", "completed", "failed", "cancelled", "rejected", "replayed", "unresolved"].includes(status)) throw new TypeError("Choose a supported request outcome.");
  if (filters.userID != null && (typeof filters.userID !== "string" || filters.userID.length > 300)) throw new TypeError("Choose a valid account.");
  return { period, periodStart: start.toISOString(), periodEnd: end.toISOString(),
    startDate: period === "all" ? "" : start.toISOString().slice(0, 10),
    endDate: period === "all" ? "" : new Date(end.getTime() - 86_400_000).toISOString().slice(0, 10),
    userID: filters.userID || "", status, timezone: "UTC" };
}

export function researchSpendRequest({ userID, email = null, usage = null, operation = null }) {
  const accounting = operation?.providerAccounting?.schemaVersion === 1 ? operation.providerAccounting : null;
  const source = accounting || usage || operation || {};
  const unfinished = usage?.mode === "reservation";
  const status = operation?.status || (unfinished ? "unresolved" : "completed");
  // Historical failed operations did not retain token counters. Missing counters
  // must stay unknown; createResearchOperationMetric's default zeros aren't proof.
  const hasTokens = !unfinished && (accounting || usage || (operation && tokenFields.some(key => Object.hasOwn(operation, key)) &&
    (count(operation.totalTokens) > 0 || count(operation.inputTokens) > 0 || count(operation.outputTokens) > 0)));
  const embeddingOnly = !hasTokens && count(operation?.embeddingUsage?.inputTokens) > 0;
  const noCalls = !usage && !accounting && operation?.providerRequestCount === 0 &&
    (["rejected", "replayed"].includes(status) ||
      (operation?.actualProviderCostUSD === 0 && operation?.conservativeProviderCostUSD === 0));
  const pending = count(accounting?.pendingProviderRequestCount ?? operation?.pendingProviderRequestCount) || 0;
  const reportedCostUSD = number(accounting?.reportedCostUSD) ?? number(operation?.actualProviderCostUSD) ?? (!unfinished ? number(usage?.estimatedCostUSD) : null) ??
    (!pending ? number(operation?.estimatedCostUSD) : null);
  const legacyBound = number(operation?.conservativeProviderCostUSD);
  const unreconciledCostUpperBoundUSD = number(accounting?.unreconciledCostUpperBoundUSD) ?? (unfinished ? number(usage.estimatedCostUSD) : null) ??
    (pending && legacyBound != null ? money(Math.max(0, legacyBound - (reportedCostUSD || 0))) : null);
  const estimatedCostUSD = reportedCostUSD ?? (noCalls ? 0 : null);
  const costStatus = estimatedCostUSD == null ? "unknown" : pending ? "partial" : "complete";
  const tokens = Object.fromEntries(tokenFields.map(key => [key,
    noCalls ? 0 : hasTokens ? count(source[key]) : null]));
  if (hasTokens && tokens.inputTokens != null && tokens.outputTokens != null) {
    tokens.totalTokens = tokens.inputTokens + tokens.outputTokens;
  }
  if (embeddingOnly) Object.assign(tokens, { inputTokens: operation.embeddingUsage.inputTokens,
    totalTokens: operation.embeddingUsage.inputTokens, cachedInputTokens: 0, cacheWriteInputTokens: 0 });
  const tokenUsageStatus = noCalls ? "complete" : embeddingOnly ? "partial" : !hasTokens ? "unknown" :
    pending || tokens.inputTokens == null || tokens.outputTokens == null ? "partial" : "complete";
  // Older usage rows did not store cache-write counts. Their other counters are
  // still useful, but do not manufacture a cache-write zero for them.
  const models = accounting?.models || operation?.modelUsage || [operation?.model || usage?.model].filter(Boolean);
  return { id: operation?.id || usage?.id, usageID: usage?.id || operation?.usageReservationID || null,
    userID, email, createdAt: operation?.createdAt || usage?.createdAt,
    status, charged: operation ? operation.charged === true : Boolean(usage) && !unfinished,
    source: operation ? "operation" : "usage_ledger", route: operation?.route || (usage?.mode === "openai-code-question" ? "code-question" : "research"),
    model: operation?.model || usage?.model || null, models: [...new Set(models)],
    pricingVersion: accounting?.pricingVersion || operation?.pricingVersion || usage?.pricingVersion || null,
    fundingSource: operation?.fundingSource || usage?.fundingSource || null,
    providerRequestCount: count(accounting?.providerRequestCount ?? operation?.providerRequestCount),
    pendingProviderRequestCount: count(accounting?.pendingProviderRequestCount ?? operation?.pendingProviderRequestCount), ...tokens, tokenUsageStatus,
    embeddingInputTokens: count(accounting?.embeddingInputTokens ?? operation?.embeddingUsage?.inputTokens),
    webSearchCalls: count(accounting?.webSearchCalls),
    estimatedCostUSD, unreconciledCostUpperBoundUSD, costStatus,
    durationMilliseconds: count(operation?.durationMilliseconds), failureCode: operation?.failureCode || null };
}

function summarize(requests) {
  const sum = key => requests.reduce((total, row) => total + (row[key] || 0), 0);
  const completed = requests.filter(row => row.status === "completed").length;
  const estimatedCostUSD = money(sum("estimatedCostUSD"));
  const unknownCostRequests = requests.filter(row => row.costStatus === "unknown").length;
  const partialCostRequests = requests.filter(row => row.costStatus === "partial").length;
  return { requests: requests.length, completed, failed: requests.filter(row => row.status === "failed").length,
    cancelled: requests.filter(row => row.status === "cancelled").length,
    unresolved: requests.filter(row => row.status === "unresolved").length,
    charged: requests.filter(row => row.charged).length,
    ...Object.fromEntries(tokenFields.map(key => [key, sum(key)])),
    unknownTokenRequests: requests.filter(row => row.tokenUsageStatus === "unknown").length,
    partialTokenRequests: requests.filter(row => row.tokenUsageStatus === "partial").length,
    unknownCacheWriteRequests: requests.filter(row => row.cacheWriteInputTokens == null).length,
    unknownCostRequests, partialCostRequests, estimatedCostUSD,
    unreconciledCostUpperBoundUSD: money(sum("unreconciledCostUpperBoundUSD")),
    averageCostPerCompletedRequestUSD: completed && !unknownCostRequests && !partialCostRequests ? money(estimatedCostUSD / completed) : null };
}

export function buildResearchSpendReport(records, range) {
  const dated = records.filter(row => !row.coveredByLegacyLedger).map(researchSpendRequest)
    .filter(row => row.createdAt >= range.periodStart && row.createdAt < range.periodEnd);
  const accounts = [...new Map(dated.map(row => [row.userID, { userID: row.userID, email: row.email }])).values()]
    .sort((a, b) => (a.email || a.userID).localeCompare(b.email || b.userID));
  const requests = dated.filter(row => (!range.userID || row.userID === range.userID) && (range.status === "all" || row.status === range.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  const grouped = new Map();
  for (const row of requests) { if (!grouped.has(row.userID)) grouped.set(row.userID, []); grouped.get(row.userID).push(row); }
  const users = [...grouped].map(([userID, rows]) => ({ userID, email: rows[0].email, ...summarize(rows) }))
    .sort((a, b) => b.estimatedCostUSD - a.estimatedCostUSD || a.userID.localeCompare(b.userID));
  return { ...range, generatedAt: new Date().toISOString(), accounts, users, requests,
    legacyUnlinkedOperations: records.filter(row => row.coveredByLegacyLedger && (!range.userID || row.userID === range.userID) &&
      (range.status === "all" || row.operation?.status === range.status)).length,
    totals: { users: users.length, ...summarize(requests) } };
}

const csvCell = value => {
  const text = value == null ? "" : String(value);
  const safe = /^[\s\uFEFF]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

export function researchSpendCSV(report, view = "requests") {
  if (!["accounts", "requests"].includes(view)) throw new TypeError("Choose accounts or requests for export.");
  const fields = view === "accounts"
    ? ["userID", "email", "requests", "completed", "failed", "cancelled", "unresolved", "charged", ...tokenFields,
      "estimatedCostUSD", "unreconciledCostUpperBoundUSD", "unknownCostRequests", "partialCostRequests", "unknownTokenRequests", "partialTokenRequests", "unknownCacheWriteRequests", "averageCostPerCompletedRequestUSD"]
    : ["id", "usageID", "userID", "email", "createdAt", "status", "charged", "route", "model", "models", "pricingVersion", "fundingSource",
      "providerRequestCount", "pendingProviderRequestCount", ...tokenFields, "tokenUsageStatus", "embeddingInputTokens", "webSearchCalls",
      "estimatedCostUSD", "costStatus", "unreconciledCostUpperBoundUSD", "durationMilliseconds", "failureCode", "source"];
  const rows = view === "accounts" ? report.users : report.requests;
  const columns = ["periodStartUTC", "periodEndExclusiveUTC", ...fields];
  return "\uFEFF" + [columns, ...rows.map(row => [report.periodStart, report.periodEnd, ...fields.map(key =>
    Array.isArray(row[key]) ? row[key].join("; ") : row[key])])].map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
