import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import { researchHistoryOptions, researchHistoryCursor, researchHistoryPageQuery } from "../research-history-pagination.mjs";

const temp = await mkdtemp(join(tmpdir(), "permitext-history-page-"));
Object.assign(process.env, { NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "", PERMITEXT_TEST_RESEARCH_MOCK: "1",
  PERMITEXT_SYNC_DATA_PATH: join(temp, "sync.json"), PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(temp, "assets"),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: "history-page-test-only" });
for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL", "BLOB_READ_WRITE_TOKEN", "VERCEL_OIDC_TOKEN", "BLOB_STORE_ID"]) delete process.env[key];
const { handleRequest, createFileStoreAdapter } = await import("../app.mjs");
const server = createServer(handleRequest);
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const fetchOriginal = globalThis.fetch;
globalThis.fetch = (input, options) => {
  assert.equal(new URL(typeof input === "string" ? input : input.url).origin, base, "No external/provider calls in history regression");
  return fetchOriginal(input, options);
};
async function post(path, body, token, status = 200) {
  const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const value = await response.json();
  assert.equal(response.status, status, `${path}: ${JSON.stringify(value)}`);
  return value;
}
const owners = ["apple:history-owner-a", "apple:history-owner-b"];
const tokens = [];
const sameDate = "2026-10-08T12:00:00.000Z";
const make = (id, overrides = {}) => ({ id, title: `Conversation ${id}`, createdAt: sameDate, updatedAt: sameDate,
  messages: [], sources: [], ...overrides });
