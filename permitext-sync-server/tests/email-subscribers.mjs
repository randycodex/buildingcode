import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emailSubscribersFromAccounts, emailSubscribersCSV } from "../email-subscribers.mjs";

const date = "2026-11-06T12:00:00.000Z";
const preference = { subscribed: true, updatedAt: date, source: "web-onboarding" };
const accounts = {
  owner: { appUserID: "owner", displayName: "Owner", authProvider: "apple", email: "owner@example.com" },
  subscriber: { appUserID: "subscriber", displayName: 'Last, "First"\nArchitect', authProvider: "apple", email: "PERSON@EXAMPLE.COM", productEmailPreference: preference, backendSessionToken: "PRIVATE-TOKEN" },
  formula: { appUserID: "formula", displayName: ' =HYPERLINK("https://example.com")', authProvider: "apple", email: "formula@example.com", productEmailPreference: preference },
  relay: { appUserID: "relay", displayName: "Relay", privateRelayEmail: "relay@example.com", productEmailPreference: { subscribed: true } },
  off: { appUserID: "off", email: "off@example.com", productEmailPreference: { subscribed: false } },
  missing: { appUserID: "missing", email: "missing@example.com" },
  legacy: { appUserID: "legacy", email: "legacy@example.com", productEmailPreference: { subscribed: "true" } },
  invalid: { appUserID: "invalid", email: "bad\nemail@example.com", productEmailPreference: preference }
};
const projected = emailSubscribersFromAccounts(Object.values(accounts));
assert.deepEqual(projected.map(row => row.email), ["formula@example.com", "person@example.com", "relay@example.com"]);
assert.deepEqual(Object.keys(projected[0]), ["name", "email", "subscribedAt"]);
assert.equal(projected[2].subscribedAt, null);
const csv = emailSubscribersCSV(projected);
assert.ok(csv.startsWith('\uFEFF"Name","Email","Opt-in date (UTC)"\r\n'));
assert.ok(csv.includes('"Last, ""First""\nArchitect","person@example.com","2026-11-06T12:00:00.000Z"\r\n'));
assert.ok(csv.includes('"\' =HYPERLINK(""https://example.com"")"'));
for (const name of ["=1+1", "+1+1", "-1+1", "@SUM(1)", "\tname", "\rname", "\nname"]) {
  assert.ok(emailSubscribersCSV([{ name, email: "person@example.com" }]).includes(`"'${name}"`));
}
assert.equal(emailSubscribersCSV([]).trim(), '"Name","Email","Opt-in date (UTC)"');

const temporary = await mkdtemp(join(tmpdir(), "permitext-subscribers-"));
const storePath = join(temporary, "store.json");
await writeFile(storePath, JSON.stringify({ users: accounts, sessions: { owner: "owner-token", subscriber: "subscriber-token" }, entitlements: {} }));
Object.assign(process.env, {
  NODE_ENV: "test", VERCEL: "1", VERCEL_ENV: "preview",
  PERMITEXT_INTERNAL_OWNER_USER_IDS: "owner", PERMITEXT_SYNC_DATA_PATH: storePath
});
for (const key of ["DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL"]) delete process.env[key];
const { handleRequest } = await import("../app.mjs");
const serve = process.argv.includes("--serve");
const server = createServer((request, response) => {
  if (serve && request.url === "/__subscriber_test") {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<script>localStorage.setItem('permitext:webAccount:v1',${JSON.stringify(JSON.stringify({ userID: "owner", sessionToken: "owner-token" }))});location.href='/internal'</script>`);
    return;
  }
  return handleRequest(request, response);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
async function post(path, values = {}, userID = "owner", token = "owner-token") {
  return fetch(base + path, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ auth: { accountUserID: userID }, ...values }) });
}
try {
  for (const path of ["/internal/email-subscribers/data", "/internal/email-subscribers/export"]) {
    assert.equal((await post(path, {}, "owner", "invalid")).status, 401);
    assert.equal((await post(path, {}, "subscriber", "subscriber-token")).status, 403);
    assert.notEqual((await fetch(base + path)).status, 200);
  }
  const listing = await post("/internal/email-subscribers/data");
  assert.equal(listing.status, 200);
  assert.equal(listing.headers.get("cache-control"), "no-store");
  const data = await listing.json();
  assert.deepEqual(data.subscribers, projected);
  assert.equal(JSON.stringify(data).includes("PRIVATE-TOKEN"), false);
  // Use the customer's real profile action after the owner has loaded the list.
  const optOut = await post("/account/profile", { displayName: "Person", productEmailOptIn: false }, "subscriber", "subscriber-token");
  assert.equal(optOut.status, 200);
  const download = await post("/internal/email-subscribers/export", { subscribers: projected });
  assert.equal(download.status, 200);
  assert.equal(download.headers.get("content-type"), "text/csv; charset=utf-8");
  assert.match(download.headers.get("content-disposition"), /^attachment; filename="permitext-email-subscribers-\d{4}-\d{2}-\d{2}\.csv"$/);
  assert.equal(download.headers.get("cache-control"), "no-store");
  assert.equal(download.headers.get("x-subscriber-count"), "2");
  const exported = await download.text();
  assert.equal(exported.includes("person@example.com"), false, "A stale list reintroduced an unsubscribed user.");
  for (const excluded of ["off@example.com", "missing@example.com", "legacy@example.com", "PRIVATE-TOKEN", "owner-token", "subscriber-token"]) {
    assert.equal(exported.includes(excluded), false, `${excluded} leaked into the CSV.`);
  }
  assert.ok(exported.includes("formula@example.com"));
  assert.ok(exported.includes("relay@example.com"));
  const refreshed = await (await post("/internal/email-subscribers/data")).json();
  assert.equal(refreshed.subscribers.length, 2);
  console.log("Email subscribers passed: owner-only list/export, strict current consent, real unsubscribe, fresh CSV, private-field exclusion, CSV escaping and formula protection.");
  if (serve) {
    console.log(`Synthetic subscriber browser fixture: ${base}/__subscriber_test`);
    await new Promise(() => {});
  }
} finally {
  await new Promise(resolve => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
