import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createPostgresSyncRepository } from "../postgres-sync-repository.mjs";

const { PGlite } = await import(process.env.PERMITEXT_TEST_PGLITE_PATH || "@electric-sql/pglite");
const db = new PGlite();

function sql(parts, ...values) {
  let statement = parts[0];
  const parameters = [];
  values.forEach((value, index) => {
    if (value?.statement) {
      statement += value.statement.replace(/\$(\d+)/g, (_, position) => `$${parameters.length + Number(position)}`);
      parameters.push(...value.parameters);
    } else {
      parameters.push(value);
      statement += `$${parameters.length}`;
    }
    statement += parts[index + 1];
  });
  return {
    statement, parameters,
    then(resolve, reject) {
      return db.query(statement, parameters).then(result => result.rows).then(resolve, reject);
    }
  };
}

sql.transaction = queries => db.transaction(async transaction => {
  const results = [];
  for (const { statement, parameters } of queries) {
    results.push((await transaction.query(statement, parameters)).rows);
  }
  return results;
});

try {
  const source = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
  for (const table of ["entitlements", "user_content_records", "projects", "sync_events"]) {
    const ddl = source.match(new RegExp(`CREATE TABLE IF NOT EXISTS permitext_${table} \\([\\s\\S]*?\\n      \\)`))?.[0];
    assert(ddl, table);
    await db.exec(ddl);
  }
  await db.exec("CREATE UNIQUE INDEX sync_event_identity ON permitext_sync_events(record_id, mutation_updated_at)");
  const repository = createPostgresSyncRepository(sql);
  const userID = "workflow-owner";
  const id = "workflow-project";
  await db.query(
    "INSERT INTO permitext_entitlements(user_id, plan, source, entitlement) VALUES ($1, 'pro', 'lifetimeGrant', '{\"plan\":\"pro\"}')",
    [userID]
  );
  const base = { id, userID, clientID: id, name: "Workflow Project", codeVersion: "nyc-2022" };
  const openQuestions = [{ id: "q1", question: "Which records?", answer: "Approved plans." }];
  const recordsChecklist = [{ id: "plans", label: "Approved plans", status: "requested", note: "Request pending" }];
  const structuredFacts = [{ key: "borough", value: "Brooklyn" }];
  const mutation = (second, fields = {}) => ({
    project: { ...base, updatedAt: `2026-10-10T15:00:0${second}.000Z`, ...fields }
  });
  const push = project => repository.push(userID, [project]);

  assert.deepEqual((await push(mutation(0, { structuredFacts }))).acceptedMutationIDs, [id]);
  const questions = await push(mutation(1, { openQuestions }));
  assert.deepEqual(questions.acceptedMutationIDs, [id]);
  const checklistMutation = mutation(2, { recordsChecklist });
  const checklist = await push(checklistMutation);
  assert.deepEqual(checklist.acceptedMutationIDs, [id]);
  const delta = await repository.pull(userID, { sinceEventID: questions.latestEventID });
  assert.equal(delta.mutations.length, 1);
  assert.deepEqual(delta.mutations[0].project.openQuestions, openQuestions);
  assert.deepEqual(delta.mutations[0].project.recordsChecklist, recordsChecklist);
  assert.deepEqual(delta.mutations[0].project.structuredFacts, structuredFacts);
  for (const table of ["user_content_records", "projects", "sync_events"]) {
    const result = await db.query(
      `SELECT mutation FROM permitext_${table} WHERE record_id = $1${table === "sync_events" ? " ORDER BY event_id DESC LIMIT 1" : ""}`,
      [id]
    );
    assert.deepEqual(result.rows[0].mutation.project.openQuestions, openQuestions, table);
    assert.deepEqual(result.rows[0].mutation.project.recordsChecklist, recordsChecklist, table);
  }
  const retry = await push(checklistMutation);
  assert.deepEqual(retry.acceptedMutationIDs, [id]);
  assert.equal(retry.latestEventID, checklist.latestEventID);
  const conflict = await push(mutation(2, { recordsChecklist: [] }));
  assert.deepEqual(conflict.rejectedMutationIDs, [id]);
  assert.equal(conflict.rejectionReasons[id].code, "EQUAL_TIMESTAMP_CONFLICT");

  assert.deepEqual((await push(mutation(3, { openQuestions: [] }))).acceptedMutationIDs, [id]);
  const final = (await repository.pull(userID, {})).mutations.find(record => record.project?.id === id).project;
  assert.deepEqual(final.openQuestions, []);
  assert.deepEqual(final.recordsChecklist, recordsChecklist);
  assert.deepEqual(final.structuredFacts, structuredFacts);
  console.log("Project Questions PostgreSQL sync passed: partial writes, full and delta reads, retries, and explicit clearing.");
} finally {
  await db.close();
}
