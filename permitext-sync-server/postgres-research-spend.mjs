const json = (value, fallback) => value == null ? fallback : typeof value === "string" ? JSON.parse(value) : value;
const dateToISO = value => new Date(value).toISOString();

export async function postgresResearchSpendRecords(sql, range) {
      const rows = await sql`
        WITH usage_with_operation AS (
          SELECT usage.*, COALESCE(answer.answer->>'operationID', (
            SELECT op.id FROM permitext_research_operations op
            WHERE op.user_id = usage.user_id
              AND op.operation->>'usageReservationID' = usage.id
              AND op.operation->>'charged' = 'true'
            ORDER BY op.created_at DESC LIMIT 1
          )) AS operation_id
          FROM permitext_research_usage usage
          LEFT JOIN permitext_research_answers answer
            ON answer.user_id = usage.user_id
              AND usage.id LIKE 'research-%:usage'
              AND answer.id = regexp_replace(usage.id, ':usage$', ':answer')
        )
        SELECT COALESCE(op.user_id, usage.user_id) AS user_id,
          COALESCE(NULLIF(account.account->>'email', ''), NULLIF(account.account->>'emailAddress', ''),
            NULLIF(account.account->>'privateRelayEmail', '')) AS email,
          op.operation, op.created_at AS operation_created_at,
          (usage.id IS NULL AND op.operation->>'charged' = 'true' AND EXISTS (
            SELECT 1 FROM permitext_research_usage ledger
            WHERE ledger.user_id = op.user_id AND ledger.mode <> 'reservation'
          )) AS covered_by_legacy_ledger,
          CASE WHEN usage.id IS NOT NULL THEN jsonb_build_object(
            'id', usage.id, 'createdAt', usage.created_at, 'model', usage.model, 'mode', usage.mode,
            'fundingSource', usage.funding_source, 'inputTokens', usage.input_tokens,
            'cachedInputTokens', usage.cached_input_tokens, 'outputTokens', usage.output_tokens,
            'totalTokens', usage.total_tokens, 'estimatedCostUSD', usage.estimated_cost_usd,
            'pricingVersion', usage.pricing_version) END AS usage
        FROM usage_with_operation usage
        FULL OUTER JOIN permitext_research_operations op
          ON op.user_id = usage.user_id AND op.id = usage.operation_id
        LEFT JOIN permitext_users account ON account.id = COALESCE(op.user_id, usage.user_id)
        WHERE COALESCE(op.created_at, usage.created_at) >= ${range.periodStart}::timestamptz
          AND COALESCE(op.created_at, usage.created_at) < ${range.periodEnd}::timestamptz
      `;
      return rows.map(row => ({ userID: row.user_id, email: row.email || null, coveredByLegacyLedger: row.covered_by_legacy_ledger === true,
        operation: row.operation ? { ...json(row.operation, {}), createdAt: dateToISO(row.operation_created_at) } : null,
        usage: row.usage ? { ...json(row.usage, {}), createdAt: dateToISO(json(row.usage, {}).createdAt) } : null }));
}
