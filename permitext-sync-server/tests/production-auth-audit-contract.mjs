import assert from "node:assert/strict";
import { auditProductionAuthentication } from "../production-auth-audit.mjs";

const environment = {
  CLERK_PUBLISHABLE_KEY: "pk_live_contract",
  CLERK_SECRET_KEY: "sk_live_contract",
  CLERK_AUTHORIZED_PARTIES: "https://permitext.com,https://www.permitext.com",
  CLERK_FRONTEND_API_URL: "https://clerk.permitext.com",
  CLERK_ACCOUNT_PORTAL_URL: "https://accounts.permitext.com/sign-in",
  APPLE_TEAM_ID: "TEAMCONTRACT",
  APPLE_BUNDLE_ID: "com.example.permitext"
};

const clerkEnvironment = {
  auth_config: {
    test_mode: false,
    first_factors: ["email_code", "oauth_apple", "oauth_google", "oauth_microsoft"],
    identification_strategies: ["email_address", "oauth_apple", "oauth_google", "oauth_microsoft"],
    email_address_verification_strategies: ["email_code"],
    native_settings: { api_enabled: true }
  },
  display_config: {
    instance_environment_type: "production",
    sign_in_url: "https://accounts.permitext.com/sign-in",
    sign_up_url: "https://accounts.permitext.com/sign-up",
    home_url: "https://permitext.com"
  },
  user_settings: {
    attributes: {
      email_address: {
        enabled: true,
        required: true,
        verify_at_sign_up: true,
        verifications: ["email_code"]
      }
    },
    sign_up: { mode: "public" }
  }
};

const appleAssociation = {
  webcredentials: { apps: ["57BY95X97H.com.randycodex.permitext"] }
};

const configured = auditProductionAuthentication({ environment, clerkEnvironment, appleAssociation });
assert.equal(configured.schema, "permitext-production-auth-audit-v1");
assert.equal(configured.configurationReady, true);
assert.equal(configured.manualAcceptanceComplete, false);
assert.equal(configured.releaseReady, false);
assert.equal(configured.privacy.secretValuesEmitted, false);
assert.equal(configured.privacy.customerIdentifiersEmitted, false);
assert.deepEqual(configured.expected.providers, ["email", "apple", "google", "microsoft"]);

const complete = auditProductionAuthentication({
  environment,
  clerkEnvironment,
  appleAssociation,
  acceptanceEvidence: {
    freshAccountProviders: ["email", "apple", "google", "microsoft"],
    existingAccountProviders: ["email", "apple", "google", "microsoft"],
    accountExportDeletion: true
  }
});
assert.equal(complete.configurationReady, true);
assert.equal(complete.manualAcceptanceComplete, true);
assert.equal(complete.releaseReady, true);

// The live hosted portal offered email sign-in but no email sign-up field when
// email was optional. First factors and verification strategies still passed.
for (const [label, userSettings] of [
  ["missing sign-up settings", undefined],
  ["optional email", { ...clerkEnvironment.user_settings, attributes: { email_address: { ...clerkEnvironment.user_settings.attributes.email_address, required: false } } }],
  ["disabled email", { ...clerkEnvironment.user_settings, attributes: { email_address: { ...clerkEnvironment.user_settings.attributes.email_address, enabled: false } } }],
  ["unverified sign-up email", { ...clerkEnvironment.user_settings, attributes: { email_address: { ...clerkEnvironment.user_settings.attributes.email_address, verify_at_sign_up: false } } }],
  ["missing sign-up code", { ...clerkEnvironment.user_settings, attributes: { email_address: { ...clerkEnvironment.user_settings.attributes.email_address, verifications: [] } } }],
  ["closed sign-up", { ...clerkEnvironment.user_settings, sign_up: { mode: "restricted" } }]
]) {
  const result = auditProductionAuthentication({
    environment,
    clerkEnvironment: { ...clerkEnvironment, user_settings: userSettings },
    appleAssociation,
    acceptanceEvidence: {
      freshAccountProviders: ["email", "apple", "google", "microsoft"],
      existingAccountProviders: ["email", "apple", "google", "microsoft"],
      accountExportDeletion: true
    }
  });
  assert.equal(result.checks.configuration.find((item) => item.id === "provider-email").ready, true);
  assert.equal(result.checks.configuration.find((item) => item.id === "email-sign-up").ready, false, label);
  assert.equal(result.configurationReady, false, label);
  assert.equal(result.releaseReady, false, `${label} must fail even with claimed manual evidence.`);
}

for (const [label, overrides] of [
  ["test instance", { clerkEnvironment: { ...clerkEnvironment, auth_config: { ...clerkEnvironment.auth_config, test_mode: true } } }],
  ["missing Microsoft", { clerkEnvironment: { ...clerkEnvironment, auth_config: { ...clerkEnvironment.auth_config, first_factors: clerkEnvironment.auth_config.first_factors.filter((factor) => factor !== "oauth_microsoft") } } }],
  ["wrong portal", { clerkEnvironment: { ...clerkEnvironment, display_config: { ...clerkEnvironment.display_config, sign_in_url: "https://accounts.permitext.com/user" } } }],
  ["disabled native API", { clerkEnvironment: { ...clerkEnvironment, auth_config: { ...clerkEnvironment.auth_config, native_settings: { api_enabled: false } } } }],
  ["wrong AASA", { appleAssociation: { webcredentials: { apps: ["OTHER.com.randycodex.permitext"] } } }],
  ["extra authorized party", { environment: { ...environment, CLERK_AUTHORIZED_PARTIES: `${environment.CLERK_AUTHORIZED_PARTIES},https://unexpected.example` } }]
]) {
  const result = auditProductionAuthentication({
    environment: overrides.environment || environment,
    clerkEnvironment: overrides.clerkEnvironment || clerkEnvironment,
    appleAssociation: overrides.appleAssociation || appleAssociation
  });
  assert.equal(result.configurationReady, false, `${label} was accepted as Production auth configuration.`);
  assert.equal(result.releaseReady, false, `${label} was accepted as Production release evidence.`);
}

const serialized = JSON.stringify(configured);
assert.equal(serialized.includes("sk_live_contract"), false);
assert.equal(serialized.includes("pk_live_contract"), false);

console.log("Permitext production auth audit contract passed.");
