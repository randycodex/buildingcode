// Run against a local PostgreSQL Unix socket with PERMITEXT_TEST_PG_SOCKET and PGPORT.
// PERMITEXT_TEST_PG_DRIVER can point to a disposable installation of node-postgres.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { neon } from "@neondatabase/serverless";
import { createPostgresSyncRepository } from "../postgres-sync-repository.mjs";

const socket = process.env.PERMITEXT_TEST_PG_SOCKET;
if (!socket) {
  console.log("PostgreSQL event-order test skipped. Set PERMITEXT_TEST_PG_SOCKET to run it.");
  process.exit(0);
}
assert.ok(socket.startsWith("/"), "Use a local Unix socket.");
const { default: pg } = await import(process.env.PERMITEXT_TEST_PG_DRIVER || "pg");
const schema = "sync_order_" + randomUUID().replaceAll("-", "");
const clients = Array.from({length: 3}, () => new pg.Client({
  host: socket, database: "postgres", statement_timeout: 15000
}));
const [writer, readerPosition, observer] = clients;
const tag = neon("postgresql://localhost/test");
function repository(client, beforeCommit) {
  // Reuse the production driver's SQL composition. Execute through a dedicated
  // connection so the test can pause a transaction between its write and commit.
  function sql(parts, ...values) {
    const query = tag(parts, ...values);
    query.then = (resolve, reject) => execute(query).then(resolve, reject);
    return query;
  }
  async function execute(query) {
    const {query: text, params} = query.queryData.toParameterizedQuery();
    return (await client.query(text, params)).rows;
  }
  sql.transaction = async (queries, options = {}) => {
    const isolation = {Serializable: " SERIALIZABLE", RepeatableRead: " REPEATABLE READ"}[options.isolationLevel];
    await client.query("BEGIN" + (isolation ? " ISOLATION LEVEL" + isolation : "") + (options.readOnly ? " READ ONLY" : ""));
    try {
      const rows = [];
      for (const query of queries) rows.push(await execute(query));
      if (!options.readOnly) await beforeCommit?.();
      await client.query("COMMIT");
      return rows;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  };
  return createPostgresSyncRepository(sql);
}
const held = Promise.withResolvers();
const resume = Promise.withResolvers();
let schemaCreated = false;
const writes = [];
try {
  await Promise.all(clients.map(client => client.connect()));
  await writer.query("CREATE SCHEMA " + schema);
  schemaCreated = true;
  await Promise.all(clients.map(client => client.query("SET search_path TO " + schema)));
  const source = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
  for (const table of ["entitlements", "content_trash", "user_content_records", "saved_items", "annotations", "projects", "project_items", "sync_events"]) {
    const ddl = source.match(new RegExp("CREATE TABLE IF NOT EXISTS permitext_" + table + " \\([\\s\\S]*?\\n      \\)"));
    assert.ok(ddl, table);
    await writer.query(ddl[0]);
  }
  await writer.query("CREATE UNIQUE INDEX sync_event_identity ON permitext_sync_events(record_id,mutation_updated_at)");
  const userID = "order-test";
  await writer.query("INSERT INTO permitext_entitlements(user_id,plan,source,entitlement) VALUES($1,'pro','lifetimeGrant',$2)", [userID, {plan:"pro"}]);
  const base = {userID, codeVersion:"nyc-2022", updatedAt:new Date(Date.now()-1000).toISOString()};
  const link = {...base, id:"passage", folderClientID:"project", sectionID:601};
  const baseline = await repository(writer).push(userID, [
    {project:{...base,id:"project",clientID:"project",name:"QA"}}, {projectSection:link}
  ]);
  const now = new Date().toISOString();
  const deletion = repository(writer, async () => { held.resolve(); await resume.promise; }).push(userID, [
    {projectSection:{...link,updatedAt:now,deletedAt:now,evidenceActionAt:now,evidenceRemovalID:randomUUID()}}
  ]);
  writes.push(deletion);
  await Promise.race([held.promise, deletion.then(() => { throw Error("Deletion did not reach commit."); })]);
  const position = repository(readerPosition).push(userID, [{continuity:{...base,updatedAt:now,values:{}}}]);
  writes.push(position);
  const remote = repository(observer);
  // On the old implementation the second write commits here. On the fixed
  // implementation it waits for the deletion. Pull at that exact boundary.
  const deadline = Date.now() + 5000;
  for (;;) {
    const [{waiting}] = (await observer.query("SELECT wait_event = 'advisory' AS waiting FROM pg_stat_activity WHERE pid=$1", [readerPosition.processID])).rows;
    if (waiting || await Promise.race([position.then(() => true), delay(10, false)])) break;
    assert.ok(Date.now() < deadline, "Concurrent write did not reach the commit boundary.");
  }
  const mid = await remote.pull(userID, {sinceEventID:baseline.latestEventID});
  resume.resolve();
  for (const result of await Promise.all([deletion,position])) assert.deepEqual(result.rejectedMutationIDs, []);
  const delta = await remote.pull(userID, {sinceEventID:mid.latestEventID});
  assert.ok(delta.mutations.some(row => row.projectSection?.deletedAt), "An accepted deletion must survive the intervening pull.");
  console.log("Concurrent reading-position update and Evidence deletion stayed visible across the cursor boundary.");
} finally {
  resume.resolve();
  await Promise.allSettled(writes);
  if (schemaCreated) await writer.query("DROP SCHEMA " + schema + " CASCADE");
  await Promise.all(clients.map(client => client.end()));
}
