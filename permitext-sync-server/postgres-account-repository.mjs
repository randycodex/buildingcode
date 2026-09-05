import { createHash, randomUUID } from "node:crypto";
import { accountMergeHasEntitlementConflict } from "./entitlement-contract.mjs";
import { mergedPolicyAcceptances } from "./policy-acceptance.mjs";
import { accountLinkBusyError } from "./account-lifecycle.mjs";

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

function normalizedAppleBillingAccountToken(value) {
  const token = String(value || "").trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(token)
    ? token
    : null;
}

export function appleBillingAccountTokens(account) {
  return new Set([
    account?.appleBillingAccountToken,
    ...(Array.isArray(account?.appleBillingAccountTokenAliases)
      ? account.appleBillingAccountTokenAliases
      : [])
  ].map(normalizedAppleBillingAccountToken).filter(Boolean));
}

export function mergedAppleBillingAccountTokens(sourceAccount, targetAccount) {
  const sourceTokens = appleBillingAccountTokens(sourceAccount);
  const targetTokens = appleBillingAccountTokens(targetAccount);
  const sourcePrimary = normalizedAppleBillingAccountToken(sourceAccount?.appleBillingAccountToken);
  const targetPrimary = normalizedAppleBillingAccountToken(targetAccount?.appleBillingAccountToken);
  const primary = targetPrimary || sourcePrimary || null;
  const aliases = Array.from(new Set([...targetTokens, ...sourceTokens]))
    .filter((token) => token !== primary)
    .sort();
  return {
    appleBillingAccountToken: primary,
    appleBillingAccountTokenAliases: aliases
  };
}

