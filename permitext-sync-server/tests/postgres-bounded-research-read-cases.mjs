import assert from "node:assert/strict";

// Runs only inside the empty, disposable loopback PostgreSQL acceptance harness.
export async function runPostgresBoundedResearchReadCases({ sql, adapter }) {
  const owner = "web:bounded-research-owner";
  const now = "2026-10-05T12:00:00.000Z";
  const size = 8 * 1024 * 1024;
  for (let index = 0; index < 10; index += 1) {
    const id = `bounded-answer-${index}`;
    const conversationID = `bounded-conversation-${index}`;
    const projectID = index < 8 ? "large-project" : "other-project";
    const answer = { id, conversationID, projectID, question: `Question ${index}`, reviewStatus: "unreviewed", createdAt: now,
      answer: { conclusion: "Supported conclusion", answerText: "Complete answer", explanation: "Full explanation" },
      citations: [{ sectionID: "section-b" }], evidence: [{ sectionID: " section-b " }, { sectionID: "section-a" }, { sectionID: "section-b" }] };
    await sql`INSERT INTO permitext_research_answers (id, user_id, conversation_id, project_id, answer, created_at)
      VALUES (${id}, ${owner}, ${conversationID}, ${projectID},
        jsonb_set(${JSON.stringify(answer)}::jsonb, '{evidence,0,text}', to_jsonb(repeat('x', ${size}::int))), ${now}::timestamptz)`;
    const conversation = { id: conversationID, primaryProjectID: projectID, title: `History ${index}`, createdAt: now, updatedAt: now,
      messages: [{ id: `question-${index}`, role: "user", question: `Question ${index}` },
        { id, role: "assistant", answer: answer.answer }], sources: [] };
    await sql`INSERT INTO permitext_research_conversations (id, user_id, title, conversation, created_at, updated_at)
      VALUES (${conversationID}, ${owner}, 'History',
        ${JSON.stringify(conversation)}::jsonb || jsonb_build_object('retainedContext', repeat('x', ${size}::int)),
        ${now}::timestamptz, ${now}::timestamptz)`;
  }
  const totals = await sql`SELECT SUM(octet_length(answer::text))::bigint AS bytes FROM permitext_research_answers WHERE user_id = ${owner}`;
  assert.ok(Number(totals[0].bytes) > 67108864, "Fixture must exceed Neon's response limit");
  const summaries = await adapter.listResearchAnswers(owner, { projectID: "large-project", summaryOnly: true });
  assert.equal(summaries.length, 8);
  assert.ok(Buffer.byteLength(JSON.stringify(summaries)) < 10000);
  assert.deepEqual(Array.from(summaries[0].sectionIDs), ["section-b", "section-a"]);
  assert.equal(summaries[0].evidenceCount, 3);
  assert.equal(summaries[0].evidence, undefined);
  assert.equal(summaries[0].answer.explanation, undefined);
  assert.equal((await adapter.listResearchAnswers(owner, { projectID: "large-project", linkedAnswerIDs: ["bounded-answer-9"], summaryOnly: true })).length, 9);
  assert.equal((await adapter.listResearchAnswers("another-owner", { linkedAnswerIDs: ["bounded-answer-9"], summaryOnly: true })).length, 0);
  const ids = await adapter.listResearchAnswers(owner, { idsOnly: true });
  assert.equal(ids.length, 10);
  assert.deepEqual(Object.keys(ids[0]), ["id"]);
  const full = await adapter.listResearchAnswers(owner, { projectID: "large-project", ids: ["bounded-answer-0"] });
  assert.equal(full.length, 1);
  assert.equal(full[0].evidence[0].text.length, size);
  assert.equal(full[0].answer.explanation, "Full explanation");
  assert.deepEqual(full[0].citations, [{ sectionID: "section-b" }]);
  assert.equal((await adapter.listResearchAnswers(owner, { ids: [] })).length, 0);
  assert.equal((await adapter.listResearchConversations(owner, { migrationPendingOnly: true })).length, 0,
    "Modern, persisted answers must never transfer the large full history during migration");
  for (const suffix of ["a", "b"]) {
    const id = `legacy-bounded-${suffix}`;
    const conversation = { id, primaryProjectID: "large-project", codeVersion: "legacy-code", evidenceSetVersion: 3, createdAt: now, updatedAt: now,
      sources: [{ id: "source", kind: "selection", selectedText: "Enacted passage", visual: { provenance: "retained" } }],
      messages: [{ id: "q1", role: "user", question: "Earlier question" },
        { id: "bounded-answer-0", role: "assistant", answer: { conclusion: "Already saved" } },
        { id: "q2", role: "user", question: "Correct nearest question" },
        { id: `${id}-answer`, role: "assistant", answer: { conclusion: "Legacy conclusion", evidenceSourceIDs: ["source"] }, createdAt: now }] };
    await sql`INSERT INTO permitext_research_conversations (id, user_id, title, conversation, created_at, updated_at)
      VALUES (${id}, ${owner}, 'Legacy', ${JSON.stringify(conversation)}::jsonb || jsonb_build_object('retainedContext', repeat('x', ${size}::int)), ${now}::timestamptz, ${now}::timestamptz)`;
  }
  const first = await adapter.listResearchConversations(owner, { migrationPendingOnly: true });
  assert.equal(first.length, 1);
  assert.equal(first[0].id, "legacy-bounded-a");
  assert.ok(Buffer.byteLength(JSON.stringify(first)) < 2000);
  assert.deepEqual(Array.from(first[0].messages, message => message.id), ["q1", "q2", "legacy-bounded-a-answer"]);
  assert.equal(first[0].messages[1].question, "Correct nearest question");
  assert.deepEqual(first[0].sources[0].visual, { provenance: "retained" });
  assert.equal((await adapter.listResearchConversations(owner, { migrationPendingOnly: true, afterID: first[0].id }))[0].id, "legacy-bounded-b");
  assert.equal((await adapter.listResearchConversations(owner, { migrationPendingOnly: true, afterID: "legacy-bounded-b" })).length, 0);
  assert.equal((await adapter.listResearchConversations("another-owner", { migrationPendingOnly: true })).length, 0);
  console.log("Live PostgreSQL bounded Research reads passed: >64 MiB history, compact project summaries, linked/foreign owners, complete selected Report answers, and pending-only legacy batches.");
}
