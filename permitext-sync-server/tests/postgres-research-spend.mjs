// A fresh, loopback-only local cluster. Never uses an environment database URL.
// Requires PostgreSQL CLI tools; no driver download or remote database access.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { postgresResearchSpendRecords } from "../postgres-research-spend.mjs";
import { buildResearchSpendReport, researchSpendRange } from "../research-spend-report.mjs";
import { seedResearchSpend, spendFixtureMonth } from "./research-spend-fixture.mjs";

const scratch = await mkdtemp(join(tmpdir(), "permitext-spend-pg-")), directory = join(scratch, "db");
const listener = createServer(); await new Promise(resolve => listener.listen(0, "127.0.0.1", resolve));
const port = listener.address().port; await new Promise(resolve => listener.close(resolve));
const literal = value => value == null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;
const psql = statement => execFileSync("psql", ["-X", "-h", "127.0.0.1", "-p", String(port), "-U", "spend_test", "-d", "postgres", "-tA", "-v", "ON_ERROR_STOP=1"],
  { input: statement, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
let running = false;
try {
  execFileSync("initdb", ["-D", directory, "--username=spend_test", "--auth=trust", "--no-locale"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", directory, "-l", join(scratch, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port} -k ${scratch}`, "-w", "start"], { stdio: "pipe" });
  running = true;
  psql(`CREATE TABLE permitext_users (id text PRIMARY KEY, account jsonb);
    CREATE TABLE permitext_research_usage (id text PRIMARY KEY, user_id text, model text, mode text, funding_source text,
      input_tokens integer, cached_input_tokens integer, output_tokens integer, total_tokens integer, estimated_cost_usd numeric, pricing_version text, created_at timestamptz);
    CREATE TABLE permitext_research_operations (id text PRIMARY KEY, user_id text, operation jsonb, created_at timestamptz);
    CREATE TABLE permitext_research_answers (id text PRIMARY KEY, user_id text, answer jsonb);`);
  const store = { users: { owner: {}, other: {} }, researchUsageByUserID: {}, researchOperationsByUserID: {}, researchAnswersByUserID: {} };
  seedResearchSpend(store, "owner", "other");
  const statements = [];
  for (const [userID, account] of Object.entries(store.users)) statements.push(`INSERT INTO permitext_users VALUES (${literal(userID)},${literal(JSON.stringify(account))}::jsonb);`);
  for (const [userID, rows] of Object.entries(store.researchUsageByUserID)) for (const row of rows) statements.push(`INSERT INTO permitext_research_usage VALUES (${[
    row.id, userID, row.model, row.mode, row.fundingSource || "included", row.inputTokens, row.cachedInputTokens, row.outputTokens, row.totalTokens,
    row.estimatedCostUSD, row.pricingVersion, row.createdAt].map(literal).join(",")});`);
  for (const [userID, rows] of Object.entries(store.researchOperationsByUserID)) for (const row of rows) statements.push(`INSERT INTO permitext_research_operations VALUES (${[
    row.id, userID, JSON.stringify(row), row.createdAt].map(literal).join(",")});`);
  for (const [userID, rows] of Object.entries(store.researchAnswersByUserID)) for (const row of rows) statements.push(`INSERT INTO permitext_research_answers VALUES (${[
    row.id, userID, JSON.stringify(row)].map(literal).join(",")});`);
  psql(statements.join("\n"));
  // Execute the exact production tagged query against PostgreSQL, changing only
  // the transport. Parameters are quoted locally; production uses Neon binds.
  const sql = async (parts, ...values) => {
    const statement = parts.reduce((text, part, index) => text + part + (index < values.length ? literal(values[index]) : ""), "");
    const output = psql(`SELECT row_to_json(result) FROM (${statement}) result;`).trim();
    return output ? output.split("\n").map(line => JSON.parse(line)) : [];
  };
  const range = researchSpendRange(spendFixtureMonth);
  const records = await postgresResearchSpendRecords(sql, range);
  const report = buildResearchSpendReport(records, range);
  assert.equal(report.totals.requests, 10);
  assert.equal(report.totals.estimatedCostUSD, .092);
  assert.equal(report.totals.unknownTokenRequests, 2);
  assert.equal(report.totals.partialCostRequests, 1);
  assert.equal(report.totals.unknownCostRequests, 2);
  assert.equal(report.legacyUnlinkedOperations, 1);
  assert.equal(report.requests.find(row => row.id === "op-historical").totalTokens, 1100);
  assert.equal(report.requests.find(row => row.id === "op-failed").totalTokens, 1350);
  assert.equal(report.requests.find(row => row.id === "op-success").usageID, "new-success");
  assert(!JSON.stringify(records).includes("PRIVATE"));
  const allRange = researchSpendRange({ period: "all" });
  const all = buildResearchSpendReport(await postgresResearchSpendRecords(sql, allRange), allRange);
  assert.equal(all.totals.requests, 12);
  const oneDay = researchSpendRange({ period: "custom", startDate: "2026-12-01", endDate: "2026-12-01" });
  assert.equal(buildResearchSpendReport(await postgresResearchSpendRecords(sql, oneDay), oneDay).totals.estimatedCostUSD, .5);
  console.log("Research spend PostgreSQL passed: real SQL, authoritative historical links, completed/failed attempts, UTC bounds, and legacy deduplication in a disposable cluster.");
} finally {
  if (running) execFileSync("pg_ctl", ["-D", directory, "-m", "fast", "-w", "stop"], { stdio: "pipe" });
  await rm(scratch, { recursive: true, force: true });
}
