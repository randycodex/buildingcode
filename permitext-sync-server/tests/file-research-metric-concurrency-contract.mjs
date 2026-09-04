import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// This runs the actual file adapter against a disposable synthetic store. The
// barrier exposes both the old unlocked-read path and the atomic mutation path
// without timing sleeps, HTTP, providers, or changes to a real account.
function deferred() {
  let resolve;
  const promise = new Promise((yes) => { resolve = yes; });
  return { promise, resolve };
}
const directory = await mkdtemp(join(tmpdir(), "permitext-metric-concurrency-"));
process.env.PERMITEXT_SYNC_DATA_PATH = join(directory, "synthetic-store.json");
const { createFileStoreAdapter } = await import("../app.mjs");
const owner = "web:synthetic-metric-owner";
const otherOwner = "web:synthetic-other-owner";
const store = createFileStoreAdapter();
const releaseCommit = deferred();
let commit;
const writes = [];
try {
  await store.withMutation((data) => {
    data.researchCreditsByUserID[owner] = [{ id: "synthetic-grant", units: 25 }];
    data.researchConversationsByUserID[owner] = [{ id: "synthetic-conversation", messages: [] }];
  });
  const commitStarted = deferred();
  commit = store.withMutation(async (data) => {
    data.researchCreditsByUserID[owner].push({ id: "synthetic-debit", units: -1 });
    data.researchConversationsByUserID[owner][0].messages.push({ id: "synthetic-answer", text: "Synthetic committed answer" });
    commitStarted.resolve();
    await releaseCommit.promise;
  });
  await commitStarted.promise;

  const attempts = [];
  for (const [userID, metricID] of [[owner, "metric-a"], [otherOwner, "metric-b"]]) {
    const adapter = createFileStoreAdapter();
    const attempt = deferred();
    attempts.push(attempt.promise);
    const read = adapter.read.bind(adapter);
    adapter.read = async () => {
      const snapshot = await read();
      attempt.resolve();
      return snapshot;
    };
    const mutate = adapter.withMutation.bind(adapter);
    adapter.withMutation = (mutator) => {
      attempt.resolve();
      return mutate(mutator);
    };
    writes.push(adapter.saveResearchOperationMetric(userID, {
      id: metricID, createdAt: "2026-09-04T00:00:00.000Z", status: "failed", code: "RESEARCH_NOT_CONFIGURED"
    }));
  }
  // Both metric tasks have entered while an unrelated commit owns the file
  // lock. The old method captures a 25-turn snapshot here, then overwrites the
  // completed 24-turn commit when its separate write eventually acquires lock.
  await Promise.all(attempts);
  releaseCommit.resolve();
  await Promise.all([commit, ...writes]);
  const final = await store.read();
  assert.equal(final.researchCreditsByUserID[owner].reduce((total, row) => total + row.units, 0), 24,
    "A delayed metric must preserve the unrelated committed credit debit.");
  assert.equal(final.researchConversationsByUserID[owner][0].messages[0].id, "synthetic-answer",
    "A delayed metric must preserve the unrelated committed conversation.");
  assert.equal(final.researchOperationsByUserID[owner][0].id, "metric-a");
  assert.equal(final.researchOperationsByUserID[otherOwner][0].id, "metric-b",
    "Metrics for different accounts must not replace one another's store snapshot.");
  await store.saveResearchOperationMetric(owner, { id: "metric-a", createdAt: "2026-09-04T00:00:00.000Z", status: "complete" });
  const updated = await store.read();
  assert.equal(updated.researchOperationsByUserID[owner].length, 1);
  assert.equal(updated.researchOperationsByUserID[owner][0].status, "complete");
  assert.equal(updated.researchOperationsByUserID[otherOwner][0].id, "metric-b");
  console.log("File Research metric concurrency contract passed (real adapter, deterministic overlapping commit and two metrics).");
} finally {
  releaseCommit.resolve();
  await Promise.allSettled([commit, ...writes].filter(Boolean));
  await rm(directory, { recursive: true, force: true });
}
