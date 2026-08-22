import { readFile } from "node:fs/promises";
import {
  ClerkCredentialError,
  clerkAuthorizedParties,
  clerkConfigurationStatus,
  verifyClerkCredential,
  verifyClerkSessionToken
} from "../clerk-auth.mjs";
import { appleSubjectIDs } from "../postgres-account-repository.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const localParties = clerkAuthorizedParties({});
assert(
  !appleSubjectIDs({
    authProvider: "clerk",
    authProviderUserID: "user_contract",
    linkedAppleUserIDs: ["apple_legacy"]
  }).has("user_contract") &&
    appleSubjectIDs({ authProvider: "clerk", linkedAppleUserIDs: ["apple_legacy"] }).has("apple_legacy"),
  "Clerk identities were confused with linked Apple subjects."
);
assert(localParties.includes("http://localhost:3000"), "Local Clerk auth lost its explicit localhost party.");
assert(clerkAuthorizedParties({ VERCEL: "1" }).length === 0, "Hosted Clerk auth accepted an implicit authorized party.");
assert(
  clerkAuthorizedParties({
    CLERK_AUTHORIZED_PARTIES: "https://permitext.com,https://www.permitext.com,https://permitext.com/path"
  }).join(",") === "https://permitext.com,https://www.permitext.com",
  "Clerk authorized-party parsing accepted a path or lost a valid origin."
);

const missing = clerkConfigurationStatus({ VERCEL: "1" });
assert(!missing.ready && missing.message.includes("CLERK_PUBLISHABLE_KEY"), "Missing Clerk keys were accepted.");

const productionTestKeys = clerkConfigurationStatus({
  VERCEL_ENV: "production",
  CLERK_PUBLISHABLE_KEY: "pk_test_contract",
  CLERK_SECRET_KEY: "sk_test_contract",
  CLERK_AUTHORIZED_PARTIES: "https://permitext.com"
});
assert(!productionTestKeys.ready && productionTestKeys.message.includes("still using a test"), "Production accepted Clerk test keys.");

const production = {
  VERCEL_ENV: "production",
  CLERK_PUBLISHABLE_KEY: "pk_live_contract",
  CLERK_SECRET_KEY: "sk_live_contract",
  CLERK_AUTHORIZED_PARTIES: "https://permitext.com,https://www.permitext.com",
  CLERK_FRONTEND_API_URL: "https://clerk.permitext.com",
  CLERK_ACCOUNT_PORTAL_URL: "https://accounts.permitext.com/sign-in"
};
assert(clerkConfigurationStatus(production).ready, "A complete production Clerk configuration was rejected.");
assert(clerkConfigurationStatus(production).webReady, "A complete Clerk web configuration was rejected.");
assert(
  !clerkConfigurationStatus({ ...production, CLERK_FRONTEND_API_URL: "https://different.clerk.accounts.dev" }).webReady,
  "Production Clerk web readiness accepted a frontend domain blocked by Permitext's CSP."
);
assert(
  !clerkConfigurationStatus({ ...production, CLERK_ACCOUNT_PORTAL_URL: "https://accounts.permitext.com/user" }).webReady,
  "Production Clerk web readiness accepted a non-sign-in Account Portal route."
);

let receivedOptions = null;
const verified = await verifyClerkSessionToken("session-token", {
  environment: production,
  verifier: async (_token, options) => {
    receivedOptions = options;
    return { sub: "user_contract", sid: "sess_contract" };
  }
});
assert(verified.providerUserID === "user_contract", "Verified Clerk user identity was lost.");
assert(
  receivedOptions.authorizedParties.join(",") === "https://permitext.com,https://www.permitext.com",
  "Clerk verification omitted the authorized-party boundary."
);
assert(receivedOptions.secretKey === "sk_live_contract", "Clerk verification omitted its server credential.");

const [iosProject, iosApp, iosSettings, iosViewModel, iosInfo] = await Promise.all([
  readFile(new URL("../../NYC CC APP/NYC CC APP.xcodeproj/project.pbxproj", import.meta.url), "utf8"),
  readFile(new URL("../../NYC CC APP/permitext/PermitextApp.swift", import.meta.url), "utf8"),
  readFile(new URL("../../NYC CC APP/permitext/Views/SettingsView.swift", import.meta.url), "utf8"),
  readFile(new URL("../../NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift", import.meta.url), "utf8"),
  readFile(new URL("../../NYC CC APP/permitext/Info.plist", import.meta.url), "utf8")
]);
assert(iosProject.includes("https://github.com/clerk/clerk-ios") && iosProject.includes("ClerkKit in Frameworks"), "iOS is not linked to ClerkKit.");
assert(
  iosApp.includes("Clerk.configure(publishableKey:") &&
    iosApp.includes("private let clerk: Clerk?") &&
    iosApp.includes(".environment(\\.permitextClerk, clerk)"),
  "iOS does not safely configure and inject optional Clerk authentication."
);
assert(
  iosSettings.includes("Sign in or create an account") &&
    iosSettings.includes("passwordless email, Apple, Google, or Microsoft") &&
    iosSettings.includes("SignInWithAppleButton") &&
    iosSettings.includes("clerk.user?.delete()"),
  "iOS lost the Clerk social sign-in path, its Apple fallback, or identity deletion."
);
assert(
  iosViewModel.includes("startHostedAuth(mode: .signIn)") &&
    iosViewModel.includes("clerk.auth.getToken()") &&
    iosViewModel.includes("linkFrom: sourceAccount"),
  "iOS Clerk sign-in does not complete hosted auth and authenticated account linking."
);
assert(
  iosViewModel.includes("guard await requireSignedInBillingAccount(clerk: clerk) else { return }") &&
    iosViewModel.includes("Sign in or create a Permitext account before purchasing or restoring Pro.") &&
    iosSettings.includes("purchasePro(clerk: clerk)") &&
    iosSettings.includes("restorePurchases(clerk: clerk)") &&
    iosApp.includes("purchasePro(clerk: clerk)"),
  "iOS can start StoreKit purchase or restore before establishing its Permitext account."
);
assert(iosInfo.includes("PermitextClerkPublishableKey"), "iOS does not expose its Clerk publishable-key build setting.");

const networklessEnvironment = {
  ...production,
  CLERK_SECRET_KEY: "",
  CLERK_JWT_KEY: "-----BEGIN PUBLIC KEY-----\\ncontract\\n-----END PUBLIC KEY-----"
};
await verifyClerkSessionToken("session-token", {
  environment: networklessEnvironment,
  verifier: async (_token, options) => {
    assert(options.jwtKey.includes("\ncontract\n"), "Clerk JWT public-key newlines were not restored.");
    assert(!options.secretKey, "Networkless Clerk verification exposed a secret key.");
    return { sub: "user_networkless", sid: "sess_networkless" };
  }
});

await verifyClerkCredential(
  { sessionToken: "session-token", providerUserID: "user_contract" },
  {
    environment: production,
    verifier: async () => ({ sub: "user_contract", sid: "sess_contract" })
  }
);
try {
  await verifyClerkCredential(
    { sessionToken: "session-token", providerUserID: "user_different" },
    {
      environment: production,
      verifier: async () => ({ sub: "user_contract", sid: "sess_contract" })
    }
  );
  throw new Error("A mismatched Clerk user ID was accepted.");
} catch (error) {
  assert(error instanceof ClerkCredentialError && error.statusCode === 401, "Clerk mismatch returned the wrong error.");
}

console.log("permitext Clerk auth contract passed");
