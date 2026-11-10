export const approvedPolicyArtifacts = Object.freeze({
  terms: Object.freeze({
    version: "terms-2026-11-10-rebrand",
    sourcePath: "public/terms.html",
    publicPath: "/terms",
    sha256: "0c35277cbe764140bb49e29c8c31b944a13d79212d6164b367d6bed6eccd1def"
  }),
  privacy: Object.freeze({
    version: "privacy-2026-11-10-rebrand",
    sourcePath: "public/privacy.html",
    publicPath: "/privacy",
    sha256: "333f9086a8893492fb315d6e647aaca59855bb9d593ae8fae84bf8c426cc28fd"
  }),
  subscriptionsAndRefunds: Object.freeze({
    version: "subscriptions-2026-11-10-rebrand",
    sourcePath: "public/refunds.html",
    publicPath: "/refunds",
    sha256: "bc4d2370ca4ec70f80c062873d6fb324c4a50f631973beccaa7ceb0adc7efb60"
  })
});

export function approvedPolicyEnvironment(publicBaseURL) {
  return {
    PERMITEXT_PUBLIC_BASE_URL: publicBaseURL,
    PERMITEXT_TERMS_VERSION: approvedPolicyArtifacts.terms.version,
    PERMITEXT_PRIVACY_VERSION: approvedPolicyArtifacts.privacy.version,
    PERMITEXT_SUBSCRIPTION_POLICY_VERSION: approvedPolicyArtifacts.subscriptionsAndRefunds.version
  };
}
