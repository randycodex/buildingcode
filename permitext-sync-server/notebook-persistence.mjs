import { createHash } from "node:crypto";

export function notebookCreationID(userID, projectID, clientMutationID) {
  const hex = createHash("sha256").update(JSON.stringify([userID, projectID, clientMutationID])).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function notebookMutationReplay(artifact, links, receipt, artifactType = "notebookCard") {
  if (!receipt || !artifact || artifact.envelope?.type !== artifactType || artifact.envelope.deletedAt ||
      artifact.envelope.version !== receipt.expectedVersion + 1) return null;
  const stored = artifact.payload?._saveReceipt;
  if (!stored || ["clientMutationID", "fingerprint", "expectedVersion", "projectID"].some((key) => stored[key] !== receipt[key])) return null;
  const link = links.find((item) => !item.deletedAt && item.projectID === receipt.projectID &&
    item.targetKind === artifactType && item.targetID === artifact.envelope.id);
  return link ? { artifact, link } : null;
}

export function notebookVersionConflict(artifactType = "notebookCard") {
  const error = new Error(`This ${artifactType === "projectNote" ? "Project note" : "Notebook card"} changed after you opened it. Review the current version before saving.`);
  error.code = artifactType === "projectNote" ? "PROJECT_NOTE_VERSION_CONFLICT" : "NOTEBOOK_VERSION_CONFLICT";
  error.statusCode = 409;
  return error;
}

export function applyNotebookCardMutation(store, userID, {
  artifact, expectedVersion, links = [], expectedLinks = [], events = [], requireEmptyProjectNoteProjectID = null
}) {
  const artifactType = artifact.envelope.type;
  const artifacts = store.foundationArtifactsByUserID?.[userID] || [];
  const index = artifacts.findIndex((item) => item.envelope?.id === artifact.envelope.id);
  const existing = artifacts[index];
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0 ||
      !["notebookCard", "projectNote"].includes(artifactType) ||
      (existing && (existing.envelope.type !== artifactType || existing.envelope.deletedAt)) ||
      Number(existing?.envelope.version || 0) !== expectedVersion ||
      artifact.envelope.version !== expectedVersion + 1) throw notebookVersionConflict(artifactType);
  const storedLinks = store.projectLinksByUserID?.[userID] || [];
  if (requireEmptyProjectNoteProjectID && storedLinks.some((link) => !link.deletedAt &&
      link.projectID === requireEmptyProjectNoteProjectID && link.targetKind === "projectNote")) throw notebookVersionConflict(artifactType);
  for (const expected of expectedLinks) {
    const current = storedLinks.find((link) => link.id === expected.id);
    if (!current || current.version !== expected.version ||
        (current.deletedAt || null) !== (expected.deletedAt || null)) throw notebookVersionConflict(artifactType);
  }
  for (const link of links) {
    const current = storedLinks.find((item) => item.id === link.id);
    const expected = expectedLinks.find((item) => item.id === link.id);
    if (!expected && current) throw notebookVersionConflict(artifactType);
  }
  store.foundationArtifactsByUserID ||= {};
  if (index < 0) artifacts.push(artifact);
  else artifacts[index] = artifact;
  store.foundationArtifactsByUserID[userID] = artifacts;
  store.projectLinksByUserID ||= {};
  for (const link of links) {
    const index = storedLinks.findIndex((item) => item.id === link.id);
    if (index < 0) storedLinks.push(link);
    else storedLinks[index] = link;
  }
  store.projectLinksByUserID[userID] = storedLinks;
  store.activityEventsByUserID ||= {};
  const activity = store.activityEventsByUserID[userID] || [];
  for (const event of events) if (!activity.some((item) => item.id === event.id)) activity.push(event);
  store.activityEventsByUserID[userID] = activity;
  return artifact;
}

