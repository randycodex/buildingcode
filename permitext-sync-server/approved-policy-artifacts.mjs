// The hashes track the published HTML, including contact-only updates.
// The versions identify the terms customers accepted.
export const approvedPolicyArtifacts = Object.freeze({
  terms: Object.freeze({
    version: "terms-2026-11-10-rebrand",
    sourcePath: "public/terms.html",
    publicPath: "/terms",
    sha256: "e4ef61e33a30c76904faad4f1cf09113921abbde1b1574256a43042ce56e8f8a"
  }),
  privacy: Object.freeze({
    version: "privacy-2026-11-10-rebrand",
    sourcePath: "public/privacy.html",
    publicPath: "/privacy",
    sha256: "ecf89f4a73e62a55cece279dda92922c1b8e0dd233625b8250f025227fd6adbd"
  }),
  subscriptionsAndRefunds: Object.freeze({
    version: "subscriptions-2026-11-10-rebrand",
    sourcePath: "public/refunds.html",
    publicPath: "/refunds",
    sha256: "4e19489f69a074a6fa164475154825a2163765f3d8942692ce2ebcb88978e5de"
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
