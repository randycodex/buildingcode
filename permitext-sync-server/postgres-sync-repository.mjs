function safeJSON(value, fallback) {
  if (value === null || value === undefined) return fallback;
  return typeof value === "string" ? JSON.parse(value) : value;
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

export function createPostgresSyncRepository(sql) {
  function compatibilityQuery(userID, mutation) {
    const recordID = mutationRecordID(mutation);
    const { kind, record } = mutationEntry(mutation);
    const ownerUserID = record.userID || userID;
    const mutationJSON = JSON.stringify(mutation);
    return sql`
      INSERT INTO permitext_user_content_records (
        record_id, user_id, entity_kind, code_version, mutation,
        updated_at, deleted_at, server_version
      )
      VALUES (
        ${recordID}, ${ownerUserID}, ${kind}, ${record.codeVersion || null},
        ${mutationJSON}::jsonb, ${updatedAt(record)}::timestamptz,
        ${deletedAt(record)}::timestamptz, 1
      )
      ON CONFLICT (record_id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        entity_kind = EXCLUDED.entity_kind,
        code_version = EXCLUDED.code_version,
        mutation = EXCLUDED.mutation,
        updated_at = EXCLUDED.updated_at,
        deleted_at = EXCLUDED.deleted_at,
        server_version = permitext_user_content_records.server_version + 1
      WHERE permitext_user_content_records.user_id = EXCLUDED.user_id
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
        address, description, color_hex, sort_order, mutation,
        updated_at, deleted_at, server_version
      )
      SELECT ${recordID}, ${ownerUserID}, ${record.codeVersion}, ${record.clientID || null},
        ${record.localFolderID || null}, ${record.name ?? null}, ${record.address ?? null},
        ${record.description ?? null}, ${record.colorHex ?? null}, ${record.sortOrder ?? null},
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
        section_id, block_id, scope, mutation, updated_at, deleted_at, server_version
      )
      SELECT ${recordID}, ${ownerUserID}, ${record.codeVersion}, ${record.folderClientID || null},
        ${record.localFolderID || null}, ${record.sectionID}, ${blockID(record.blockID)},
        ${record.scope || null}, ${mutationJSON}::jsonb, ${updatedAt(record)}::timestamptz,
        ${deletedAt(record)}::timestamptz, 1
      WHERE ${accepted}
      ON CONFLICT (record_id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        code_version = EXCLUDED.code_version,
        project_client_id = EXCLUDED.project_client_id,
        local_folder_id = EXCLUDED.local_folder_id,
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

  async function push(userID, mutations) {
    const queries = [];
    const acceptanceIndexes = [];
    for (const mutation of mutations) {
      acceptanceIndexes.push(queries.length);
      queries.push(compatibilityQuery(userID, mutation));
      const recordQuery = domainQuery(userID, mutation);
      if (recordQuery) queries.push(recordQuery);
      queries.push(eventQuery(userID, mutation));
    }
    const latestIndex = queries.length;
    queries.push(sql`
      SELECT COALESCE(MAX(event_id), 0)::bigint AS latest_event_id
      FROM permitext_sync_events WHERE user_id = ${userID}
    `);
    const entitlementIndex = queries.length;
    queries.push(sql`
      SELECT entitlement FROM permitext_entitlements WHERE user_id = ${userID} LIMIT 1
    `);

    const results = await sql.transaction(queries, { isolationMode: "ReadCommitted" });
    const acceptedMutationIDs = [];
    const rejectedMutationIDs = [];
    mutations.forEach((mutation, index) => {
      const recordID = mutationRecordID(mutation);
      if (results[acceptanceIndexes[index]]?.length) acceptedMutationIDs.push(recordID);
      else rejectedMutationIDs.push(recordID);
    });
    return {
      acceptedMutationIDs,
      rejectedMutationIDs,
      latestEventID: Number(results[latestIndex]?.[0]?.latest_event_id || 0),
      entitlement: results[entitlementIndex]?.[0]?.entitlement
        ? safeJSON(results[entitlementIndex][0].entitlement, null)
        : null
    };
  }

  async function pull(userID, { since, sinceEventID }) {
    let filteredQuery;
    if (Number.isSafeInteger(sinceEventID) && sinceEventID >= 0) {
      filteredQuery = sql`
        SELECT records.mutation
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
        SELECT mutation FROM permitext_user_content_records
        WHERE user_id = ${userID}
          AND updated_at > ${new Date(since).toISOString()}::timestamptz
        ORDER BY record_id
      `;
    } else {
      filteredQuery = sql`
        SELECT mutation FROM permitext_user_content_records
        WHERE user_id = ${userID} ORDER BY record_id
      `;
    }

    const [filteredRows, allRows, latestRows, entitlementRows] = await sql.transaction([
      filteredQuery,
      sql`
        SELECT mutation FROM permitext_user_content_records
        WHERE user_id = ${userID} ORDER BY record_id
      `,
      sql`
        SELECT COALESCE(MAX(event_id), 0)::bigint AS latest_event_id
        FROM permitext_sync_events WHERE user_id = ${userID}
      `,
      sql`
        SELECT entitlement FROM permitext_entitlements WHERE user_id = ${userID} LIMIT 1
      `
    ], { isolationMode: "RepeatableRead", readOnly: true });

    return {
      mutations: filteredRows.map((row) => safeJSON(row.mutation, {})),
      allMutations: allRows.map((row) => safeJSON(row.mutation, {})),
      latestEventID: Number(latestRows[0]?.latest_event_id || 0),
      entitlement: entitlementRows[0]?.entitlement
        ? safeJSON(entitlementRows[0].entitlement, null)
        : null
    };
  }

  return { push, pull };
}
