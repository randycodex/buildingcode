import { captureTrash, restoreTrash, trashSummary } from "./trash-recovery.mjs";
import { freePlanMutationDecision } from "./entitlement-contract.mjs";
import { mergeContinuityMutations } from "./continuity-merge.mjs";

function safeJSON(value, fallback) {
  if (value === null || value === undefined) return fallback;
  return typeof value === "string" ? JSON.parse(value) : value;
}

function canonicalJSONString(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJSONString(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJSONString(value[key])}`
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

function mutationEntry(mutation) {
  const [kind, record] = Object.entries(mutation || {})[0] || [];
  return { kind, record };
}

function mutationRecordID(mutation) {
  const { kind, record } = mutationEntry(mutation);
  if (!kind || !record) return null;
  if (kind === "continuity") {
    return [record.userID, "continuity", record.codeVersion].join(":");
  }
  if (kind === "codeVersionClear") {
    return [record.userID, "code-version-clear", record.codeVersion, record.values?.scope]
      .filter(Boolean)
      .join(":");
  }
  return record.id || null;
}

function normalizedDate(value, fallback = null) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function updatedAt(record) {
  return normalizedDate(record?.updatedAt, new Date().toISOString());
}

function deletedAt(record) {
  return normalizedDate(record?.deletedAt);
}

function blockID(value) {
  return String(value || "").trim();
}

function mutationWithServerEventID(mutation, value) {
  const { kind, record } = mutationEntry(mutation);
  const serverEventID = Number(value || 0);
  if (!kind || !record || !Number.isSafeInteger(serverEventID) || serverEventID <= 0) return mutation;
  return { [kind]: { ...record, serverEventID } };
}

export function postgresMutationRejectionReason({ userID, mutation, context = {} }) {
  const { kind, record = {} } = mutationEntry(mutation);
  const ownerUserID = record.userID || userID;
  const existingUserID = context.existing_user_id || null;
  const activePro = context.active_pro === true;

  if (existingUserID && existingUserID !== ownerUserID) {
    return {
      code: "RECORD_OWNERSHIP_MISMATCH",
      message: "This sync record belongs to a different Permitext account."
    };
  }

  const planDecision = freePlanMutationDecision({
    mutation, entitlement: activePro ? { plan: "pro" } : null
  });
  if (!planDecision.allowed) {
    return { code: planDecision.code, message: planDecision.message };
  }

  const incomingUpdatedAt = Date.parse(record.updatedAt || "");
  const existingUpdatedAt = Date.parse(context.existing_updated_at || "");
  if (Number.isFinite(existingUpdatedAt) && existingUpdatedAt > incomingUpdatedAt) {
    return {
      code: "SERVER_NEWER",
      message: "A newer version of this item is already on the server. Review it before retrying."
    };
  }
  const existingMutation = safeJSON(context.existing_mutation, null);
  if (
    Number.isFinite(existingUpdatedAt) &&
    existingUpdatedAt === incomingUpdatedAt &&
    existingMutation &&
    canonicalJSONString(existingMutation) !== canonicalJSONString(mutation)
  ) {
    return {
      code: "EQUAL_TIMESTAMP_CONFLICT",
      message: "This item changed in two places at the same time. Review the sync conflict before retrying."
    };
  }
  return {
    code: "SYNC_MUTATION_REJECTED",
    message: "The server could not accept this change. Refresh the item and retry."
  };
}

export function createPostgresSyncRepository(sql) {
  function activeProPredicate(ownerUserID) {
    return sql`
      EXISTS (
        SELECT 1
        FROM permitext_entitlements
        WHERE user_id = ${ownerUserID}
          AND lower(plan) = 'pro'
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      )
    `;
  }

  function quotaPredicate(userID, mutation) {
    const { kind, record } = mutationEntry(mutation);
    const ownerUserID = record.userID || userID;
    const pro = activeProPredicate(ownerUserID);
    if (deletedAt(record) || kind === "continuity" || kind === "codeVersionClear") {
      return sql`TRUE`;
    }
    if (["savedItem", "annotation", "project", "projectSection", "workboard"].includes(kind)) {
      return pro;
    }
    return sql`TRUE`;
  }

  function compatibilityQuery(userID, mutation, restoring = false) {
    const recordID = mutationRecordID(mutation);
    const { kind, record } = mutationEntry(mutation);
    const ownerUserID = record.userID || userID;
    const mutationJSON = JSON.stringify(mutation);
    return sql`
      INSERT INTO permitext_user_content_records (
        record_id, user_id, entity_kind, code_version, mutation,
        updated_at, deleted_at, server_version
      )
      SELECT
        ${recordID}, ${ownerUserID}, ${kind}, ${record.codeVersion || null},
        ${mutationJSON}::jsonb, ${updatedAt(record)}::timestamptz,
        ${deletedAt(record)}::timestamptz, 1
      WHERE ${restoring ? sql`TRUE` : quotaPredicate(userID, mutation)}
      ON CONFLICT (record_id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        entity_kind = EXCLUDED.entity_kind,
        code_version = EXCLUDED.code_version,
        mutation = EXCLUDED.mutation,
        updated_at = EXCLUDED.updated_at,
        deleted_at = EXCLUDED.deleted_at,
        server_version = permitext_user_content_records.server_version + 1
      WHERE permitext_user_content_records.user_id = EXCLUDED.user_id
        AND NOT (
          EXCLUDED.entity_kind = 'project'
          AND permitext_user_content_records.mutation->'project'->>'folderType' = 'reference'
          AND NOT (EXCLUDED.mutation->'project' ? 'folderType')
        )
        AND (
          permitext_user_content_records.updated_at < EXCLUDED.updated_at
          OR (
            permitext_user_content_records.updated_at = EXCLUDED.updated_at
            AND permitext_user_content_records.mutation = EXCLUDED.mutation
          )
        )
      RETURNING record_id
    `;
  }

  function continuityCompatibilityQuery(userID, mutation, expectedServerVersion) {
    const recordID = mutationRecordID(mutation);
    const { kind, record } = mutationEntry(mutation);
    const ownerUserID = record.userID || userID;
    const mutationJSON = JSON.stringify(mutation);
    return sql`
      WITH accepted AS (
        INSERT INTO permitext_user_content_records (
          record_id, user_id, entity_kind, code_version, mutation,
          updated_at, deleted_at, server_version
        )
        VALUES (
          ${recordID}, ${ownerUserID}, ${kind}, ${record.codeVersion || null},
          ${mutationJSON}::jsonb, ${updatedAt(record)}::timestamptz, NULL, 1
        )
        ON CONFLICT (record_id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          entity_kind = EXCLUDED.entity_kind,
          code_version = EXCLUDED.code_version,
          mutation = EXCLUDED.mutation,
          updated_at = EXCLUDED.updated_at,
          deleted_at = NULL,
          server_version = permitext_user_content_records.server_version + 1
        WHERE permitext_user_content_records.user_id = EXCLUDED.user_id
          AND permitext_user_content_records.server_version = ${expectedServerVersion}
        RETURNING record_id, user_id, entity_kind, code_version, updated_at, mutation
      )
      INSERT INTO permitext_sync_events (
        record_id, user_id, entity_kind, code_version, mutation_updated_at, mutation
      )
      SELECT record_id, user_id, entity_kind, code_version, updated_at, mutation
      FROM accepted
      ON CONFLICT (record_id, mutation_updated_at) DO NOTHING
      RETURNING record_id
    `;
  }

  function rejectionContextQuery(userID, mutation) {
    const recordID = mutationRecordID(mutation);
    return sql`
      SELECT
        EXISTS (
          SELECT 1
          FROM permitext_entitlements
          WHERE user_id = ${userID}
            AND lower(plan) = 'pro'
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        ) AS active_pro,
        (
          SELECT user_id FROM permitext_user_content_records
          WHERE record_id = ${recordID} LIMIT 1
        ) AS existing_user_id,
        (
          SELECT updated_at FROM permitext_user_content_records
          WHERE record_id = ${recordID} LIMIT 1
        ) AS existing_updated_at,
        (
          SELECT deleted_at FROM permitext_user_content_records
          WHERE record_id = ${recordID} LIMIT 1
        ) AS existing_deleted_at,
        (
          SELECT mutation FROM permitext_user_content_records
          WHERE record_id = ${recordID} LIMIT 1
        ) AS existing_mutation,
        (
          SELECT count(*) FROM permitext_user_content_records
          WHERE user_id = ${userID}
            AND entity_kind = 'savedItem'
            AND deleted_at IS NULL
        )::int AS saved_item_count,
        (
          SELECT count(*) FROM permitext_user_content_records
          WHERE user_id = ${userID}
            AND entity_kind = 'annotation'
            AND deleted_at IS NULL
            AND coalesce(mutation->'annotation'->>'noteBody', '') <> ''
            AND NOT (mutation->'annotation' ? 'tags')
        )::int AS note_count
    `;
  }

  function acceptedMutationPredicate(recordID, ownerUserID, mutationJSON) {
    return sql`
      EXISTS (
        SELECT 1
        FROM permitext_user_content_records
        WHERE record_id = ${recordID}
          AND user_id = ${ownerUserID}
          AND mutation = ${mutationJSON}::jsonb
      )
    `;
  }

  function savedItemQuery(userID, mutation) {
    const recordID = mutationRecordID(mutation);
    const { record } = mutationEntry(mutation);
    const ownerUserID = record.userID || userID;
    const mutationJSON = JSON.stringify(mutation);
    const accepted = acceptedMutationPredicate(recordID, ownerUserID, mutationJSON);
    return sql`
      INSERT INTO permitext_saved_items (
        record_id, user_id, code_version, section_id, mutation,
        updated_at, deleted_at, server_version
      )
      SELECT ${recordID}, ${ownerUserID}, ${record.codeVersion}, ${record.sectionID},
        ${mutationJSON}::jsonb, ${updatedAt(record)}::timestamptz,
        ${deletedAt(record)}::timestamptz, 1
      WHERE ${accepted}
      ON CONFLICT (record_id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        code_version = EXCLUDED.code_version,
        section_id = EXCLUDED.section_id,
        mutation = EXCLUDED.mutation,
        updated_at = EXCLUDED.updated_at,
        deleted_at = EXCLUDED.deleted_at,
        server_version = permitext_saved_items.server_version + 1
      WHERE permitext_saved_items.mutation IS DISTINCT FROM EXCLUDED.mutation
      RETURNING record_id
    `;
  }

  function annotationQuery(userID, mutation) {
    const recordID = mutationRecordID(mutation);
    const { record } = mutationEntry(mutation);
    const ownerUserID = record.userID || userID;
    const mutationJSON = JSON.stringify(mutation);
    const accepted = acceptedMutationPredicate(recordID, ownerUserID, mutationJSON);
    const tagsJSON = record.tags === undefined || record.tags === null ? null : JSON.stringify(record.tags);
    return sql`
      INSERT INTO permitext_annotations (
        record_id, user_id, code_version, section_id, block_id, note_body,
        tags, mutation, updated_at, deleted_at, server_version
      )
      SELECT ${recordID}, ${ownerUserID}, ${record.codeVersion}, ${record.sectionID},
        ${blockID(record.blockID)}, ${record.noteBody ?? null}, ${tagsJSON}::jsonb,
        ${mutationJSON}::jsonb, ${updatedAt(record)}::timestamptz,
        ${deletedAt(record)}::timestamptz, 1
      WHERE ${accepted}
      ON CONFLICT (record_id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        code_version = EXCLUDED.code_version,
        section_id = EXCLUDED.section_id,
        block_id = EXCLUDED.block_id,
        note_body = EXCLUDED.note_body,
        tags = EXCLUDED.tags,
        mutation = EXCLUDED.mutation,
        updated_at = EXCLUDED.updated_at,
        deleted_at = EXCLUDED.deleted_at,
        server_version = permitext_annotations.server_version + 1
      WHERE permitext_annotations.mutation IS DISTINCT FROM EXCLUDED.mutation
      RETURNING record_id
    `;
  }

  function projectQuery(userID, mutation) {
    const recordID = mutationRecordID(mutation);
    const { record } = mutationEntry(mutation);
    const ownerUserID = record.userID || userID;
    const mutationJSON = JSON.stringify(mutation);
    const accepted = acceptedMutationPredicate(recordID, ownerUserID, mutationJSON);
    return sql`
      INSERT INTO permitext_projects (
        record_id, user_id, code_version, client_id, local_folder_id, name,
        address, description, folder_type, color_hex, sort_order, mutation,
        updated_at, deleted_at, server_version
      )
      SELECT ${recordID}, ${ownerUserID}, ${record.codeVersion}, ${record.clientID || null},
        ${record.localFolderID || null}, ${record.name ?? null}, ${record.address ?? null},
        ${record.description ?? null}, ${record.folderType || "project"}, ${record.colorHex ?? null}, ${record.sortOrder ?? null},
        ${mutationJSON}::jsonb, ${updatedAt(record)}::timestamptz,
        ${deletedAt(record)}::timestamptz, 1
      WHERE ${accepted}
      ON CONFLICT (record_id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        code_version = EXCLUDED.code_version,
        client_id = EXCLUDED.client_id,
        local_folder_id = EXCLUDED.local_folder_id,
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        description = EXCLUDED.description,
        folder_type = EXCLUDED.folder_type,
        color_hex = EXCLUDED.color_hex,
        sort_order = EXCLUDED.sort_order,
        mutation = EXCLUDED.mutation,
        updated_at = EXCLUDED.updated_at,
        deleted_at = EXCLUDED.deleted_at,
        server_version = permitext_projects.server_version + 1
      WHERE permitext_projects.mutation IS DISTINCT FROM EXCLUDED.mutation
      RETURNING record_id
    `;
  }

  function projectSectionQuery(userID, mutation) {
    const recordID = mutationRecordID(mutation);
    const { record } = mutationEntry(mutation);
    const ownerUserID = record.userID || userID;
    const mutationJSON = JSON.stringify(mutation);
    const accepted = acceptedMutationPredicate(recordID, ownerUserID, mutationJSON);
    return sql`
      INSERT INTO permitext_project_items (
        record_id, user_id, code_version, project_client_id, local_folder_id,
        folder_type, section_id, block_id, scope, mutation, updated_at, deleted_at, server_version
      )
      SELECT ${recordID}, ${ownerUserID}, ${record.codeVersion}, ${record.folderClientID || null},
        ${record.localFolderID || null}, ${record.folderType || "project"}, ${record.sectionID}, ${blockID(record.blockID)},
        ${record.scope || null}, ${mutationJSON}::jsonb, ${updatedAt(record)}::timestamptz,
        ${deletedAt(record)}::timestamptz, 1
      WHERE ${accepted}
      ON CONFLICT (record_id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        code_version = EXCLUDED.code_version,
        project_client_id = EXCLUDED.project_client_id,
        local_folder_id = EXCLUDED.local_folder_id,
        folder_type = EXCLUDED.folder_type,
        section_id = EXCLUDED.section_id,
        block_id = EXCLUDED.block_id,
        scope = EXCLUDED.scope,
        mutation = EXCLUDED.mutation,
        updated_at = EXCLUDED.updated_at,
        deleted_at = EXCLUDED.deleted_at,
        server_version = permitext_project_items.server_version + 1
      WHERE permitext_project_items.mutation IS DISTINCT FROM EXCLUDED.mutation
      RETURNING record_id
    `;
  }

  function commentQuery(userID, mutation) {
    const recordID = mutationRecordID(mutation);
    const { record } = mutationEntry(mutation);
    const ownerUserID = record.userID || userID;
    const mutationJSON = JSON.stringify(mutation);
    const accepted = acceptedMutationPredicate(recordID, ownerUserID, mutationJSON);
    return sql`
      INSERT INTO permitext_comments (
        record_id, user_id, code_version, section_id, block_id, body,
        visibility, mutation, updated_at, deleted_at, server_version
      )
      SELECT ${recordID}, ${ownerUserID}, ${record.codeVersion}, ${record.sectionID},
        ${blockID(record.blockID)}, ${record.body ?? null}, ${record.visibility || "private"},
        ${mutationJSON}::jsonb, ${updatedAt(record)}::timestamptz,
        ${deletedAt(record)}::timestamptz, 1
      WHERE ${accepted}
      ON CONFLICT (record_id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        code_version = EXCLUDED.code_version,
        section_id = EXCLUDED.section_id,
        block_id = EXCLUDED.block_id,
        body = EXCLUDED.body,
        visibility = EXCLUDED.visibility,
        mutation = EXCLUDED.mutation,
        updated_at = EXCLUDED.updated_at,
        deleted_at = EXCLUDED.deleted_at,
        server_version = permitext_comments.server_version + 1
      WHERE permitext_comments.mutation IS DISTINCT FROM EXCLUDED.mutation
      RETURNING record_id
    `;
  }

  function domainQuery(userID, mutation) {
    const { kind } = mutationEntry(mutation);
    if (kind === "savedItem") return savedItemQuery(userID, mutation);
    if (kind === "annotation") return annotationQuery(userID, mutation);
    if (kind === "project") return projectQuery(userID, mutation);
    if (kind === "projectSection") return projectSectionQuery(userID, mutation);
    if (kind === "comment") return commentQuery(userID, mutation);
    return null;
  }

  function eventQuery(userID, mutation) {
    const recordID = mutationRecordID(mutation);
    const { kind, record } = mutationEntry(mutation);
    const ownerUserID = record.userID || userID;
    const mutationJSON = JSON.stringify(mutation);
    const accepted = acceptedMutationPredicate(recordID, ownerUserID, mutationJSON);
    return sql`
      INSERT INTO permitext_sync_events (
        record_id, user_id, entity_kind, code_version, mutation_updated_at, mutation
      )
      SELECT ${recordID}, ${ownerUserID}, ${kind}, ${record.codeVersion || null},
        ${updatedAt(record)}::timestamptz, ${mutationJSON}::jsonb
      WHERE ${accepted}
      ON CONFLICT (record_id, mutation_updated_at) DO NOTHING
      RETURNING event_id
    `;
  }

  async function pushContinuity(userID, incomingMutation) {
    const recordID = mutationRecordID(incomingMutation);
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const existingRows = await sql`
        SELECT user_id, mutation, server_version
        FROM permitext_user_content_records
        WHERE record_id = ${recordID}
        LIMIT 1
      `;
      const existingRow = existingRows[0] || null;
      if (existingRow && existingRow.user_id !== userID) {
        return {
          accepted: false,
          reason: {
            code: "RECORD_OWNERSHIP_MISMATCH",
            message: "This sync record belongs to a different Permitext account."
          }
        };
      }

      const existingMutation = existingRow ? safeJSON(existingRow.mutation, null) : null;
      const newestTimestamp = Math.max(
        Date.parse(existingMutation?.continuity?.updatedAt || "") || 0,
        Date.parse(incomingMutation?.continuity?.updatedAt || "") || 0
      );
      const mergedAt = new Date(Math.max(Date.now(), newestTimestamp + 1)).toISOString();
      const mergedMutation = existingMutation
        ? mergeContinuityMutations(existingMutation, incomingMutation, { mergedAt })
        : incomingMutation;

      if (
        existingMutation &&
        canonicalJSONString(existingMutation) === canonicalJSONString(mergedMutation)
      ) {
        return { accepted: true };
      }

      let acceptedRows;
      try {
        acceptedRows = await continuityCompatibilityQuery(
          userID,
          mergedMutation,
          Number(existingRow?.server_version || 0)
        );
      } catch (error) {
        if (error?.code === "40001") continue;
        throw error;
      }
      if (acceptedRows?.length) {
        return { accepted: true };
      }
    }

    return {
      accepted: false,
      reason: {
        code: "CONTINUITY_RETRY_EXHAUSTED",
        message: "Reading history changed repeatedly during sync. Retry to merge the latest activity."
      }
    };
  }

  async function push(userID, mutations, recoveryBatch = null) {
    const needsRecovery = recoveryBatch || mutations.some(m => m.codeVersionClear || Object.values(m).some(r => r?.deletedAt || (m.annotation && !String(r?.noteBody || "").trim())));
    let original = [], expectedEvent = 0, captured = null, skipped = 0;
    if (needsRecovery) {
      const [rows, events] = await sql.transaction([
        sql`SELECT mutation FROM permitext_user_content_records WHERE user_id = ${userID}`,
        sql`SELECT COALESCE(MAX(event_id),0)::bigint AS latest_event_id FROM permitext_sync_events WHERE user_id = ${userID}`
      ], {isolationLevel:"RepeatableRead",readOnly:true});
      original = rows.map(row => safeJSON(row.mutation,{}));
      expectedEvent = Number(events[0]?.latest_event_id || 0);
      if (recoveryBatch) {
        const plan = restoreTrash(recoveryBatch, original);
        mutations = plan.mutations;
        skipped = plan.skipped;
      } else captured = captureTrash(userID,original,mutations);
    }
    const continuityMutations = mutations.filter(({ continuity }) => Boolean(continuity));
    const standardMutations = mutations.filter(({ continuity }) => !continuity);
    const queries = [];
    if (needsRecovery) {
      queries.push(sql`SELECT 1 / CASE WHEN (SELECT COALESCE(MAX(event_id),0) FROM permitext_sync_events WHERE user_id = ${userID}) = ${expectedEvent} THEN 1 ELSE 0 END AS recovery_guard`);
    }
    if (recoveryBatch) {
      queries.push(sql`SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM permitext_content_trash WHERE user_id = ${userID} AND id = ${recoveryBatch.id} AND expires_at > CURRENT_TIMESTAMP) THEN 1 ELSE 0 END AS trash_guard`);
    }
    const acceptanceIndexes = [];
    const rejectionContextIndexes = [];
    for (const mutation of standardMutations) {
      acceptanceIndexes.push(queries.length);
      queries.push(compatibilityQuery(userID, mutation, Boolean(recoveryBatch)));
      const recordQuery = domainQuery(userID, mutation);
      if (recordQuery) queries.push(recordQuery);
      queries.push(eventQuery(userID, mutation));
      rejectionContextIndexes.push(queries.length);
      queries.push(rejectionContextQuery(userID, mutation));
    }
    if (captured) {
      // Keep snapshots only for changes actually accepted in this transaction.
      const candidates = captured.records.map(item => ({...item, triggers: standardMutations.filter(mutation =>
        captureTrash(userID, [{[item.kind]: item.record}], [mutation]) !== null
      )}));
      const {records, ...metadata} = captured;
      queries.push(sql`INSERT INTO permitext_content_trash(id,user_id,batch,expires_at)
        SELECT ${captured.id}, ${userID}, ${JSON.stringify(metadata)}::jsonb || jsonb_build_object(
          'records', jsonb_agg(candidate - 'triggers'), 'title', count(*)::text || ' deleted items'
        ), ${captured.expiresAt}::timestamptz
        FROM jsonb_array_elements(${JSON.stringify(candidates)}::jsonb) candidate
        WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements(candidate->'triggers') trigger_mutation
          JOIN permitext_user_content_records accepted ON accepted.user_id = ${userID} AND accepted.mutation = trigger_mutation
        ) HAVING count(*) > 0 ON CONFLICT(id) DO NOTHING`);
    }
    if (recoveryBatch) {
      // A rejected restore must retain the recovery copy and roll back every write.
      for (const mutation of standardMutations) queries.push(sql`SELECT 1 / CASE WHEN EXISTS(
        SELECT 1 FROM permitext_user_content_records WHERE user_id = ${userID}
        AND record_id = ${mutationRecordID(mutation)} AND mutation = ${JSON.stringify(mutation)}::jsonb
      ) THEN 1 ELSE 0 END AS restore_guard`);
      queries.push(sql`DELETE FROM permitext_content_trash WHERE user_id = ${userID} AND id = ${recoveryBatch.id}`);
    }
    if (needsRecovery) queries.push(sql`DELETE FROM permitext_content_trash WHERE user_id = ${userID} AND expires_at <= CURRENT_TIMESTAMP`);
    let results;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        results = await sql.transaction(queries, { isolationLevel: "Serializable" });
        break;
      } catch (error) {
        if (error?.code !== "40001" || attempt === 3) throw error;
      }
    }
    const acceptedMutationIDs = [];
    const rejectedMutationIDs = [];
    const rejectionReasons = {};
    standardMutations.forEach((mutation, index) => {
      const recordID = mutationRecordID(mutation);
      if (results[acceptanceIndexes[index]]?.length) acceptedMutationIDs.push(recordID);
      else {
        rejectedMutationIDs.push(recordID);
        rejectionReasons[recordID] = postgresMutationRejectionReason({
          userID,
          mutation,
          context: results[rejectionContextIndexes[index]]?.[0] || {}
        });
      }
    });

    for (const mutation of continuityMutations) {
      const recordID = mutationRecordID(mutation);
      const result = await pushContinuity(userID, mutation);
      if (result.accepted) {
        acceptedMutationIDs.push(recordID);
      } else {
        rejectedMutationIDs.push(recordID);
        rejectionReasons[recordID] = result.reason;
      }
    }

    const [finalLatestRows, finalEntitlementRows] = await sql.transaction([
      sql`
        SELECT COALESCE(MAX(event_id), 0)::bigint AS latest_event_id
        FROM permitext_sync_events WHERE user_id = ${userID}
      `,
      sql`
        SELECT entitlement FROM permitext_entitlements WHERE user_id = ${userID} LIMIT 1
      `
    ], { isolationLevel: "RepeatableRead", readOnly: true });
    return {
      acceptedMutationIDs,
      rejectedMutationIDs,
      rejectionReasons,
      skippedCount: skipped,
      latestEventID: Number(finalLatestRows?.[0]?.latest_event_id || 0),
      entitlement: finalEntitlementRows?.[0]?.entitlement
        ? safeJSON(finalEntitlementRows[0].entitlement, null)
        : null
    };
  }

  async function pull(userID, { since, sinceEventID }) {
    let filteredQuery;
    if (Number.isSafeInteger(sinceEventID) && sinceEventID >= 0) {
      filteredQuery = sql`
        SELECT records.mutation,
          (
            SELECT MAX(events.event_id)::bigint
            FROM permitext_sync_events AS events
            WHERE events.user_id = ${userID}
              AND events.record_id = records.record_id
          ) AS server_event_id
        FROM permitext_user_content_records AS records
        WHERE records.user_id = ${userID}
          AND EXISTS (
            SELECT 1 FROM permitext_sync_events AS events
            WHERE events.user_id = ${userID}
              AND events.record_id = records.record_id
              AND events.event_id > ${sinceEventID}
          )
        ORDER BY records.record_id
      `;
    } else if (Number.isFinite(since)) {
      filteredQuery = sql`
        SELECT records.mutation,
          (
            SELECT MAX(events.event_id)::bigint
            FROM permitext_sync_events AS events
            WHERE events.user_id = ${userID}
              AND events.record_id = records.record_id
          ) AS server_event_id
        FROM permitext_user_content_records AS records
        WHERE records.user_id = ${userID}
          AND records.updated_at > ${new Date(since).toISOString()}::timestamptz
        ORDER BY records.record_id
      `;
    } else {
      filteredQuery = sql`
        SELECT records.mutation,
          (
            SELECT MAX(events.event_id)::bigint
            FROM permitext_sync_events AS events
            WHERE events.user_id = ${userID}
              AND events.record_id = records.record_id
          ) AS server_event_id
        FROM permitext_user_content_records AS records
        WHERE records.user_id = ${userID} ORDER BY records.record_id
      `;
    }

    const [filteredRows, dependencyRows, latestRows, entitlementRows] = await sql.transaction([
      filteredQuery,
      sql`
        SELECT records.mutation,
          (
            SELECT MAX(events.event_id)::bigint
            FROM permitext_sync_events AS events
            WHERE events.user_id = ${userID}
              AND events.record_id = records.record_id
          ) AS server_event_id
        FROM permitext_user_content_records AS records
        WHERE records.user_id = ${userID}
          AND records.entity_kind = 'project'
        ORDER BY records.record_id
      `,
      sql`
        SELECT COALESCE(MAX(event_id), 0)::bigint AS latest_event_id
        FROM permitext_sync_events WHERE user_id = ${userID}
      `,
      sql`
        SELECT entitlement FROM permitext_entitlements WHERE user_id = ${userID} LIMIT 1
      `
    ], { isolationLevel: "RepeatableRead", readOnly: true });

    return {
      mutations: filteredRows.map((row) => mutationWithServerEventID(safeJSON(row.mutation, {}), row.server_event_id)),
      // Incremental pulls only need project records to resolve a changed
      // projectSection's parent. Avoid re-reading every saved record on each
      // foreground poll as a user's library grows.
      allMutations: [...filteredRows, ...dependencyRows]
        .map((row) => mutationWithServerEventID(safeJSON(row.mutation, {}), row.server_event_id)),
      latestEventID: Number(latestRows[0]?.latest_event_id || 0),
      entitlement: entitlementRows[0]?.entitlement
        ? safeJSON(entitlementRows[0].entitlement, null)
        : null
    };
  }

  async function trashAction(userID, action, id) {
    let restoredCount = 0, skippedCount = 0;
    if (action === "restore") {
      const rows = await sql`SELECT batch FROM permitext_content_trash WHERE user_id = ${userID} AND id = ${id} AND expires_at > CURRENT_TIMESTAMP`;
      if (!rows.length) throw new Error("Trash entry is unavailable or expired.");
      const result = await push(userID, [], safeJSON(rows[0].batch,null));
      restoredCount = result.acceptedMutationIDs.length;
      skippedCount = result.skippedCount;
    } else if (action === "purge") await sql`DELETE FROM permitext_content_trash WHERE user_id = ${userID} AND id = ${id}`;
    else if (action === "empty") await sql`DELETE FROM permitext_content_trash WHERE user_id = ${userID}`;
    await sql`DELETE FROM permitext_content_trash WHERE user_id = ${userID} AND expires_at <= CURRENT_TIMESTAMP`;
    const rows = await sql`SELECT batch FROM permitext_content_trash WHERE user_id = ${userID} ORDER BY expires_at DESC`;
    return {entries:rows.map(row => trashSummary(safeJSON(row.batch,{}))),restoredCount,skippedCount};
  }
  return { push, pull, trashAction };
}
