function safeJSON(value, fallback) {
  if (value === null || value === undefined) return fallback;
  return typeof value === "string" ? JSON.parse(value) : value;
}

async function withSerializableRetry(operation) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (error?.code !== "40001" || attempt === 3) throw error;
    }
  }
  throw new Error("Serializable organization mutation did not complete.");
}

export function createPostgresOrganizationRepository(sql) {
  return {
    mergeUserQueries(sourceUserID, targetUserID) {
      return [
        sql`
          UPDATE permitext_organizations
          SET owner_user_id = ${targetUserID},
              organization = jsonb_set(
                organization,
                '{ownerUserID}',
                to_jsonb(${targetUserID}::text),
                true
              ),
              updated_at = now()
          WHERE owner_user_id = ${sourceUserID}
        `,
        sql`
          UPDATE permitext_organization_memberships AS target
          SET role = CASE
                WHEN CASE source.role
                  WHEN 'owner' THEN 4 WHEN 'editor' THEN 3
                  WHEN 'reviewer' THEN 2 ELSE 1
                END > CASE target.role
                  WHEN 'owner' THEN 4 WHEN 'editor' THEN 3
                  WHEN 'reviewer' THEN 2 ELSE 1
                END
                  THEN source.role
                ELSE target.role
              END,
              status = CASE
                WHEN source.status = 'active' OR target.status = 'active' THEN 'active'
                ELSE 'deactivated'
              END,
              membership = jsonb_set(
                jsonb_set(
                  CASE
                    WHEN CASE source.role
                      WHEN 'owner' THEN 4 WHEN 'editor' THEN 3
                      WHEN 'reviewer' THEN 2 ELSE 1
                    END > CASE target.role
                      WHEN 'owner' THEN 4 WHEN 'editor' THEN 3
                      WHEN 'reviewer' THEN 2 ELSE 1
                    END
                      THEN source.membership
                    ELSE target.membership
                  END,
                  '{id}',
                  to_jsonb(target.id),
                  true
                ),
                '{userID}',
                to_jsonb(${targetUserID}::text),
                true
              ),
              updated_at = GREATEST(source.updated_at, target.updated_at),
              deactivated_at = CASE
                WHEN source.status = 'active' OR target.status = 'active' THEN NULL
                ELSE GREATEST(source.deactivated_at, target.deactivated_at)
              END
          FROM permitext_organization_memberships AS source
          WHERE source.user_id = ${sourceUserID}
            AND target.user_id = ${targetUserID}
            AND source.organization_id = target.organization_id
        `,
        sql`
          DELETE FROM permitext_organization_memberships AS source
          USING permitext_organization_memberships AS target
          WHERE source.user_id = ${sourceUserID}
            AND target.user_id = ${targetUserID}
            AND source.organization_id = target.organization_id
        `,
        sql`
          UPDATE permitext_organization_memberships
          SET user_id = ${targetUserID},
              membership = jsonb_set(
                membership,
                '{userID}',
                to_jsonb(${targetUserID}::text),
                true
              ),
              updated_at = now()
          WHERE user_id = ${sourceUserID}
        `,
        sql`
          UPDATE permitext_project_memberships AS target
          SET role = CASE
                WHEN CASE source.role
                  WHEN 'owner' THEN 4 WHEN 'editor' THEN 3
                  WHEN 'reviewer' THEN 2 ELSE 1
                END > CASE target.role
                  WHEN 'owner' THEN 4 WHEN 'editor' THEN 3
                  WHEN 'reviewer' THEN 2 ELSE 1
                END
                  THEN source.role
                ELSE target.role
              END,
              status = CASE
                WHEN source.status = 'active' OR target.status = 'active' THEN 'active'
                ELSE 'deactivated'
              END,
              membership = jsonb_set(
                jsonb_set(
                  CASE
                    WHEN CASE source.role
                      WHEN 'owner' THEN 4 WHEN 'editor' THEN 3
                      WHEN 'reviewer' THEN 2 ELSE 1
                    END > CASE target.role
                      WHEN 'owner' THEN 4 WHEN 'editor' THEN 3
                      WHEN 'reviewer' THEN 2 ELSE 1
                    END
                      THEN source.membership
                    ELSE target.membership
                  END,
                  '{id}',
                  to_jsonb(target.id),
                  true
                ),
                '{userID}',
                to_jsonb(${targetUserID}::text),
                true
              ),
              updated_at = GREATEST(source.updated_at, target.updated_at),
              deactivated_at = CASE
                WHEN source.status = 'active' OR target.status = 'active' THEN NULL
                ELSE GREATEST(source.deactivated_at, target.deactivated_at)
              END
          FROM permitext_project_memberships AS source
          WHERE source.user_id = ${sourceUserID}
            AND target.user_id = ${targetUserID}
            AND source.project_id = target.project_id
        `,
        sql`
          DELETE FROM permitext_project_memberships AS source
          USING permitext_project_memberships AS target
          WHERE source.user_id = ${sourceUserID}
            AND target.user_id = ${targetUserID}
            AND source.project_id = target.project_id
        `,
        sql`
          UPDATE permitext_project_memberships
          SET user_id = ${targetUserID},
              membership = jsonb_set(
                membership,
                '{userID}',
                to_jsonb(${targetUserID}::text),
                true
              ),
              updated_at = now()
          WHERE user_id = ${sourceUserID}
        `,
        sql`
          UPDATE permitext_organization_invitations
          SET invited_user_id = CASE
                WHEN invited_user_id = ${sourceUserID} THEN ${targetUserID}
                ELSE invited_user_id
              END,
              invitation = jsonb_set(
                jsonb_set(
                  jsonb_set(
                    invitation,
                    '{invitedUserID}',
                    CASE
                      WHEN invitation->>'invitedUserID' = ${sourceUserID}
                        THEN to_jsonb(${targetUserID}::text)
                      ELSE COALESCE(invitation->'invitedUserID', 'null'::jsonb)
                    END,
                    true
                  ),
                  '{invitedByUserID}',
                  CASE
                    WHEN invitation->>'invitedByUserID' = ${sourceUserID}
                      THEN to_jsonb(${targetUserID}::text)
                    ELSE COALESCE(invitation->'invitedByUserID', 'null'::jsonb)
                  END,
                  true
                ),
                '{acceptedByUserID}',
                CASE
                  WHEN invitation->>'acceptedByUserID' = ${sourceUserID}
                    THEN to_jsonb(${targetUserID}::text)
                  ELSE COALESCE(invitation->'acceptedByUserID', 'null'::jsonb)
                END,
                true
              ),
              updated_at = now()
          WHERE invited_user_id = ${sourceUserID}
             OR invitation->>'invitedByUserID' = ${sourceUserID}
             OR invitation->>'acceptedByUserID' = ${sourceUserID}
        `,
        sql`
          UPDATE permitext_project_ownerships
          SET owner_id = CASE
                WHEN owner_kind = 'user' AND owner_id = ${sourceUserID}
                  THEN ${targetUserID}
                ELSE owner_id
              END,
              storage_owner_user_id = CASE
                WHEN storage_owner_user_id = ${sourceUserID}
                  THEN ${targetUserID}
                ELSE storage_owner_user_id
              END,
              ownership = jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      ownership,
                      '{storageOwnerUserID}',
                      CASE
                        WHEN ownership->>'storageOwnerUserID' = ${sourceUserID}
                          THEN to_jsonb(${targetUserID}::text)
                        ELSE ownership->'storageOwnerUserID'
                      END,
                      true
                    ),
                    '{originalOwnerUserID}',
                    CASE
                      WHEN ownership->>'originalOwnerUserID' = ${sourceUserID}
                        THEN to_jsonb(${targetUserID}::text)
                      ELSE ownership->'originalOwnerUserID'
                    END,
                    true
                  ),
                  '{transferredByUserID}',
                  CASE
                    WHEN ownership->>'transferredByUserID' = ${sourceUserID}
                      THEN to_jsonb(${targetUserID}::text)
                    ELSE COALESCE(ownership->'transferredByUserID', 'null'::jsonb)
                  END,
                  true
                ),
                '{owner,id}',
                CASE
                  WHEN ownership #>> '{owner,kind}' = 'user'
                    AND ownership #>> '{owner,id}' = ${sourceUserID}
                    THEN to_jsonb(${targetUserID}::text)
                  ELSE ownership #> '{owner,id}'
                END,
                true
              ),
              updated_at = now()
          WHERE owner_id = ${sourceUserID}
             OR storage_owner_user_id = ${sourceUserID}
             OR ownership->>'originalOwnerUserID' = ${sourceUserID}
             OR ownership->>'transferredByUserID' = ${sourceUserID}
        `
      ];
    },

    async initialize() {
      await sql`
        CREATE TABLE IF NOT EXISTS permitext_organizations (
          id TEXT PRIMARY KEY,
          owner_user_id TEXT NOT NULL,
          slug TEXT NOT NULL,
          status TEXT NOT NULL,
          organization JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS permitext_organizations_slug_idx
        ON permitext_organizations (slug)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS permitext_organizations_owner_idx
        ON permitext_organizations (owner_user_id, updated_at DESC)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS permitext_organization_memberships (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          role TEXT NOT NULL,
          status TEXT NOT NULL,
          membership JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          deactivated_at TIMESTAMPTZ
        )
      `;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS permitext_organization_memberships_org_user_idx
        ON permitext_organization_memberships (organization_id, user_id)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS permitext_organization_memberships_user_idx
        ON permitext_organization_memberships (user_id, status, updated_at DESC)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS permitext_organization_invitations (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          project_id TEXT,
          token_hash TEXT NOT NULL,
          invited_email TEXT,
          invited_user_id TEXT,
          role TEXT NOT NULL,
          status TEXT NOT NULL,
          invitation JSONB NOT NULL DEFAULT '{}'::jsonb,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS permitext_organization_invitations_token_idx
        ON permitext_organization_invitations (token_hash)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS permitext_organization_invitations_org_idx
        ON permitext_organization_invitations (organization_id, status, updated_at DESC)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS permitext_project_ownerships (
          project_id TEXT PRIMARY KEY,
          owner_kind TEXT NOT NULL,
          owner_id TEXT NOT NULL,
          organization_id TEXT,
          storage_owner_user_id TEXT NOT NULL,
          ownership JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS permitext_project_ownerships_org_idx
        ON permitext_project_ownerships (organization_id, updated_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS permitext_project_ownerships_storage_owner_idx
        ON permitext_project_ownerships (storage_owner_user_id, updated_at DESC)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS permitext_project_memberships (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          role TEXT NOT NULL,
          status TEXT NOT NULL,
          membership JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          deactivated_at TIMESTAMPTZ
        )
      `;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS permitext_project_memberships_project_user_idx
        ON permitext_project_memberships (project_id, user_id)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS permitext_project_memberships_user_idx
        ON permitext_project_memberships (user_id, status, updated_at DESC)
      `;
    },

    async organization(organizationID) {
      const rows = await sql`
        SELECT organization
        FROM permitext_organizations
        WHERE id = ${organizationID}
        LIMIT 1
      `;
      return safeJSON(rows[0]?.organization, null);
    },

    async organizationBySlug(slug) {
      const rows = await sql`
        SELECT organization
        FROM permitext_organizations
        WHERE slug = ${slug}
        LIMIT 1
      `;
      return safeJSON(rows[0]?.organization, null);
    },

    async listOrganizationsForUser(userID) {
      const rows = await sql`
        SELECT organizations.organization, memberships.membership
        FROM permitext_organization_memberships AS memberships
        JOIN permitext_organizations AS organizations
          ON organizations.id = memberships.organization_id
        WHERE memberships.user_id = ${userID}
          AND memberships.status = 'active'
          AND organizations.status = 'active'
        ORDER BY organizations.updated_at DESC
      `;
      return rows.map((row) => ({
        organization: safeJSON(row.organization, {}),
        membership: safeJSON(row.membership, {})
      }));
    },

    async saveOrganization(organization) {
      await sql`
        INSERT INTO permitext_organizations (
          id, owner_user_id, slug, status, organization, created_at, updated_at
        )
        VALUES (
          ${organization.id}, ${organization.ownerUserID}, ${organization.slug},
          ${organization.status}, ${JSON.stringify(organization)}::jsonb,
          ${organization.createdAt}::timestamptz, ${organization.updatedAt}::timestamptz
        )
        ON CONFLICT (id) DO UPDATE SET
          owner_user_id = EXCLUDED.owner_user_id,
          slug = EXCLUDED.slug,
          status = EXCLUDED.status,
          organization = EXCLUDED.organization,
          updated_at = EXCLUDED.updated_at
        WHERE permitext_organizations.updated_at <= EXCLUDED.updated_at
      `;
      return organization;
    },

    async deleteOrganization(organizationID, ownerUserID, updatedAt) {
      const results = await sql.transaction([
        sql`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${organizationID}, 20260726)
          )
        `,
        sql`
          DELETE FROM permitext_project_memberships
          WHERE project_id IN (
            SELECT project_id
            FROM permitext_project_ownerships
            WHERE organization_id = ${organizationID}
          )
            AND EXISTS (
              SELECT 1
              FROM permitext_organizations
              WHERE id = ${organizationID}
                AND owner_user_id = ${ownerUserID}
            )
        `,
        sql`
          DELETE FROM permitext_organization_invitations
          WHERE organization_id = ${organizationID}
            AND EXISTS (
              SELECT 1
              FROM permitext_organizations
              WHERE id = ${organizationID}
                AND owner_user_id = ${ownerUserID}
            )
        `,
        sql`
          DELETE FROM permitext_organization_memberships
          WHERE organization_id = ${organizationID}
            AND EXISTS (
              SELECT 1
              FROM permitext_organizations
              WHERE id = ${organizationID}
                AND owner_user_id = ${ownerUserID}
            )
        `,
        sql`
          UPDATE permitext_project_ownerships
          SET owner_kind = 'user',
              owner_id = COALESCE(
                NULLIF(ownership->>'originalOwnerUserID', ''),
                storage_owner_user_id,
                ${ownerUserID}
              ),
              organization_id = NULL,
              ownership = jsonb_set(
                jsonb_set(
                  jsonb_set(
                    ownership,
                    '{owner}',
                    jsonb_build_object(
                      'kind', 'user',
                      'id', COALESCE(
                        NULLIF(ownership->>'originalOwnerUserID', ''),
                        storage_owner_user_id,
                        ${ownerUserID}
                      ),
                      'organizationID', NULL
                    ),
                    true
                  ),
                  '{transferredByUserID}',
                  'null'::jsonb,
                  true
                ),
                '{updatedAt}',
                to_jsonb(${updatedAt}::text),
                true
              ),
              updated_at = ${updatedAt}::timestamptz
          WHERE organization_id = ${organizationID}
            AND EXISTS (
              SELECT 1
              FROM permitext_organizations
              WHERE id = ${organizationID}
                AND owner_user_id = ${ownerUserID}
            )
          RETURNING project_id
        `,
        sql`
          DELETE FROM permitext_organizations
          WHERE id = ${organizationID}
            AND owner_user_id = ${ownerUserID}
          RETURNING id
        `
      ]);
      const restoredProjects = results[4] || [];
      const deletedOrganizations = results[5] || [];
      return {
        outcome: deletedOrganizations.length ? "deleted" : "not_found",
        restoredProjectIDs: restoredProjects.map((row) => row.project_id)
      };
    },

    async membership(organizationID, userID) {
      const rows = await sql`
        SELECT membership
        FROM permitext_organization_memberships
        WHERE organization_id = ${organizationID} AND user_id = ${userID}
        LIMIT 1
      `;
      return safeJSON(rows[0]?.membership, null);
    },

    async listOrganizationMemberships(organizationID) {
      const rows = await sql`
        SELECT membership
        FROM permitext_organization_memberships
        WHERE organization_id = ${organizationID}
        ORDER BY created_at ASC
      `;
      return rows.map((row) => safeJSON(row.membership, {}));
    },

    async saveOrganizationMembership(membership) {
      await sql`
        INSERT INTO permitext_organization_memberships (
          id, organization_id, user_id, role, status, membership,
          created_at, updated_at, deactivated_at
        )
        VALUES (
          ${membership.id}, ${membership.organizationID}, ${membership.userID},
          ${membership.role}, ${membership.status}, ${JSON.stringify(membership)}::jsonb,
          ${membership.createdAt}::timestamptz, ${membership.updatedAt}::timestamptz,
          ${membership.deactivatedAt}::timestamptz
        )
        ON CONFLICT (organization_id, user_id) DO UPDATE SET
          id = EXCLUDED.id,
          role = EXCLUDED.role,
          status = EXCLUDED.status,
          membership = EXCLUDED.membership,
          updated_at = EXCLUDED.updated_at,
          deactivated_at = EXCLUDED.deactivated_at
        WHERE permitext_organization_memberships.updated_at <= EXCLUDED.updated_at
      `;
      return membership;
    },

    async invitationByTokenHash(tokenHash) {
      const rows = await sql`
        SELECT invitation
        FROM permitext_organization_invitations
        WHERE token_hash = ${tokenHash}
        LIMIT 1
      `;
      return safeJSON(rows[0]?.invitation, null);
    },

    async listOrganizationInvitations(organizationID) {
      const rows = await sql`
        SELECT invitation
        FROM permitext_organization_invitations
        WHERE organization_id = ${organizationID}
        ORDER BY created_at DESC
      `;
      return rows.map((row) => safeJSON(row.invitation, {}));
    },

    async saveOrganizationInvitation(invitation) {
      await sql`
        INSERT INTO permitext_organization_invitations (
          id, organization_id, project_id, token_hash, invited_email,
          invited_user_id, role, status, invitation, expires_at, created_at, updated_at
        )
        VALUES (
          ${invitation.id}, ${invitation.organizationID}, ${invitation.projectID},
          ${invitation.tokenHash}, ${invitation.invitedEmail}, ${invitation.invitedUserID},
          ${invitation.role}, ${invitation.status}, ${JSON.stringify(invitation)}::jsonb,
          ${invitation.expiresAt}::timestamptz, ${invitation.createdAt}::timestamptz,
          ${invitation.updatedAt}::timestamptz
        )
        ON CONFLICT (id) DO UPDATE SET
          project_id = EXCLUDED.project_id,
          invited_email = EXCLUDED.invited_email,
          invited_user_id = EXCLUDED.invited_user_id,
          role = EXCLUDED.role,
          status = EXCLUDED.status,
          invitation = EXCLUDED.invitation,
          expires_at = EXCLUDED.expires_at,
          updated_at = EXCLUDED.updated_at
        WHERE permitext_organization_invitations.updated_at <= EXCLUDED.updated_at
      `;
      return invitation;
    },

    async reserveOrganizationInvitation(invitation, seatLimit) {
      return withSerializableRetry(async () => {
        const [, resultRows] = await sql.transaction([
          sql`
            SELECT pg_advisory_xact_lock(
              hashtextextended(${invitation.organizationID}, 20260726)
            )
          `,
          sql`
            WITH active_users AS (
              SELECT user_id
              FROM permitext_organization_memberships
              WHERE organization_id = ${invitation.organizationID}
                AND status = 'active'
              UNION
              SELECT memberships.user_id
              FROM permitext_project_memberships AS memberships
              JOIN permitext_project_ownerships AS ownerships
                ON ownerships.project_id = memberships.project_id
              WHERE ownerships.organization_id = ${invitation.organizationID}
                AND memberships.status = 'active'
            ),
            pending_invitees AS (
              SELECT DISTINCT CASE
                WHEN invitations.invited_user_id IS NOT NULL
                  THEN 'user:' || invitations.invited_user_id
                ELSE 'email:' || lower(invitations.invited_email)
              END AS identity
              FROM permitext_organization_invitations AS invitations
              WHERE invitations.organization_id = ${invitation.organizationID}
                AND invitations.status = 'pending'
                AND invitations.expires_at > CURRENT_TIMESTAMP
                AND (
                  invitations.invited_user_id IS NULL
                  OR NOT EXISTS (
                    SELECT 1
                    FROM active_users
                    WHERE active_users.user_id = invitations.invited_user_id
                  )
                )
            ),
            seat_state AS (
              SELECT
                (SELECT count(*)::int FROM active_users) AS active,
                (SELECT count(*)::int FROM pending_invitees) AS pending
            ),
            duplicate_invitation AS (
              SELECT 1
              FROM permitext_organization_invitations AS invitations
              WHERE invitations.organization_id = ${invitation.organizationID}
                AND invitations.project_id IS NOT DISTINCT FROM ${invitation.projectID}
                AND invitations.status = 'pending'
                AND invitations.expires_at > CURRENT_TIMESTAMP
                AND (
                  (
                    ${invitation.invitedUserID}::text IS NOT NULL
                    AND invitations.invited_user_id = ${invitation.invitedUserID}
                  )
                  OR (
                    ${invitation.invitedEmail}::text IS NOT NULL
                    AND lower(invitations.invited_email) = lower(${invitation.invitedEmail})
                  )
                )
              LIMIT 1
            ),
            candidate AS (
              SELECT
                seat_state.*,
                CASE
                  WHEN ${invitation.invitedUserID}::text IS NOT NULL
                    AND EXISTS (
                      SELECT 1 FROM active_users
                      WHERE active_users.user_id = ${invitation.invitedUserID}
                    )
                    THEN 0
                  WHEN EXISTS (
                    SELECT 1 FROM pending_invitees
                    WHERE pending_invitees.identity = CASE
                      WHEN ${invitation.invitedUserID}::text IS NOT NULL
                        THEN 'user:' || ${invitation.invitedUserID}
                      ELSE 'email:' || lower(${invitation.invitedEmail})
                    END
                  )
                    THEN 0
                  ELSE 1
                END AS additional
              FROM seat_state
            ),
            inserted AS (
              INSERT INTO permitext_organization_invitations (
                id, organization_id, project_id, token_hash, invited_email,
                invited_user_id, role, status, invitation, expires_at, created_at, updated_at
              )
              SELECT
                ${invitation.id}, ${invitation.organizationID}, ${invitation.projectID},
                ${invitation.tokenHash}, ${invitation.invitedEmail}, ${invitation.invitedUserID},
                ${invitation.role}, ${invitation.status}, ${JSON.stringify(invitation)}::jsonb,
                ${invitation.expiresAt}::timestamptz, ${invitation.createdAt}::timestamptz,
                ${invitation.updatedAt}::timestamptz
              FROM candidate
              WHERE NOT EXISTS (SELECT 1 FROM duplicate_invitation)
                AND candidate.active + candidate.pending + candidate.additional <= ${seatLimit}
              ON CONFLICT (id) DO NOTHING
              RETURNING invitation
            )
            SELECT
              candidate.active,
              candidate.pending,
              candidate.active + candidate.pending AS used,
              CASE
                WHEN EXISTS (SELECT 1 FROM duplicate_invitation) THEN 'duplicate'
                WHEN candidate.active + candidate.pending + candidate.additional > ${seatLimit}
                  THEN 'seat_limit'
                WHEN EXISTS (SELECT 1 FROM inserted) THEN 'created'
                ELSE 'conflict'
              END AS outcome,
              (SELECT invitation FROM inserted LIMIT 1) AS invitation
            FROM candidate
          `
        ], { isolationMode: "Serializable" });
        const result = resultRows?.[0] || {};
        return {
          outcome: result.outcome || "conflict",
          invitation: safeJSON(result.invitation, null),
          seats: {
            active: Number(result.active || 0),
            pending: Number(result.pending || 0),
            used: Number(result.used || 0)
          }
        };
      });
    },

    async updatePendingOrganizationInvitation(invitation) {
      return withSerializableRetry(async () => {
        const [, rows] = await sql.transaction([
          sql`
            SELECT pg_advisory_xact_lock(
              hashtextextended(${invitation.organizationID}, 20260726)
            )
          `,
          sql`
            UPDATE permitext_organization_invitations
            SET status = ${invitation.status},
                invitation = ${JSON.stringify(invitation)}::jsonb,
                updated_at = ${invitation.updatedAt}::timestamptz
            WHERE id = ${invitation.id}
              AND organization_id = ${invitation.organizationID}
              AND status = 'pending'
              AND expires_at > CURRENT_TIMESTAMP
            RETURNING invitation
          `
        ], { isolationMode: "Serializable" });
        return safeJSON(rows?.[0]?.invitation, null);
      });
    },

    async acceptOrganizationInvitation(invitation, membership, seatLimit) {
      return withSerializableRetry(async () => {
        const acceptanceMutation = membership.projectID
          ? sql`
              WITH current_invitation AS MATERIALIZED (
                SELECT id
                FROM permitext_organization_invitations
                WHERE id = ${invitation.id}
                  AND token_hash = ${invitation.tokenHash}
                  AND organization_id = ${invitation.organizationID}
                  AND status = 'pending'
                  AND expires_at > CURRENT_TIMESTAMP
              ),
              active_users AS (
                SELECT user_id
                FROM permitext_organization_memberships
                WHERE organization_id = ${invitation.organizationID} AND status = 'active'
                UNION
                SELECT project_memberships.user_id
                FROM permitext_project_memberships AS project_memberships
                JOIN permitext_project_ownerships AS ownerships
                  ON ownerships.project_id = project_memberships.project_id
                WHERE ownerships.organization_id = ${invitation.organizationID}
                  AND project_memberships.status = 'active'
              ),
              pending_invitees AS (
                SELECT DISTINCT CASE
                  WHEN pending.invited_user_id IS NOT NULL
                    THEN 'user:' || pending.invited_user_id
                  ELSE 'email:' || lower(pending.invited_email)
                END AS identity
                FROM permitext_organization_invitations AS pending
                WHERE pending.organization_id = ${invitation.organizationID}
                  AND pending.status = 'pending'
                  AND pending.expires_at > CURRENT_TIMESTAMP
                  AND (
                    pending.invited_user_id IS NULL
                    OR NOT EXISTS (
                      SELECT 1 FROM active_users
                      WHERE active_users.user_id = pending.invited_user_id
                    )
                  )
              ),
              seat_state AS (
                SELECT
                  (SELECT count(*)::int FROM active_users) AS active,
                  (SELECT count(*)::int FROM pending_invitees) AS pending
              ),
              accepted AS (
                UPDATE permitext_organization_invitations
                SET status = ${invitation.status},
                    invitation = ${JSON.stringify(invitation)}::jsonb,
                    updated_at = ${invitation.updatedAt}::timestamptz
                WHERE id IN (SELECT id FROM current_invitation)
                  AND (SELECT active + pending FROM seat_state) <= ${seatLimit}
                RETURNING invitation
              ),
              saved_membership AS (
                INSERT INTO permitext_project_memberships (
                  id, organization_id, project_id, user_id, role, status, membership,
                  created_at, updated_at, deactivated_at
                )
                SELECT
                  ${membership.id}, ${membership.organizationID}, ${membership.projectID},
                  ${membership.userID}, ${membership.role}, ${membership.status},
                  ${JSON.stringify(membership)}::jsonb, ${membership.createdAt}::timestamptz,
                  ${membership.updatedAt}::timestamptz, ${membership.deactivatedAt}::timestamptz
                WHERE EXISTS (SELECT 1 FROM accepted)
                ON CONFLICT (project_id, user_id) DO UPDATE SET
                  id = EXCLUDED.id,
                  organization_id = EXCLUDED.organization_id,
                  role = EXCLUDED.role,
                  status = EXCLUDED.status,
                  membership = EXCLUDED.membership,
                  updated_at = EXCLUDED.updated_at,
                  deactivated_at = EXCLUDED.deactivated_at
                RETURNING membership
              )
              SELECT
                CASE
                  WHEN NOT EXISTS (SELECT 1 FROM current_invitation) THEN 'unavailable'
                  WHEN (SELECT active + pending FROM seat_state) > ${seatLimit} THEN 'seat_limit'
                  WHEN EXISTS (SELECT 1 FROM accepted) THEN 'accepted'
                  ELSE 'unavailable'
                END AS outcome,
                (SELECT invitation FROM accepted LIMIT 1) AS invitation,
                (SELECT membership FROM saved_membership LIMIT 1) AS membership
            `
          : sql`
              WITH current_invitation AS MATERIALIZED (
                SELECT id
                FROM permitext_organization_invitations
                WHERE id = ${invitation.id}
                  AND token_hash = ${invitation.tokenHash}
                  AND organization_id = ${invitation.organizationID}
                  AND status = 'pending'
                  AND expires_at > CURRENT_TIMESTAMP
              ),
              active_users AS (
                SELECT user_id
                FROM permitext_organization_memberships
                WHERE organization_id = ${invitation.organizationID} AND status = 'active'
                UNION
                SELECT project_memberships.user_id
                FROM permitext_project_memberships AS project_memberships
                JOIN permitext_project_ownerships AS ownerships
                  ON ownerships.project_id = project_memberships.project_id
                WHERE ownerships.organization_id = ${invitation.organizationID}
                  AND project_memberships.status = 'active'
              ),
              pending_invitees AS (
                SELECT DISTINCT CASE
                  WHEN pending.invited_user_id IS NOT NULL
                    THEN 'user:' || pending.invited_user_id
                  ELSE 'email:' || lower(pending.invited_email)
                END AS identity
                FROM permitext_organization_invitations AS pending
                WHERE pending.organization_id = ${invitation.organizationID}
                  AND pending.status = 'pending'
                  AND pending.expires_at > CURRENT_TIMESTAMP
                  AND (
                    pending.invited_user_id IS NULL
                    OR NOT EXISTS (
                      SELECT 1 FROM active_users
                      WHERE active_users.user_id = pending.invited_user_id
                    )
                  )
              ),
              seat_state AS (
                SELECT
                  (SELECT count(*)::int FROM active_users) AS active,
                  (SELECT count(*)::int FROM pending_invitees) AS pending
              ),
              accepted AS (
                UPDATE permitext_organization_invitations
                SET status = ${invitation.status},
                    invitation = ${JSON.stringify(invitation)}::jsonb,
                    updated_at = ${invitation.updatedAt}::timestamptz
                WHERE id IN (SELECT id FROM current_invitation)
                  AND (SELECT active + pending FROM seat_state) <= ${seatLimit}
                RETURNING invitation
              ),
              saved_membership AS (
                INSERT INTO permitext_organization_memberships (
                  id, organization_id, user_id, role, status, membership,
                  created_at, updated_at, deactivated_at
                )
                SELECT
                  ${membership.id}, ${membership.organizationID}, ${membership.userID},
                  ${membership.role}, ${membership.status}, ${JSON.stringify(membership)}::jsonb,
                  ${membership.createdAt}::timestamptz, ${membership.updatedAt}::timestamptz,
                  ${membership.deactivatedAt}::timestamptz
                WHERE EXISTS (SELECT 1 FROM accepted)
                ON CONFLICT (organization_id, user_id) DO UPDATE SET
                  id = EXCLUDED.id,
                  role = EXCLUDED.role,
                  status = EXCLUDED.status,
                  membership = EXCLUDED.membership,
                  updated_at = EXCLUDED.updated_at,
                  deactivated_at = EXCLUDED.deactivated_at
                RETURNING membership
              )
              SELECT
                CASE
                  WHEN NOT EXISTS (SELECT 1 FROM current_invitation) THEN 'unavailable'
                  WHEN (SELECT active + pending FROM seat_state) > ${seatLimit} THEN 'seat_limit'
                  WHEN EXISTS (SELECT 1 FROM accepted) THEN 'accepted'
                  ELSE 'unavailable'
                END AS outcome,
                (SELECT invitation FROM accepted LIMIT 1) AS invitation,
                (SELECT membership FROM saved_membership LIMIT 1) AS membership
            `;
        const [, resultRows] = await sql.transaction([
          sql`
            SELECT pg_advisory_xact_lock(
              hashtextextended(${invitation.organizationID}, 20260726)
            )
          `,
          acceptanceMutation
        ], { isolationMode: "Serializable" });
        const result = resultRows?.[0] || {};
        return {
          outcome: result.outcome || "unavailable",
          invitation: safeJSON(result.invitation, null),
          membership: safeJSON(result.membership, null)
        };
      });
    },

    async saveMembershipWithinSeatLimit(membership, seatLimit) {
      return withSerializableRetry(async () => {
        const membershipMutation = membership.projectID
          ? sql`
              WITH active_users AS (
                SELECT user_id
                FROM permitext_organization_memberships
                WHERE organization_id = ${membership.organizationID} AND status = 'active'
                UNION
                SELECT project_memberships.user_id
                FROM permitext_project_memberships AS project_memberships
                JOIN permitext_project_ownerships AS ownerships
                  ON ownerships.project_id = project_memberships.project_id
                WHERE ownerships.organization_id = ${membership.organizationID}
                  AND project_memberships.status = 'active'
              ),
              pending_invitees AS (
                SELECT DISTINCT CASE
                  WHEN invitations.invited_user_id IS NOT NULL
                    THEN 'user:' || invitations.invited_user_id
                  ELSE 'email:' || lower(invitations.invited_email)
                END AS identity
                FROM permitext_organization_invitations AS invitations
                WHERE invitations.organization_id = ${membership.organizationID}
                  AND invitations.status = 'pending'
                  AND invitations.expires_at > CURRENT_TIMESTAMP
                  AND (
                    invitations.invited_user_id IS NULL
                    OR NOT EXISTS (
                      SELECT 1 FROM active_users
                      WHERE active_users.user_id = invitations.invited_user_id
                    )
                  )
              ),
              candidate AS (
                SELECT
                  (SELECT count(*)::int FROM active_users) AS active,
                  (SELECT count(*)::int FROM pending_invitees) AS pending,
                  CASE
                    WHEN ${membership.status} <> 'active' THEN 0
                    WHEN EXISTS (
                      SELECT 1 FROM active_users
                      WHERE active_users.user_id = ${membership.userID}
                    ) THEN 0
                    WHEN EXISTS (
                      SELECT 1 FROM pending_invitees
                      WHERE pending_invitees.identity = 'user:' || ${membership.userID}
                    ) THEN 0
                    ELSE 1
                  END AS additional
              ),
              saved AS (
                INSERT INTO permitext_project_memberships (
                  id, organization_id, project_id, user_id, role, status, membership,
                  created_at, updated_at, deactivated_at
                )
                SELECT
                  ${membership.id}, ${membership.organizationID}, ${membership.projectID},
                  ${membership.userID}, ${membership.role}, ${membership.status},
                  ${JSON.stringify(membership)}::jsonb, ${membership.createdAt}::timestamptz,
                  ${membership.updatedAt}::timestamptz, ${membership.deactivatedAt}::timestamptz
                FROM candidate
                WHERE candidate.active + candidate.pending + candidate.additional <= ${seatLimit}
                ON CONFLICT (project_id, user_id) DO UPDATE SET
                  id = EXCLUDED.id,
                  organization_id = EXCLUDED.organization_id,
                  role = EXCLUDED.role,
                  status = EXCLUDED.status,
                  membership = EXCLUDED.membership,
                  updated_at = EXCLUDED.updated_at,
                  deactivated_at = EXCLUDED.deactivated_at
                RETURNING membership
              )
              SELECT
                CASE WHEN EXISTS (SELECT 1 FROM saved) THEN 'saved' ELSE 'seat_limit' END AS outcome,
                (SELECT membership FROM saved LIMIT 1) AS membership,
                candidate.active,
                candidate.pending,
                candidate.active + candidate.pending AS used
              FROM candidate
            `
          : sql`
              WITH active_users AS (
                SELECT user_id
                FROM permitext_organization_memberships
                WHERE organization_id = ${membership.organizationID} AND status = 'active'
                UNION
                SELECT project_memberships.user_id
                FROM permitext_project_memberships AS project_memberships
                JOIN permitext_project_ownerships AS ownerships
                  ON ownerships.project_id = project_memberships.project_id
                WHERE ownerships.organization_id = ${membership.organizationID}
                  AND project_memberships.status = 'active'
              ),
              pending_invitees AS (
                SELECT DISTINCT CASE
                  WHEN invitations.invited_user_id IS NOT NULL
                    THEN 'user:' || invitations.invited_user_id
                  ELSE 'email:' || lower(invitations.invited_email)
                END AS identity
                FROM permitext_organization_invitations AS invitations
                WHERE invitations.organization_id = ${membership.organizationID}
                  AND invitations.status = 'pending'
                  AND invitations.expires_at > CURRENT_TIMESTAMP
                  AND (
                    invitations.invited_user_id IS NULL
                    OR NOT EXISTS (
                      SELECT 1 FROM active_users
                      WHERE active_users.user_id = invitations.invited_user_id
                    )
                  )
              ),
              candidate AS (
                SELECT
                  (SELECT count(*)::int FROM active_users) AS active,
                  (SELECT count(*)::int FROM pending_invitees) AS pending,
                  CASE
                    WHEN ${membership.status} <> 'active' THEN 0
                    WHEN EXISTS (
                      SELECT 1 FROM active_users
                      WHERE active_users.user_id = ${membership.userID}
                    ) THEN 0
                    WHEN EXISTS (
                      SELECT 1 FROM pending_invitees
                      WHERE pending_invitees.identity = 'user:' || ${membership.userID}
                    ) THEN 0
                    ELSE 1
                  END AS additional
              ),
              saved AS (
                INSERT INTO permitext_organization_memberships (
                  id, organization_id, user_id, role, status, membership,
                  created_at, updated_at, deactivated_at
                )
                SELECT
                  ${membership.id}, ${membership.organizationID}, ${membership.userID},
                  ${membership.role}, ${membership.status}, ${JSON.stringify(membership)}::jsonb,
                  ${membership.createdAt}::timestamptz, ${membership.updatedAt}::timestamptz,
                  ${membership.deactivatedAt}::timestamptz
                FROM candidate
                WHERE candidate.active + candidate.pending + candidate.additional <= ${seatLimit}
                ON CONFLICT (organization_id, user_id) DO UPDATE SET
                  id = EXCLUDED.id,
                  role = EXCLUDED.role,
                  status = EXCLUDED.status,
                  membership = EXCLUDED.membership,
                  updated_at = EXCLUDED.updated_at,
                  deactivated_at = EXCLUDED.deactivated_at
                RETURNING membership
              )
              SELECT
                CASE WHEN EXISTS (SELECT 1 FROM saved) THEN 'saved' ELSE 'seat_limit' END AS outcome,
                (SELECT membership FROM saved LIMIT 1) AS membership,
                candidate.active,
                candidate.pending,
                candidate.active + candidate.pending AS used
              FROM candidate
            `;
        const [, resultRows] = await sql.transaction([
          sql`
            SELECT pg_advisory_xact_lock(
              hashtextextended(${membership.organizationID}, 20260726)
            )
          `,
          membershipMutation
        ], { isolationMode: "Serializable" });
        const result = resultRows?.[0] || {};
        return {
          outcome: result.outcome || "seat_limit",
          membership: safeJSON(result.membership, null),
          seats: {
            active: Number(result.active || 0),
            pending: Number(result.pending || 0),
            used: Number(result.used || 0)
          }
        };
      });
    },

    async projectOwnership(projectID) {
      const rows = await sql`
        SELECT ownership
        FROM permitext_project_ownerships
        WHERE project_id = ${projectID}
        LIMIT 1
      `;
      return safeJSON(rows[0]?.ownership, null);
    },

    async listProjectOwnershipsForOrganizations(organizationIDs) {
      if (!organizationIDs?.length) return [];
      const rows = await sql`
        SELECT ownership
        FROM permitext_project_ownerships
        WHERE organization_id = ANY(${organizationIDs}::text[])
        ORDER BY updated_at DESC
      `;
      return rows.map((row) => safeJSON(row.ownership, {}));
    },

    async saveProjectOwnership(ownership) {
      await sql`
        INSERT INTO permitext_project_ownerships (
          project_id, owner_kind, owner_id, organization_id,
          storage_owner_user_id, ownership, created_at, updated_at
        )
        VALUES (
          ${ownership.projectID}, ${ownership.owner.kind}, ${ownership.owner.id},
          ${ownership.owner.organizationID}, ${ownership.storageOwnerUserID},
          ${JSON.stringify(ownership)}::jsonb,
          ${ownership.createdAt}::timestamptz, ${ownership.updatedAt}::timestamptz
        )
        ON CONFLICT (project_id) DO UPDATE SET
          owner_kind = EXCLUDED.owner_kind,
          owner_id = EXCLUDED.owner_id,
          organization_id = EXCLUDED.organization_id,
          storage_owner_user_id = EXCLUDED.storage_owner_user_id,
          ownership = EXCLUDED.ownership,
          updated_at = EXCLUDED.updated_at
        WHERE permitext_project_ownerships.updated_at <= EXCLUDED.updated_at
      `;
      return ownership;
    },

    async projectMembership(projectID, userID) {
      const rows = await sql`
        SELECT membership
        FROM permitext_project_memberships
        WHERE project_id = ${projectID} AND user_id = ${userID}
        LIMIT 1
      `;
      return safeJSON(rows[0]?.membership, null);
    },

    async listProjectMemberships(projectID) {
      const rows = await sql`
        SELECT membership
        FROM permitext_project_memberships
        WHERE project_id = ${projectID}
        ORDER BY created_at ASC
      `;
      return rows.map((row) => safeJSON(row.membership, {}));
    },

    async listProjectMembershipsForUser(userID) {
      const rows = await sql`
        SELECT membership
        FROM permitext_project_memberships
        WHERE user_id = ${userID} AND status = 'active'
        ORDER BY updated_at DESC
      `;
      return rows.map((row) => safeJSON(row.membership, {}));
    },

    async saveProjectMembership(membership) {
      await sql`
        INSERT INTO permitext_project_memberships (
          id, organization_id, project_id, user_id, role, status, membership,
          created_at, updated_at, deactivated_at
        )
        VALUES (
          ${membership.id}, ${membership.organizationID}, ${membership.projectID},
          ${membership.userID}, ${membership.role}, ${membership.status},
          ${JSON.stringify(membership)}::jsonb, ${membership.createdAt}::timestamptz,
          ${membership.updatedAt}::timestamptz, ${membership.deactivatedAt}::timestamptz
        )
        ON CONFLICT (project_id, user_id) DO UPDATE SET
          id = EXCLUDED.id,
          organization_id = EXCLUDED.organization_id,
          role = EXCLUDED.role,
          status = EXCLUDED.status,
          membership = EXCLUDED.membership,
          updated_at = EXCLUDED.updated_at,
          deactivated_at = EXCLUDED.deactivated_at
        WHERE permitext_project_memberships.updated_at <= EXCLUDED.updated_at
      `;
      return membership;
    }
  };
}
