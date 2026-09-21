export const approvedPolicyArtifacts = Object.freeze({
  terms: Object.freeze({
    version: "terms-2026-08-28",
    sourcePath: "public/terms.html",
    publicPath: "/terms",
    sha256: "511435a9a798c192fa9d65685f93b059ce7bf93724327712e4f83d871fccfbc1"
  }),
  privacy: Object.freeze({
    version: "privacy-2026-09-20",
    sourcePath: "public/privacy.html",
    publicPath: "/privacy",
    sha256: "62902fb6ee4e24afa4dfeb0a523c3c704586336eb5e755d69b9427634f7bcafa"
  }),
  subscriptionsAndRefunds: Object.freeze({
    version: "subscriptions-2026-08-28",
    sourcePath: "public/refunds.html",
    publicPath: "/refunds",
    sha256: "ff0b335ce7c184511e6f0a18220f071835eedd6f5bfb776b1aec30a0b70ed35d"
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
