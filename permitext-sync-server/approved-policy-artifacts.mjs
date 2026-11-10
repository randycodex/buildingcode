export const approvedPolicyArtifacts = Object.freeze({
  terms: Object.freeze({
    version: "terms-2026-11-10-rebrand",
    sourcePath: "public/terms.html",
    publicPath: "/terms",
    sha256: "c879d9f761da62009f3fd9c126cebcfeed0ae1d8210938e38bc1c56f48119113"
  }),
  privacy: Object.freeze({
    version: "privacy-2026-11-10-rebrand",
    sourcePath: "public/privacy.html",
    publicPath: "/privacy",
    sha256: "cad9f1847e307c21ee6499ea142b777eb09b93e1f96e5f596b625f47b91fc4dc"
  }),
  subscriptionsAndRefunds: Object.freeze({
    version: "subscriptions-2026-11-10-rebrand",
    sourcePath: "public/refunds.html",
    publicPath: "/refunds",
    sha256: "fd395b75d915b220d9b6f45b11072e803b36a121f77240f98e7ee4d8c7530227"
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
