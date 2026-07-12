import { createHash, randomUUID } from "node:crypto";

function safeJSON(value, fallback) {
  if (value === null || value === undefined) return fallback;
  return typeof value === "string" ? JSON.parse(value) : value;
}

function tokenHash(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

function withoutSessionToken(account) {
  const stored = { ...(account || {}) };
  delete stored.backendSessionToken;
  return stored;
}

function appleSubjectIDs(account) {
  return new Set([
    account?.authProviderUserID,
    account?.appleUserID,
    ...(Array.isArray(account?.linkedAppleUserIDs) ? account.linkedAppleUserIDs : [])
  ].map((value) => String(value || "").trim()).filter(Boolean));
}

function normalizedEmail(account) {
  return String(account?.email || "").trim().toLowerCase();
}

export function accountSessionTTLSeconds(environment = process.env) {
  const configured = Number(environment.PERMITEXT_SESSION_TTL_SECONDS);
  return Number.isSafeInteger(configured) && configured >= 3600
    ? configured
    : 60 * 60 * 24 * 30;
}

export function createPostgresAccountRepository(sql) {
  async function contextForUser(userID) {
    const rows = await sql`
      SELECT users.account, entitlements.entitlement
      FROM permitext_users AS users
      LEFT JOIN permitext_entitlements AS entitlements ON entitlements.user_id = users.id
      WHERE users.id = ${userID}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      account: safeJSON(row.account, {}),
      entitlement: row.entitlement ? safeJSON(row.entitlement, null) : null
    };
  }

  async function hasActiveSession(userID) {
    const rows = await sql`
      SELECT (
        EXISTS (
          SELECT 1 FROM permitext_account_sessions
          WHERE user_id = ${userID} AND revoked_at IS NULL AND expires_at > now()
        )
        OR EXISTS (
          SELECT 1 FROM permitext_sessions WHERE user_id = ${userID}
        )
      ) AS has_session
    `;
    return Boolean(rows[0]?.has_session);
  }

  async function authenticate(userID, rawToken) {
    if (!userID || !rawToken) return null;
    const hash = tokenHash(rawToken);
    const rows = await sql`
      UPDATE permitext_account_sessions
      SET last_seen_at = now()
      WHERE token_hash = ${hash}
        AND user_id = ${userID}
        AND revoked_at IS NULL
        AND expires_at > now()
      RETURNING user_id
    `;
    if (rows.length) {
      return contextForUser(userID);
    }

    const legacyRows = await sql`
      SELECT user_id
      FROM permitext_sessions
      WHERE user_id = ${userID} AND session_token = ${rawToken}
      LIMIT 1
    `;
    if (!legacyRows.length) return null;

    await sql.transaction([
      sql`
        INSERT INTO permitext_account_sessions (
          token_hash, user_id, created_at, last_seen_at, expires_at
        )
        VALUES (
          ${hash}, ${userID}, now(), now(),
          now() + (${accountSessionTTLSeconds()} * interval '1 second')
        )
        ON CONFLICT (token_hash) DO UPDATE SET
          last_seen_at = now(),
          expires_at = EXCLUDED.expires_at,
          revoked_at = NULL
      `,
      sql`DELETE FROM permitext_sessions WHERE user_id = ${userID}`
    ]);
    return contextForUser(userID);
  }

  async function matchingAppleAccounts(account) {
    if (account?.authProvider !== "apple") return [];
    const subject = String(account.authProviderUserID || account.appleUserID || "").trim();
    const email = normalizedEmail(account);
    return sql`
      SELECT
        users.id,
        users.account,
        legacy_sessions.session_token AS legacy_session_token,
        (
          SELECT count(*)::int
          FROM permitext_user_content_records AS records
          WHERE records.user_id = users.id
        ) AS mutation_count,
        EXISTS (
          SELECT 1 FROM permitext_entitlements AS entitlements
          WHERE entitlements.user_id = users.id
        ) AS has_entitlement
      FROM permitext_users AS users
      LEFT JOIN permitext_sessions AS legacy_sessions ON legacy_sessions.user_id = users.id
      WHERE users.auth_provider = 'apple'
        AND (
          users.id = ${account.appUserID}
          OR users.auth_provider_user_id = ${subject}
          OR users.apple_user_id = ${subject}
          OR users.account->'linkedAppleUserIDs' ? ${subject}
          OR (${email} <> '' AND lower(users.account->>'email') = ${email})
        )
      ORDER BY users.created_at ASC
    `;
  }

  async function signIn(account) {
    const incoming = withoutSessionToken(account);
    const candidates = await matchingAppleAccounts(incoming);
    const exact = candidates.find((candidate) => candidate.id === incoming.appUserID) || null;
    const alternatives = candidates
      .filter((candidate) => candidate.id !== incoming.appUserID)
      .sort((left, right) => {
        const mutationDelta = Number(right.mutation_count || 0) - Number(left.mutation_count || 0);
        if (mutationDelta !== 0) return mutationDelta;
        const entitlementDelta = Number(Boolean(right.has_entitlement)) - Number(Boolean(left.has_entitlement));
        return entitlementDelta;
      });
    const preferredAlternative = alternatives[0] || null;
    if (exact && preferredAlternative) {
      return { requiresLegacyMerge: true };
    }

    const targetRow = preferredAlternative || exact;
    const targetAccount = targetRow ? safeJSON(targetRow.account, {}) : {};
    const targetUserID = targetRow?.id || incoming.appUserID;
    const linkedAppleUserIDs = Array.from(new Set([
      ...appleSubjectIDs(targetAccount),
      ...appleSubjectIDs(incoming)
    ]));
    const storedAccount = withoutSessionToken({
      ...incoming,
      ...targetAccount,
      appUserID: targetUserID,
      authProvider: incoming.authProvider,
      authProviderUserID: targetAccount.authProviderUserID || incoming.authProviderUserID,
      appleUserID: targetAccount.appleUserID || incoming.appleUserID,
      email: normalizedEmail(incoming) || normalizedEmail(targetAccount),
      linkedAppleUserIDs,
      signedInAt: incoming.signedInAt,
      migrationState: targetAccount.migrationState || incoming.migrationState
    });
    const rawToken = randomUUID();
    const hash = tokenHash(rawToken);
    const authProviderUserID = storedAccount.authProviderUserID || storedAccount.appleUserID || targetUserID;

    const queries = [sql`
        INSERT INTO permitext_users (
          id, auth_provider, auth_provider_user_id, apple_user_id,
          public_username, display_name, migration_state, account, created_at, updated_at
        )
        VALUES (
          ${targetUserID}, ${storedAccount.authProvider || "apple"}, ${authProviderUserID},
          ${storedAccount.appleUserID || null}, ${storedAccount.publicUsername || null},
          ${storedAccount.displayName || null}, ${storedAccount.migrationState || null},
          ${JSON.stringify(storedAccount)}::jsonb,
          ${storedAccount.signedInAt || new Date().toISOString()}::timestamptz, now()
        )
        ON CONFLICT (id) DO UPDATE SET
          public_username = EXCLUDED.public_username,
          display_name = EXCLUDED.display_name,
          migration_state = EXCLUDED.migration_state,
          account = EXCLUDED.account,
          updated_at = now()
      `, sql`
        INSERT INTO permitext_account_sessions (
          token_hash, user_id, created_at, last_seen_at, expires_at
        )
        VALUES (
          ${hash}, ${targetUserID}, now(), now(),
          now() + (${accountSessionTTLSeconds()} * interval '1 second')
        )
      `];
    if (targetRow?.legacy_session_token) {
      queries.push(sql`
        INSERT INTO permitext_account_sessions (
          token_hash, user_id, created_at, last_seen_at, expires_at
        )
        VALUES (
          ${tokenHash(targetRow.legacy_session_token)}, ${targetUserID}, now(), now(),
          now() + (${accountSessionTTLSeconds()} * interval '1 second')
        )
        ON CONFLICT (token_hash) DO NOTHING
      `);
    }
    queries.push(sql`DELETE FROM permitext_sessions WHERE user_id = ${targetUserID}`);
    const entitlementIndex = queries.length;
    queries.push(sql`
        SELECT entitlement FROM permitext_entitlements
        WHERE user_id = ${targetUserID}
        LIMIT 1
      `);
    queries.push(sql`
        DELETE FROM permitext_account_sessions
        WHERE expires_at <= now() OR revoked_at IS NOT NULL
      `);
    const transactionResults = await sql.transaction(queries);
    const entitlementRows = transactionResults[entitlementIndex];

    return {
      account: { ...storedAccount, backendSessionToken: rawToken },
      entitlement: entitlementRows[0]?.entitlement
        ? safeJSON(entitlementRows[0].entitlement, null)
        : null,
      mergedAccount: preferredAlternative ? {
        sourceUserID: incoming.appUserID,
        targetUserID,
        movedMutationCount: 0,
        acceptedMutationIDs: [],
        rejectedMutationIDs: [],
        transferredEntitlement: false
      } : null
    };
  }

  async function updateAccount(userID, account) {
    const stored = withoutSessionToken(account);
    const rows = await sql`
      UPDATE permitext_users
      SET public_username = ${stored.publicUsername || null},
          display_name = ${stored.displayName || null},
          migration_state = ${stored.migrationState || null},
          account = ${JSON.stringify(stored)}::jsonb,
          updated_at = now()
      WHERE id = ${userID}
      RETURNING account
    `;
    return rows[0]?.account ? safeJSON(rows[0].account, null) : null;
  }

  async function saveEntitlement(userID, entitlement) {
    const rows = await sql`
      INSERT INTO permitext_entitlements (
        user_id, plan, source, granted_user_id, entitlement, expires_at, updated_at
      )
      VALUES (
        ${userID}, ${entitlement.plan || "free"}, ${entitlement.source || "unknown"},
        ${entitlement.grantedUserID || null}, ${JSON.stringify(entitlement)}::jsonb,
        ${entitlement.expiresAt || null}::timestamptz, now()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        plan = EXCLUDED.plan,
        source = EXCLUDED.source,
        granted_user_id = EXCLUDED.granted_user_id,
        entitlement = EXCLUDED.entitlement,
        expires_at = EXCLUDED.expires_at,
        updated_at = now()
      RETURNING entitlement
    `;
    return safeJSON(rows[0]?.entitlement, entitlement);
  }

  async function deleteEntitlement(userID, expected = {}) {
    let rows;
    if (expected.source && expected.providerKey && expected.providerValue) {
      rows = await sql`
        DELETE FROM permitext_entitlements
        WHERE user_id = ${userID}
          AND source = ${expected.source}
          AND entitlement->'provider'->>${expected.providerKey} = ${expected.providerValue}
        RETURNING user_id
      `;
    } else if (expected.source) {
      rows = await sql`
        DELETE FROM permitext_entitlements
        WHERE user_id = ${userID} AND source = ${expected.source}
        RETURNING user_id
      `;
    } else {
      rows = await sql`
        DELETE FROM permitext_entitlements
        WHERE user_id = ${userID}
        RETURNING user_id
      `;
    }
    return rows.length > 0;
  }

  async function stripeEntitlementOwner(subscriptionID) {
    const rows = await sql`
      SELECT user_id, entitlement
      FROM permitext_entitlements
      WHERE source = 'webSubscription'
        AND entitlement->'provider'->>'stripeSubscriptionID' = ${subscriptionID}
      LIMIT 1
    `;
    if (!rows[0]) return null;
    return {
      userID: rows[0].user_id,
      entitlement: safeJSON(rows[0].entitlement, null)
    };
  }

  async function revoke(userID, rawToken) {
    if (!userID || !rawToken) return false;
    const rows = await sql`
      UPDATE permitext_account_sessions
      SET revoked_at = now()
      WHERE token_hash = ${tokenHash(rawToken)} AND user_id = ${userID} AND revoked_at IS NULL
      RETURNING token_hash
    `;
    await sql`DELETE FROM permitext_sessions WHERE user_id = ${userID} AND session_token = ${rawToken}`;
    return rows.length > 0;
  }

  return {
    authenticate,
    contextForUser,
    deleteEntitlement,
    hasActiveSession,
    revoke,
    saveEntitlement,
    signIn,
    stripeEntitlementOwner,
    updateAccount
  };
}
