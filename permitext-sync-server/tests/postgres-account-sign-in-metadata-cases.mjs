import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createPostgresAccountRepository } from "../postgres-account-repository.mjs";
import { policyAcceptanceRecord } from "../policy-acceptance.mjs";

// Called only after the parent harness proves its database is newly created,
// disposable and loopback-only. These assertions execute the shipped SQL.
export async function runPostgresAccountSignInMetadataCases({ sql, setStatementHook }) {
  const accounts = createPostgresAccountRepository(sql);
  const environment = {
    PERMITEXT_PUBLIC_BASE_URL: "https://synthetic.invalid",
    PERMITEXT_TERMS_VERSION: "terms-test-1",
    PERMITEXT_PRIVACY_VERSION: "privacy-test-1",
    PERMITEXT_SUBSCRIPTION_POLICY_VERSION: "subscriptions-test-1"
  };
  const acceptance = policyAcceptanceRecord({ platform: "web", clientRelease: "synthetic-local",
    versions: { terms: "terms-test-1", privacy: "privacy-test-1", subscriptionsAndRefunds: "subscriptions-test-1" }
  }, { environment });
  const clean = account => {
    const copy = { ...account };
    delete copy.backendSessionToken;
    return JSON.parse(JSON.stringify(copy));
  };
  const persisted = async id => (await sql`SELECT account, public_username, display_name, migration_state
    FROM permitext_users WHERE id = ${id}`)[0];

  for (const provider of ["clerk", "web", "apple"]) {
    const userID = `${provider}:pg-sign-in-metadata`;
    const credential = { appUserID: userID, authProvider: provider,
      authProviderUserID: "pg-sign-in-metadata", email: `${provider}@synthetic.invalid`,
      publicUsername: null, displayName: "Provider name", migrationState: "notStarted",
      verifiedEmails: provider === "clerk" ? ["clerk@synthetic.invalid"] : [],
      signedInAt: "2026-09-07T10:00:00.000Z" };
    const first = await accounts.signIn(credential);
    const metadata = { ...clean(first.account), publicUsername: `saved-${provider}`,
      displayName: "Saved profile name", migrationState: "completed", policyAcceptances: [acceptance],
      appleBillingAccountToken: "11111111-1111-4111-8111-111111111111",
      appleBillingAccountTokenAliases: ["22222222-2222-4222-8222-222222222222"],
      linkedAppleUserIDs: [...first.account.linkedAppleUserIDs, `saved-apple-subject-${provider}`],
      serverMetadata: { marker: "preserve existing account", revision: 1 } };
    await accounts.updateAccount(userID, metadata);
    const entitlement = { plan: "pro", source: "synthetic-local-fixture", grantedUserID: userID };
    await accounts.saveEntitlement(userID, entitlement);
    const nextCredential = { ...credential, signedInAt: "2026-09-07T11:00:00.000Z",
      ...(provider === "clerk" ? { email: "current-clerk@synthetic.invalid",
        verifiedEmails: ["current-clerk@synthetic.invalid"] } : {}) };
    const returned = await accounts.signIn(nextCredential);
    const expected = { ...metadata, signedInAt: nextCredential.signedInAt,
      email: nextCredential.email, verifiedEmails: nextCredential.verifiedEmails };
    assert.deepEqual(clean(returned.account), expected, `${provider}: returning sign-in must retain server metadata`);
    assert.deepEqual(returned.entitlement, entitlement);
    assert.deepEqual((await persisted(userID)), { account: expected, public_username: metadata.publicUsername,
      display_name: metadata.displayName, migration_state: metadata.migrationState });
    assert.deepEqual((await accounts.authenticate(userID, returned.account.backendSessionToken)).account, expected);
    assert.notEqual(returned.account.backendSessionToken, first.account.backendSessionToken);
    assert.equal((await sql`SELECT token_hash FROM permitext_account_sessions WHERE token_hash = ${
      createHash("sha256").update(returned.account.backendSessionToken).digest("hex")}`).length, 1);
    assert.equal(JSON.stringify((await persisted(userID)).account).includes(returned.account.backendSessionToken), false);

    // A metadata write commits after the optional Apple candidate read and
    // immediately before sign-in's upsert. A stale JS snapshot must not win.
    const concurrentMetadata = { ...expected, displayName: "Updated while signing in",
      serverMetadata: { marker: "concurrent update", revision: 2 },
      policyAcceptances: [acceptance, { ...acceptance, id: `${acceptance.id}-next`,
        policySetID: "synthetic-next-policy", acceptedAt: "2026-09-07T11:30:00.000Z" }] };
    let intercepted = false;
    setStatementHook(async query => {
      if (intercepted || !/INSERT INTO permitext_users\s*\(/.test(query.query) || !query.params.includes(userID)) return;
      intercepted = true;
      await accounts.updateAccount(userID, concurrentMetadata);
    });
    let raced;
    try {
      raced = await accounts.signIn({ ...nextCredential, signedInAt: "2026-09-07T12:00:00.000Z" });
    } finally {
      setStatementHook(null);
    }
    assert.equal(intercepted, true);
    const expectedConcurrent = { ...concurrentMetadata, signedInAt: "2026-09-07T12:00:00.000Z" };
    assert.deepEqual(clean(raced.account), expectedConcurrent, `${provider}: sign-in response must include concurrently committed metadata`);
    assert.deepEqual((await persisted(userID)).account, expectedConcurrent);
    assert.equal((await persisted(userID)).display_name, concurrentMetadata.displayName);
    assert.deepEqual((await accounts.authenticate(userID, raced.account.backendSessionToken)).account, expectedConcurrent);
  }

  const appleBefore = await persisted("apple:pg-sign-in-metadata");
  const appleAlias = await accounts.signIn({ appUserID: "apple:pg-sign-in-new-subject",
    authProvider: "apple", authProviderUserID: "pg-sign-in-new-subject", email: "apple@synthetic.invalid",
    signedInAt: "2026-09-07T13:00:00.000Z" });
  assert.equal(appleAlias.account.appUserID, "apple:pg-sign-in-metadata");
  assert.deepEqual(appleAlias.account.policyAcceptances, appleBefore.account.policyAcceptances);
  assert.deepEqual(appleAlias.account.linkedAppleUserIDs,
    [...appleBefore.account.linkedAppleUserIDs, "pg-sign-in-new-subject"]);
  assert.equal((await persisted("apple:pg-sign-in-new-subject")), undefined);

  // An equal email is not authorization to merge two distinct Clerk identities.
  const existingID = "clerk:pg-sign-in-metadata";
  const before = await persisted(existingID);
  const other = await accounts.signIn({ appUserID: "clerk:pg-sign-in-same-email",
    authProvider: "clerk", authProviderUserID: "pg-sign-in-same-email", email: "current-clerk@synthetic.invalid",
    displayName: "Separate synthetic identity", signedInAt: new Date().toISOString() });
  assert.equal(other.account.appUserID, "clerk:pg-sign-in-same-email");
  assert.equal(other.account.policyAcceptances, undefined);
  assert.equal(other.account.appleBillingAccountToken, undefined);
  assert.equal(other.account.serverMetadata, undefined);
  assert.equal(other.entitlement, null);
  assert.equal(other.mergedAccount, null);
  assert.deepEqual(await persisted(existingID), before);
  const noEmail = await accounts.signIn({ appUserID: existingID, authProvider: "clerk",
    authProviderUserID: "pg-sign-in-metadata", email: "", verifiedEmails: [],
    signedInAt: new Date().toISOString() });
  assert.equal(noEmail.account.email, "");
  assert.deepEqual(noEmail.account.verifiedEmails, []);
  assert.deepEqual(noEmail.account.policyAcceptances, before.account.policyAcceptances);
  assert.deepEqual((await persisted(existingID)).account, clean(noEmail.account));
  console.log(JSON.stringify({ scenario: "returning-sign-in-metadata", providers: ["clerk", "web", "apple"],
    consentPreserved: true, concurrentMetadataPreserved: true, sameEmailIsolated: true,
    storedAndReturnedAccountsMatch: true, verifiedAddressesRefreshed: true, sessionsHashed: true }));
}