export function appleSubjectIDs(account) {
  return new Set([
    account?.authProvider === "apple" ? account?.authProviderUserID : null,
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

/** Minimum age of last_seen_at before authenticate rewrites it (hot-path throttle). */
export function accountSessionLastSeenThrottleSeconds(environment = process.env) {
  const configured = Number(environment.PERMITEXT_SESSION_LAST_SEEN_THROTTLE_SECONDS);
  return Number.isSafeInteger(configured) && configured >= 30
    ? configured
    : 5 * 60;
}

export function createPostgresAccountRepository(sql, options = {}) {
  const lastSeenThrottleSeconds = options.lastSeenThrottleSeconds ??
    accountSessionLastSeenThrottleSeconds();

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

  function contextFromAuthRow(row) {
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
    // Single read joins session + account + entitlement. last_seen_at is only
    // rewritten when older than the throttle window (not on every request).
    const rows = await sql`
      SELECT
        sessions.user_id,
        sessions.last_seen_at,
        users.account,
        entitlements.entitlement
      FROM permitext_account_sessions AS sessions
      JOIN permitext_users AS users ON users.id = sessions.user_id
      LEFT JOIN permitext_entitlements AS entitlements ON entitlements.user_id = sessions.user_id
      WHERE sessions.token_hash = ${hash}
        AND sessions.user_id = ${userID}
        AND sessions.revoked_at IS NULL
        AND sessions.expires_at > now()
      LIMIT 1
    `;
    if (rows.length) {
      const row = rows[0];
      const lastSeenMs = Date.parse(row.last_seen_at);
      const stale =
        !Number.isFinite(lastSeenMs) ||
        Date.now() - lastSeenMs >= lastSeenThrottleSeconds * 1000;
      if (stale) {
        await sql`
          UPDATE permitext_account_sessions
          SET last_seen_at = now()
          WHERE token_hash = ${hash}
            AND user_id = ${userID}
            AND revoked_at IS NULL
            AND expires_at > now()
            AND (
              last_seen_at IS NULL OR
              last_seen_at <= now() - (${lastSeenThrottleSeconds} * interval '1 second')
            )
        `;
      }
      return contextFromAuthRow(row);
    }

    const legacyRows = await sql`
      SELECT
        sessions.user_id,
        users.account,
        entitlements.entitlement
      FROM permitext_sessions AS sessions
      JOIN permitext_users AS users ON users.id = sessions.user_id
      LEFT JOIN permitext_entitlements AS entitlements ON entitlements.user_id = sessions.user_id
      WHERE sessions.user_id = ${userID} AND sessions.session_token = ${rawToken}
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
    return contextFromAuthRow(legacyRows[0]);
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

  async function mergeAccounts(sourceUserID, targetUserID, { operationIDsByUserID = {} } = {}) {
    if (!sourceUserID || !targetUserID || sourceUserID === targetUserID) return null;
    const [sourceContext, targetContext] = await Promise.all([
      contextForUser(sourceUserID),
      contextForUser(targetUserID)
    ]);
    if (!sourceContext || !targetContext) return null;
    if (accountMergeHasEntitlementConflict(sourceContext.entitlement, targetContext.entitlement)) {
      return {
        sourceUserID,
        targetUserID,
        movedMutationCount: 0,
        acceptedMutationIDs: [],
        rejectedMutationIDs: [],
        transferredEntitlement: false,
        entitlementConflict: true
      };
    }
    const mergedAppleBillingTokens = mergedAppleBillingAccountTokens(
      sourceContext.account,
      targetContext.account
    );
    const mergedPolicyAcceptanceHistory = mergedPolicyAcceptances(
      sourceContext.account?.policyAcceptances,
      targetContext.account?.policyAcceptances
    );

    // Make both lifecycle rows exist before the Serializable snapshot begins.
    // Locking them in the transaction then detects an operation registered
    // after that snapshot, including one that finished acquiring its parent
    // lock just before the merge acquired its own. An absent lifecycle row
    // must not hide such a writer from the transaction's snapshot.
    await sql`
      INSERT INTO permitext_account_lifecycle (user_id)
      SELECT id FROM permitext_users WHERE id IN (${sourceUserID}, ${targetUserID})
      ORDER BY id
      ON CONFLICT (user_id) DO NOTHING
    `;

    const queries = [
      // The preflight reads happen before the transaction. Lock both identities
      // and fail the whole batch if a concurrent merge already consumed either
      // one; otherwise a later transaction could mint a phantom recovery link.
      sql`
        WITH locked_accounts AS (
          SELECT id FROM permitext_users
          WHERE id IN (${sourceUserID}, ${targetUserID})
          ORDER BY id FOR UPDATE
        )
        SELECT 1 / CASE WHEN count(*) = 2 THEN 1 ELSE 0 END AS identities_present
        FROM locked_accounts
      `,
      sql`
        WITH locked_lifecycle AS (
          SELECT user_id, operations, deletion_id FROM permitext_account_lifecycle
          WHERE user_id IN (${sourceUserID}, ${targetUserID})
          ORDER BY user_id FOR UPDATE
        )
        SELECT 1 / CASE WHEN count(*) = 2 AND bool_and(
          deletion_id IS NULL AND
          (operations - CASE WHEN user_id = ${sourceUserID}
            THEN ${operationIDsByUserID[sourceUserID] || ""}::text
            ELSE ${operationIDsByUserID[targetUserID] || ""}::text END) = '{}'::jsonb
        ) THEN 1 ELSE 0 END AS accounts_idle
        FROM locked_lifecycle
      `,
      sql`
        SELECT record_id
        FROM permitext_user_content_records
        WHERE user_id = ${sourceUserID}
        ORDER BY record_id
      `,
      sql`
        UPDATE permitext_users
        SET public_username = NULL, updated_at = now()
        WHERE id = ${sourceUserID}
      `,
      sql`
        UPDATE permitext_users AS target
        SET public_username = COALESCE(
              target.public_username,
              NULLIF(source.account->>'publicUsername', '')
            ),
            display_name = COALESCE(target.display_name, source.display_name),
            migration_state = 'localDataAttached',
            account = source.account || target.account || jsonb_build_object(
              'appUserID', ${targetUserID}::text,
              'migrationState', 'localDataAttached',
              'mergedAccountIDs',
                COALESCE(target.account->'mergedAccountIDs', '[]'::jsonb) ||
                COALESCE(source.account->'mergedAccountIDs', '[]'::jsonb) ||
                jsonb_build_array(${sourceUserID}::text),
              'linkedAppleUserIDs', (
                SELECT COALESCE(jsonb_agg(DISTINCT identities.subject), '[]'::jsonb)
                FROM (
                  SELECT jsonb_array_elements_text(
                    COALESCE(source.account->'linkedAppleUserIDs', '[]'::jsonb)
                  ) AS subject
                  UNION
                  SELECT jsonb_array_elements_text(
                    COALESCE(target.account->'linkedAppleUserIDs', '[]'::jsonb)
                  ) AS subject
                  UNION SELECT NULLIF(source.auth_provider_user_id, '')
                    WHERE source.auth_provider = 'apple'
                  UNION SELECT NULLIF(source.apple_user_id, '')
                  UNION SELECT NULLIF(target.auth_provider_user_id, '')
                    WHERE target.auth_provider = 'apple'
                  UNION SELECT NULLIF(target.apple_user_id, '')
                ) AS identities
                WHERE identities.subject IS NOT NULL
              ),
              'appleBillingAccountToken', ${mergedAppleBillingTokens.appleBillingAccountToken}::text,
              'appleBillingAccountTokenAliases',
                ${JSON.stringify(mergedAppleBillingTokens.appleBillingAccountTokenAliases)}::jsonb,
              'policyAcceptances',
                ${JSON.stringify(mergedPolicyAcceptanceHistory)}::jsonb
            ),
            updated_at = now()
        FROM permitext_users AS source
        WHERE source.id = ${sourceUserID} AND target.id = ${targetUserID}
      `,
      sql`
        INSERT INTO permitext_entitlements (
          user_id, plan, source, granted_user_id, entitlement, expires_at, updated_at
        )
        SELECT
          ${targetUserID}, plan, source, ${targetUserID},
          entitlement || jsonb_build_object(
            'grantedUserID', ${targetUserID}::text,
            'transferredFromUserID', ${sourceUserID}::text,
            'updatedAt', now()
          ),
          expires_at, now()
        FROM permitext_entitlements
        WHERE user_id = ${sourceUserID}
          AND NOT EXISTS (
            SELECT 1 FROM permitext_entitlements WHERE user_id = ${targetUserID}
          )
        ON CONFLICT (user_id) DO NOTHING
        RETURNING user_id
      `,
      sql`DELETE FROM permitext_entitlements WHERE user_id = ${sourceUserID}`,
      sql`
        UPDATE permitext_apple_transaction_owners
        SET user_id = ${targetUserID}, updated_at = now()
        WHERE user_id = ${sourceUserID}
      `,
      sql`
        WITH moved AS (
          SELECT
            CASE
              WHEN record_id LIKE ${`${sourceUserID}:%`}
                THEN ${targetUserID} || substr(record_id, ${sourceUserID.length + 1})
              ELSE record_id
            END AS next_record_id,
            entity_kind,
            code_version,
            jsonb_set(
              CASE
                WHEN mutation #> ARRAY[entity_kind, 'id'] IS NULL THEN mutation
                ELSE jsonb_set(
                  mutation,
                  ARRAY[entity_kind, 'id'],
                  to_jsonb(
                    CASE
                      WHEN record_id LIKE ${`${sourceUserID}:%`}
                        THEN ${targetUserID} || substr(record_id, ${sourceUserID.length + 1})
                      ELSE record_id
                    END
                  ),
                  true
                )
              END,
              ARRAY[entity_kind, 'userID'],
              to_jsonb(${targetUserID}::text),
              true
            ) AS next_mutation,
            updated_at,
            deleted_at,
            server_version
          FROM permitext_user_content_records
          WHERE user_id = ${sourceUserID}
        )
        INSERT INTO permitext_user_content_records (
          record_id, user_id, entity_kind, code_version, mutation,
          updated_at, deleted_at, server_version
        )
        SELECT
          next_record_id, ${targetUserID}, entity_kind, code_version, next_mutation,
          updated_at, deleted_at, server_version
        FROM moved
        ON CONFLICT (record_id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          entity_kind = EXCLUDED.entity_kind,
          code_version = EXCLUDED.code_version,
          mutation = EXCLUDED.mutation,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at,
          server_version = GREATEST(
            permitext_user_content_records.server_version,
            EXCLUDED.server_version
          ) + 1
        WHERE permitext_user_content_records.updated_at < EXCLUDED.updated_at
      `,
      sql`
        WITH moved AS (
          SELECT
            CASE
              WHEN record_id LIKE ${`${sourceUserID}:%`}
                THEN ${targetUserID} || substr(record_id, ${sourceUserID.length + 1})
              ELSE record_id
            END AS next_record_id,
            code_version, section_id,
            jsonb_set(
              jsonb_set(
                mutation, ARRAY['savedItem', 'userID'], to_jsonb(${targetUserID}::text), true
              ),
              ARRAY['savedItem', 'id'],
              to_jsonb(CASE
                WHEN record_id LIKE ${`${sourceUserID}:%`}
                  THEN ${targetUserID} || substr(record_id, ${sourceUserID.length + 1})
                ELSE record_id
              END),
              true
            ) AS next_mutation,
            updated_at, deleted_at, server_version
          FROM permitext_saved_items
          WHERE user_id = ${sourceUserID}
        )
        INSERT INTO permitext_saved_items (
          record_id, user_id, code_version, section_id, mutation,
          updated_at, deleted_at, server_version
        )
        SELECT
          next_record_id, ${targetUserID}, code_version, section_id, next_mutation,
          updated_at, deleted_at, server_version
        FROM moved
        ON CONFLICT (record_id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          code_version = EXCLUDED.code_version,
          section_id = EXCLUDED.section_id,
          mutation = EXCLUDED.mutation,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at,
          server_version = GREATEST(permitext_saved_items.server_version, EXCLUDED.server_version) + 1
        WHERE permitext_saved_items.updated_at < EXCLUDED.updated_at
      `,
      sql`
        WITH moved AS (
          SELECT
            CASE
              WHEN record_id LIKE ${`${sourceUserID}:%`}
                THEN ${targetUserID} || substr(record_id, ${sourceUserID.length + 1})
              ELSE record_id
            END AS next_record_id,
            code_version, section_id, block_id, note_body, tags,
            jsonb_set(
              jsonb_set(
                mutation, ARRAY['annotation', 'userID'], to_jsonb(${targetUserID}::text), true
              ),
              ARRAY['annotation', 'id'],
              to_jsonb(CASE
                WHEN record_id LIKE ${`${sourceUserID}:%`}
                  THEN ${targetUserID} || substr(record_id, ${sourceUserID.length + 1})
                ELSE record_id
              END),
              true
            ) AS next_mutation,
            updated_at, deleted_at, server_version
          FROM permitext_annotations
          WHERE user_id = ${sourceUserID}
        )
        INSERT INTO permitext_annotations (
          record_id, user_id, code_version, section_id, block_id, note_body, tags,
          mutation, updated_at, deleted_at, server_version
        )
        SELECT
          next_record_id, ${targetUserID}, code_version, section_id, block_id, note_body, tags,
          next_mutation, updated_at, deleted_at, server_version
        FROM moved
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
          server_version = GREATEST(permitext_annotations.server_version, EXCLUDED.server_version) + 1
        WHERE permitext_annotations.updated_at < EXCLUDED.updated_at
      `,
      sql`
        WITH moved AS (
          SELECT
            CASE
              WHEN record_id LIKE ${`${sourceUserID}:%`}
                THEN ${targetUserID} || substr(record_id, ${sourceUserID.length + 1})
              ELSE record_id
            END AS next_record_id,
            code_version, client_id, local_folder_id, name, address, description,
            color_hex, sort_order,
            jsonb_set(
              jsonb_set(
                mutation, ARRAY['project', 'userID'], to_jsonb(${targetUserID}::text), true
              ),
              ARRAY['project', 'id'],
              to_jsonb(CASE
                WHEN record_id LIKE ${`${sourceUserID}:%`}
                  THEN ${targetUserID} || substr(record_id, ${sourceUserID.length + 1})
                ELSE record_id
              END),
              true
            ) AS next_mutation,
            updated_at, deleted_at, server_version
          FROM permitext_projects
          WHERE user_id = ${sourceUserID}
        )
        INSERT INTO permitext_projects (
          record_id, user_id, code_version, client_id, local_folder_id, name,
          address, description, color_hex, sort_order, mutation,
          updated_at, deleted_at, server_version
        )
        SELECT
          next_record_id, ${targetUserID}, code_version, client_id, local_folder_id, name,
          address, description, color_hex, sort_order, next_mutation,
          updated_at, deleted_at, server_version
        FROM moved
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
          server_version = GREATEST(permitext_projects.server_version, EXCLUDED.server_version) + 1
        WHERE permitext_projects.updated_at < EXCLUDED.updated_at
      `,
      sql`
        WITH moved AS (
          SELECT
            CASE
              WHEN record_id LIKE ${`${sourceUserID}:%`}
                THEN ${targetUserID} || substr(record_id, ${sourceUserID.length + 1})
              ELSE record_id
            END AS next_record_id,
            code_version, project_client_id, local_folder_id, section_id, block_id, scope,
            jsonb_set(
              jsonb_set(
                mutation, ARRAY['projectSection', 'userID'], to_jsonb(${targetUserID}::text), true
              ),
              ARRAY['projectSection', 'id'],
              to_jsonb(CASE
                WHEN record_id LIKE ${`${sourceUserID}:%`}
                  THEN ${targetUserID} || substr(record_id, ${sourceUserID.length + 1})
                ELSE record_id
              END),
              true
            ) AS next_mutation,
            updated_at, deleted_at, server_version
          FROM permitext_project_items
          WHERE user_id = ${sourceUserID}
        )
        INSERT INTO permitext_project_items (
          record_id, user_id, code_version, project_client_id, local_folder_id,
          section_id, block_id, scope, mutation, updated_at, deleted_at, server_version
        )
        SELECT
          next_record_id, ${targetUserID}, code_version, project_client_id, local_folder_id,
          section_id, block_id, scope, next_mutation, updated_at, deleted_at, server_version
        FROM moved
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
          server_version = GREATEST(permitext_project_items.server_version, EXCLUDED.server_version) + 1
        WHERE permitext_project_items.updated_at < EXCLUDED.updated_at
      `,
      sql`
        WITH moved AS (
          SELECT
            CASE
              WHEN record_id LIKE ${`${sourceUserID}:%`}
                THEN ${targetUserID} || substr(record_id, ${sourceUserID.length + 1})
              ELSE record_id
            END AS next_record_id,
            code_version, section_id, block_id, body, visibility,
            jsonb_set(
              jsonb_set(
                mutation, ARRAY['comment', 'userID'], to_jsonb(${targetUserID}::text), true
              ),
              ARRAY['comment', 'id'],
              to_jsonb(CASE
                WHEN record_id LIKE ${`${sourceUserID}:%`}
                  THEN ${targetUserID} || substr(record_id, ${sourceUserID.length + 1})
                ELSE record_id
              END),
              true
            ) AS next_mutation,
            updated_at, deleted_at, server_version
          FROM permitext_comments
          WHERE user_id = ${sourceUserID}
        )
        INSERT INTO permitext_comments (
          record_id, user_id, code_version, section_id, block_id, body, visibility,
          mutation, updated_at, deleted_at, server_version
        )
        SELECT
          next_record_id, ${targetUserID}, code_version, section_id, block_id, body, visibility,
          next_mutation, updated_at, deleted_at, server_version
        FROM moved
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
          server_version = GREATEST(permitext_comments.server_version, EXCLUDED.server_version) + 1
        WHERE permitext_comments.updated_at < EXCLUDED.updated_at
      `,
      sql`UPDATE permitext_research_conversations SET user_id = ${targetUserID} WHERE user_id = ${sourceUserID}`,
      sql`UPDATE permitext_research_usage SET user_id = ${targetUserID} WHERE user_id = ${sourceUserID}`,
      sql`UPDATE permitext_research_operations SET user_id = ${targetUserID} WHERE user_id = ${sourceUserID}`,
      sql`
        DELETE FROM permitext_research_feedback AS source
        USING permitext_research_feedback AS target
        WHERE source.user_id = ${sourceUserID}
          AND target.user_id = ${targetUserID}
          AND source.answer_id = target.answer_id
          AND source.updated_at <= target.updated_at
      `,
      sql`
        DELETE FROM permitext_research_feedback AS target
        USING permitext_research_feedback AS source
        WHERE target.user_id = ${targetUserID}
          AND source.user_id = ${sourceUserID}
          AND target.answer_id = source.answer_id
          AND target.updated_at < source.updated_at
      `,
      sql`UPDATE permitext_research_feedback SET user_id = ${targetUserID} WHERE user_id = ${sourceUserID}`,
      sql`
        UPDATE permitext_foundation_artifacts
        SET user_id = ${targetUserID},
            envelope = CASE
              WHEN envelope #>> '{owner,kind}' = 'user'
                THEN jsonb_set(envelope, '{owner,id}', to_jsonb(${targetUserID}::text), true)
              ELSE envelope
            END
        WHERE user_id = ${sourceUserID}
      `,
      sql`
        UPDATE permitext_project_links
        SET user_id = ${targetUserID},
            link = CASE
              WHEN link #>> '{owner,kind}' = 'user'
                THEN jsonb_set(link, '{owner,id}', to_jsonb(${targetUserID}::text), true)
              ELSE link
            END
        WHERE user_id = ${sourceUserID}
      `,
      sql`
        UPDATE permitext_research_answers
        SET user_id = ${targetUserID},
            answer = CASE
              WHEN answer #>> '{owner,kind}' = 'user'
                THEN jsonb_set(answer, '{owner,id}', to_jsonb(${targetUserID}::text), true)
              ELSE answer
            END
        WHERE user_id = ${sourceUserID}
      `,
      sql`UPDATE permitext_evidence_snapshots SET user_id = ${targetUserID} WHERE user_id = ${sourceUserID}`,
      sql`
        UPDATE permitext_project_activity
        SET user_id = ${targetUserID},
            event = CASE
              WHEN event #>> '{owner,kind}' = 'user'
                THEN jsonb_set(event, '{owner,id}', to_jsonb(${targetUserID}::text), true)
              ELSE event
            END
        WHERE user_id = ${sourceUserID}
      `,
      sql`
        INSERT INTO permitext_migration_checkpoints (user_id, checkpoint_name, checkpoint, updated_at)
        VALUES (
          ${targetUserID}, 'confirmed-account-link-recovery-v1',
          jsonb_build_object('sourceUserIDs', (
            SELECT COALESCE(jsonb_agg(DISTINCT ancestors.user_id), '[]'::jsonb)
            FROM (
              SELECT jsonb_array_elements_text(checkpoint->'sourceUserIDs') AS user_id
              FROM permitext_migration_checkpoints
              WHERE user_id IN (${sourceUserID}, ${targetUserID})
                AND checkpoint_name = 'confirmed-account-link-recovery-v1'
              UNION ALL SELECT ${sourceUserID}::text
            ) AS ancestors
            WHERE ancestors.user_id <> ${targetUserID}
          )), now()
        )
        ON CONFLICT (user_id, checkpoint_name) DO UPDATE SET
          checkpoint = EXCLUDED.checkpoint, updated_at = now()
      `,
      sql`
        DELETE FROM permitext_migration_checkpoints AS source
        USING permitext_migration_checkpoints AS target
        WHERE source.user_id = ${sourceUserID}
          AND target.user_id = ${targetUserID}
          AND source.checkpoint_name = target.checkpoint_name
      `,
      sql`UPDATE permitext_migration_checkpoints SET user_id = ${targetUserID} WHERE user_id = ${sourceUserID}`,
      sql`UPDATE permitext_passkey_credentials SET user_id = ${targetUserID}, updated_at = now() WHERE user_id = ${sourceUserID}`,
      sql`DELETE FROM permitext_account_sessions WHERE user_id = ${sourceUserID}`,
      sql`DELETE FROM permitext_sessions WHERE user_id = ${sourceUserID}`,
      sql`DELETE FROM permitext_sync_events WHERE user_id = ${sourceUserID}`,
      sql`DELETE FROM permitext_saved_items WHERE user_id = ${sourceUserID}`,
      sql`DELETE FROM permitext_annotations WHERE user_id = ${sourceUserID}`,
      sql`DELETE FROM permitext_projects WHERE user_id = ${sourceUserID}`,
      sql`DELETE FROM permitext_project_items WHERE user_id = ${sourceUserID}`,
      sql`DELETE FROM permitext_comments WHERE user_id = ${sourceUserID}`,
      sql`DELETE FROM permitext_user_content_records WHERE user_id = ${sourceUserID}`,
      sql`
        INSERT INTO permitext_sync_events (
          record_id, user_id, entity_kind, code_version, mutation_updated_at, mutation
        )
        SELECT
          record_id, user_id, entity_kind, code_version, updated_at, mutation
        FROM permitext_user_content_records
        WHERE user_id = ${targetUserID}
        ON CONFLICT (record_id, mutation_updated_at) DO NOTHING
      `,
      sql`DELETE FROM permitext_users WHERE id = ${sourceUserID}`
    ];
    const additionalMergeQueries = typeof options.mergeUserQueries === "function"
      ? options.mergeUserQueries(sourceUserID, targetUserID)
      : [];
    if (additionalMergeQueries?.length) {
      queries.splice(queries.length - 1, 0, ...additionalMergeQueries);
    }

    let results;
    try {
      results = await sql.transaction(queries, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error?.code === "40001") throw accountLinkBusyError();
      if (error?.code === "22012") {
        // Either the identity or operation guard rolled back the whole batch.
        // A consumed identity remains a missing-source result; retained
        // identities tell callers to retry linking after their other work.
        const remaining = await sql`SELECT id FROM permitext_users WHERE id IN (${sourceUserID}, ${targetUserID})`;
        if (remaining.length === 2) throw accountLinkBusyError();
        return null;
      }
      throw error;
    }
    const sourceRows = results[2] || [];
    const acceptedMutationIDs = sourceRows.map(({ record_id: recordID }) =>
      recordID.startsWith(`${sourceUserID}:`)
        ? `${targetUserID}:${recordID.slice(sourceUserID.length + 1)}`
        : recordID
    );
    return {
      sourceUserID,
      targetUserID,
      movedMutationCount: sourceRows.length,
      acceptedMutationIDs,
      rejectedMutationIDs: [],
      transferredEntitlement: Boolean(results[5]?.length)
    };
  }

  async function signIn(account, mergeOptions = {}) {
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
      const mergedAccount = await mergeAccounts(exact.id, preferredAlternative.id, mergeOptions);
      if (mergedAccount?.entitlementConflict) {
        return {
          account: null,
          entitlement: null,
          mergedAccount,
          requiresLegacyMerge: true,
          mergeConflictCode: "ACCOUNT_ENTITLEMENT_CONFLICT"
        };
      }
      return signIn(account, mergeOptions);
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

  async function claimAppleEntitlement(
    userID,
    originalTransactionID,
    entitlement,
    transactionSignedDate = 0
  ) {
    const [ownerRows, entitlementRows] = await sql.transaction([
      sql`
        INSERT INTO permitext_apple_transaction_owners (
          original_transaction_id,
          user_id,
          updated_at
        )
        VALUES (${originalTransactionID}, ${userID}, now())
        ON CONFLICT (original_transaction_id) DO UPDATE SET
          updated_at = now()
        WHERE permitext_apple_transaction_owners.user_id = EXCLUDED.user_id
        RETURNING user_id
      `,
      sql`
        INSERT INTO permitext_entitlements (
          user_id, plan, source, granted_user_id, entitlement, expires_at, updated_at
        )
        SELECT
          ${userID}, ${entitlement.plan || "free"}, ${entitlement.source || "unknown"},
          ${entitlement.grantedUserID || null}, ${JSON.stringify(entitlement)}::jsonb,
          ${entitlement.expiresAt || null}::timestamptz, now()
        WHERE EXISTS (
          SELECT 1
          FROM permitext_apple_transaction_owners
          WHERE original_transaction_id = ${originalTransactionID}
            AND user_id = ${userID}
        )
          AND NOT EXISTS (
            SELECT 1
            FROM permitext_apple_notification_states
            WHERE original_transaction_id = ${originalTransactionID}
              AND (
                ${transactionSignedDate}::bigint <= 0
                OR signed_date >= ${transactionSignedDate}::bigint
              )
          )
        ON CONFLICT (user_id) DO UPDATE SET
          plan = EXCLUDED.plan,
          source = EXCLUDED.source,
          granted_user_id = EXCLUDED.granted_user_id,
          entitlement = EXCLUDED.entitlement,
          expires_at = EXCLUDED.expires_at,
          updated_at = now()
        RETURNING entitlement
      `
    ], { isolationLevel: "ReadCommitted" });
    if (!ownerRows.length || !entitlementRows.length) return null;
    return safeJSON(entitlementRows[0].entitlement, entitlement);
  }

  async function appleTransactionOwner(originalTransactionID) {
    const rows = await sql`
      SELECT user_id
      FROM permitext_apple_transaction_owners
      WHERE original_transaction_id = ${originalTransactionID}
      LIMIT 1
    `;
    return rows[0]?.user_id || null;
  }

  async function appleNotificationState(originalTransactionID) {
    const rows = await sql`
      SELECT signed_date, notification_uuid, notification_type
      FROM permitext_apple_notification_states
      WHERE original_transaction_id = ${originalTransactionID}
      LIMIT 1
    `;
    if (!rows.length) return null;
    return {
      signedDate: Number(rows[0].signed_date),
      notificationUUID: rows[0].notification_uuid,
      notificationType: rows[0].notification_type
    };
  }

  async function applyAppleNotification({
    userID,
    originalTransactionID,
    signedDate,
    notificationUUID,
    notificationType,
    nextEntitlement
  }) {
    if (nextEntitlement) {
      const entitlementRows = await sql`
        WITH applied AS (
          INSERT INTO permitext_apple_notification_states (
            original_transaction_id, signed_date, notification_uuid, notification_type, updated_at
          )
          VALUES (
            ${originalTransactionID}, ${signedDate}, ${notificationUUID}, ${notificationType}, now()
          )
          ON CONFLICT (original_transaction_id) DO UPDATE SET
            signed_date = EXCLUDED.signed_date,
            notification_uuid = EXCLUDED.notification_uuid,
            notification_type = EXCLUDED.notification_type,
            updated_at = now()
          WHERE permitext_apple_notification_states.signed_date < EXCLUDED.signed_date
          RETURNING original_transaction_id
        )
        INSERT INTO permitext_entitlements (
          user_id, plan, source, granted_user_id, entitlement, expires_at, updated_at
        )
        SELECT
          ${userID}, ${nextEntitlement.plan || "free"}, ${nextEntitlement.source || "unknown"},
          ${nextEntitlement.grantedUserID || null}, ${JSON.stringify(nextEntitlement)}::jsonb,
          ${nextEntitlement.expiresAt || null}::timestamptz, now()
        FROM applied
        ON CONFLICT (user_id) DO UPDATE SET
          plan = EXCLUDED.plan,
          source = EXCLUDED.source,
          granted_user_id = EXCLUDED.granted_user_id,
          entitlement = EXCLUDED.entitlement,
          expires_at = EXCLUDED.expires_at,
          updated_at = now()
        RETURNING entitlement
      `;
      return {
        applied: entitlementRows.length > 0,
        entitlement: entitlementRows[0]?.entitlement
          ? safeJSON(entitlementRows[0].entitlement, nextEntitlement)
          : null
      };
    }
    const rows = await sql`
      WITH applied AS (
        INSERT INTO permitext_apple_notification_states (
          original_transaction_id, signed_date, notification_uuid, notification_type, updated_at
        )
        VALUES (
          ${originalTransactionID}, ${signedDate}, ${notificationUUID}, ${notificationType}, now()
        )
        ON CONFLICT (original_transaction_id) DO UPDATE SET
          signed_date = EXCLUDED.signed_date,
          notification_uuid = EXCLUDED.notification_uuid,
          notification_type = EXCLUDED.notification_type,
          updated_at = now()
        WHERE permitext_apple_notification_states.signed_date < EXCLUDED.signed_date
        RETURNING original_transaction_id
      ), removed AS (
        DELETE FROM permitext_entitlements
        WHERE user_id = ${userID}
          AND EXISTS (SELECT 1 FROM applied)
        RETURNING user_id
      )
      SELECT
        EXISTS (SELECT 1 FROM applied) AS applied,
        EXISTS (SELECT 1 FROM removed) AS removed
    `;
    return {
      applied: Boolean(rows[0]?.applied),
      entitlement: null,
      removed: Boolean(rows[0]?.removed)
    };
  }

  async function applyStripeSubscriptionEvent({
    userID,
    subscriptionID,
    packageID,
    eventCreatedAt,
    eventID,
    eventType,
    terminal,
    nextEntitlement
  }) {
    if (nextEntitlement) {
      const rows = await sql`
        WITH applied AS (
          INSERT INTO permitext_stripe_subscription_event_states (
            subscription_id, user_id, package_id, event_created_at,
            event_id, event_type, terminal, updated_at
          )
          VALUES (
            ${subscriptionID}, ${userID}, ${packageID}, ${eventCreatedAt}::timestamptz,
            ${eventID}, ${eventType}, ${terminal}, now()
          )
          ON CONFLICT (subscription_id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            package_id = EXCLUDED.package_id,
            event_created_at = EXCLUDED.event_created_at,
            event_id = EXCLUDED.event_id,
            event_type = EXCLUDED.event_type,
            terminal = EXCLUDED.terminal,
            updated_at = now()
          WHERE permitext_stripe_subscription_event_states.user_id = EXCLUDED.user_id
            AND (
              permitext_stripe_subscription_event_states.event_created_at < EXCLUDED.event_created_at
              OR (
                permitext_stripe_subscription_event_states.event_created_at = EXCLUDED.event_created_at
                AND permitext_stripe_subscription_event_states.event_id <> EXCLUDED.event_id
                AND permitext_stripe_subscription_event_states.terminal = false
              )
            )
          RETURNING subscription_id
        ), saved AS (
          INSERT INTO permitext_entitlements (
            user_id, plan, source, granted_user_id, entitlement, expires_at, updated_at
          )
          SELECT
            ${userID}, ${nextEntitlement.plan || "free"}, ${nextEntitlement.source || "unknown"},
            ${nextEntitlement.grantedUserID || null}, ${JSON.stringify(nextEntitlement)}::jsonb,
            ${nextEntitlement.expiresAt || null}::timestamptz, now()
          FROM applied
          ON CONFLICT (user_id) DO UPDATE SET
            plan = EXCLUDED.plan,
            source = EXCLUDED.source,
            granted_user_id = EXCLUDED.granted_user_id,
            entitlement = EXCLUDED.entitlement,
            expires_at = EXCLUDED.expires_at,
            updated_at = now()
          RETURNING entitlement
        )
        SELECT
          EXISTS (SELECT 1 FROM applied) AS applied,
          (SELECT entitlement FROM saved LIMIT 1) AS entitlement
      `;
      const row = rows[0] || {};
      return {
        applied: Boolean(row.applied),
        entitlement: row.entitlement ? safeJSON(row.entitlement, nextEntitlement) : null,
        removed: false
      };
    }

    const rows = await sql`
      WITH applied AS (
        INSERT INTO permitext_stripe_subscription_event_states (
          subscription_id, user_id, package_id, event_created_at,
          event_id, event_type, terminal, updated_at
        )
        VALUES (
          ${subscriptionID}, ${userID}, ${packageID}, ${eventCreatedAt}::timestamptz,
          ${eventID}, ${eventType}, ${terminal}, now()
        )
        ON CONFLICT (subscription_id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          package_id = EXCLUDED.package_id,
          event_created_at = EXCLUDED.event_created_at,
          event_id = EXCLUDED.event_id,
          event_type = EXCLUDED.event_type,
          terminal = EXCLUDED.terminal,
          updated_at = now()
        WHERE permitext_stripe_subscription_event_states.user_id = EXCLUDED.user_id
          AND (
            permitext_stripe_subscription_event_states.event_created_at < EXCLUDED.event_created_at
            OR (
              permitext_stripe_subscription_event_states.event_created_at = EXCLUDED.event_created_at
              AND permitext_stripe_subscription_event_states.event_id <> EXCLUDED.event_id
              AND permitext_stripe_subscription_event_states.terminal = false
            )
          )
        RETURNING subscription_id
      ), removed AS (
        DELETE FROM permitext_entitlements
        WHERE user_id = ${userID}
          AND source = 'webSubscription'
          AND entitlement->'provider'->>'stripeSubscriptionID' = ${subscriptionID}
          AND EXISTS (SELECT 1 FROM applied)
        RETURNING user_id
      )
      SELECT
        EXISTS (SELECT 1 FROM applied) AS applied,
        EXISTS (SELECT 1 FROM removed) AS removed
    `;
    const row = rows[0] || {};
    return {
      applied: Boolean(row.applied),
      entitlement: null,
      removed: Boolean(row.removed)
    };
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
      WHERE (
        source = 'webSubscription'
        AND entitlement->'provider'->>'stripeSubscriptionID' = ${subscriptionID}
      ) OR (
        entitlement->'addOns'->'research'->>'source' = 'webSubscription'
        AND entitlement->'addOns'->'research'->'provider'->>'stripeSubscriptionID' = ${subscriptionID}
      )
      LIMIT 1
    `;
    if (!rows[0]) return null;
    return {
      userID: rows[0].user_id,
      entitlement: safeJSON(rows[0].entitlement, null)
    };
  }

  async function deleteLegacyPasskeyAccounts() {
    const rows = await sql`
      SELECT id FROM permitext_users
      WHERE id LIKE 'passkey:%'
      ORDER BY id
    `;
    const deletedUserIDs = rows.map((row) => row.id);
    if (!deletedUserIDs.length) return [];

    await sql.transaction([
      sql`DELETE FROM permitext_sync_events WHERE user_id LIKE 'passkey:%'`,
      sql`DELETE FROM permitext_saved_items WHERE user_id LIKE 'passkey:%'`,
      sql`DELETE FROM permitext_annotations WHERE user_id LIKE 'passkey:%'`,
      sql`DELETE FROM permitext_projects WHERE user_id LIKE 'passkey:%'`,
      sql`DELETE FROM permitext_project_items WHERE user_id LIKE 'passkey:%'`,
      sql`DELETE FROM permitext_comments WHERE user_id LIKE 'passkey:%'`,
      sql`DELETE FROM permitext_evidence_snapshots WHERE user_id LIKE 'passkey:%'`,
      sql`DELETE FROM permitext_research_answers WHERE user_id LIKE 'passkey:%'`,
      sql`DELETE FROM permitext_project_activity WHERE user_id LIKE 'passkey:%'`,
      sql`DELETE FROM permitext_project_links WHERE user_id LIKE 'passkey:%'`,
      sql`DELETE FROM permitext_foundation_artifacts WHERE user_id LIKE 'passkey:%'`,
      sql`DELETE FROM permitext_migration_checkpoints WHERE user_id LIKE 'passkey:%'`,
      sql`DELETE FROM permitext_research_feedback WHERE user_id LIKE 'passkey:%'`,
      sql`DELETE FROM permitext_research_usage WHERE user_id LIKE 'passkey:%'`,
      sql`DELETE FROM permitext_research_operations WHERE user_id LIKE 'passkey:%'`,
      sql`DELETE FROM permitext_research_conversations WHERE user_id LIKE 'passkey:%'`,
      sql`DELETE FROM permitext_user_content_records WHERE user_id LIKE 'passkey:%'`,
      sql`DELETE FROM permitext_account_sessions WHERE user_id LIKE 'passkey:%'`,
      sql`DELETE FROM permitext_sessions WHERE user_id LIKE 'passkey:%'`,
      sql`DELETE FROM permitext_entitlements WHERE user_id LIKE 'passkey:%'`,
      sql`DELETE FROM permitext_passkey_credentials WHERE user_id LIKE 'passkey:%'`,
      sql`DELETE FROM permitext_users WHERE id LIKE 'passkey:%'`
    ]);
    return deletedUserIDs;
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
    applyAppleNotification,
    applyStripeSubscriptionEvent,
    appleNotificationState,
    appleTransactionOwner,
    authenticate,
    claimAppleEntitlement,
    contextForUser,
    deleteEntitlement,
    deleteLegacyPasskeyAccounts,
    hasActiveSession,
    mergeAccounts,
    revoke,
    saveEntitlement,
    signIn,
    stripeEntitlementOwner,
    updateAccount
  };
}
