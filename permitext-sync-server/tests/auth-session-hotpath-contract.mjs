import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  accountSessionLastSeenThrottleSeconds,
  createPostgresAccountRepository
} from "../postgres-account-repository.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const accountSource = await readFile(join(root, "../postgres-account-repository.mjs"), "utf8");

assert.equal(accountSessionLastSeenThrottleSeconds({}), 5 * 60);
assert.equal(
  accountSessionLastSeenThrottleSeconds({ PERMITEXT_SESSION_LAST_SEEN_THROTTLE_SECONDS: "120" }),
  120
);
assert.equal(
  accountSessionLastSeenThrottleSeconds({ PERMITEXT_SESSION_LAST_SEEN_THROTTLE_SECONDS: "5" }),
  5 * 60,
  "Unsafe sub-30s last_seen throttle was accepted."
);

assert.match(
  accountSource,
  /JOIN permitext_users AS users ON users\.id = sessions\.user_id/,
  "Authenticate no longer joins users in the session lookup."
);
assert.match(
  accountSource,
  /lastSeenThrottleSeconds|last_seen_at <= now\(\) - \(\$\{lastSeenThrottleSeconds\}/,
  "Authenticate is missing throttled last_seen_at updates."
);
assert.equal(
  /UPDATE permitext_account_sessions\s+SET last_seen_at = now\(\)\s+WHERE token_hash = \$\{hash\}\s+AND user_id = \$\{userID\}\s+AND revoked_at IS NULL\s+AND expires_at > now\(\)\s+RETURNING user_id/.test(
    accountSource
  ),
  false,
  "Authenticate still unconditionally rewrites last_seen_at on every request."
);

const queries = [];
function fakeSQL(strings, ...values) {
  const text = strings.reduce((acc, part, index) => acc + part + (index < values.length ? `$${index}` : ""), "");
  queries.push({ text, values });
  if (/FROM permitext_account_sessions AS sessions/.test(text) && /JOIN permitext_users/.test(text)) {
    return [{
      user_id: "apple:hotpath",
      last_seen_at: new Date().toISOString(),
      account: { appUserID: "apple:hotpath", displayName: "Hot Path" },
      entitlement: { plan: "pro" }
    }];
  }
  if (/UPDATE permitext_account_sessions/.test(text) && /SET last_seen_at = now\(\)/.test(text)) {
    return [];
  }
  if (/FROM permitext_sessions AS sessions/.test(text)) {
    return [];
  }
  return [];
}
fakeSQL.transaction = async (parts) => parts;

const repository = createPostgresAccountRepository(fakeSQL, {
  lastSeenThrottleSeconds: 300
});

queries.length = 0;
const freshContext = await repository.authenticate("apple:hotpath", "session-token-fresh");
assert.equal(freshContext.account.appUserID, "apple:hotpath");
assert.equal(freshContext.entitlement.plan, "pro");
const selectCount = queries.filter((query) => /FROM permitext_account_sessions AS sessions/.test(query.text)).length;
const updateCount = queries.filter((query) =>
  /UPDATE permitext_account_sessions/.test(query.text) && /SET last_seen_at = now\(\)/.test(query.text)
).length;
assert.equal(selectCount, 1, "Authenticate did not use a single joined session/context query.");
assert.equal(updateCount, 0, "Fresh last_seen_at still triggered a write on the hot path.");

// Stale last_seen should refresh once without a separate context re-query.
queries.length = 0;
function staleSQL(strings, ...values) {
  const text = strings.reduce((acc, part, index) => acc + part + (index < values.length ? `$${index}` : ""), "");
  queries.push({ text, values });
  if (/FROM permitext_account_sessions AS sessions/.test(text) && /JOIN permitext_users/.test(text)) {
    return [{
      user_id: "apple:hotpath",
      last_seen_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      account: { appUserID: "apple:hotpath", displayName: "Hot Path" },
      entitlement: null
    }];
  }
  if (/UPDATE permitext_account_sessions/.test(text)) {
    return [{ user_id: "apple:hotpath" }];
  }
  return [];
}
staleSQL.transaction = async (parts) => parts;
const staleRepo = createPostgresAccountRepository(staleSQL, { lastSeenThrottleSeconds: 300 });
const staleContext = await staleRepo.authenticate("apple:hotpath", "session-token-stale");
assert.equal(staleContext.account.appUserID, "apple:hotpath");
assert.equal(
  queries.filter((query) => /FROM permitext_account_sessions AS sessions/.test(query.text)).length,
  1
);
assert.equal(
  queries.filter((query) => /UPDATE permitext_account_sessions/.test(query.text)).length,
  1,
  "Stale sessions must still refresh last_seen_at."
);
assert.equal(
  queries.filter((query) => /FROM permitext_users AS users/.test(query.text) && !/JOIN/.test(query.text)).length,
  0,
  "Authenticate still performed a separate contextForUser re-query."
);

console.log("permitext auth session hotpath contract passed");
