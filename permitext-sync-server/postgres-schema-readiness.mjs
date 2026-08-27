export const postgresNormalizedSchemaReadinessVersion = "normalized-v4-20260827";

export const postgresNormalizedSchemaRequiredTables = Object.freeze([
  "permitext_account_sessions",
  "permitext_annotations",
  "permitext_apple_notification_states",
  "permitext_apple_transaction_owners",
  "permitext_artifact_revisions",
  "permitext_comments",
  "permitext_entitlements",
  "permitext_evidence_snapshots",
  "permitext_foundation_artifacts",
  "permitext_lifetime_grant_audit",
  "permitext_lifetime_grant_invitations",
  "permitext_migration_checkpoints",
  "permitext_organization_invitations",
  "permitext_organization_memberships",
  "permitext_organizations",
  "permitext_passkey_credentials",
  "permitext_project_activity",
  "permitext_project_items",
  "permitext_project_links",
  "permitext_project_memberships",
  "permitext_project_ownerships",
  "permitext_projects",
  "permitext_rate_limit_buckets",
  "permitext_research_answers",
  "permitext_research_conversations",
  "permitext_research_credits",
  "permitext_research_feedback",
  "permitext_research_operations",
  "permitext_research_purchase_claims",
  "permitext_research_usage",
  "permitext_saved_items",
  "permitext_sessions",
  "permitext_sync_events",
  "permitext_sync_state",
  "permitext_user_content_records",
  "permitext_users"
]);

export const postgresNormalizedSchemaRequiredColumns = Object.freeze([
  "permitext_project_items.folder_type",
  "permitext_projects.folder_type",
  "permitext_research_purchase_claims.last_reversal_event_id",
  "permitext_research_purchase_claims.last_reversal_signed_date",
  "permitext_research_purchase_claims.provider_payment_id",
  "permitext_research_purchase_claims.refunded_amount",
  "permitext_research_purchase_claims.revoked_units",
  "permitext_research_usage.cached_input_tokens",
  "permitext_research_usage.evidence_version",
  "permitext_research_usage.estimated_cost_usd",
  "permitext_research_usage.funding_source",
  "permitext_research_usage.pricing_version",
  "permitext_research_usage.prompt_version",
  "permitext_research_usage.request_fingerprint",
  "permitext_sync_events.mutation_updated_at",
  "permitext_sync_state.passkey_credentials"
]);

export const postgresNormalizedSchemaRequiredIndexes = Object.freeze([
  "permitext_account_sessions_user_idx",
  "permitext_annotations_user_locator_idx",
  "permitext_annotations_user_updated_idx",
  "permitext_apple_transaction_owners_user_idx",
  "permitext_comments_user_locator_idx",
  "permitext_entitlements_source_granted_idx",
  "permitext_evidence_snapshots_answer_idx",
  "permitext_foundation_artifacts_user_updated_idx",
  "permitext_lifetime_grant_audit_created_idx",
  "permitext_lifetime_grant_invitations_status_idx",
  "permitext_organization_invitations_org_idx",
  "permitext_organization_invitations_token_idx",
  "permitext_organization_memberships_org_user_idx",
  "permitext_organization_memberships_user_idx",
  "permitext_organizations_owner_idx",
  "permitext_organizations_slug_idx",
  "permitext_passkey_credentials_user_idx",
  "permitext_project_activity_project_idx",
  "permitext_project_items_project_idx",
  "permitext_project_items_user_updated_idx",
  "permitext_project_links_project_idx",
  "permitext_project_links_research_decision_unique_idx",
  "permitext_project_links_target_idx",
  "permitext_project_memberships_project_user_idx",
  "permitext_project_memberships_user_idx",
  "permitext_project_ownerships_org_idx",
  "permitext_project_ownerships_storage_owner_idx",
  "permitext_projects_user_updated_idx",
  "permitext_projects_user_version_idx",
  "permitext_rate_limit_buckets_reset_idx",
  "permitext_research_answers_conversation_idx",
  "permitext_research_conversations_user_updated_idx",
  "permitext_research_credits_user_created_idx",
  "permitext_research_feedback_user_answer_idx",
  "permitext_research_operations_created_idx",
  "permitext_research_purchase_provider_id_idx",
  "permitext_research_purchase_provider_payment_idx",
  "permitext_research_usage_user_created_idx",
  "permitext_saved_items_user_locator_idx",
  "permitext_saved_items_user_updated_idx",
  "permitext_sync_events_record_update_idx",
  "permitext_sync_events_user_event_idx",
  "permitext_sync_events_user_record_event_idx",
  "permitext_user_content_user_updated_idx",
  "permitext_user_content_user_version_kind_idx",
  "permitext_users_auth_identity_idx",
  "permitext_users_public_username_idx"
]);

export async function postgresNormalizedSchemaIsReady(sql) {
  const [row] = await sql`
    SELECT
      (
        SELECT count(DISTINCT class.relname)::int
        FROM pg_catalog.pg_class AS class
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = class.relnamespace
        WHERE namespace.nspname = current_schema()
          AND class.relkind IN ('r', 'p')
          AND class.relname = ANY(${postgresNormalizedSchemaRequiredTables}::text[])
      ) AS table_count,
      (
        SELECT count(*)::int
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND (table_name || '.' || column_name) = ANY(${postgresNormalizedSchemaRequiredColumns}::text[])
      ) AS column_count,
      (
        SELECT count(DISTINCT indexname)::int
        FROM pg_catalog.pg_indexes
        WHERE schemaname = current_schema()
          AND indexname = ANY(${postgresNormalizedSchemaRequiredIndexes}::text[])
      ) AS index_count
  `;
  return Number(row?.table_count || 0) === postgresNormalizedSchemaRequiredTables.length &&
    Number(row?.column_count || 0) === postgresNormalizedSchemaRequiredColumns.length &&
    Number(row?.index_count || 0) === postgresNormalizedSchemaRequiredIndexes.length;
}

const retryablePostgresSchemaInitializationCodes = new Set([
  "23505",
  "40P01",
  "42P07",
  "42710"
]);

export function retryablePostgresSchemaInitializationError(error) {
  return retryablePostgresSchemaInitializationCodes.has(String(error?.code || ""));
}

export async function waitForPostgresNormalizedSchema(
  sql,
  { attempts = 50, delayMilliseconds = 100, delay = setTimeout } = {}
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await postgresNormalizedSchemaIsReady(sql)) return true;
    if (attempt + 1 < attempts) {
      await new Promise((resolveDelay) => delay(resolveDelay, delayMilliseconds));
    }
  }
  return false;
}

export async function ensurePostgresNormalizedSchema(sql, initializeSchema) {
  if (await postgresNormalizedSchemaIsReady(sql)) return;

  try {
    await initializeSchema();
    if (!(await postgresNormalizedSchemaIsReady(sql))) {
      const error = new Error(
        "PostgreSQL schema initialization did not reach normalized-v4 readiness."
      );
      error.code = "POSTGRES_SCHEMA_INCOMPLETE";
      throw error;
    }
  } catch (error) {
    if (
      retryablePostgresSchemaInitializationError(error) &&
      await waitForPostgresNormalizedSchema(sql)
    ) {
      return;
    }
    throw error;
  }
}