const fixtures = [
  make("a", { primaryProjectID: "project-a", starterQuestion: "Original RAMP slope?", sources: [{ kind: "selection", sectionID: "passage-a", selectedText: "Source text must not be history search." }] }),
  make("b", { primaryProjectID: "project-a", title: "Door WIDTH", messages: [{ role: "user", question: "Original doorway question" }, { role: "user", question: "Later confidential question" }, { role: "assistant", answer: { answerText: "Private answer sentinel" } }] }),
  make("c", { primaryProjectID: null, messages: [{ role: "assistant", answer: { answerText: "Private answer sentinel" } }, { role: "user", question: "Legacy ramp original question" }] }),
  make("d", { createdAt: "2026-10-07T12:00:00.000Z", primaryProjectID: "project-b", starterQuestion: "Literal 20%_table query" }),
  make("e", { createdAt: "2026-10-06T12:00:00.000Z", primaryProjectID: "", starterQuestion: "A stair question" }),
  make("hidden", { createdAt: "2026-10-09T12:00:00.000Z", historyHiddenAt: sameDate, starterQuestion: "Original RAMP slope?" })
];
try {
  for (const userID of owners) {
    await post("/admin/lifetime-grants/grant", { userID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
    const signed = await post("/account/sign-in", { credential: { provider: "apple", providerUserID: userID.slice(6), email: `${userID.slice(6)}@example.test`, displayName: "Synthetic history" } });
    tokens.push(signed.account.backendSessionToken);
  }
  const adapter = createFileStoreAdapter();
  await adapter.withMutation(store => {
    store.researchConversationsByUserID = { [owners[0]]: fixtures, [owners[1]]: [make("foreign", { starterQuestion: "Original RAMP slope?", primaryProjectID: "project-a" })] };
  });
  const list = (body = {}, owner = 0, status = 200) => post("/research/conversations/list", { auth: { accountUserID: owners[owner] }, ...body }, tokens[owner], status);
  const ids = response => response.conversations.map(row => row.id);
  const legacy = await list();
  assert.deepEqual(Object.keys(legacy), ["conversations"], "Unmodified callers keep the original response shape");
  assert.deepEqual(ids(legacy), ["a", "b", "c", "d", "e"]);
  const hidden = await list({limit:2, includeHidden:true});
  assert.deepEqual(ids(hidden), ['hidden','a'], 'Settings can page through hidden conversations too');
  assert.equal((await list({limit:2, cursor:hidden.nextCursor},0,400)).code, 'INVALID_RESEARCH_HISTORY_CURSOR');
  const first = await list({ limit: 2 });
  assert.deepEqual(ids(first), ["a", "b"]);
  assert.equal(first.hasMore, true); assert.equal(typeof first.nextCursor, "string");
  assert.equal(first.conversations[0].sourceCount, 1);
  assert.deepEqual(first.conversations[0].sourceSectionIDs, ["passage-a"]);
  assert(!("messages" in first.conversations[0]) && !("sources" in first.conversations[0]), "Page retains summaries, not full evidence/answers");
  const second = await list({ limit: 2, cursor: first.nextCursor });
  assert.deepEqual(ids(second), ["c", "d"]);
  const third = await list({ limit: 2, cursor: second.nextCursor });
  assert.deepEqual(ids(third), ["e"]); assert.equal(third.hasMore, false); assert.equal(third.nextCursor, null);
  assert.equal(new Set([...ids(first), ...ids(second), ...ids(third)]).size, 5, "Equal dates must not duplicate or skip rows");
  assert.deepEqual(ids(await list({ q: "  rAmP  " })), ["a", "c"], "Search title/original question including legacy first-user fallback");
  assert.deepEqual(ids(await list({ q: "width" })), ["b"]);
  for (const q of ["Later confidential", "Private answer sentinel", "Source text must not", "absent"]) {
    const result = await list({ q }); assert.deepEqual(ids(result), []); assert.equal(result.hasMore, false); assert.equal(result.nextCursor, null);
  }
  assert.deepEqual(ids(await list({ q: "%_" })), ["d"], "Search metacharacters are literal, not SQL wildcard patterns");
  assert.deepEqual(ids(await list({ projectID: "project-a" })), ["a", "b"]);
  assert.deepEqual(ids(await list({ projectID: "" })), ["c", "e"], "Explicit empty Project means unassigned");
  assert.deepEqual(ids(await list({ projectID: "project-a", q: "ramp" })), ["a"]);
  assert.deepEqual(ids(await list({ projectID: "foreign-project" })), []);
  assert.deepEqual(ids(await list({ limit: 2 }, 1)), ["foreign"], "History is isolated to authenticated account");
  for (const body of [{ cursor: "garbage" }, { cursor: first.nextCursor, q: "ramp" }, { cursor: first.nextCursor, projectID: "" }]) {
    assert.equal((await list(body, 0, 400)).code, "INVALID_RESEARCH_HISTORY_CURSOR");
  }
  assert.equal((await list({ cursor: first.nextCursor }, 1, 400)).code, "INVALID_RESEARCH_HISTORY_CURSOR");
  for (const body of [{ limit: 0 }, { limit: 101 }, { limit: 1.5 }, { limit: "2" }, { q: 5 }, { q: "x".repeat(201) }, { projectID: null }]) {
    assert.equal((await list(body, 0, 400)).code, "INVALID_RESEARCH_HISTORY_QUERY");
  }
  const rampFirst = await list({ limit: 1, q: "RAMP" });
  assert.deepEqual(ids(await list({ limit: 1, q: " ramp ", cursor: rampFirst.nextCursor })), ["c"], "Normalized equivalent filters accept the same cursor");
  await adapter.withMutation(store => {
    const rows = store.researchConversationsByUserID[owners[0]];
    rows.unshift(make("new", { createdAt: "2026-10-09T12:00:00.000Z" }));
    rows.splice(rows.findIndex(row => row.id === "b"), 1);
    rows.find(row => row.id === "a").updatedAt = "2026-10-10T12:00:00.000Z";
  });
  assert.deepEqual(ids(await list({ limit: 2, cursor: first.nextCursor })), ["c", "d"], "New insert, removed boundary and later messages do not shift the next page");

  // Execute the real PostgreSQL adapter methods with a query recorder. This
  // proves bounded/owned query construction, not a live database query plan.
  const source = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
  function method(name) {
    const start = source.indexOf(`    async ${name}(`, source.indexOf("async function createPostgresStoreAdapter()"));
    assert(start >= 0); return source.slice(start, source.indexOf("\n    },", start) + 6);
  }
  const recorded = [];
  const sql = async (strings, ...values) => { recorded.push({ text: strings.join("?"), values }); return []; };
  sql.query = async (text, values) => { recorded.push({ text, values }); return [{ conversation: { id: "a" }, sort_date: sameDate }]; };
  const context = vm.createContext({ ensureSchema: async () => {}, researchHistoryPageQuery, safeJSON: value => value, sql });
  const pg = vm.runInContext(`({${method("listResearchConversationPage")},${method("listProjectLinks")}})`, context);
  const options = researchHistoryOptions({ limit: 2, q: "20%_' OR TRUE --", projectID: "project-a", cursor: null }, owners[0]);
  const row = (await pg.listResearchConversationPage(owners[0], options))[0];
  const cursor = researchHistoryCursor(options, row);
  await pg.listResearchConversationPage(owners[0], researchHistoryOptions({ limit: 2, q: options.q, projectID: options.projectID, cursor }, owners[0]));
  for (const query of recorded) {
    assert.equal(query.values[0], owners[0]); assert.equal(query.values.at(-1), 3);
    assert.match(query.text, /WHERE user_id = \$1 AND COALESCE\(conversation->>'historyHiddenAt'/);
    assert.match(query.text, /WITH page AS MATERIALIZED/);
    assert.match(query.text, /ORDER BY created_at DESC, id COLLATE "C" ASC LIMIT \$/);
    assert.match(query.text, /jsonb_build_object/); assert.doesNotMatch(query.text, /OFFSET|SELECT \*/);
    assert(!query.text.includes(options.q), "Search text must be bound as a value, never SQL syntax");
    assert(query.values.includes(options.q) && query.values.includes("project-a"));
  }
  assert.match(recorded[1].text, /created_at < \$\d+::timestamptz OR \(created_at = \$\d+::timestamptz AND id COLLATE "C" > \$\d+\)/);
  const before = recorded.length;
  await pg.listProjectLinks(owners[0], { targetKind: "researchConversation", targetIDs: [] });
  assert.equal(recorded.length, before, "Empty page must not load all links");
  await pg.listProjectLinks(owners[0], { targetKind: "researchConversation", targetIDs: ["a", "b"] });
  assert.match(recorded.at(-1).text, /WHERE user_id = \? AND target_id = ANY\(\?\)/);
  assert.deepEqual(recorded.at(-1).values.slice(0, 2), [owners[0], ["a", "b"]]);
  assert.match(source, /permitext_research_conversations_visible_history_idx[\s\S]*?user_id, created_at DESC, id COLLATE "C" ASC/);
  assert.match(source, /permitext_research_conversations_visible_project_history_idx/);
  const malformedDate = Buffer.from(JSON.stringify({ v: 1, s: options.scope, id: "a", d: "2026-02-30T12:00:00.000Z" })).toString("base64url");
  assert.throws(() => researchHistoryOptions({ limit: 2, q: options.q, projectID: options.projectID, cursor: malformedDate }, owners[0]), { code: "INVALID_RESEARCH_HISTORY_CURSOR" });
  console.log("Research history pagination passed: real HTTP legacy/page/filter/owner/cursor behavior, tied dates, concurrent insert/deletion, original-question-only search, compact summaries and bounded parameterized PostgreSQL/page-link queries. Zero external calls; no live DB claim.");
} finally {
  globalThis.fetch = fetchOriginal;
  await new Promise(resolve => server.close(resolve));
  await rm(temp, { recursive: true, force: true });
}
