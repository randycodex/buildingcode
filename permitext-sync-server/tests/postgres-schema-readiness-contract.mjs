import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ensurePostgresNormalizedSchema,
  postgresNormalizedSchemaIsReady,
  postgresNormalizedSchemaRequiredColumns,
  postgresNormalizedSchemaRequiredIndexes,
  postgresNormalizedSchemaRequiredTables,
  retryablePostgresSchemaInitializationError,
  waitForPostgresNormalizedSchema
} from "../postgres-schema-readiness.mjs";

const schemaSourceFiles = [
  "app.mjs",
  "postgres-account-repository.mjs",
  "postgres-organization-repository.mjs",
  "postgres-rate-limit-repository.mjs",
  "postgres-sync-repository.mjs"
];

const sourceByFile = await Promise.all(
  schemaSourceFiles.map((file) => readFile(new URL(`../${file}`, import.meta.url), "utf8"))
);
const appSource = sourceByFile[0];
const coreInitializerStart = appSource.indexOf("const initializeSchema = async () => {");
const coreInitializerEnd = appSource.indexOf(
  "const ensureSchema = createSingleFlightInitializer",
  coreInitializerStart
);
assert.ok(coreInitializerStart >= 0 && coreInitializerEnd > coreInitializerStart);
const coreInitializerSource = appSource.slice(coreInitializerStart, coreInitializerEnd);
const schemaSource = [coreInitializerSource, ...sourceByFile.slice(1)].join("\n");

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function matches(pattern, formatter = (match) => match[1]) {
  return uniqueSorted([...schemaSource.matchAll(pattern)].map(formatter));
}

assert.deepEqual(
  [...postgresNormalizedSchemaRequiredTables].sort(),
  matches(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-z0-9_]+)/gi),
  "the readiness signature must include every table created by normalized-v4 initialization"
);
assert.deepEqual(
  [...postgresNormalizedSchemaRequiredColumns].sort(),
  matches(
    /ALTER\s+TABLE\s+([a-z0-9_]+)\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+([a-z0-9_]+)/gi,
    (match) => `${match[1]}.${match[2]}`
  ),
  "the readiness signature must include every additive normalized-v4 column migration"
);
assert.deepEqual(
  [...postgresNormalizedSchemaRequiredIndexes].sort(),
  matches(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+([a-z0-9_]+)/gi),
  "the readiness signature must include every normalized-v4 index"
);

function schemaSQL(rows) {
  let invocation = 0;
  return async function sql() {
    const row = rows[Math.min(invocation, rows.length - 1)];
    invocation += 1;
    return [row];
  };
}

const readyCounts = {
  table_count: postgresNormalizedSchemaRequiredTables.length,
  column_count: postgresNormalizedSchemaRequiredColumns.length,
  index_count: postgresNormalizedSchemaRequiredIndexes.length
};

assert.equal(await postgresNormalizedSchemaIsReady(schemaSQL([readyCounts])), true);
assert.equal(
  await postgresNormalizedSchemaIsReady(schemaSQL([{ ...readyCounts, index_count: readyCounts.index_count - 1 }])),
  false
);

let initializeCalls = 0;
await ensurePostgresNormalizedSchema(schemaSQL([readyCounts]), async () => {
  initializeCalls += 1;
});
assert.equal(initializeCalls, 0, "a ready cold isolate must avoid the DDL initializer");

// A pre-history deployment already has every table/column and all older indexes.
// Use the actual queried index names, so omitting a history index from the
// readiness signature would incorrectly skip initialization and fail this test.
const historyIndexes = [
  "permitext_research_conversations_creation_request_idx",
  "permitext_research_conversations_visible_history_idx",
  "permitext_research_conversations_visible_project_history_idx"
];
for (const missingIndexes of [...historyIndexes.map(name => [name]), historyIndexes]) {
  const installedIndexes = new Set(postgresNormalizedSchemaRequiredIndexes.filter(
    (name) => !missingIndexes.includes(name)
  ));
  const catalogSQL = async (_strings, tables, columns, indexes) => [{
    table_count: tables.length,
    column_count: columns.length,
    index_count: indexes.filter((name) => installedIndexes.has(name)).length
  }];
  let historyInitializeCalls = 0;
  const initializeHistoryIndexes = async () => {
    historyInitializeCalls += 1;
    for (const name of missingIndexes) installedIndexes.add(name);
  };
  await ensurePostgresNormalizedSchema(catalogSQL, initializeHistoryIndexes);
  assert.equal(historyInitializeCalls, 1,
    `an otherwise ready schema missing ${missingIndexes.join(", ")} must install indexes`);
  assert.equal(await postgresNormalizedSchemaIsReady(catalogSQL), true);
  await ensurePostgresNormalizedSchema(catalogSQL, initializeHistoryIndexes);
  assert.equal(historyInitializeCalls, 1,
    "subsequent cold isolates should use the readiness fast path after the indexes exist");
}

await ensurePostgresNormalizedSchema(
  schemaSQL([
    { ...readyCounts, table_count: readyCounts.table_count - 1 },
    readyCounts
  ]),
  async () => {
    initializeCalls += 1;
  }
);
assert.equal(initializeCalls, 1, "an incomplete schema must run initialization exactly once");

await assert.rejects(
  ensurePostgresNormalizedSchema(
    schemaSQL([
      { ...readyCounts, column_count: readyCounts.column_count - 1 },
      { ...readyCounts, column_count: readyCounts.column_count - 1 }
    ]),
    async () => {}
  ),
  (error) => error?.code === "POSTGRES_SCHEMA_INCOMPLETE"
);

assert.equal(retryablePostgresSchemaInitializationError({ code: "23505" }), true);
assert.equal(retryablePostgresSchemaInitializationError({ code: "40P01" }), true);
assert.equal(retryablePostgresSchemaInitializationError({ code: "42P07" }), true);
assert.equal(retryablePostgresSchemaInitializationError({ code: "42710" }), true);
assert.equal(retryablePostgresSchemaInitializationError({ code: "28P01" }), false);

await ensurePostgresNormalizedSchema(
  schemaSQL([
    { ...readyCounts, index_count: readyCounts.index_count - 1 },
    readyCounts
  ]),
  async () => {
    const error = new Error("another cold isolate is creating the same PostgreSQL object");
    error.code = "23505";
    throw error;
  }
);

let delays = 0;
assert.equal(
  await waitForPostgresNormalizedSchema(
    schemaSQL([
      { ...readyCounts, table_count: readyCounts.table_count - 1 },
      { ...readyCounts, table_count: readyCounts.table_count - 1 },
      readyCounts
    ]),
    {
      attempts: 3,
      delay(resolve) {
        delays += 1;
        resolve();
      }
    }
  ),
  true
);
assert.equal(delays, 2, "the conflict loser should wait while another isolate finishes migrations");

assert.match(
  appSource,
  /createSingleFlightInitializer\(\(\)\s*=>\s*ensurePostgresNormalizedSchema\(sql, initializeSchema\)\s*\)/,
  "the adapter must use one in-isolate initializer backed by cross-isolate readiness coordination"
);

console.log("PostgreSQL schema readiness contracts passed.");
