const baseURL = process.env.PERMITEXT_PRODUCTION_BASE_URL || "https://permitext-sync.vercel.app";
const shouldRun = process.env.PERMITEXT_RUN_PRODUCTION_IDENTITY_RESTORE === "1";
const providerUserID = process.env.PERMITEXT_PRODUCTION_TEST_USER || "production-identity-restore-smoke";
const passkeyCredentialID = process.env.PERMITEXT_PRODUCTION_TEST_PASSKEY || "production-identity-restore-passkey";
const userID = `apple:${providerUserID}`;

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

async function request(path, { method = "GET", body, token } = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  return { response, json };
}

async function main() {
  if (!shouldRun) {
    throw new Error(
      "Set PERMITEXT_RUN_PRODUCTION_IDENTITY_RESTORE=1 to run this production-writing test."
    );
  }

  const signIn = await request("/account/sign-in", {
    method: "POST",
    body: {
      credential: {
        provider: "apple",
        providerUserID,
        displayName: "Production Identity Restore Smoke",
        signedInAt: new Date().toISOString()
      }
    }
  });
  assert(signIn.response.ok, "Apple sign-in failed.");
  assert(signIn.json.account.appUserID === userID, "Apple sign-in returned the wrong account.");
  const token = signIn.json.account.backendSessionToken;
  assert(token, "Apple sign-in did not return a backend session token.");

  const profile = await request("/account/profile", {
    method: "POST",
    token,
    body: {
      auth: { accountUserID: userID },
      publicUsername: "production-restore-smoke",
      displayName: "Production Identity Restore Smoke"
    }
  });
  assert(profile.response.ok, "Profile update failed.");
  assert(profile.json.account.publicUsername === "production-restore-smoke", "Profile did not persist.");

  const passkeyLink = await request("/account/passkeys/link", {
    method: "POST",
    token,
    body: {
      auth: { accountUserID: userID },
      credentialID: passkeyCredentialID,
      account: profile.json.account
    }
  });
  assert(passkeyLink.response.ok, "Passkey link failed.");
  assert(passkeyLink.json.account.appUserID === userID, "Passkey link returned the wrong account.");

  const savedItem = {
    savedItem: {
      id: "production-restore-saved-item",
      userID,
      codeVersion: "nyc-2022",
      sectionID: 101,
      createdAt: "2026-06-05T00:00:00Z",
      updatedAt: "2026-06-05T00:00:00Z"
    }
  };
  const tags = {
    annotation: {
      id: "production-restore-tags",
      userID,
      codeVersion: "nyc-2022",
      sectionID: 101,
      noteBody: null,
      tags: ["ProductionSmoke"],
      updatedAt: "2026-06-05T00:01:00Z",
      deletedAt: null
    }
  };
  const project = {
    project: {
      id: "production-restore-project",
      userID,
      codeVersion: "nyc-2022",
      clientID: "production-restore-project-client",
      localFolderID: 9001,
      name: "Production Restore Smoke",
      description: "Synthetic production sync verification project.",
      colorHex: "#FF6B35",
      sortOrder: 0,
      updatedAt: "2026-06-05T00:02:00Z"
    }
  };
  const projectSection = {
    projectSection: {
      id: "production-restore-project-section",
      userID,
      codeVersion: "nyc-2022",
      folderClientID: "production-restore-project-client",
      localFolderID: 9001,
      sectionID: 101,
      scope: "manual",
      updatedAt: "2026-06-05T00:03:00Z"
    }
  };

  const push = await request("/sync/push", {
    method: "POST",
    token,
    body: {
      auth: { accountUserID: userID },
      batch: {
        user: {
          id: userID,
          publicUsername: "production-restore-smoke",
          displayName: "Production Identity Restore Smoke"
        },
        mutations: [savedItem, tags, project, projectSection]
      }
    }
  });
  assert(push.response.ok, "Sync push failed.");

  const passkeySignIn = await request("/account/sign-in", {
    method: "POST",
    body: {
      credential: {
        provider: "passkey",
        providerUserID: passkeyCredentialID,
        signedInAt: new Date().toISOString()
      }
    }
  });
  assert(passkeySignIn.response.ok, "Linked passkey sign-in failed.");
  assert(passkeySignIn.json.account.appUserID === userID, "Passkey did not restore the Apple account.");
  assert(
    passkeySignIn.json.account.publicUsername === "production-restore-smoke",
    "Passkey did not restore the public username."
  );

  const pull = await request("/sync/pull", {
    method: "POST",
    token: passkeySignIn.json.account.backendSessionToken,
    body: { auth: { accountUserID: userID } }
  });
  assert(pull.response.ok, "Passkey restore pull failed.");
  const records = pull.json.mutations.map((mutation) => ({
    kind: mutationKind(mutation),
    record: mutationRecord(mutation)
  }));
  assert(records.some((item) => item.kind === "savedItem" && item.record.sectionID === 101), "Saved item was not restored.");
  assert(records.some((item) => item.kind === "annotation" && item.record.tags?.includes("ProductionSmoke")), "Tags were not restored.");
  assert(records.some((item) => item.kind === "project" && item.record.clientID === "production-restore-project-client"), "Project was not restored.");
  assert(records.some((item) => item.kind === "projectSection" && item.record.folderClientID === "production-restore-project-client"), "Project membership was not restored.");
}

main().then(
  () => {
    console.log(`permitext production identity restore passed: ${baseURL}`);
  },
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);
