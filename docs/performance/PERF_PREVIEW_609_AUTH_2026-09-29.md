# Preview609 signed-in acceptance prerequisite

Deployment: dpl_CvNqTLHXN8GM6T5FXSuPpMS5mqTX, source d7f1191dd. Public asset identity passes separately.

The rendered guest workspace opened normally. Sign in → Account → Sign in completed into a browser-only account: Name Web browser, Email unavailable, Free plan, no Project records. This is not the authorized Gmail Pro test account. No Project, Note, Saved item, entitlement or Production account was changed during this check.

Source tracing confirms signInCurrentBrowser tries Clerk, then Apple, then signInWithBrowserFallback only when the returned Apple configuration allows it. The fallback supplies provider web and displayName Web browser. This matches the observed UI, but does not prove which environment variable is absent: direct public-config inspection was blocked, and connector fetch returned a Vercel authentication redirect. Do not infer successful Clerk authentication or failed Pro entitlement propagation from this fallback account.

Signed-in candidate acceptance remains blocked by preview authentication configuration. Owner asked whether an existing staging deployment has Clerk and Pro test access. Do not copy Production secrets, expand allowed origins, grant this fallback account Pro, or merge merely to work around this prerequisite. Use the existing staging environment if available; otherwise prepare explicit staging configuration for review, then test the intended authenticated artifact.

Screenshot: /tmp/permitext-preview-account-20260929.png. No Instruments or physical-device work.
