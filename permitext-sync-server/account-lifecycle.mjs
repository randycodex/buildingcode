// Durable account operation guards. Deletion claims the same row used to start
// operations, so a different process cannot accept work during cleanup. Guards
// deliberately have no time-based expiry: a timed-out provider request can still
// finish, and elapsed time is not evidence that it stopped writing.
export function accountBusyError() {
  return Object.assign(new Error("An account operation is still in progress. Wait for it to finish, then retry deletion. If the operation was interrupted and this message persists, contact support."), {
    code: "ACCOUNT_OPERATION_IN_PROGRESS", statusCode: 409
  });
}

export function accountClosingError() {
  return Object.assign(new Error("Account deletion is in progress. Wait for cleanup to finish before using this account."), {
    code: "ACCOUNT_DELETION_IN_PROGRESS", statusCode: 409
  });
}

export function inactiveAccountError() {
  return Object.assign(new Error("The account session is no longer active. Sign in again."), {
    code: "ACCOUNT_SESSION_INACTIVE", statusCode: 401
  });
}

export function createFileAccountLifecycle(mutate) {
  return {
    async begin(userID, id, { sessionToken = null, kind = "request" } = {}) {
      return mutate((store) => {
        if (!store.users?.[userID] || (sessionToken && store.sessions?.[userID] !== sessionToken)) throw inactiveAccountError();
        store.accountLifecycleByUserID ||= {};
        const state = store.accountLifecycleByUserID[userID] ||= { operations: {}, deletionID: null };
        if (state.deletionID) throw accountClosingError();
        state.operations[id] = { kind, startedAt: new Date().toISOString() };
      });
    },
    async finish(userID, id) {
      return mutate((store) => {
        const state = store.accountLifecycleByUserID?.[userID];
        if (!state) return;
        delete state.operations[id];
        if (!state.deletionID && !Object.keys(state.operations).length) delete store.accountLifecycleByUserID[userID];
      });
    },
    async claimDeletion(userID, id, { sessionToken = null } = {}) {
      return mutate((store) => {
        if (!store.users?.[userID] || (sessionToken && store.sessions?.[userID] !== sessionToken)) throw inactiveAccountError();
        store.accountLifecycleByUserID ||= {};
        const state = store.accountLifecycleByUserID[userID] ||= { operations: {}, deletionID: null };
        if (state.deletionID) throw accountClosingError();
        if (Object.keys(state.operations).length) throw accountBusyError();
        state.deletionID = id;
      });
    },
    async releaseDeletion(userID, id) {
      return mutate((store) => {
        if (store.accountLifecycleByUserID?.[userID]?.deletionID === id) delete store.accountLifecycleByUserID[userID];
      });
    }
  };
}

export function createPostgresAccountLifecycle(sql) {
  async function failure(userID, deleting = false, sessionToken = null) {
    const [row] = await sql`SELECT users.id, lifecycle.deletion_id,
      (${sessionToken}::text IS NULL OR EXISTS (
        SELECT 1 FROM permitext_account_sessions WHERE user_id = users.id
          AND token_hash = encode(sha256(convert_to(${sessionToken}::text, 'UTF8')), 'hex')
          AND revoked_at IS NULL AND expires_at > now()
      ) OR EXISTS (SELECT 1 FROM permitext_sessions WHERE user_id = users.id AND session_token = ${sessionToken})) AS session_active
      FROM permitext_users AS users LEFT JOIN permitext_account_lifecycle AS lifecycle ON lifecycle.user_id = users.id
      WHERE users.id = ${userID}`;
    if (!row || !row.session_active) throw inactiveAccountError();
    if (row.deletion_id) throw accountClosingError();
    if (deleting) throw accountBusyError();
    throw inactiveAccountError();
  }
  return {
    async begin(userID, id, { sessionToken = null, kind = "request" } = {}) {
      const rows = await sql`
        INSERT INTO permitext_account_lifecycle (user_id, operations)
        SELECT users.id, jsonb_build_object(${id}::text, jsonb_build_object('kind', ${kind}::text, 'startedAt', now()))
        FROM permitext_users AS users WHERE users.id = ${userID}
          AND (${sessionToken}::text IS NULL OR EXISTS (
            SELECT 1 FROM permitext_account_sessions WHERE user_id = users.id
              AND token_hash = encode(sha256(convert_to(${sessionToken}::text, 'UTF8')), 'hex')
              AND revoked_at IS NULL AND expires_at > now()
          ) OR EXISTS (SELECT 1 FROM permitext_sessions WHERE user_id = users.id AND session_token = ${sessionToken}))
        FOR KEY SHARE OF users
        ON CONFLICT (user_id) DO UPDATE SET operations = permitext_account_lifecycle.operations || EXCLUDED.operations
        WHERE permitext_account_lifecycle.deletion_id IS NULL
        RETURNING user_id
      `;
      if (!rows.length) await failure(userID, false, sessionToken);
    },
    async finish(userID, id) {
      // Keep the empty row until account deletion. Removing it separately would
      // race with another operation beginning on that same row.
      await sql`UPDATE permitext_account_lifecycle SET operations = operations - ${id} WHERE user_id = ${userID}`;
    },
    async claimDeletion(userID, id, { sessionToken = null } = {}) {
      const rows = await sql`
        INSERT INTO permitext_account_lifecycle (user_id, deletion_id)
        SELECT users.id, ${id} FROM permitext_users AS users WHERE users.id = ${userID}
          AND (${sessionToken}::text IS NULL OR EXISTS (
            SELECT 1 FROM permitext_account_sessions WHERE user_id = users.id
              AND token_hash = encode(sha256(convert_to(${sessionToken}::text, 'UTF8')), 'hex')
              AND revoked_at IS NULL AND expires_at > now()
          ) OR EXISTS (SELECT 1 FROM permitext_sessions WHERE user_id = users.id AND session_token = ${sessionToken}))
        FOR KEY SHARE OF users
        ON CONFLICT (user_id) DO UPDATE SET deletion_id = EXCLUDED.deletion_id
        WHERE permitext_account_lifecycle.deletion_id IS NULL AND permitext_account_lifecycle.operations = '{}'::jsonb
        RETURNING user_id
      `;
      if (!rows.length) await failure(userID, true, sessionToken);
    },
    async releaseDeletion(userID, id) {
      await sql`UPDATE permitext_account_lifecycle SET deletion_id = NULL WHERE user_id = ${userID} AND deletion_id = ${id}`;
    }
  };
}
