export const approvedPolicyArtifacts = Object.freeze({
  terms: Object.freeze({
    version: "terms-2026-08-28",
    sourcePath: "public/terms.html",
    publicPath: "/terms",
    sha256: "511435a9a798c192fa9d65685f93b059ce7bf93724327712e4f83d871fccfbc1"
  }),
  privacy: Object.freeze({
    version: "privacy-2026-09-18",
    sourcePath: "public/privacy.html",
    publicPath: "/privacy",
    sha256: "2d3058f4534903033c7086615a152a9fc2ff70649acd32cf40cc279f86cbd7cc"
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
