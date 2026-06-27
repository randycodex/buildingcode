import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const port = 8794;
const baseURL = `http://127.0.0.1:${port}`;
const adminToken = "smoke-admin-token";
const stripeWebhookSecret = "whsec_smoke";
const userID = "apple:smoke-user";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function mutationKind(mutation) {
  return Object.keys(mutation)[0];
}

function mutationRecord(mutation) {
  return Object.values(mutation)[0];
}

function stripeSignature(rawBody, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

async function request(path, { method = "GET", body, token, headers = {}, rawBody } = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: rawBody ?? (body ? JSON.stringify(body) : undefined)
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  return { response, json };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const { response } = await request("/health");
      if (response.ok) {
        return;
      }
    } catch {
      await sleep(100);
    }
  }
  throw new Error("Server did not become ready.");
}

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "permitext-sync-smoke-"));
  const dataPath = join(tempDir, "sync-store.json");
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      PERMITEXT_SYNC_DATA_PATH: dataPath,
      PERMITEXT_SYNC_DATABASE_URL: "",
      DATABASE_URL: "",
      STORAGE_URL: "",
      POSTGRES_URL: "",
      NEON_DATABASE_URL: "",
      PERMITEXT_SYNC_ADMIN_TOKEN: adminToken,
      APPLE_TEAM_ID: "ABCDE12345",
      APPLE_BUNDLE_ID: "com.randycodex.permitext",
      STRIPE_WEBHOOK_SECRET: stripeWebhookSecret
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForServer();

    const aasa = await request("/.well-known/apple-app-site-association");
    assert(aasa.response.ok, "AASA endpoint failed.");
    assert(
      aasa.json.webcredentials.apps.includes("ABCDE12345.com.randycodex.permitext"),
      "AASA payload did not include the configured app identifier."
    );

    const unauthorizedStorageSummary = await request("/admin/storage/summary");
    assert(unauthorizedStorageSummary.response.status === 401, "Storage summary allowed an unauthenticated request.");

    const storageSummary = await request("/admin/storage/summary", {
      token: adminToken
    });
    assert(storageSummary.response.ok, "Storage summary failed.");
    assert(storageSummary.json.storage === "file", "Local storage summary did not report file storage.");
    assert(storageSummary.json.schema === "json-file", "Local storage summary did not report the file schema.");
    assert(storageSummary.json.latestEventID === 0, "Local storage summary should report event cursor 0.");

    const unauthorizedGrant = await request("/admin/lifetime-grants/grant", {
      method: "POST",
      body: { userID }
    });
    assert(unauthorizedGrant.response.status === 401, "Admin route allowed an unauthenticated grant.");

    const unsignedPush = await request("/sync/push", {
      method: "POST",
      body: {
        auth: { accountUserID: "apple:unsigned-user" },
        batch: {
          user: { id: "apple:unsigned-user" },
          mutations: []
        }
      }
    });
    assert(unsignedPush.response.status === 401, "Push allowed a user with no backend session.");

    const grant = await request("/admin/lifetime-grants/grant", {
      method: "POST",
      token: adminToken,
      body: { userID }
    });
    assert(grant.response.ok, "Lifetime grant failed.");
    assert(grant.json.entitlement.source === "lifetimeGrant", "Lifetime grant source was not persisted.");

    const signIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "smoke-user",
          displayName: "Smoke User"
        }
      }
    });
    assert(signIn.response.ok, "Sign-in failed.");
    assert(signIn.json.account.appUserID === userID, "Sign-in returned the wrong user ID.");
    assert(signIn.json.account.backendSessionToken, "Sign-in did not return a backend session token.");
    assert(signIn.json.entitlement?.source === "lifetimeGrant", "Sign-in did not return the granted entitlement.");

    const invalidAppleTokenSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "bad-token-user",
          identityToken: "not-a-jwt"
        }
      }
    });
    assert(invalidAppleTokenSignIn.response.status === 401, "Invalid Apple identity token was accepted.");

    const attach = await request("/account/attach-local-data", {
      method: "POST",
      body: { account: signIn.json.account }
    });
    assert(attach.response.ok, "Attach local data failed.");
    assert(attach.json === "localDataAttached", "Attach local data returned the wrong state.");

    const profile = await request("/account/profile", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        publicUsername: "@Smoke-Pro",
        displayName: "Smoke Pro"
      }
    });
    assert(profile.response.ok, "Profile update failed.");
    assert(profile.json.account.publicUsername === "smoke-pro", "Profile update did not persist public username.");

    const attachAfterProfile = await request("/account/attach-local-data", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        account: {
          ...signIn.json.account,
          publicUsername: null,
          displayName: "Stale Local Name"
        }
      }
    });
    assert(attachAfterProfile.response.ok, "Attach local data after profile update failed.");
    const profileAfterAttach = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "smoke-user",
          displayName: "Smoke User Reinstall"
        }
      }
    });
    assert(
      profileAfterAttach.json.account.publicUsername === "smoke-pro",
      "Attach local data should not erase the server-owned public username."
    );
    assert(
      profileAfterAttach.json.entitlement?.source === "lifetimeGrant",
      "Re-sign-in did not return the persisted entitlement."
    );

    const secondSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "second-smoke-user",
          displayName: "Second Smoke User"
        }
      }
    });
    assert(secondSignIn.response.ok, "Second account sign-in failed.");

    const clientEntitlementPush = await request("/sync/push", {
      method: "POST",
      token: secondSignIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: "apple:second-smoke-user" },
        batch: {
          user: { id: "apple:second-smoke-user" },
          entitlement: {
            plan: "pro",
            source: "webSubscription",
            grantedUserID: "apple:second-smoke-user"
          },
          mutations: []
        }
      }
    });
    assert(clientEntitlementPush.response.ok, "Push with client entitlement failed.");
    assert(clientEntitlementPush.json.entitlement === null, "Push accepted a client-provided entitlement.");

    const secondSignInAfterClientEntitlement = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "second-smoke-user",
          displayName: "Second Smoke User"
        }
      }
    });
    assert(
      secondSignInAfterClientEntitlement.json.entitlement === null,
      "Client-provided entitlement persisted after sign-in."
    );

    const stripeCheckoutEvent = JSON.stringify({
      id: "evt_smoke_checkout",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_smoke",
          mode: "subscription",
          client_reference_id: "apple:second-smoke-user",
          customer: "cus_smoke",
          subscription: "sub_smoke",
          metadata: { accountUserID: "apple:second-smoke-user" }
        }
      }
    });
    const invalidStripeWebhook = await request("/billing/stripe/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=1,v1=bad"
      },
      rawBody: stripeCheckoutEvent
    });
    assert(invalidStripeWebhook.response.status === 400, "Stripe webhook accepted an invalid signature.");

    const stripeCheckoutWebhook = await request("/billing/stripe/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": stripeSignature(stripeCheckoutEvent, stripeWebhookSecret)
      },
      rawBody: stripeCheckoutEvent
    });
    assert(stripeCheckoutWebhook.response.ok, "Stripe checkout webhook failed.");
    assert(stripeCheckoutWebhook.json.changed === true, "Stripe checkout webhook did not update entitlement.");

    const secondSignInAfterStripeWebhook = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "second-smoke-user",
          displayName: "Second Smoke User"
        }
      }
    });
    assert(
      secondSignInAfterStripeWebhook.json.entitlement?.source === "webSubscription",
      "Stripe checkout webhook did not grant web subscription entitlement."
    );

    const stripeDeletedEvent = JSON.stringify({
      id: "evt_smoke_deleted",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_smoke",
          status: "canceled",
          customer: "cus_smoke"
        }
      }
    });
    const stripeDeletedWebhook = await request("/billing/stripe/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": stripeSignature(stripeDeletedEvent, stripeWebhookSecret)
      },
      rawBody: stripeDeletedEvent
    });
    assert(stripeDeletedWebhook.response.ok, "Stripe subscription delete webhook failed.");
    assert(stripeDeletedWebhook.json.changed === true, "Stripe subscription delete did not update entitlement.");

    const secondSignInAfterStripeDelete = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "second-smoke-user",
          displayName: "Second Smoke User"
        }
      }
    });
    assert(
      secondSignInAfterStripeDelete.json.entitlement === null,
      "Stripe subscription delete did not revoke web subscription entitlement."
    );

    const crossAccountProfile = await request("/account/profile", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: "apple:second-smoke-user" },
        publicUsername: "wrong-token-profile"
      }
    });
    assert(crossAccountProfile.response.status === 401, "Profile update allowed another account's session token.");

    const crossAccountPush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: "apple:second-smoke-user" },
        batch: {
          user: { id: "apple:second-smoke-user" },
          mutations: []
        }
      }
    });
    assert(crossAccountPush.response.status === 401, "Push allowed another account's session token.");

    const crossAccountPull = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: "apple:second-smoke-user" } }
    });
    assert(crossAccountPull.response.status === 401, "Pull allowed another account's session token.");

    const duplicateProfile = await request("/account/profile", {
      method: "POST",
      token: secondSignIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: "apple:second-smoke-user" },
        publicUsername: "smoke-pro"
      }
    });
    assert(duplicateProfile.response.status === 409, "Profile update allowed a duplicate public username.");

    const invalidProfile = await request("/account/profile", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        publicUsername: "bad name"
      }
    });
    assert(invalidProfile.response.status === 400, "Profile update allowed an invalid public username.");

    const unlinkedPasskeySignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "passkey",
          providerUserID: "unlinked-passkey"
        }
      }
    });
    assert(unlinkedPasskeySignIn.response.status === 404, "Unlinked passkey created a new account.");

    const passkeyCredentialID = "smoke-passkey-credential";
    const passkeyLink = await request("/account/passkeys/link", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        credentialID: passkeyCredentialID,
        account: signIn.json.account
      }
    });
    assert(passkeyLink.response.ok, "Passkey link failed.");
    assert(passkeyLink.json.account.appUserID === userID, "Passkey link returned the wrong account.");

    const passkeySignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "passkey",
          providerUserID: passkeyCredentialID
        }
      }
    });
    assert(passkeySignIn.response.ok, "Linked passkey sign-in failed.");
    assert(passkeySignIn.json.account.appUserID === userID, "Passkey sign-in did not restore the linked account.");
    assert(passkeySignIn.json.entitlement?.source === "lifetimeGrant", "Passkey sign-in did not restore entitlement.");

    const legacyStore = JSON.parse(await readFile(dataPath, "utf8"));
    legacyStore.users["passkey:legacy-bad-account"] = {
      appUserID: "passkey:legacy-bad-account",
      authProvider: "passkey",
      authProviderUserID: "legacy-bad-account",
      displayName: "Legacy Bad Account"
    };
    legacyStore.sessions["passkey:legacy-bad-account"] = "legacy-session";
    legacyStore.entitlements["passkey:legacy-bad-account"] = {
      plan: "pro",
      source: "subscription"
    };
    legacyStore.passkeyCredentials["legacy-bad-credential"] = "passkey:legacy-bad-account";
    legacyStore.mutationsByUserID["passkey:legacy-bad-account"] = [{
      savedItem: {
        id: "legacy-bad-saved-item",
        userID: "passkey:legacy-bad-account",
        codeVersion: "nyc-2022",
        sectionID: 202,
        createdAt: "2026-06-05T00:00:00Z",
        updatedAt: "2026-06-05T00:00:00Z"
      }
    }];
    await writeFile(dataPath, JSON.stringify(legacyStore, null, 2) + "\n");

    const unauthorizedLegacyCleanup = await request("/admin/accounts/delete-legacy-passkey-users", {
      method: "POST"
    });
    assert(unauthorizedLegacyCleanup.response.status === 401, "Legacy passkey cleanup allowed an unauthenticated request.");

    const legacyCleanup = await request("/admin/accounts/delete-legacy-passkey-users", {
      method: "POST",
      token: adminToken
    });
    assert(legacyCleanup.response.ok, "Legacy passkey cleanup failed.");
    assert(legacyCleanup.json.deletedCount === 1, "Legacy passkey cleanup deleted the wrong number of users.");
    assert(
      legacyCleanup.json.deletedUserIDs.includes("passkey:legacy-bad-account"),
      "Legacy passkey cleanup did not report the deleted user."
    );

    const linkedPasskeyAfterCleanup = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "passkey",
          providerUserID: passkeyCredentialID
        }
      }
    });
    assert(linkedPasskeyAfterCleanup.response.ok, "Legacy cleanup broke the linked Apple passkey.");
    assert(
      linkedPasskeyAfterCleanup.json.account.appUserID === userID,
      "Legacy cleanup changed the linked Apple passkey owner."
    );

    const legacyPasskeyAfterCleanup = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "passkey",
          providerUserID: "legacy-bad-credential"
        }
      }
    });
    assert(legacyPasskeyAfterCleanup.response.status === 404, "Legacy passkey credential still signs in after cleanup.");

    const unauthorizedPush = await request("/sync/push", {
      method: "POST",
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: []
        }
      }
    });
    assert(unauthorizedPush.response.status === 401, "Push allowed a missing session token.");

    const malformedPush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [{ unknown: { id: "bad", userID, updatedAt: "2026-06-04T00:00:00Z" } }]
        }
      }
    });
    assert(malformedPush.response.status === 400, "Push accepted an unsupported mutation kind.");

    const mismatchedUserPush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: "apple:wrong-user" },
          mutations: []
        }
      }
    });
    assert(mismatchedUserPush.response.status === 400, "Push accepted a mismatched batch user.");

    const mutation = {
      savedItem: {
        id: "saved-smoke",
        userID,
        codeVersion: "nyc-2022",
        sectionID: 101,
        createdAt: "2026-06-04T00:00:00Z",
        updatedAt: "2026-06-04T00:00:00Z"
      }
    };
    const push = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [mutation]
        }
      }
    });
    assert(push.response.ok, "Sync push failed.");
    assert(push.json.acceptedMutationIDs.includes("saved-smoke"), "Push did not accept the saved item mutation.");
    assert(Number.isInteger(push.json.latestEventID), "Push did not return a latest event ID.");
    assert(push.json.syncRevision === push.json.latestEventID, "Push sync revision did not match latest event ID.");

    const stalePush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [{
            savedItem: {
              ...mutation.savedItem,
              updatedAt: "2026-06-03T00:00:00Z"
            }
          }]
        }
      }
    });
    assert(stalePush.response.ok, "Stale push should report rejection without failing the request.");
    assert(!stalePush.json.acceptedMutationIDs.includes("saved-smoke"), "Stale push was accepted.");
    assert(stalePush.json.rejectedMutationIDs.includes("saved-smoke"), "Stale push was not reported as rejected.");

    const pull = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    assert(pull.response.ok, "Sync pull failed.");
    assert(Number.isInteger(pull.json.latestEventID), "Pull did not return a latest event ID.");
    assert(pull.json.syncRevision === pull.json.latestEventID, "Pull sync revision did not match latest event ID.");
    assert(pull.json.mutations.length === 1, "Pull did not return the pushed mutation.");

    const cursorPull = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID }, sinceEventID: pull.json.latestEventID }
    });
    assert(cursorPull.response.ok, "Event cursor sync pull failed.");
    assert(Number.isInteger(cursorPull.json.latestEventID), "Cursor pull did not return a latest event ID.");

    const projectMutation = {
      project: {
        id: "project-smoke",
        userID,
        codeVersion: "nyc-2022",
        clientID: "project-client-smoke",
        localFolderID: 42,
        name: "Smoke Project",
        description: "",
        colorHex: "#FF6B35",
        sortOrder: 0,
        updatedAt: "2026-06-04T00:00:00Z"
      }
    };
    const projectSectionMutation = {
      projectSection: {
        id: "project-section-smoke",
        userID,
        codeVersion: "nyc-2022",
        folderClientID: "project-client-smoke",
        localFolderID: 42,
        sectionID: 101,
        scope: "manual",
        updatedAt: "2026-06-06T00:00:00Z"
      }
    };
    const projectPush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [projectMutation, projectSectionMutation]
        }
      }
    });
    assert(projectPush.response.ok, "Project sync push failed.");
    assert(projectPush.json.acceptedMutationIDs.includes("project-smoke"), "Project mutation was not accepted.");
    assert(projectPush.json.acceptedMutationIDs.includes("project-section-smoke"), "Project section mutation was not accepted.");

    const tagMutation = {
      annotation: {
        id: "tags-smoke",
        userID,
        codeVersion: "nyc-2022",
        sectionID: 101,
        noteBody: null,
        tags: ["Concrete", "Permit"],
        updatedAt: "2026-06-07T00:00:00Z",
        deletedAt: null
      }
    };
    const continuityMutation = {
      continuity: {
        userID,
        codeVersion: "nyc-2022",
        values: {
          selectedCodeSectionID: "building",
          selectedVersionID: "nyc-2022",
          activeProjectID: "42"
        },
        updatedAt: "2026-06-08T00:00:00Z"
      }
    };
    const fullStatePush = await request("/sync/push", {
      method: "POST",
      token: profileAfterAttach.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: {
            id: userID,
            publicUsername: "smoke-pro",
            displayName: "Smoke Pro"
          },
          mutations: [tagMutation, continuityMutation]
        }
      }
    });
    assert(fullStatePush.response.ok, "Full restore-state push failed.");
    assert(fullStatePush.json.acceptedMutationIDs.includes("tags-smoke"), "Tag mutation was not accepted.");
    assert(
      fullStatePush.json.acceptedMutationIDs.includes(`${userID}:continuity:nyc-2022`),
      "Continuity mutation was not accepted."
    );

    const projectDependencyPull = await request("/sync/pull", {
      method: "POST",
      token: passkeySignIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        since: "2026-06-05T00:00:00Z"
      }
    });
    assert(projectDependencyPull.response.ok, "Project dependency pull failed.");
    const pulledKinds = projectDependencyPull.json.mutations.map(mutationKind);
    assert(pulledKinds.includes("projectSection"), "Pull did not include the newer project section.");
    assert(pulledKinds.includes("project"), "Pull did not include the parent project dependency.");

    const reinstallSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "smoke-user",
          displayName: "Smoke User Reinstalled"
        }
      }
    });
    assert(reinstallSignIn.response.ok, "Reinstall sign-in failed.");
    assert(
      reinstallSignIn.json.account.publicUsername === "smoke-pro",
      "Reinstall sign-in did not restore the profile."
    );
    assert(
      reinstallSignIn.json.entitlement?.plan === "pro",
      "Reinstall sign-in did not restore the Pro entitlement."
    );

    const reinstallPull = await request("/sync/pull", {
      method: "POST",
      token: reinstallSignIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    assert(reinstallPull.response.ok, "Reinstall pull failed.");
    const reinstallRecords = reinstallPull.json.mutations.map((mutation) => ({
      kind: mutationKind(mutation),
      record: mutationRecord(mutation)
    }));
    assert(
      reinstallRecords.some((item) => item.kind === "savedItem" && item.record.sectionID === 101),
      "Reinstall pull did not restore the saved section."
    );
    assert(
      reinstallRecords.some((item) => item.kind === "annotation" && item.record.tags?.includes("Concrete")),
      "Reinstall pull did not restore tags."
    );
    assert(
      reinstallRecords.some((item) => item.kind === "project" && item.record.clientID === "project-client-smoke"),
      "Reinstall pull did not restore the project."
    );
    assert(
      reinstallRecords.some((item) => item.kind === "projectSection" && item.record.folderClientID === "project-client-smoke"),
      "Reinstall pull did not restore the project membership."
    );
    assert(
      reinstallRecords.some((item) => item.kind === "continuity" && item.record.values.activeProjectID === "42"),
      "Reinstall pull did not restore continuity."
    );

    const unauthorizedChecklist = await request("/admin/accounts/restore-checklist", {
      method: "POST",
      body: { userID }
    });
    assert(unauthorizedChecklist.response.status === 401, "Restore checklist allowed an unauthenticated request.");

    const restoreChecklist = await request("/admin/accounts/restore-checklist", {
      method: "POST",
      token: adminToken,
      body: { userID }
    });
    assert(restoreChecklist.response.ok, "Restore checklist failed.");
    assert(restoreChecklist.json.hasAccount === true, "Restore checklist did not report the account.");
    assert(restoreChecklist.json.publicUsername === "smoke-pro", "Restore checklist did not report the profile.");
    assert(restoreChecklist.json.entitlement?.plan === "pro", "Restore checklist did not report the entitlement.");
    assert(restoreChecklist.json.hasSession === true, "Restore checklist did not report the session.");
    assert(restoreChecklist.json.passkeyCredentialCount === 1, "Restore checklist did not report the linked passkey.");
    assert(restoreChecklist.json.mutationCounts.savedItem === 1, "Restore checklist did not count saved items.");
    assert(restoreChecklist.json.mutationCounts.annotation === 1, "Restore checklist did not count annotations.");
    assert(restoreChecklist.json.mutationCounts.project === 1, "Restore checklist did not count projects.");
    assert(restoreChecklist.json.mutationCounts.projectSection === 1, "Restore checklist did not count project memberships.");
    assert(restoreChecklist.json.mutationCounts.continuity === 1, "Restore checklist did not count continuity.");

    const unauthorizedExport = await request("/admin/accounts/export", {
      method: "POST",
      body: { userID }
    });
    assert(unauthorizedExport.response.status === 401, "Account export allowed an unauthenticated request.");

    const accountExport = await request("/admin/accounts/export", {
      method: "POST",
      token: adminToken,
      body: { userID }
    });
    assert(accountExport.response.ok, "Account export failed.");
    assert(accountExport.json.account.appUserID === userID, "Account export did not include the account.");
    assert(accountExport.json.entitlement?.plan === "pro", "Account export did not include the entitlement.");
    assert(accountExport.json.hasSession === true, "Account export did not include session status.");
    assert(accountExport.json.passkeyCredentialIDs.includes(passkeyCredentialID), "Account export did not include the linked passkey.");
    assert(
      accountExport.json.mutations.some((item) => item.annotation?.tags?.includes("Concrete")),
      "Account export did not include tag mutations."
    );
    assert(
      accountExport.json.mutations.some((item) => item.project?.clientID === "project-client-smoke"),
      "Account export did not include project mutations."
    );

    const revoke = await request("/admin/lifetime-grants/revoke", {
      method: "POST",
      token: adminToken,
      body: { userID }
    });
    assert(revoke.response.ok, "Lifetime revoke failed.");
    assert(revoke.json.entitlement === null, "Lifetime revoke did not clear the entitlement.");
  } finally {
    server.kill();
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().then(
  () => {
    console.log("permitext-sync smoke passed");
  },
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);
