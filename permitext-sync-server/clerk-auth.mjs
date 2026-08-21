import { verifyToken } from "@clerk/backend";

export class ClerkCredentialError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "ClerkCredentialError";
    this.statusCode = statusCode;
  }
}

function hostedEnvironment(environment) {
  return environment.VERCEL === "1" || Boolean(environment.VERCEL_ENV);
}

function productionEnvironment(environment) {
  return environment.VERCEL_ENV === "production" || environment.CLERK_REQUIRE_LIVE === "1";
}

function normalizedPEM(value) {
  return String(value || "").trim().replace(/\\n/g, "\n");
}

function clerkKeyMode(value, prefix) {
  const key = String(value || "").trim();
  if (!key) return "missing";
  if (key.startsWith(`${prefix}_test_`)) return "test";
  if (key.startsWith(`${prefix}_live_`)) return "live";
  return "unknown";
}

function normalizedAuthorizedParty(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) return null;
    const localHTTP = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !localHTTP) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function normalizedClerkURL(value, { originOnly = false } = {}) {
  try {
    const url = new URL(String(value || "").trim());
    const localHTTP = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !localHTTP) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    if (originOnly && url.pathname !== "/") return null;
    return originOnly ? url.origin : url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function clerkAuthorizedParties(environment = process.env) {
  const configured = String(environment.CLERK_AUTHORIZED_PARTIES || "")
    .split(",")
    .map((value) => normalizedAuthorizedParty(value))
    .filter(Boolean);
  if (configured.length || hostedEnvironment(environment)) {
    return Array.from(new Set(configured));
  }
  return ["http://localhost:3000", "http://127.0.0.1:3000"];
}

export function clerkConfigurationStatus(environment = process.env) {
  const publishableKey = String(
    environment.CLERK_PUBLISHABLE_KEY || environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ""
  ).trim();
  const secretKey = String(environment.CLERK_SECRET_KEY || "").trim();
  const jwtKey = normalizedPEM(environment.CLERK_JWT_KEY);
  const authorizedParties = clerkAuthorizedParties(environment);
  const frontendAPIURL = normalizedClerkURL(environment.CLERK_FRONTEND_API_URL, { originOnly: true });
  const accountPortalSignInURL = normalizedClerkURL(environment.CLERK_ACCOUNT_PORTAL_URL);
  const publishableKeyMode = clerkKeyMode(publishableKey, "pk");
  const secretKeyMode = clerkKeyMode(secretKey, "sk");
  const problems = [];

  if (publishableKeyMode === "missing") problems.push("CLERK_PUBLISHABLE_KEY is missing.");
  else if (publishableKeyMode === "unknown") problems.push("CLERK_PUBLISHABLE_KEY has an unexpected format.");
  if (!jwtKey && secretKeyMode === "missing") {
    problems.push("Set CLERK_JWT_KEY or CLERK_SECRET_KEY for backend token verification.");
  } else if (!jwtKey && secretKeyMode === "unknown") {
    problems.push("CLERK_SECRET_KEY has an unexpected format.");
  }
  if (productionEnvironment(environment)) {
    if (publishableKeyMode === "test") problems.push("Production Clerk is still using a test publishable key.");
    if (!jwtKey && secretKeyMode === "test") problems.push("Production Clerk is still using a test secret key.");
  }
  if (!authorizedParties.length) {
    problems.push("CLERK_AUTHORIZED_PARTIES must list the permitted web origins.");
  }

  const webProblems = [];
  if (!frontendAPIURL) webProblems.push("CLERK_FRONTEND_API_URL must be an HTTPS origin.");
  if (!accountPortalSignInURL) webProblems.push("CLERK_ACCOUNT_PORTAL_URL must be the hosted HTTPS sign-in URL.");
  if (productionEnvironment(environment)) {
    if (frontendAPIURL && frontendAPIURL !== "https://clerk.permitext.com") {
      webProblems.push("Production CLERK_FRONTEND_API_URL must be https://clerk.permitext.com.");
    }
    if (accountPortalSignInURL) {
      const accountPortalURL = new URL(accountPortalSignInURL);
      if (accountPortalURL.origin !== "https://accounts.permitext.com" || accountPortalURL.pathname !== "/sign-in") {
        webProblems.push("Production CLERK_ACCOUNT_PORTAL_URL must be https://accounts.permitext.com/sign-in.");
      }
    }
  }

  return {
    ready: problems.length === 0,
    message: problems.join(" "),
    webReady: problems.length === 0 && webProblems.length === 0,
    webMessage: [...problems, ...webProblems].join(" "),
    publishableKey: publishableKey || null,
    publishableKeyMode,
    verificationMode: jwtKey ? "networkless" : secretKeyMode === "missing" ? "missing" : "remote-jwks",
    authorizedParties,
    frontendAPIURL,
    accountPortalSignInURL
  };
}

export async function verifyClerkSessionToken(
  sessionToken,
  { environment = process.env, verifier = verifyToken } = {}
) {
  const token = String(sessionToken || "").trim();
  if (!token) throw new ClerkCredentialError(401, "Missing Clerk session token.");

  const configuration = clerkConfigurationStatus(environment);
  if (!configuration.ready) {
    throw new ClerkCredentialError(503, `Clerk sign-in is not configured. ${configuration.message}`.trim());
  }

  const options = { authorizedParties: configuration.authorizedParties };
  const jwtKey = normalizedPEM(environment.CLERK_JWT_KEY);
  if (jwtKey) options.jwtKey = jwtKey;
  else options.secretKey = String(environment.CLERK_SECRET_KEY || "").trim();

  let claims;
  try {
    claims = await verifier(token, options);
  } catch {
    throw new ClerkCredentialError(401, "Invalid or expired Clerk session token.");
  }
  const providerUserID = String(claims?.sub || "").trim();
  const sessionID = String(claims?.sid || "").trim();
  if (!providerUserID.startsWith("user_") || !sessionID.startsWith("sess_")) {
    throw new ClerkCredentialError(401, "Clerk session token is missing its user or session identity.");
  }
  return { providerUserID, sessionID, claims };
}

export async function verifyClerkCredential(
  credential,
  { environment = process.env, verifier = verifyToken } = {}
) {
  const verified = await verifyClerkSessionToken(
    credential?.sessionToken || credential?.identityToken,
    { environment, verifier }
  );
  const claimedUserID = String(credential?.providerUserID || "").trim();
  if (claimedUserID && claimedUserID !== verified.providerUserID) {
    throw new ClerkCredentialError(401, "Clerk session token subject does not match the credential.");
  }
  return verified;
}