export async function commitPostgresNotebookCardMutation(sql, userID, {
  artifact, expectedVersion, links = [], expectedLinks = [], events = [], requireEmptyProjectNoteProjectID = null
}) {
  const artifactType = artifact.envelope.type;
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0 ||
      !["notebookCard", "projectNote"].includes(artifactType) ||
      artifact.envelope.version !== expectedVersion + 1) throw notebookVersionConflict(artifactType);
  const envelope = artifact.envelope;
  const queries = [];
  if (requireEmptyProjectNoteProjectID) queries.push(sql`
    SELECT 1 / (CASE WHEN NOT EXISTS (
      SELECT id FROM permitext_project_links WHERE user_id = ${userID}
        AND project_id = ${requireEmptyProjectNoteProjectID} AND target_kind = 'projectNote' AND deleted_at IS NULL
    ) THEN 1 ELSE 0 END) AS project_note_creation_guard
  `);
  queries.push(expectedVersion === 0 ? sql`
    WITH changed AS (
      INSERT INTO permitext_foundation_artifacts
        (id, user_id, artifact_type, envelope, payload, created_at, updated_at, archived_at, deleted_at)
      VALUES (${envelope.id}, ${userID}, ${envelope.type}, ${JSON.stringify(envelope)}::jsonb,
        ${JSON.stringify(artifact.payload)}::jsonb, ${envelope.createdAt}::timestamptz,
        ${envelope.updatedAt}::timestamptz, ${envelope.archivedAt}::timestamptz, ${envelope.deletedAt}::timestamptz)
      ON CONFLICT (id) DO NOTHING RETURNING id
    ) SELECT 1 / COUNT(*)::int AS notebook_version_guard FROM changed
  ` : sql`
    WITH changed AS (
      UPDATE permitext_foundation_artifacts
      SET envelope = ${JSON.stringify(envelope)}::jsonb, payload = ${JSON.stringify(artifact.payload)}::jsonb,
        updated_at = ${envelope.updatedAt}::timestamptz, archived_at = ${envelope.archivedAt}::timestamptz,
        deleted_at = ${envelope.deletedAt}::timestamptz
      WHERE id = ${envelope.id} AND user_id = ${userID} AND artifact_type = ${artifactType} AND deleted_at IS NULL
        AND (envelope->>'version')::bigint = ${expectedVersion}
      RETURNING id
    ) SELECT 1 / COUNT(*)::int AS notebook_version_guard FROM changed
  `);
  for (const expected of expectedLinks) {
    queries.push(sql`
      WITH current_link AS MATERIALIZED (
        SELECT id FROM permitext_project_links WHERE id = ${expected.id} AND user_id = ${userID}
          AND (link->>'version')::bigint = ${expected.version}
          AND deleted_at IS NOT DISTINCT FROM ${expected.deletedAt || null}::timestamptz
        FOR UPDATE
      ) SELECT 1 / COUNT(*)::int AS notebook_link_guard FROM current_link
    `);
  }
  for (const link of links) {
    const expected = expectedLinks.find((item) => item.id === link.id);
    queries.push(expected ? sql`
      UPDATE permitext_project_links
      SET link = ${JSON.stringify(link)}::jsonb, updated_at = ${link.updatedAt}::timestamptz,
        deleted_at = ${link.deletedAt}::timestamptz
      WHERE id = ${link.id} AND user_id = ${userID}
    ` : sql`
      WITH changed AS (
        INSERT INTO permitext_project_links
          (id, user_id, project_id, target_kind, target_id, relationship, link, created_at, updated_at, deleted_at)
        VALUES (${link.id}, ${userID}, ${link.projectID}, ${link.targetKind}, ${link.targetID},
          ${link.relationship}, ${JSON.stringify(link)}::jsonb, ${link.createdAt}::timestamptz,
          ${link.updatedAt}::timestamptz, ${link.deletedAt}::timestamptz)
        ON CONFLICT (id) DO NOTHING RETURNING id
      ) SELECT 1 / COUNT(*)::int AS notebook_link_guard FROM changed
    `);
  }
  for (const event of events) queries.push(sql`
    INSERT INTO permitext_project_activity
      (id, user_id, project_id, action, object_kind, object_id, event, created_at)
    VALUES (${event.id}, ${userID}, ${event.projectID}, ${event.action}, ${event.objectKind},
      ${event.objectID}, ${JSON.stringify(event)}::jsonb, ${event.createdAt}::timestamptz)
    ON CONFLICT (id) DO NOTHING
  `);
  try {
    await sql.transaction(queries, { isolationLevel: "Serializable" });
  } catch (error) {
    if (["22012", "23505", "40001"].includes(String(error?.code))) throw notebookVersionConflict(artifactType);
    throw error;
  }
  return artifact;
}
