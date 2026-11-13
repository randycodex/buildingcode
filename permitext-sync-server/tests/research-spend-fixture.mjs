export const spendFixtureMonth = { period: "custom", startDate: "2026-11-01", endDate: "2026-11-30" };

export function seedResearchSpend(store, owner, other) {
  const usage = (id, cost, input = 1000, output = 100) => ({ id, model: "synthetic-model", mode: "openai",
    inputTokens: input, cachedInputTokens: 100, outputTokens: output, totalTokens: input + output,
    estimatedCostUSD: cost, pricingVersion: "synthetic-pricing-v1", createdAt: "2026-11-05T12:00:00.000Z" });
  const accounting = (reportedCostUSD, pending = 0) => ({ schemaVersion: 1,
    inputTokens: 1200, cachedInputTokens: 200, cacheWriteInputTokens: 300, outputTokens: 150, totalTokens: 1350,
    embeddingInputTokens: 50, webSearchCalls: 1, providerRequestCount: 3, pendingProviderRequestCount: pending,
    reportedCostUSD, unreconciledCostUpperBoundUSD: pending ? .08 : 0,
    models: ["synthetic-model", "synthetic-embedding"], pricingVersion: "synthetic-pricing-v1" });
  const operation = (id, status, cost, pending = 0) => ({ id, status, charged: false,
    createdAt: "2026-11-05T12:00:00.000Z", model: "synthetic-model", providerRequestCount: 3,
    providerAccounting: accounting(cost, pending), durationMilliseconds: 1234 });
  const historicalID = `research-${"a".repeat(64)}`;
  store.users[owner].email = "owner@example.test";
  store.users[other].email = '=HYPERLINK("https://example.test","tester")';
  store.researchUsageByUserID[owner] = [usage("new-success", .03), usage(`${historicalID}:usage`, .02),
    usage("legacy-code-question", .01, 200, 20), usage("missing-price", null, 50, 10),
    { ...usage("old-month", .1), createdAt: "2026-10-31T23:59:59.999Z" },
    { ...usage("next-month", .5), createdAt: "2026-12-01T00:00:00.000Z" },
    { ...usage("in-progress", 1), mode: "reservation" }];
  store.researchOperationsByUserID[owner] = [
    { ...operation("op-success", "completed", .031), charged: true, usageReservationID: "new-success" },
    { ...operation("op-failed", "failed", .006), failureCode: "SYNTHETIC_REVIEW_FAILED", usageReservationID: "new-success" },
    operation("op-partial", "cancelled", .004, 1),
    { id: "op-legacy-failed", status: "failed", charged: false, createdAt: "2026-11-05T11:00:00.000Z",
      providerRequestCount: 2, pendingProviderRequestCount: 0, actualProviderCostUSD: .001,
      conservativeProviderCostUSD: .1, inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    { id: "op-historical", status: "completed", charged: true, createdAt: "2026-11-05T12:00:00.000Z",
      providerRequestCount: 2, actualProviderCostUSD: .02, conservativeProviderCostUSD: .05 },
    { id: "op-deleted-link", status: "completed", charged: true, createdAt: "2026-11-05T12:00:00.000Z",
      providerRequestCount: 2, actualProviderCostUSD: .01 },
    { id: "op-replay", status: "replayed", charged: false, createdAt: "2026-11-05T12:00:00.000Z", providerRequestCount: 0 }
  ];
  store.researchAnswersByUserID[owner] = [{ id: `${historicalID}:answer`, operationID: "op-historical", question: "PRIVATE QUESTION SENTINEL", answer: { text: "PRIVATE ANSWER SENTINEL" } }];
  store.researchOperationsByUserID[other] = [operation("other-failure", "failed", .02)];
}
