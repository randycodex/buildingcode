function normalizedSubscriber({ name, email, subscribedAt }) {
  const address = String(email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) return null;
  const timestamp = Date.parse(subscribedAt || "");
  return {
    name: String(name || ""),
    email: address,
    subscribedAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
  };
}

function sortedSubscribers(records) {
  return records.filter(Boolean).sort((left, right) =>
    left.email.localeCompare(right.email) || left.name.localeCompare(right.name)
  );
}

export function emailSubscribersFromAccounts(accounts) {
  return sortedSubscribers(accounts
    .filter(account => account?.productEmailPreference?.subscribed === true)
    .map(account => normalizedSubscriber({
      name: account.displayName,
      email: account.email || account.emailAddress || account.privateRelayEmail,
      subscribedAt: account.productEmailPreference.updatedAt
    })));
}

export async function postgresEmailSubscribers(sql) {
  // Project only newsletter fields; account/session payloads stay in storage.
  const rows = await sql`
    SELECT account->>'displayName' AS name,
           COALESCE(NULLIF(account->>'email', ''), NULLIF(account->>'emailAddress', ''),
                    account->>'privateRelayEmail') AS email,
           account->'productEmailPreference'->>'updatedAt' AS "subscribedAt"
    FROM permitext_users
    WHERE account->'productEmailPreference'->'subscribed' = 'true'::jsonb
  `;
  return sortedSubscribers(rows.map(normalizedSubscriber));
}

function csvCell(value) {
  let text = String(value ?? "");
  // Quoting alone does not stop spreadsheet applications from executing formulas.
  if (/^[\s\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function emailSubscribersCSV(subscribers) {
  const rows = [["Name", "Email", "Opt-in date (UTC)"], ...subscribers.map(subscriber =>
    [subscriber.name, subscriber.email, subscriber.subscribedAt]
  )];
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
