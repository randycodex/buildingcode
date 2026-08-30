import { auditProductionAuthentication } from "../production-auth-audit.mjs";

const argumentsSet = new Set(process.argv.slice(2));
const frontendAPIURL = "https://clerk.permitext.com";

async function fetchJSON(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json" }
  });
  if (!response.ok) throw new Error(`${new URL(url).pathname} returned HTTP ${response.status}.`);
  return response.json();
}

const [clerkEnvironment, appleAssociation] = await Promise.all([
  fetchJSON(`${frontendAPIURL}/v1/environment`),
  fetchJSON(`${frontendAPIURL}/.well-known/apple-app-site-association`)
]);

const report = auditProductionAuthentication({
  environment: process.env,
  clerkEnvironment,
  appleAssociation
});

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (argumentsSet.has("--require-configuration") && !report.configurationReady) {
  process.exitCode = 1;
}
if (argumentsSet.has("--require-manual") && !report.manualAcceptanceComplete) {
  process.exitCode = 2;
}
