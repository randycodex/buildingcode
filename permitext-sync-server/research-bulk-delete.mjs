import {createHash} from 'node:crypto';

export function researchDeleteScope(input = {}) {
  const kind = input.scope;
  if (!['selected', 'project', 'all'].includes(kind)) throw new Error('Choose a conversation deletion scope.');
  const projectID = kind === 'project' && typeof input.projectID === 'string' ? input.projectID.trim() : '';
  if (kind === 'project' && (!projectID || projectID.length > 300)) throw new Error('Choose the current project.');
  const ids = kind === 'selected' && Array.isArray(input.conversationIDs) ? [...new Set(input.conversationIDs)] : [];
  if (kind === 'selected' && (!ids.length || ids.length > 500 || ids.some(id => typeof id !== 'string' || !id.trim() || id.length > 512))) {
    throw new Error('Choose between 1 and 500 conversations, or choose a project or all projects.');
  }
  return {kind, projectID, ids: ids.sort()};
}

export function researchDeleteTarget(conversation) {
  return {id: conversation.id, revision: Number(conversation.revision || 0),
    updatedAt: String(conversation.updatedAt || ''), projectID: String(conversation.primaryProjectID || '')};
}

export function researchDeleteTargetsForStore(store, userID, scope) {
  const ids = new Set(scope.ids);
  return (store.researchConversationsByUserID?.[userID] || [])
    .filter(row => scope.kind === 'all' || (scope.kind === 'project' ? row.primaryProjectID === scope.projectID : ids.has(row.id)))
    .map(researchDeleteTarget).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

// A confirmation snapshot is a concurrency fence, not an authorization token.
// Every lookup and deletion independently enforces the authenticated owner.
export function researchDeleteConfirmation(userID, scope, targets) {
  return createHash('sha256').update(JSON.stringify([userID, scope, targets])).digest('hex');
}

export function researchDeleteConflict() {
  return Object.assign(new Error('Conversations changed. Review the updated count before deleting.'), {status: 409, code:'RESEARCH_DELETE_CHANGED'});
}

export function researchDeleteTargetsQuery(userID, scope) {
  const values = [userID];
  let condition = '';
  if (scope.kind === 'project') {values.push(scope.projectID); condition = " AND conversation->>'primaryProjectID' = $2";}
  if (scope.kind === 'selected') {values.push(scope.ids); condition = ' AND id = ANY($2::text[])';}
  return {values, text: `SELECT id, COALESCE((conversation->>'revision')::int, 0) AS revision,
    COALESCE(conversation->>'updatedAt', '') AS "updatedAt", COALESCE(conversation->>'primaryProjectID', '') AS "projectID"
    FROM permitext_research_conversations WHERE user_id = $1${condition} ORDER BY id COLLATE "C"`};
}

// One serializable transaction handles the entire confirmed set. Lock and check
// every target before any cascade can run; a changed target deletes nothing.
export function researchBulkDeleteQuery(userID, targets, activityStorageUserIDs) {
  return {values: [userID, JSON.stringify(targets), activityStorageUserIDs], text: `
    WITH expected AS MATERIALIZED (
      SELECT * FROM jsonb_to_recordset($2::jsonb) AS entry(id text, revision int, "updatedAt" text, "projectID" text)
    ), locked AS MATERIALIZED (
      SELECT stored.id, stored.conversation FROM permitext_research_conversations stored
      JOIN expected ON expected.id = stored.id WHERE stored.user_id = $1 FOR UPDATE OF stored
    ), permitted AS MATERIALIZED (
      SELECT (SELECT count(*) FROM locked) = (SELECT count(*) FROM expected)
        AND NOT EXISTS (SELECT 1 FROM locked JOIN expected USING(id)
          WHERE COALESCE((conversation->>'revision')::int, 0) <> expected.revision
            OR COALESCE(conversation->>'updatedAt', '') <> expected."updatedAt"
            OR COALESCE(conversation->>'primaryProjectID', '') <> expected."projectID") AS ok
    ), targets AS MATERIALIZED (SELECT * FROM locked WHERE (SELECT ok FROM permitted)),
    answers AS MATERIALIZED (
      SELECT id FROM permitext_research_answers WHERE user_id = $1 AND conversation_id IN (SELECT id FROM targets)
    ), snapshots AS MATERIALIZED (
      SELECT id FROM permitext_evidence_snapshots WHERE user_id = $1 AND answer_id IN (SELECT id FROM answers)
    ), passages AS MATERIALIZED (
      SELECT source->>'id' AS id FROM targets, jsonb_array_elements(
        CASE WHEN jsonb_typeof(conversation->'sources') = 'array' THEN conversation->'sources' ELSE '[]'::jsonb END) AS source
      WHERE COALESCE(source->>'id', '') <> ''
    ), deleted_feedback AS (
      DELETE FROM permitext_research_feedback WHERE user_id = $1
        AND (conversation_id IN (SELECT id FROM targets) OR answer_id IN (SELECT id FROM answers)) RETURNING id
    ), deleted_links AS (
      DELETE FROM permitext_project_links WHERE user_id = $1 AND (
        (target_kind = 'researchConversation' AND target_id IN (SELECT id FROM targets))
        OR (target_kind = 'researchAnswer' AND target_id IN (SELECT id FROM answers))
        OR (target_kind = 'approvedEvidence' AND target_id IN (SELECT id FROM snapshots))
        OR (target_kind = 'selectedPassage' AND target_id IN (SELECT id FROM passages))) RETURNING project_id
    ), deleted_activity AS (
      DELETE FROM permitext_project_activity WHERE user_id = ANY($3::text[]) AND (
        (object_kind = 'researchConversation' AND object_id IN (SELECT id FROM targets))
        OR (object_kind = 'researchAnswer' AND object_id IN (SELECT id FROM answers))
        OR event->'metadata'->>'conversationID' IN (SELECT id FROM targets)
        OR event->'metadata'->>'researchConversationID' IN (SELECT id FROM targets)) RETURNING project_id
    ), deleted_snapshots AS (
      DELETE FROM permitext_evidence_snapshots WHERE user_id = $1 AND id IN (SELECT id FROM snapshots) RETURNING id
    ), deleted_answers AS (
      DELETE FROM permitext_research_answers WHERE user_id = $1 AND id IN (SELECT id FROM answers) RETURNING id
    ), deleted_conversations AS (
      DELETE FROM permitext_research_conversations WHERE user_id = $1 AND id IN (SELECT id FROM targets) RETURNING id
    ), projects AS (
      SELECT NULLIF(conversation->>'primaryProjectID', '') AS project_id FROM targets
      UNION SELECT project_id FROM deleted_links UNION SELECT project_id FROM deleted_activity
    ) SELECT (SELECT ok FROM permitted) AS confirmed,
      (SELECT count(*)::int FROM deleted_conversations) AS "deletedCount",
      (SELECT count(*)::int FROM deleted_answers) AS "deletedAnswerCount",
      (SELECT count(*)::int FROM deleted_snapshots) AS "deletedEvidenceSnapshotCount",
      (SELECT count(*)::int FROM deleted_feedback) AS "deletedFeedbackCount",
      COALESCE((SELECT jsonb_agg(project_id ORDER BY project_id) FROM projects WHERE project_id IS NOT NULL), '[]'::jsonb) AS "projectIDs"
  `};
}
