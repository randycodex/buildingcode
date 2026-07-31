import { readFile } from "node:fs/promises";
import { allSectionCatalogByID, setBoundedLRUCacheValue } from "../app.mjs";
import { createPostgresSyncRepository } from "../postgres-sync-repository.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fakeSQL(strings, ...values) {
  return {
    text: strings.join("?"),
    values
  };
}

const transactions = [];
fakeSQL.transaction = async (queries, options) => {
  transactions.push({ queries, options });
  return queries.map((query) => {
    if (/INSERT INTO permitext_user_content_records/.test(query.text)) {
      return [{ record_id: "performance-user:saved:1" }];
    }
    if (/MAX\(event_id\)/.test(query.text)) {
      return [{ latest_event_id: 17 }];
    }
    if (/SELECT entitlement FROM permitext_entitlements/.test(query.text)) {
      return [{ entitlement: { plan: "pro" } }];
    }
    if (/SELECT\s+EXISTS/.test(query.text)) {
      return [{}];
    }
    return [];
  });
};

const repository = createPostgresSyncRepository(fakeSQL);
const pushResult = await repository.push("performance-user", [{
  savedItem: {
    id: "performance-user:saved:1",
    userID: "performance-user",
    codeVersion: "nyc-construction-codes-2022",
    sectionID: 11909,
    updatedAt: "2026-07-31T12:00:00.000Z"
  }
}]);

assert(
  transactions.length === 2,
  "A standard PostgreSQL push should use one write transaction and one final state read."
);
assert(
  transactions[0].queries.length === 4 &&
    transactions[0].queries.every((query) => !/MAX\(event_id\)|SELECT entitlement FROM permitext_entitlements/.test(query.text)),
  "The PostgreSQL write transaction still performs duplicate event-cursor or entitlement reads."
);
assert(
  transactions[1].queries.length === 2 &&
    transactions[1].queries.some((query) => /MAX\(event_id\)/.test(query.text)) &&
    transactions[1].queries.some((query) => /SELECT entitlement FROM permitext_entitlements/.test(query.text)),
  "The PostgreSQL push must read its final cursor and entitlement after all mutations finish."
);
assert(
  transactions[0].options?.isolationLevel === "Serializable" &&
    transactions[1].options?.isolationLevel === "RepeatableRead",
  "PostgreSQL transactions are not using the Neon isolationLevel option."
);
assert(
  pushResult.latestEventID === 17 && pushResult.entitlement?.plan === "pro",
  "The optimized PostgreSQL push lost its final sync state."
);

const firstCatalog = await allSectionCatalogByID();
const secondCatalog = await allSectionCatalogByID();
assert(firstCatalog === secondCatalog, "The immutable combined section catalog was rebuilt instead of reused.");
assert(firstCatalog.size > 10_000, "The combined section catalog omitted published code sections.");
assert(firstCatalog.get("11909")?.sectionNumber === "403.1", "The cached catalog lost canonical section lookup.");

const boundedCache = new Map();
setBoundedLRUCacheValue(boundedCache, "oldest", 1, 2);
setBoundedLRUCacheValue(boundedCache, "newer", 2, 2);
setBoundedLRUCacheValue(boundedCache, "oldest", 1, 2);
setBoundedLRUCacheValue(boundedCache, "newest", 3, 2);
assert(
  boundedCache.has("oldest") && boundedCache.has("newest") && !boundedCache.has("newer"),
  "The section-text cache does not evict the least recently used entry."
);

for (const sourceName of [
  "app.mjs",
  "postgres-account-repository.mjs",
  "postgres-organization-repository.mjs",
  "postgres-sync-repository.mjs"
]) {
  const source = await readFile(new URL(`../${sourceName}`, import.meta.url), "utf8");
  assert(!source.includes("isolationMode"), `${sourceName} still uses Neon's ignored isolationMode option.`);
}

console.log("Permitext backend performance contract passed.");
