import {
  clerkConfigurationStatus,
  productionClerkAuthorizedParties
} from "./clerk-auth.mjs";

export const productionAuthenticationProviders = Object.freeze([
  "email",
  "apple",
  "google",
  "microsoft"
]);

// Apple's App ID prefix can differ from the Developer Team ID. Clerk publishes
// the prefix in the webcredentials AASA record for the registered native app.
export const productionAppleWebCredentialAppID = "57BY95X97H.com.randycodex.permitext";

const expectedFirstFactors = Object.freeze({
  email: "email_code",
  apple: "oauth_apple",
  google: "oauth_google",
  microsoft: "oauth_microsoft"
});

function check(id, ready, detail) {
  return { id, ready: Boolean(ready), detail };
}

function normalizedEvidenceProviders(value) {
  return new Set(
    Array.isArray(value)
      ? value.map((provider) => String(provider || "").trim().toLowerCase()).filter(Boolean)
      : []
  );
}

export function auditProductionAuthentication({
  environment = process.env,
  clerkEnvironment = null,
  appleAssociation = null,
  acceptanceEvidence = {}
} = {}) {
  const productionEnvironment = { ...environment, CLERK_REQUIRE_LIVE: "1" };
  const configuration = clerkConfigurationStatus(productionEnvironment);
  const authConfig = clerkEnvironment?.auth_config || {};
  const displayConfig = clerkEnvironment?.display_config || {};
  const firstFactors = new Set(Array.isArray(authConfig.first_factors) ? authConfig.first_factors : []);
  const identificationStrategies = new Set(
    Array.isArray(authConfig.identification_strategies) ? authConfig.identification_strategies : []
  );
  const associatedApps = Array.isArray(appleAssociation?.webcredentials?.apps)
    ? appleAssociation.webcredentials.apps
    : [];

  const configurationChecks = [
    check(
      "server-environment",
      configuration.webReady,
      configuration.webReady
        ? "Live Clerk keys, network verification, exact Permitext origins, and hosted web URLs are configured."
        : configuration.webMessage
    ),
    check(
      "production-instance",
      authConfig.test_mode === false && displayConfig.instance_environment_type === "production",
      "The public Clerk environment must report a Production instance with test mode disabled."
    ),
    ...productionAuthenticationProviders.map((provider) => {
      const firstFactor = expectedFirstFactors[provider];
      const firstFactorReady = firstFactors.has(firstFactor);
      const identificationReady = provider === "email"
        ? identificationStrategies.has("email_address")
        : identificationStrategies.has(firstFactor);
      return check(
        `provider-${provider}`,
        firstFactorReady && identificationReady,
        `${provider} must remain available as both a configured identity strategy and first factor.`
      );
    }),
    check(
      "email-verification",
      Array.isArray(authConfig.email_address_verification_strategies) &&
        authConfig.email_address_verification_strategies.includes("email_code"),
      "Email accounts must be verified with a one-time code."
    ),
    check(
      "native-api",
      authConfig.native_settings?.api_enabled === true,
      "Clerk Native API must remain enabled for the iOS sign-in flow."
    ),
    check(
      "account-portal-paths",
      displayConfig.sign_in_url === "https://accounts.permitext.com/sign-in" &&
        displayConfig.sign_up_url === "https://accounts.permitext.com/sign-up" &&
        displayConfig.home_url === "https://permitext.com",
      "The public Clerk environment must publish Permitext's exact Account Portal and home URLs."
    ),
    check(
      "apple-webcredentials",
      associatedApps.includes(productionAppleWebCredentialAppID),
      "The Clerk AASA document must authorize the configured Permitext Apple team and bundle identifier."
    )
  ];

  const freshAccountProviders = normalizedEvidenceProviders(acceptanceEvidence.freshAccountProviders);
  const existingAccountProviders = normalizedEvidenceProviders(acceptanceEvidence.existingAccountProviders);
  const manualChecks = [
    check(
      "fresh-account-sign-in",
      productionAuthenticationProviders.every((provider) => freshAccountProviders.has(provider)),
      "Fresh-account sign-in must be completed manually for email, Apple, Google, and Microsoft after the final deployment."
    ),
    check(
      "existing-account-sign-in",
      productionAuthenticationProviders.every((provider) => existingAccountProviders.has(provider)),
      "Existing-account sign-in must be completed manually for email, Apple, Google, and Microsoft after the final deployment."
    ),
    check(
      "account-export-deletion",
      acceptanceEvidence.accountExportDeletion === true,
      "One dedicated Production-configured account export/deletion lifecycle must report provider and Permitext cleanup accurately."
    )
  ];

  const configurationReady = configurationChecks.every((item) => item.ready);
  const manualAcceptanceComplete = manualChecks.every((item) => item.ready);
  return {
    schema: "permitext-production-auth-audit-v1",
    generatedAt: new Date().toISOString(),
    configurationReady,
    manualAcceptanceComplete,
    releaseReady: configurationReady && manualAcceptanceComplete,
    checks: {
      configuration: configurationChecks,
      manual: manualChecks
    },
    expected: {
      providers: [...productionAuthenticationProviders],
      authorizedPartyCount: productionClerkAuthorizedParties.length,
      appleWebCredentialAppID: productionAppleWebCredentialAppID
    },
    privacy: {
      secretValuesEmitted: false,
      customerIdentifiersEmitted: false
    }
  };
}
