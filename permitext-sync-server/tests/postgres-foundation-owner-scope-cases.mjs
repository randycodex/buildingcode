import assert from "node:assert/strict";

// Invoked only after the parent harness verifies its newly created disposable
// loopback database. Every assertion below runs the shipped adapter SQL.
export async function runPostgresFoundationOwnerScopeCases({ sql, adapter, setStatementHook }) {
  assert.equal(process.env.PERMITEXT_RUN_LOCAL_POSTGRES_READINESS, "1");
  const owners = ["web:pg-foundation-scope-a", "web:pg-foundation-scope-b"];
  const expected = new Map();
  const deletedAt = "2026-09-28T12:00:00.000Z";
  for (const owner of owners) {
    const profile = { displayName: `Name ${owner}`, publicUsername: `user-${owner.at(-1)}`, privateField: "not-a-profile-field" };
    await sql`INSERT INTO permitext_users (id, auth_provider, auth_provider_user_id, account)
      VALUES (${owner}, 'web', ${owner}, ${JSON.stringify(profile)}::jsonb)`;
    const records = [
      { savedItem: { id: `${owner}:01`, userID: owner, deletedAt } },
      { annotation: { id: `${owner}:02`, userID: owner, tags: ["retained"] } },
      { project: { id: `${owner}:03`, userID: owner, folderType: "reference" } },
      { projectSection: { id: `${owner}:04`, userID: owner, sectionID: 123 } },
      { continuity: { id: `${owner}:05`, userID: owner } },
      { codeVersionClear: { id: `${owner}:06`, userID: owner } },
      { workboard: { id: `${owner}:07`, userID: owner } }
    ];
    expected.set(owner, records);
    // Deliberately insert in reverse ID order, across every normalized source.
    for (const [index, kind] of [[6, "workboard"], [5, "codeVersionClear"], [4, "continuity"]]) {
      await sql`INSERT INTO permitext_user_content_records (record_id, user_id, entity_kind, mutation)
        VALUES (${`${owner}:0${index + 1}`}, ${owner}, ${kind}, ${JSON.stringify(records[index])}::jsonb)`;
    }
    await sql`INSERT INTO permitext_project_items (record_id, user_id, code_version, section_id, mutation)
      VALUES (${`${owner}:04`}, ${owner}, 'synthetic', 123, ${JSON.stringify(records[3])}::jsonb)`;
    await sql`INSERT INTO permitext_projects (record_id, user_id, code_version, mutation)
      VALUES (${`${owner}:03`}, ${owner}, 'synthetic', ${JSON.stringify(records[2])}::jsonb)`;
    await sql`INSERT INTO permitext_annotations (record_id, user_id, code_version, section_id, mutation)
      VALUES (${`${owner}:02`}, ${owner}, 'synthetic', 123, ${JSON.stringify(records[1])}::jsonb)`;
    await sql`INSERT INTO permitext_saved_items (record_id, user_id, code_version, section_id, mutation, deleted_at)
      VALUES (${`${owner}:01`}, ${owner}, 'synthetic', 123, ${JSON.stringify(records[0])}::jsonb, ${deletedAt}::timestamptz)`;
    for (const [suffix, kind] of [["08", "savedItem"], ["09", "futureUnknownKind"]]) {
      await sql`INSERT INTO permitext_user_content_records (record_id, user_id, entity_kind, mutation)
        VALUES (${`${owner}:${suffix}`}, ${owner}, ${kind}, ${JSON.stringify({ excluded: { id: `${owner}:${suffix}` } })}::jsonb)`;
    }
  }
  const statements = [];
  setStatementHook(query => { statements.push(query); });
  try {
    for (const owner of owners) {
      const records = await adapter.listUserContentMutations(owner);
      assert.deepEqual(JSON.parse(JSON.stringify(records)), expected.get(owner),
        "Owner scope preserves all legacy kinds/deleted rows and ID order without other-owner or duplicate generic data");
    }
    assert.deepEqual(Array.from(await adapter.listUserContentMutations("web:pg-foundation-scope-missing")), []);
    const profiles = await adapter.accountProfilesForUserIDs([owners[0], owners[0], "missing-profile"]);
    assert.deepEqual(JSON.parse(JSON.stringify(profiles)), {
      [owners[0]]: { displayName: `Name ${owners[0]}`, publicUsername: "user-a" }
    });
    const beforeEmpty = statements.length;
    assert.deepEqual(JSON.parse(JSON.stringify(await adapter.accountProfilesForUserIDs([]))), {});
    assert.equal(statements.length, beforeEmpty, "Empty permitted profile set sends no SQL");
    assert.equal(statements.length, 4);
    for (const query of statements.slice(0, 3)) {
      assert.equal((query.query.match(/WHERE user_id = \$/g) || []).length, 5);
      assert.ok(query.params.every(value => value === query.params[0]));
    }
    assert.match(statements[3].query, /WHERE id = ANY\(/);
    assert.doesNotMatch(statements[3].query, /SELECT id, account FROM/);
  } finally {
    setStatementHook(null);
  }
  console.log("Live local PostgreSQL foundation scope passed: two owners, all normalized tables, generic-kind compatibility, deleted rows, stable order and minimal permitted profiles.");
}
