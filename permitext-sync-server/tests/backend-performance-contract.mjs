import { allSectionCatalogByID } from "../app.mjs";
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
fakeSQL.transaction = async (queries) => {
  transactions.push(queries);
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
  transactions[0].length === 4 &&
    transactions[0].every((query) => !/MAX\(event_id\)|SELECT entitlement FROM permitext_entitlements/.test(query.text)),
  "The PostgreSQL write transaction still performs duplicate event-cursor or entitlement reads."
);
assert(
  transactions[1].length === 2 &&
    transactions[1].some((query) => /MAX\(event_id\)/.test(query.text)) &&
    transactions[1].some((query) => /SELECT entitlement FROM permitext_entitlements/.test(query.text)),
  "The PostgreSQL push must read its final cursor and entitlement after all mutations finish."
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

console.log("Permitext backend performance contract passed.");
