import assert from "node:assert/strict";
import { startResearchV2Postgres } from "./research-v2-local-postgres.mjs";
import { postgresEmailSubscribers } from "../email-subscribers.mjs";

// The shared harness creates a fresh loopback cluster and restricts Neon's
// transport to it. No deployed database, email provider, or real account is used.
const database = await startResearchV2Postgres();
const { sql } = database;
try {
  await sql`CREATE TABLE permitext_users (id TEXT PRIMARY KEY, account JSONB NOT NULL)`;
  const fixtures = [
    { displayName: "Subscribed", email: "PERSON@EXAMPLE.COM", productEmailPreference: { subscribed: true, updatedAt: "2026-11-06T12:00:00Z" }, backendSessionToken: "SECRET" },
    { displayName: "Unsubscribed", email: "off@example.com", productEmailPreference: { subscribed: false } },
    { email: "unknown@example.com" },
    { email: "string@example.com", productEmailPreference: { subscribed: "true" } },
    { email: "invalid", productEmailPreference: { subscribed: true } },
    { displayName: "Relay", email: "", privateRelayEmail: "relay@example.com", productEmailPreference: { subscribed: true } }
  ];
  for (const [index, account] of fixtures.entries()) {
    await sql`INSERT INTO permitext_users (id, account) VALUES (${String(index)}, ${JSON.stringify(account)}::jsonb)`;
  }
  const subscribers = await postgresEmailSubscribers(sql);
  assert.deepEqual(subscribers, [
    { name: "Subscribed", email: "person@example.com", subscribedAt: "2026-11-06T12:00:00.000Z" },
    { name: "Relay", email: "relay@example.com", subscribedAt: null }
  ]);
  await sql`UPDATE permitext_users SET account = jsonb_set(account, '{productEmailPreference,subscribed}', 'false'::jsonb) WHERE id = '0'`;
  assert.deepEqual((await postgresEmailSubscribers(sql)).map(row => row.email), ["relay@example.com"]);
  console.log("Email subscriber PostgreSQL query passed: boolean consent only, minimal fields, relay email, and current unsubscribe state.");
} finally {
  await database.close();
}
