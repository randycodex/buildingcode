export const approvedPolicyArtifacts = Object.freeze({
  terms: Object.freeze({
    version: "terms-2026-08-28",
    sourcePath: "public/terms.html",
    publicPath: "/terms",
    sha256: "d15a253fd0886e9f091d0e76dfbba8ce0aa922ff57d7c84b66ab37c8d1fa8abc"
  }),
  privacy: Object.freeze({
    version: "privacy-2026-08-28",
    sourcePath: "public/privacy.html",
    publicPath: "/privacy",
    sha256: "ab2a135482fe22bd02136672c37da2821fb2df5add866e02928ae284d7fdddef"
  }),
  subscriptionsAndRefunds: Object.freeze({
    version: "subscriptions-2026-08-28",
    sourcePath: "public/refunds.html",
    publicPath: "/refunds",
    sha256: "4e830128ba659d6074b975d8ea693ac5a4e687c80102531a8bbef422abd6ebc7"
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
