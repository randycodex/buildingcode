// Opt-in acceptance against a disposable local PostgreSQL cluster. This uses
// the shipped HTTP handlers and Neon query/batch encoder, replacing only Neon's
// remote fetch transport with one node-postgres connection per request/batch.
// No runtime module is modified. The driver must be installed outside this repo.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";
import { neon, neonConfig } from "@neondatabase/serverless";
import { commitPostgresNotebookCardMutation } from "../notebook-persistence.mjs";
import { researchConversationRevision, researchContextRevision, researchConversationConflict, resetResearchActiveContext, activeResearchMessages } from "../research-context-state.mjs";

assert.equal(process.env.PERMITEXT_RUN_LOCAL_POSTGRES_READINESS, "1");
const connectionString = process.env.PERMITEXT_LOCAL_POSTGRES_URL;
const database = new URL(connectionString);
assert.equal(database.protocol, "postgresql:");
assert.equal(database.hostname, "127.0.0.1");
assert.equal(database.username, "permitext_readiness");
assert.equal(database.pathname, "/permitext_readiness_temp");
assert.equal(database.search, "", "Connection options may not override the loopback-only target.");
assert.equal(database.hash, "");
assert.ok(Number(database.port) > 1024 && database.port !== "5432");
const driverPath = process.env.PERMITEXT_LOCAL_PG_DRIVER;
assert.match(driverPath, /^\/private\/tmp\/permitext-pg-acceptance\.[^/]+\/transport\/node_modules\/pg\/lib\/index\.js$/);
const { default: pg } = await import(pathToFileURL(driverPath));
const externalFetch = globalThis.fetch;
let requests = 0, serializableBatches = 0, activeConnections = 0, maximumConnections = 0;
neonConfig.fetchEndpoint = "http://127.0.0.1/permitext-readiness-neon";
neonConfig.fetchFunction = async (url, options) => {
  assert.equal(url, neonConfig.fetchEndpoint);
  assert.equal(options.headers["Neon-Connection-String"], connectionString);
  const body = JSON.parse(options.body);
  const queries = body.queries || [body];
  const client = new pg.Client({ connectionString, application_name: "permitext-readiness-local",
    types: { getTypeParser: () => (value) => value } });
  requests += 1; activeConnections += 1; maximumConnections = Math.max(maximumConnections, activeConnections);
  try {
    await client.connect();
    if (body.queries) {
      const isolation = options.headers["Neon-Batch-Isolation-Level"] || "ReadCommitted";
      const levels = { Serializable: "SERIALIZABLE", RepeatableRead: "REPEATABLE READ", ReadCommitted: "READ COMMITTED" };
      assert.ok(levels[isolation], `Unsupported isolation ${isolation}`);
      if (isolation === "Serializable") serializableBatches += 1;
      await client.query(`BEGIN ISOLATION LEVEL ${levels[isolation]}`);
    }
    const results = [];
    for (const query of queries) {
      const result = await client.query({ text: query.query, values: query.params, rowMode: "array" });
      results.push({ fields: result.fields.map((field) => ({ name: field.name, dataTypeID: field.dataTypeID })),
        rows: result.rows, command: result.command, rowCount: result.rowCount });
    }
    if (body.queries) await client.query("COMMIT");
    return new Response(JSON.stringify(body.queries ? { results } : results[0]), { status: 200 });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return new Response(JSON.stringify({ message: error.message, code: error.code, detail: error.detail, constraint: error.constraint }), { status: 400 });
  } finally { await client.end(); activeConnections -= 1; }
};
for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL", "BLOB_READ_WRITE_TOKEN", "VERCEL_OIDC_TOKEN", "BLOB_STORE_ID"]) delete process.env[key];
process.env.PERMITEXT_SYNC_DATABASE_URL = connectionString;
const sql = neon(connectionString);
const serverSource = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
const postgresSource = serverSource.slice(serverSource.indexOf("async function createPostgresStoreAdapter()"));
function actualMethod(name) {
  const start = postgresSource.indexOf(`    async ${name}(`);
  const end = postgresSource.indexOf("\n    async ", start + 1);
  assert.ok(start >= 0 && end > start, `Missing actual PostgreSQL method ${name}`);
  return postgresSource.slice(start, end).trim().replace(/,$/, "");
}
const actualJSONHelpers = serverSource.slice(serverSource.indexOf("function safeJSON("), serverSource.indexOf("const researchUsageLocks ="));
const { safeJSON, canonicalJSONString } = runInNewContext(`${actualJSONHelpers}; ({ safeJSON, canonicalJSONString })`);
const adapter = runInNewContext(`({${["listResearchConversations", "saveResearchConversation", "listResearchAnswers", "replaceResearchCodeDecisionLinks", "commitResearchConversationMessage"].map(actualMethod).join(",\n")}})`, {
  sql, ensureSchema: async () => {}, safeJSON, canonicalJSONString,
  researchConversationRevision, researchContextRevision, researchConversationConflict,
  researchCodeDecisionLinkConflict: () => Object.assign(new Error("Link changed"), { code: "RESEARCH_CONVERSATION_CHANGED" }),
  researchConversationDeletedError: () => Object.assign(new Error("Deleted"), { code: "RESEARCH_CONVERSATION_DELETED" })
});
adapter.read = async () => {
  const state = { foundationArtifactsByUserID: {}, projectLinksByUserID: {}, activityEventsByUserID: {} };
  for (const row of await sql`SELECT user_id, envelope, payload FROM permitext_foundation_artifacts`) (state.foundationArtifactsByUserID[row.user_id] ||= []).push({ envelope: row.envelope, payload: row.payload });
  for (const row of await sql`SELECT user_id, link FROM permitext_project_links`) (state.projectLinksByUserID[row.user_id] ||= []).push(row.link);
  for (const row of await sql`SELECT user_id, event FROM permitext_project_activity`) (state.activityEventsByUserID[row.user_id] ||= []).push(row.event);
  return state;
};
globalThis.__permitextLocalPostgresAdapter = adapter;
try {
  const initial = await sql`SELECT version(), inet_server_addr()::text AS address, inet_server_port() AS port`;
  assert.equal(initial[0].address, "127.0.0.1/32");
  assert.equal(initial[0].port, Number(database.port));
  assert.equal((await sql`SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = 'public'`)[0].count, 0,
    "This opt-in test requires a newly created, empty disposable database.");
  // The existing HTTP contract supplies synthetic accounts, Projects, Research,
  // Notebook races, Project-note singleton races, exact replay and conflict cases.
  // Only its file-adapter inspection/seeding and relative imports are adapted.
  let cases = await readFile(new URL("./research-notebook-concurrency-http.mjs", import.meta.url), "utf8");
  assert.ok(cases.includes('const adapter = createFileStoreAdapter();'));
  cases = cases.replace('"PERMITEXT_SYNC_DATABASE_URL", ', "")
    .replace('const adapter = createFileStoreAdapter();', 'const adapter = globalThis.__permitextLocalPostgresAdapter;')
    .replaceAll('"../app.mjs"', JSON.stringify(new URL("../app.mjs", import.meta.url).href))
    .replaceAll('"../research-context-state.mjs"', JSON.stringify(new URL("../research-context-state.mjs", import.meta.url).href));
  await import(`data:text/javascript;base64,${Buffer.from(cases).toString("base64")}`);

  // Additional real SQL acceptance for pre-move completions and atomic rollback.
  const owner = "apple:synthetic-cas-owner";
  const now = new Date().toISOString();
  const original = await adapter.saveResearchConversation(owner, { id: "pg-race-context", title: "Original", primaryProjectID: "project-a",
    contextRevision: 0, messages: [{ id: "old-message", role: "user", content: "Old Project" }], createdAt: now, updatedAt: now });
  const oldLink = { id: "pg-race-link-a", projectID: "project-a", targetKind: "researchConversation", targetID: original.id,
    relationship: "owner", version: 1, createdAt: now, updatedAt: now, deletedAt: null, metadata: {} };
  await adapter.replaceResearchCodeDecisionLinks(owner, { link: oldLink });
  const targetLink = { ...oldLink, id: "pg-race-link-b", projectID: "project-b" };
  const moved = await adapter.replaceResearchCodeDecisionLinks(owner, { conversation: resetResearchActiveContext({ ...original, primaryProjectID: "project-b" }, now),
    expectedConversationRevision: original.revision, link: targetLink, clearedLinks: [{ ...oldLink, version: 2, deletedAt: now }], expectedClearedLinks: [oldLink] });
  assert.deepEqual(activeResearchMessages(moved.conversation), []);
  const lateAnswer = { id: "pg-late-answer", conversationID: original.id, projectID: "project-a", evidence: [], createdAt: now };
  const usageEntry = { model: "synthetic", mode: "mock", inputTokens: 1, outputTokens: 1, totalTokens: 2, createdAt: now };
  await sql`INSERT INTO permitext_research_usage (id, user_id, model, mode, funding_source) VALUES ('pg-late-reservation', ${owner}, 'synthetic', 'reservation', 'purchased')`;
  await assert.rejects(adapter.commitResearchConversationMessage(owner, { conversation: original, answer: lateAnswer,
    reservationID: "pg-late-reservation", usageEntry,
    events: [{ id: "pg-late-event", projectID: "project-a", action: "test", objectKind: "researchAnswer", objectID: lateAnswer.id, createdAt: now }] }), { code: "RESEARCH_CONTEXT_CHANGED", statusCode: 409 });
  assert.equal((await sql`SELECT id FROM permitext_research_answers WHERE id = 'pg-late-answer'`).length, 0);
  assert.equal((await sql`SELECT id FROM permitext_project_activity WHERE id = 'pg-late-event'`).length, 0);
  assert.equal((await sql`SELECT mode FROM permitext_research_usage WHERE id = 'pg-late-reservation'`)[0].mode, "reservation");
  assert.equal((await sql`SELECT id FROM permitext_research_credits WHERE source_id = 'pg-late-reservation'`).length, 0);
  const before = (await adapter.listResearchConversations(owner)).find((item) => item.id === original.id);
  await assert.rejects(adapter.replaceResearchCodeDecisionLinks(owner, { conversation: { ...before, title: "Must roll back" }, expectedConversationRevision: before.revision,
    link: { ...targetLink, version: 2 }, expectedLink: { ...targetLink, version: 999 } }), { code: "RESEARCH_CONVERSATION_CHANGED" });
  assert.deepEqual((await adapter.listResearchConversations(owner)).find((item) => item.id === original.id), before);
  const concurrent = await Promise.allSettled(["Left", "Right"].map((title) => adapter.saveResearchConversation(owner, { ...before, title }, before.revision)));
  assert.equal(concurrent.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(concurrent.find((item) => item.status === "rejected").reason.code, "RESEARCH_CONVERSATION_CHANGED");

  // Reverse order: accepted answer/charge is immutable, and a stale move must
  // conflict; moving against the accepted revision then preserves that answer.
  const reverse = await adapter.saveResearchConversation(owner, { ...original, id: "pg-reverse-order", messages: [], revision: 0 });
  const reverseAnswer = { ...lateAnswer, id: "pg-reverse-answer", conversationID: reverse.id };
  await sql`INSERT INTO permitext_research_usage (id, user_id, model, mode, funding_source) VALUES ('pg-reverse-reservation', ${owner}, 'synthetic', 'reservation', 'purchased')`;
  const completed = await adapter.commitResearchConversationMessage(owner, { conversation: reverse, answer: reverseAnswer, reservationID: "pg-reverse-reservation", usageEntry });
  await assert.rejects(adapter.replaceResearchCodeDecisionLinks(owner, { conversation: resetResearchActiveContext({ ...reverse, primaryProjectID: "project-b" }, now), expectedConversationRevision: reverse.revision }), { code: "RESEARCH_CONVERSATION_CHANGED" });
  await adapter.replaceResearchCodeDecisionLinks(owner, { conversation: resetResearchActiveContext({ ...completed.conversation, primaryProjectID: "project-b" }, now), expectedConversationRevision: completed.conversation.revision });
  const replay = await adapter.commitResearchConversationMessage(owner, { conversation: reverse, answer: reverseAnswer, reservationID: "pg-reverse-reservation", usageEntry });
  assert.equal(replay.replayed, true);
  assert.equal(replay.conversation.primaryProjectID, "project-b");
  assert.equal((await sql`SELECT count(*)::int AS count FROM permitext_research_credits WHERE source_id = 'pg-reverse-reservation'`)[0].count, 1);

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const candidate = await adapter.saveResearchConversation(owner, { ...original, id: `pg-simultaneous-${iteration}`, messages: [], revision: 0 });
    const answer = { ...lateAnswer, id: `pg-simultaneous-answer-${iteration}`, conversationID: candidate.id };
    const reservationID = `pg-simultaneous-reservation-${iteration}`;
    await sql`INSERT INTO permitext_research_usage (id, user_id, model, mode, funding_source) VALUES (${reservationID}, ${owner}, 'synthetic', 'reservation', 'purchased')`;
    const contenders = await Promise.allSettled([
      adapter.replaceResearchCodeDecisionLinks(owner, { conversation: resetResearchActiveContext({ ...candidate, primaryProjectID: "project-b" }, now), expectedConversationRevision: candidate.revision }),
      adapter.commitResearchConversationMessage(owner, { conversation: candidate, answer, reservationID, usageEntry })
    ]);
    assert.equal(contenders.filter((item) => item.status === "fulfilled").length, 1);
    assert.match(contenders.find((item) => item.status === "rejected").reason.code, /^RESEARCH_(?:CONTEXT|CONVERSATION)_CHANGED$/);
    const answerWon = contenders[1].status === "fulfilled";
    assert.equal((await sql`SELECT count(*)::int AS count FROM permitext_research_answers WHERE id = ${answer.id}`)[0].count, Number(answerWon));
    assert.equal((await sql`SELECT count(*)::int AS count FROM permitext_research_credits WHERE source_id = ${reservationID}`)[0].count, Number(answerWon));
    assert.equal((await sql`SELECT mode FROM permitext_research_usage WHERE id = ${reservationID}`)[0].mode, answerWon ? "mock" : "reservation");
    const persisted = (await adapter.listResearchConversations(owner)).find((item) => item.id === candidate.id);
    assert.equal(persisted.primaryProjectID, answerWon ? "project-a" : "project-b");
    assert.equal(persisted.revision, candidate.revision + 1);
  }

  // A failed Notebook link guard rolls back the preceding card update/event.
  const notebookBefore = await sql`SELECT envelope, payload FROM permitext_foundation_artifacts WHERE user_id = ${owner} AND artifact_type = 'notebookCard' AND deleted_at IS NULL LIMIT 1`;
  const card = notebookBefore[0];
  const cardLink = (await sql`SELECT link FROM permitext_project_links WHERE user_id = ${owner} AND target_id = ${card.envelope.id} AND deleted_at IS NULL LIMIT 1`)[0].link;
  await assert.rejects(commitPostgresNotebookCardMutation(sql, owner, { artifact: { envelope: { ...card.envelope, version: card.envelope.version + 1 }, payload: { ...card.payload, title: "Must not persist" } },
    expectedVersion: card.envelope.version, expectedLinks: [{ ...cardLink, version: 999 }],
    events: [{ id: "pg-notebook-rollback-event", projectID: cardLink.projectID, action: "test", objectKind: "notebookCard", objectID: card.envelope.id, createdAt: now }] }), { code: "NOTEBOOK_VERSION_CONFLICT" });
  assert.deepEqual((await sql`SELECT envelope, payload FROM permitext_foundation_artifacts WHERE id = ${card.envelope.id}`)[0], card);
  assert.equal((await sql`SELECT id FROM permitext_project_activity WHERE id = 'pg-notebook-rollback-event'`).length, 0);
  assert.ok(serializableBatches > 5 && maximumConnections > 1);
  console.log(JSON.stringify({ result: "passed", postgresVersion: initial[0].version, requests, serializableBatches, maximumConnections,
    simultaneousMoveCompletionRaces: 4, chargedOnceAfterReplay: true, failedMutationRollback: true,
    productionHTTPHandlers: true, productionNeonQueryEncoder: true, transport: "test-only local node-postgres bridge", externalDatabaseRequests: 0, providerRequests: 0 }));
} finally {
  delete globalThis.__permitextLocalPostgresAdapter;
  globalThis.fetch = externalFetch;
  neonConfig.fetchFunction = undefined;
}
