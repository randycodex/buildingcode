function safeJSON(value, fallback) {
  if (value === null || value === undefined) return fallback;
  return typeof value === "string" ? JSON.parse(value) : value;
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
