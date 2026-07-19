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
const defaultSyncCodeVersion = "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1";

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
  const json = text && response.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) : null;
  return { response, json, text };
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
      VERCEL: "",
      VERCEL_ENV: "",
      PERMITEXT_SYNC_DATA_PATH: dataPath,
      PERMITEXT_SYNC_DATABASE_URL: "",
      DATABASE_URL: "",
      STORAGE_URL: "",
      POSTGRES_URL: "",
      NEON_DATABASE_URL: "",
      BLOB_READ_WRITE_TOKEN: "",
      VERCEL_OIDC_TOKEN: "",
      BLOB_STORE_ID: "",
      PERMITEXT_SYNC_ADMIN_TOKEN: adminToken,
      APPLE_TEAM_ID: "ABCDE12345",
      APPLE_BUNDLE_ID: "com.randycodex.permitext",
      APPLE_SERVICE_ID: "com.randycodex.permitext.web",
      PERMITEXT_PUBLIC_BASE_URL: baseURL,
      PERMITEXT_RESEARCH_MOCK: "1",
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
    assert(
      aasa.json.applinks.details.some((detail) =>
        detail.appID === "ABCDE12345.com.randycodex.permitext" &&
        detail.paths?.includes("/open/section/*")
      ),
      "AASA payload did not advertise section universal links."
    );

    const webRoot = await request("/");
    assert(webRoot.response.ok, "Web root did not load.");
    assert(webRoot.response.headers.get("content-type")?.includes("text/html"), "Web root did not return HTML.");
    assert(webRoot.response.headers.get("x-content-type-options") === "nosniff", "Web root omitted security headers.");
    assert(webRoot.response.headers.get("content-security-policy")?.includes("script-src"), "Web root omitted its CSP.");
    assert(!webRoot.text.includes("reader-share"), "Web reader unexpectedly included its retired section share control.");
    assert(webRoot.text.includes('aria-label="Research"'), "Web workspace omitted its research tool.");
    assert(!webRoot.text.includes('id="workboard-dock"'), "Web workspace still included the retired fixed Workboard dock.");
    assert(
      webRoot.text.includes("hidden-scrollbars"),
      "Web workspace omitted the hidden-scrollbar assets."
    );

    const workspaceScript = await request("/web/app.js");
    assert(workspaceScript.response.ok, "Web workspace script did not load.");
    assert(
      workspaceScript.response.headers.get("content-type")?.includes("javascript"),
      "Web workspace script returned the wrong content type."
    );
    assert(
      workspaceScript.response.headers.get("cache-control")?.includes("immutable"),
      "Versioned web workspace assets were not browser-cacheable."
    );
    assert(
      !workspaceScript.text.includes("if (popup.closed) void reattachProjectWorkboard(identity)"),
      "Detached Workboards still auto-reattached from an unreliable popup.closed check."
    );
    assert(
      !workspaceScript.text.includes("track.replaceChildren(...nodes)"),
      "Column transitions still detach and reattach the complete workspace."
    );
    assert(
      workspaceScript.text.includes("window.requestAnimationFrame(applyPendingResize)"),
      "Divider resizing is no longer coalesced to animation frames."
    );
    assert(
      workspaceScript.text.includes("paneIDForSectionDetail(searchID),"),
      "Search result changes no longer refresh their existing section-detail column."
    );
    assert(
      !workspaceScript.text.includes('notesTitle.textContent = "Notes"'),
      "Section details still render the retired Notes heading."
    );
    assert(
      workspaceScript.text.includes("const identity = projectDetailKey(project);"),
      "Project cards no longer deduplicate local and synced records by their stable identity."
    );

    const workspaceStyles = await request("/web/styles.css");
    assert(workspaceStyles.response.ok, "Web workspace stylesheet did not load.");
    assert(
      !workspaceStyles.text.includes(".panel-track.is-resizing *"),
      "Divider resizing still invalidates cursor styles across every workspace descendant."
    );
    assert(
      workspaceStyles.text.includes(".section-detail-tags .annotation-tag-input"),
      "Section-detail tag inputs omitted their pill treatment."
    );
    assert(
      workspaceStyles.text.includes("*::-webkit-scrollbar") &&
        workspaceStyles.text.includes("scrollbar-width: none !important"),
      "Web workspace no longer hides native scrollbars globally."
    );
    assert(
      workspaceStyles.text.includes(".reader-scroll-indicator") &&
        workspaceStyles.text.includes("display: none;"),
      "Reader workspace still renders its custom scroll indicator."
    );

    const workboardScript = await request("/web/workboard-assets/workboard.js");
    assert(workboardScript.response.ok, "Nested Workboard script asset did not load.");
    assert(
      workboardScript.response.headers.get("content-type")?.includes("javascript"),
      "Workboard script asset returned the wrong content type."
    );
    assert(
      workboardScript.response.headers.get("cache-control")?.includes("immutable"),
      "Versioned Workboard assets were not browser-cacheable."
    );
    const workboardStyles = await request("/web/workboard-assets/workboard.css");
    assert(workboardStyles.response.ok, "Nested Workboard stylesheet asset did not load.");
    assert(
      workboardStyles.response.headers.get("content-type")?.includes("text/css"),
      "Workboard stylesheet asset returned the wrong content type."
    );
    const workboardFont = await request(
      "/web/workboard-assets/fonts/Xiaolai/Xiaolai-Regular-353f33792a8f60dc69323ddf635a269e.woff2"
    );
    assert(workboardFont.response.ok, "Nested Workboard font asset did not load.");
    assert(
      workboardFont.response.headers.get("content-type")?.includes("font/woff2"),
      "Workboard font asset returned the wrong content type."
    );

    const sharedSectionLink = await request("/open/section/8881");
    assert(sharedSectionLink.response.ok, "Shared section URL did not load the web workspace.");
    assert(
      sharedSectionLink.response.headers.get("content-type")?.includes("text/html"),
      "Shared section URL did not return the web workspace HTML."
    );

    const detachedWorkboard = await request("/detached-workboard");
    assert(detachedWorkboard.response.ok, "Detached Workboard URL did not load the web workspace.");
    assert(
      detachedWorkboard.response.headers.get("content-type")?.includes("text/html"),
      "Detached Workboard URL did not return the web workspace HTML."
    );

    const canonicalOverrideSection = await request("/code/sections/8881");
    assert(canonicalOverrideSection.response.ok, "Canonical section override did not load.");
    assert(canonicalOverrideSection.json.section.sectionID === 8881, "Canonical section override returned the wrong ID.");
    assert(canonicalOverrideSection.json.section.chapterID, "Canonical section response omitted its chapter ID.");
    assert(canonicalOverrideSection.json.section.codePrefix, "Canonical section response omitted its code prefix.");
    assert(canonicalOverrideSection.json.section.sectionNumber, "Canonical section response omitted its section number.");
    assert(
      canonicalOverrideSection.json.section.blocks?.some((block) =>
        block.plainText?.includes("real time enforcement unit")
      ),
      "Web reader did not prefer the canonical iPhone section body."
    );
    const missingSharedSection = await request("/code/sections/999999999");
    assert(missingSharedSection.response.status === 404, "Unknown shared section did not return 404.");

    const sectionBatch = await request("/code/sections?ids=8881,8882,999999999");
    assert(sectionBatch.response.ok, "Canonical section metadata batch did not load.");
    assert(
      sectionBatch.json.sections.map((section) => section.sectionID || section.id).join(",") === "8881,8882",
      "Canonical section metadata batch returned unexpected sections or order."
    );
    assert(
      sectionBatch.json.sections.map((section) => section.requestedID).join(",") === "8881,8882",
      "Canonical section metadata batch did not preserve requested IDs."
    );
    const oversizedSectionBatch = await request(`/code/sections?ids=${Array.from({ length: 101 }, (_, index) => index + 1).join(",")}`);
    assert(oversizedSectionBatch.response.status === 400, "Oversized section metadata batch was not rejected.");

    const duplicateNumberChapter = await request("/code/chapters/47");
    assert(duplicateNumberChapter.response.ok, "Duplicate-number appendix chapter did not load.");
    const duplicateNumberSections = duplicateNumberChapter.json.chapter.sections.filter((section) =>
      section.sectionNumber === "8.5"
    );
    assert(duplicateNumberSections.length === 2, "Duplicate-number appendix provisions were collapsed.");
    assert(
      new Set(duplicateNumberSections.map((section) => section.id)).size === 2,
      "Duplicate-number appendix provisions did not retain distinct canonical IDs."
    );

    const searchGolden = JSON.parse(await readFile(new URL(
      "../../NYC CC APP/Tools/search-regression/golden-results.json",
      import.meta.url
    ), "utf8"));
    for (const [query, expectedIDs] of Object.entries(searchGolden)) {
      const search = await request(`/code/search?q=${encodeURIComponent(query)}&limit=200`);
      assert(search.response.ok, `Canonical web search failed for ${query}.`);
      const actualIDs = search.json.results.map((result) => result.id);
      const firstMismatch = expectedIDs.findIndex((id, index) => actualIDs[index] !== id);
      assert(
        JSON.stringify(actualIDs) === JSON.stringify(expectedIDs),
        `Canonical web search drifted from iPhone ordering for ${query}: ` +
          `expected ${expectedIDs.length}, received ${actualIDs.length}, first mismatch at ${firstMismatch} ` +
          `(${expectedIDs[firstMismatch]} vs ${actualIDs[firstMismatch]}).`
      );
    }

    const appleWebConfig = await request("/account/apple-web-config");
    assert(appleWebConfig.response.ok, "Apple web sign-in config failed.");
    assert(appleWebConfig.json.available === true, "Apple web sign-in config did not report availability.");
    assert(
      appleWebConfig.json.clientID === "com.randycodex.permitext.web",
      "Apple web sign-in config returned the wrong client ID."
    );
    assert(
      appleWebConfig.json.redirectURI === `${baseURL}/account/apple/callback`,
      "Apple web sign-in config returned the wrong redirect URI."
    );
    assert(
      appleWebConfig.json.identityTokenRequired === false,
      "Local smoke configuration unexpectedly required a real Apple identity token."
    );

    const appleWebStart = await request("/account/apple/start", {
      method: "POST",
      body: { successURL: "/" }
    });
    assert(appleWebStart.response.ok, "Apple web sign-in start failed.");
    assert(
      appleWebStart.json.authorizationURL?.startsWith("https://appleid.apple.com/auth/authorize?"),
      "Apple web sign-in start did not return an Apple authorize URL."
    );
    assert(
      appleWebStart.response.headers.get("set-cookie")?.includes("permitext_apple_oauth="),
      "Apple web sign-in start did not set the OAuth state cookie."
    );
    const productionAppleWebStart = await request("/account/apple/start", {
      method: "POST",
      body: { successURL: "/" },
      headers: { "x-forwarded-host": "permitext-sync.vercel.app" }
    });
    const productionAppleCookie = productionAppleWebStart.response.headers.get("set-cookie") || "";
    assert(productionAppleCookie.includes("SameSite=None"), "Production Apple OAuth cookie must allow cross-site form POST.");
    assert(productionAppleCookie.includes("Secure"), "Production Apple OAuth cookie must be Secure.");

    const appleWebCallback = await request("/account/apple/callback");
    assert(appleWebCallback.response.ok, "Apple web sign-in callback did not load.");
    assert(
      appleWebCallback.response.headers.get("content-type")?.includes("text/html"),
      "Apple web sign-in callback did not return HTML."
    );
    assert(
      appleWebCallback.response.headers.get("content-security-policy")?.includes("nonce-"),
      "Apple web sign-in callback CSP omitted its script nonce."
    );
    assert(appleWebCallback.text.includes("<script nonce="), "Apple web sign-in callback script omitted its nonce.");

    const webCheckoutFallback = await request("/web/?checkout=success");
    assert(webCheckoutFallback.response.ok, "Legacy checkout return URL did not load.");
    assert(
      webCheckoutFallback.response.headers.get("content-type")?.includes("text/html"),
      "Legacy checkout return URL did not return HTML."
    );

    const checkoutReturn = await request("/?checkout=success&session_id=cs_smoke");
    assert(checkoutReturn.response.ok, "Checkout return URL with session ID did not load.");
    assert(
      checkoutReturn.response.headers.get("content-type")?.includes("text/html"),
      "Checkout return URL with session ID did not return HTML."
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

    const unauthorizedResearch = await request("/research/interpret", {
      method: "POST",
      body: {
        auth: { accountUserID: userID },
        question: "What notice is required?",
        sectionIDs: ["8881"]
      }
    });
    assert(unauthorizedResearch.response.status === 401, "Research interpretation allowed an unauthenticated request.");

    const emptyResearchQuestion = await request("/research/interpret", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        question: "",
        sectionIDs: ["8881"]
      }
    });
    assert(emptyResearchQuestion.response.status === 400, "Research interpretation accepted an empty question.");

    const unknownResearchSection = await request("/research/interpret", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        question: "What notice is required?",
        sectionIDs: ["999999999"]
      }
    });
    assert(unknownResearchSection.response.status === 400, "Research interpretation accepted an unknown section.");

    const researchInterpretation = await request("/research/interpret", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        question: "What notice is required before work begins?",
        sectionIDs: ["8881"],
        evidence: "The client must not be allowed to supply model evidence."
      }
    });
    assert(researchInterpretation.response.ok, "Research interpretation failed in mock mode.");
    assert(researchInterpretation.json.mode === "mock", "Research interpretation did not report mock mode.");
    assert(researchInterpretation.json.model === "permitext-mock", "Research interpretation reported the wrong mock model.");
    assert(
      researchInterpretation.json.evidenceSectionIDs.join(",") === "8881",
      "Research interpretation did not use the requested canonical evidence."
    );
    assert(
      researchInterpretation.json.citations.length === 1 && researchInterpretation.json.citations[0].sectionID === "8881",
      "Research interpretation returned an unverified citation."
    );
    assert(
      researchInterpretation.json.disclaimer.includes("not an official code determination"),
      "Research interpretation omitted its authority disclaimer."
    );

    const browserCredentialID = "smoke-browser";
    const browserSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "web",
          providerUserID: browserCredentialID,
          displayName: "Smoke Browser"
        }
      }
    });
    assert(browserSignIn.response.ok, "Browser sign-in failed.");
    const browserGrant = await request("/admin/lifetime-grants/grant", {
      method: "POST",
      token: adminToken,
      body: { userID: browserSignIn.json.account.appUserID }
    });
    assert(browserGrant.response.ok, "Browser entitlement grant failed.");
    const appleRepairSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "repair-target",
          displayName: "Repair Target"
        }
      }
    });
    assert(appleRepairSignIn.response.ok, "Apple repair target sign-in failed.");
    const browserLink = await request("/account/link-browser", {
      method: "POST",
      token: appleRepairSignIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: appleRepairSignIn.json.account.appUserID },
        browserCredentialID
      }
    });
    assert(browserLink.response.ok, "Browser account link failed.");
    assert(browserLink.json.entitlement?.grantedUserID === appleRepairSignIn.json.account.appUserID, "Browser entitlement was not transferred to Apple.");
    assert(browserLink.json.mergedAccount?.sourceUserID === browserSignIn.json.account.appUserID, "Browser account link did not report the merged source.");

    const restoreWithoutStripe = await request("/billing/stripe/restore", {
      method: "POST",
      token: appleRepairSignIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: appleRepairSignIn.json.account.appUserID },
        restoreID: "sub_smoke"
      }
    });
    assert(restoreWithoutStripe.response.status === 503, "Stripe restore should be disabled without Stripe checkout configuration.");

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

    const unsupportedProviderSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "guest",
          providerUserID: "unsupported-provider"
        }
      }
    });
    assert(unsupportedProviderSignIn.response.status === 400, "Unsupported account provider was accepted.");

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

    const mergeWebSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "web",
          providerUserID: "merge-web-smoke",
          displayName: "Merge Web"
        }
      }
    });
    assert(mergeWebSignIn.response.ok, "Merge source web sign-in failed.");
    const mergeSourceUserID = mergeWebSignIn.json.account.appUserID;
    const mergeSourceToken = mergeWebSignIn.json.account.backendSessionToken;
    const mergeAppleUserID = "apple:merge-apple-smoke";
    const mergeGrant = await request("/admin/lifetime-grants/grant", {
      method: "POST",
      token: adminToken,
      body: { userID: mergeSourceUserID }
    });
    assert(mergeGrant.response.ok, "Merge source lifetime grant failed.");
    const mergeSavedMutation = {
      savedItem: {
        id: `${mergeSourceUserID}:saved:nyc-2022:900001`,
        userID: mergeSourceUserID,
        codeVersion: "nyc-2022",
        sectionID: 900001,
        updatedAt: new Date().toISOString()
      }
    };
    const mergeSourcePush = await request("/sync/push", {
      method: "POST",
      token: mergeSourceToken,
      body: {
        auth: { accountUserID: mergeSourceUserID },
        batch: {
          user: { id: mergeSourceUserID },
          mutations: [mergeSavedMutation]
        }
      }
    });
    assert(mergeSourcePush.response.ok, "Merge source push failed.");
    const mergeAppleSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "merge-apple-smoke",
          displayName: "Merge Apple"
        },
        linkFrom: {
          accountUserID: mergeSourceUserID,
          sessionToken: mergeSourceToken
        }
      }
    });
    assert(mergeAppleSignIn.response.ok, "Apple sign-in with linked web account failed.");
    assert(mergeAppleSignIn.json.account.appUserID === mergeAppleUserID, "Merge returned the wrong Apple account.");
    assert(mergeAppleSignIn.json.mergedAccount?.sourceUserID === mergeSourceUserID, "Merge source was not reported.");
    assert(mergeAppleSignIn.json.entitlement?.grantedUserID === mergeAppleUserID, "Merge did not transfer entitlement.");
    const mergeApplePull = await request("/sync/pull", {
      method: "POST",
      token: mergeAppleSignIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: mergeAppleUserID } }
    });
    assert(mergeApplePull.response.ok, "Merged Apple pull failed.");
    const mergedSaved = mergeApplePull.json.mutations.find((mutation) => mutation.savedItem);
    assert(mergedSaved?.savedItem.userID === mergeAppleUserID, "Merged saved item user ID was not retargeted.");
    assert(
      mergedSaved?.savedItem.id === `${mergeAppleUserID}:saved:${defaultSyncCodeVersion}:900001`,
      "Merged saved item ID was not retargeted."
    );
    const mergeSourcePull = await request("/sync/pull", {
      method: "POST",
      token: mergeSourceToken,
      body: { auth: { accountUserID: mergeSourceUserID } }
    });
    assert(mergeSourcePull.response.status === 401, "Merged source account session still worked.");

    const nativeAppleSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "native-apple-subject",
          email: "shared-apple@example.com",
          displayName: "Native Apple"
        }
      }
    });
    assert(nativeAppleSignIn.response.ok, "Native Apple sign-in failed.");
    const nativeAppleUserID = nativeAppleSignIn.json.account.appUserID;
    const nativeAppleToken = nativeAppleSignIn.json.account.backendSessionToken;
    const nativeAnnotationID = `${nativeAppleUserID}:note:${defaultSyncCodeVersion}:545:rid-0-0-0-164259`;
    const nativeAnnotationPush = await request("/sync/push", {
      method: "POST",
      token: nativeAppleToken,
      body: {
        auth: { accountUserID: nativeAppleUserID },
        batch: {
          user: { id: nativeAppleUserID },
          mutations: [{
            annotation: {
              id: nativeAnnotationID,
              userID: nativeAppleUserID,
              codeVersion: defaultSyncCodeVersion,
              sectionID: 545,
              blockID: "rid-0-0-0-164259",
              noteBody: "Native note",
              updatedAt: new Date().toISOString()
            }
          }]
        }
      }
    });
    assert(nativeAnnotationPush.response.ok, "Native Apple annotation push failed.");
    const webAppleSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "web-apple-subject",
          email: "shared-apple@example.com",
          displayName: "Web Apple"
        }
      }
    });
    assert(webAppleSignIn.response.ok, "Web Apple sign-in failed.");
    assert(webAppleSignIn.json.account.appUserID === nativeAppleUserID, "Web Apple sign-in did not reuse the native Apple account.");
    assert(
      webAppleSignIn.json.account.linkedAppleUserIDs?.includes("web-apple-subject"),
      "Web Apple subject was not linked to the native account."
    );
    const webApplePull = await request("/sync/pull", {
      method: "POST",
      token: webAppleSignIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: nativeAppleUserID } }
    });
    assert(webApplePull.response.ok, "Web Apple pull failed.");
    assert(
      webApplePull.json.mutations.some((mutation) => mutation.annotation?.noteBody === "Native note"),
      "Web Apple account did not pull the native Apple annotation."
    );

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
    const secondPullAfterStripeWebhook = await request("/sync/pull", {
      method: "POST",
      token: secondSignInAfterStripeWebhook.json.account.backendSessionToken,
      body: { auth: { accountUserID: "apple:second-smoke-user" } }
    });
    assert(
      secondPullAfterStripeWebhook.json.entitlement?.source === "webSubscription",
      "Sync pull did not return the web subscription entitlement."
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
    assert(unlinkedPasskeySignIn.response.status === 410, "Passkey sign-in was not disabled.");

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
    assert(passkeyLink.response.status === 410, "Passkey registration was not disabled.");

    const passkeySignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "passkey",
          providerUserID: passkeyCredentialID
        }
      }
    });
    assert(passkeySignIn.response.status === 410, "A disabled passkey credential was accepted.");

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

    const legacyPasskeyAfterCleanup = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "passkey",
          providerUserID: "legacy-bad-credential"
        }
      }
    });
    assert(legacyPasskeyAfterCleanup.response.status === 410, "Legacy passkey sign-in was not disabled.");

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

    const oversizedPush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: { user: { id: userID }, mutations: Array.from({ length: 101 }, () => ({})) }
      }
    });
    assert(oversizedPush.response.status === 413, "Push accepted an oversized mutation batch.");

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
        sectionID: 900001,
        createdAt: "2026-06-04T00:00:00Z",
        updatedAt: "2026-06-04T00:00:00Z"
      }
    };
    const savedSmokeRecordID = `${userID}:saved:${defaultSyncCodeVersion}:900001`;
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
    assert(push.json.acceptedMutationIDs.includes(savedSmokeRecordID), "Push did not accept the saved item mutation.");
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
    assert(!stalePush.json.acceptedMutationIDs.includes(savedSmokeRecordID), "Stale push was accepted.");
    assert(stalePush.json.rejectedMutationIDs.includes(savedSmokeRecordID), "Stale push was not reported as rejected.");

    const pull = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    assert(pull.response.ok, "Sync pull failed.");
    assert(Number.isInteger(pull.json.latestEventID), "Pull did not return a latest event ID.");
    assert(pull.json.syncRevision === pull.json.latestEventID, "Pull sync revision did not match latest event ID.");
    assert(pull.json.contentMapVersion === 2, "Pull did not return the canonical content-map version.");
    assert(pull.json.mutations.length === 1, "Pull did not return the pushed mutation.");

    const invalidInlineWorkboardPush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [{
            workboard: {
              id: "invalid-inline-workboard",
              userID,
              codeVersion: "nyc-2022",
              projectID: "project-client-smoke",
              elements: [],
              appState: {},
              files: { image: { dataURL: "data:image/png;base64,AA==" } },
              assets: {},
              updatedAt: "2026-06-04T00:10:00Z"
            }
          }]
        }
      }
    });
    assert(invalidInlineWorkboardPush.response.status === 400, "Workboard push accepted inline image data.");

    const workboardMutation = {
      workboard: {
        id: "local-workboard-id",
        userID,
        codeVersion: "nyc-2022",
        projectID: "project-client-smoke",
        projectName: "Smoke Project",
        elements: [{ id: "rectangle-smoke", type: "rectangle" }],
        appState: { viewBackgroundColor: "#ffffff" },
        files: {},
        assets: {},
        updatedAt: "2026-06-04T00:20:00Z"
      }
    };
    const canonicalWorkboardRecordID = `${userID}:workboard:project-client-smoke`;
    const workboardPush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: { user: { id: userID }, mutations: [workboardMutation] }
      }
    });
    assert(workboardPush.response.ok, "Workboard sync push failed.");
    assert(
      workboardPush.json.acceptedMutationIDs.includes(canonicalWorkboardRecordID),
      "Workboard sync did not use its canonical project-scoped ID."
    );

    const workboardPull = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    const pulledWorkboard = workboardPull.json.mutations.find((item) =>
      item.workboard?.id === canonicalWorkboardRecordID
    )?.workboard;
    assert(pulledWorkboard?.elements?.[0]?.id === "rectangle-smoke", "Workboard pull omitted drawing elements.");
    assert(!Object.values(pulledWorkboard.files || {}).some((file) => file.dataURL), "Workboard pull exposed inline image data.");

    const unauthorizedAssetUpload = await request("/workboards/assets/upload?projectID=project-client-smoke&fileID=image-smoke", {
      method: "POST",
      headers: {
        "content-type": "image/png",
        "x-permitext-user-id": userID
      },
      rawBody: Buffer.from([0x89, 0x50, 0x4e, 0x47])
    });
    assert(unauthorizedAssetUpload.response.status === 401, "Workboard asset upload allowed a missing session token.");

    const unconfiguredAssetUpload = await request("/workboards/assets/upload?projectID=project-client-smoke&fileID=image-smoke", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      headers: {
        "content-type": "image/png",
        "x-permitext-user-id": userID
      },
      rawBody: Buffer.from([0x89, 0x50, 0x4e, 0x47])
    });
    assert(unconfiguredAssetUpload.response.status === 503, "Workboard asset upload did not report missing private Blob storage.");

    const forgedAssetDelete = await request("/workboards/assets/delete", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        projectID: "project-client-smoke",
        pathnames: ["workboards/another-user/another-project/image.png"]
      }
    });
    assert(forgedAssetDelete.response.status === 403, "Workboard asset deletion accepted another project's pathname.");

    const webSavedMutation = {
      savedItem: {
        id: "web-saved-202",
        userID,
        codeVersion: "nyc-2022",
        codePrefix: "BC",
        chapterNumber: "2",
        sectionID: 202,
        sectionNumber: "202",
        title: "Definitions",
        updatedAt: "2026-06-04T01:00:00Z"
      }
    };
    const webSavePush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [webSavedMutation]
        }
      }
    });
    const canonicalSavedRecordID = `${userID}:saved:${defaultSyncCodeVersion}:113`;
    assert(webSavePush.response.ok, "Web-style saved push failed.");
    assert(
      webSavePush.json.acceptedMutationIDs.includes(canonicalSavedRecordID),
      "Web-style saved push was not normalized to the shared saved record ID."
    );

    const iosAfterWebSavePull = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    assert(iosAfterWebSavePull.response.ok, "iOS pull after web save failed.");
    assert(
      iosAfterWebSavePull.json.mutations.some((item) =>
        item.savedItem?.id === canonicalSavedRecordID &&
        item.savedItem?.sectionID === 113 &&
        !item.savedItem?.deletedAt
      ),
      "iOS pull did not receive the web-created saved section."
    );

    const iosDeleteMutation = {
      savedItem: {
        id: canonicalSavedRecordID,
        userID,
        codeVersion: "nyc-2022",
        sectionID: 113,
        updatedAt: "2026-06-04T02:00:00Z",
        deletedAt: "2026-06-04T02:00:00Z"
      }
    };
    const iosDeletePush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [iosDeleteMutation]
        }
      }
    });
    assert(iosDeletePush.response.ok, "iOS delete push failed.");
    assert(
      iosDeletePush.json.acceptedMutationIDs.includes(canonicalSavedRecordID),
      "iOS delete did not replace the web save record."
    );

    const webAfterIOSDeletePull = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    assert(webAfterIOSDeletePull.response.ok, "Web pull after iOS delete failed.");
    const deletedSavedRecord = webAfterIOSDeletePull.json.mutations.find((item) =>
      item.savedItem?.id === canonicalSavedRecordID
    )?.savedItem;
    assert(deletedSavedRecord?.deletedAt, "Web pull did not receive the iOS delete tombstone.");

    const legacyWebAnnotationPush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [{
            annotation: {
              id: "web-annotation-legacy-540",
              userID,
              codeVersion: "nyc-2022",
              sectionID: 540,
              blockID: "4-html-1",
              noteBody: "Legacy web note should land on the iOS paragraph.",
              updatedAt: "2026-06-04T03:00:00Z"
            }
          }]
        }
      }
    });
    const canonicalLegacyAnnotationID = `${userID}:note:${defaultSyncCodeVersion}:4:rid-0-0-0-164248`;
    assert(legacyWebAnnotationPush.response.ok, "Legacy web annotation push failed.");
    assert(
      legacyWebAnnotationPush.json.acceptedMutationIDs.includes(canonicalLegacyAnnotationID),
      "Legacy web annotation was not normalized to the iOS section and paragraph IDs."
    );

    const cursorRepairPull = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        sinceEventID: legacyWebAnnotationPush.json.latestEventID
      }
    });
    assert(cursorRepairPull.response.ok, "Cursor repair pull failed.");
    const repairedLegacyAnnotation = cursorRepairPull.json.mutations.find((item) =>
      item.annotation?.id === canonicalLegacyAnnotationID
    )?.annotation;
    assert(
      repairedLegacyAnnotation?.sectionID === 4,
      "Cursor pull did not repair the legacy web section ID."
    );
    assert(repairedLegacyAnnotation?.webSectionID === 540, "Cursor pull did not preserve the legacy web section ID.");
    assert(
      repairedLegacyAnnotation?.blockID === "rid-0-0-0-164248",
      "Cursor pull did not repair the legacy web paragraph block ID."
    );

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
        sectionID: 900001,
        scope: "manual",
        updatedAt: "2026-06-06T00:00:00Z"
      }
    };
    const projectRecordID = `${userID}:project:${defaultSyncCodeVersion}:project-client-smoke`;
    const projectSectionRecordID = `${userID}:project-section:${defaultSyncCodeVersion}:project-client-smoke:900001:manual`;
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
    assert(projectPush.json.acceptedMutationIDs.includes(projectRecordID), "Project mutation was not accepted.");
    assert(projectPush.json.acceptedMutationIDs.includes(projectSectionRecordID), "Project section mutation was not accepted.");

    const tagMutation = {
      annotation: {
        id: "tags-smoke",
        userID,
        codeVersion: "nyc-2022",
        sectionID: 900001,
        noteBody: null,
        tags: ["Concrete", "Permit"],
        updatedAt: "2026-06-07T00:00:00Z",
        deletedAt: null
      }
    };
    const tagRecordID = `${userID}:tags:${defaultSyncCodeVersion}:900001`;
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
    assert(fullStatePush.json.acceptedMutationIDs.includes(tagRecordID), "Tag mutation was not accepted.");
    assert(
      fullStatePush.json.acceptedMutationIDs.includes(`${userID}:continuity:nyc-2022`),
      "Continuity mutation was not accepted."
    );

    const projectDependencyPull = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
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
      reinstallRecords.some((item) => item.kind === "savedItem" && item.record.sectionID === 900001),
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
      reinstallRecords.some((item) => item.kind === "workboard" && item.record.projectID === "project-client-smoke"),
      "Reinstall pull did not restore the Workboard."
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
    assert(restoreChecklist.json.passkeyCredentialCount === 0, "Restore checklist reported an active passkey credential.");
    assert(restoreChecklist.json.mutationCounts.savedItem === 2, "Restore checklist did not count saved items and delete tombstones.");
    assert(restoreChecklist.json.mutationCounts.annotation === 2, "Restore checklist did not count annotations.");
    assert(restoreChecklist.json.mutationCounts.project === 1, "Restore checklist did not count projects.");
    assert(restoreChecklist.json.mutationCounts.projectSection === 1, "Restore checklist did not count project memberships.");
    assert(restoreChecklist.json.mutationCounts.workboard === 1, "Restore checklist did not count Workboards.");
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
    assert(accountExport.json.passkeyCredentialIDs.length === 0, "Account export reported an active passkey credential.");
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

    const signOut = await request("/account/sign-out", {
      method: "POST",
      token: reinstallSignIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    assert(signOut.response.ok && signOut.json.signedOut === true, "Account sign-out failed.");
    const pullAfterSignOut = await request("/sync/pull", {
      method: "POST",
      token: reinstallSignIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    assert(pullAfterSignOut.response.status === 401, "A revoked session remained usable.");

    const oversizedBody = await request("/account/profile", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.20"
      },
      rawBody: JSON.stringify({ padding: "x".repeat(1024 * 1024) })
    });
    assert(oversizedBody.response.status === 413, "Oversized request body was not rejected.");

    let rateLimitedResponse = null;
    for (let attempt = 0; attempt < 31; attempt += 1) {
      const result = await request("/account/sign-in", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.30" },
        body: {
          credential: {
            provider: "apple",
            providerUserID: `rate-limit-${attempt}`,
            signedInAt: new Date().toISOString()
          }
        }
      });
      if (attempt < 30) {
        assert(result.response.status !== 429, `Rate limiter rejected allowed request ${attempt + 1}.`);
      } else {
        rateLimitedResponse = result.response;
      }
    }
    assert(rateLimitedResponse?.status === 429, "Sign-in burst was not rate limited.");
    assert(rateLimitedResponse.headers.get("retry-after"), "Rate-limited response omitted Retry-After.");
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
