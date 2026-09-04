import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withFileStoreLock } from "../file-store-coordinator.mjs";

function deferred() {
  let resolve;
  const promise = new Promise((yes) => { resolve = yes; });
  return { promise, resolve };
}
const directory = await mkdtemp(join(tmpdir(), "permitext-usage-concurrency-"));
const dataPath = join(directory, "synthetic-store.json");
process.env.PERMITEXT_SYNC_DATA_PATH = dataPath;
const { createFileStoreAdapter } = await import("../app.mjs");
const store = createFileStoreAdapter();
const owner = "web:synthetic-usage-owner";
const otherOwner = "web:synthetic-other-owner";
const grant = { id: "synthetic-grant", units: 25 };
const claim = { id: "synthetic-claim", provider: "stripe", units: 25, creditedUserID: owner,
  status: "credited", revokedUnits: 0, refundedAmount: 0, lastReversalEventID: null, lastReversalSignedDate: 0 };

// Hold an unrelated commit while the actual adapter enters each usage/credit
// method. Instrument both possible adapter entry paths: the former bare read
// captures stale bytes, while withMutation waits to read under the file lock.
// There are no sleeps or provider calls; every file is a temporary fixture.
async function overlap(name, initialize, operation, verify) {
  await store.withMutation(initialize);
  const enteredCommit = deferred(), releaseCommit = deferred(), enteredOperation = deferred();
  let result;
  const commit = store.withMutation(async (data) => {
    data.researchOperationsByUserID[otherOwner] = [{ id: name + ":unrelated-metric", status: "complete" }];
    data.researchConversationsByUserID[otherOwner] = [{ id: name + ":conversation", messages: [{ id: name + ":answer" }] }];
    enteredCommit.resolve();
    await releaseCommit.promise;
  });
  let pending;
  try {
    await enteredCommit.promise;
    const worker = createFileStoreAdapter();
    const read = worker.read.bind(worker);
    worker.read = async () => {
      const snapshot = await read();
      enteredOperation.resolve();
      return snapshot;
    };
    const mutate = worker.withMutation.bind(worker);
    worker.withMutation = (mutator) => {
      enteredOperation.resolve();
      return mutate(mutator);
    };
    pending = operation(worker);
    await enteredOperation.promise;
    releaseCommit.resolve();
    [, result] = await Promise.all([commit, pending]);
    const final = await store.read();
    assert.equal(final.researchOperationsByUserID[otherOwner][0].id, name + ":unrelated-metric", name + " must retain another account's metric.");
    assert.equal(final.researchConversationsByUserID[otherOwner][0].messages[0].id, name + ":answer", name + " must retain the unrelated committed answer.");
    await verify(final, result);
  } finally {
    releaseCommit.resolve();
    await Promise.allSettled([commit, pending].filter(Boolean));
  }
}

try {
  await overlap("release", (data) => {
    data.researchUsageByUserID[owner] = [{ id: "reservation", mode: "reservation" }, { id: "completed", mode: "openai" }];
  }, (adapter) => adapter.releaseResearchUsageReservation(owner, "reservation"), async (data, result) => {
    assert.equal(result, true);
    assert.deepEqual(data.researchUsageByUserID[owner], [{ id: "completed", mode: "openai" }]);
    assert.equal(await store.releaseResearchUsageReservation(owner, "reservation"), false);
  });
  await overlap("complete", (data) => {
    data.researchUsageByUserID[owner] = [{ id: "reservation", mode: "reservation", fundingSource: "purchased", requestFingerprint: "synthetic-fingerprint" }];
    data.researchCreditsByUserID[owner] = [grant];
  }, (adapter) => adapter.completeResearchUsageReservation(owner, "reservation", { mode: "openai", totalTokens: 2, createdAt: "2026-09-04T00:00:00Z" }), async (data) => {
    assert.equal(data.researchUsageByUserID[owner][0].requestFingerprint, "synthetic-fingerprint");
    assert.equal(data.researchUsageByUserID[owner][0].fundingSource, "purchased");
    assert.equal(data.researchCreditsByUserID[owner].reduce((total, entry) => total + entry.units, 0), 24);
    await assert.rejects(store.completeResearchUsageReservation(owner, "reservation", { mode: "openai" }), /not found/);
    assert.equal((await store.read()).researchCreditsByUserID[owner].filter((entry) => entry.id === "usage:reservation").length, 1);
  });
  await overlap("grant", (data) => {
    data.researchCreditsByUserID[owner] = [];
    data.researchCreditsByUserID[otherOwner] = [];
  }, (adapter) => adapter.saveResearchCreditEntry(owner, grant), async (data, result) => {
    assert.equal(result.created, true);
    assert.deepEqual(data.researchCreditsByUserID[owner], [grant]);
    const replay = await store.saveResearchCreditEntry(otherOwner, grant);
    assert.equal(replay.created, false);
    assert.equal(replay.ownerUserID, owner);
  });
  await overlap("claim", (data) => {
    data.researchCreditsByUserID[owner] = [];
    data.researchPurchaseClaimsByID = {};
  }, (adapter) => adapter.claimResearchCreditPurchase(owner, claim, grant), async (data, result) => {
    assert.equal(result.created, true);
    assert.equal(data.researchPurchaseClaimsByID[claim.id].creditedUserID, owner);
    assert.deepEqual(data.researchCreditsByUserID[owner], [grant]);
    const replay = await store.claimResearchCreditPurchase(otherOwner, claim, grant);
    assert.equal(replay.created, false);
    assert.equal(replay.ownerUserID, owner);
  });
  const refund = { targetRevokedUnits: 13, eventID: "synthetic-partial-refund", signedDate: 100, refundedAmount: 500 };
  await overlap("reconcile", (data) => {
    data.researchCreditsByUserID[owner] = [grant];
    data.researchPurchaseClaimsByID[claim.id] = claim;
  }, (adapter) => adapter.reconcileResearchCreditPurchase(claim.id, refund), async (data, result) => {
    assert.equal(result.applied, true);
    assert.equal(data.researchCreditsByUserID[owner].reduce((total, entry) => total + entry.units, 0), 12);
    assert.equal(data.researchPurchaseClaimsByID[claim.id].status, "partially_refunded");
    assert.equal((await store.reconcileResearchCreditPurchase(claim.id, refund)).reason, "duplicate");
    assert.equal((await store.reconcileResearchCreditPurchase(claim.id, { ...refund, eventID: "synthetic-stale-refund", signedDate: 90 })).reason, "stale");
  });

  // Normal request handlers may already own the file lock. AsyncLocalStorage
  // reentrancy must allow the nested adapter mutation without reacquiring it.
  await withFileStoreLock(dataPath, async () => {
    await store.saveResearchOperationMetric(owner, { id: "nested-request-metric", status: "complete" });
    await store.saveResearchCreditEntry(owner, { id: "nested-request-credit", units: 1 });
    await store.releaseResearchUsageReservation(owner, "missing-reservation");
  });
  const nested = await store.read();
  assert.equal(nested.researchOperationsByUserID[owner][0].id, "nested-request-metric");
  assert.equal(nested.researchCreditsByUserID[owner].filter((entry) => entry.id === "nested-request-credit").length, 1);
  console.log("File Research usage concurrency contract passed (actual release, completion, grant, claim, reconciliation, and nested request locks).");
} finally {
  await rm(directory, { recursive: true, force: true });
}
