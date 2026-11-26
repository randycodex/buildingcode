const baseURL = process.env.PERMITEXT_SYNC_PRODUCTION_URL || "https://per.codes";
const expectedStorage = process.env.PERMITEXT_SYNC_EXPECTED_STORAGE || "postgres";
const expectedSchema = process.env.PERMITEXT_SYNC_EXPECTED_SCHEMA || "normalized-v4";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const response = await fetch(`${baseURL.replace(/\/+$/, "")}/health`);
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  assert(response.ok, `Health check failed with HTTP ${response.status}.`);
  assert(json?.ok === true, "Health check did not report ok=true.");
  assert(
    json.storage === expectedStorage,
    `Expected storage "${expectedStorage}", received "${json?.storage ?? "unknown"}".`
  );
  if (expectedSchema) {
    assert(
      json.schema === expectedSchema,
      `Expected schema "${expectedSchema}", received "${json?.schema ?? "unknown"}".`
    );
  }
  assert(
    json?.commercialReadiness?.configured === true,
    "Production health did not confirm complete commercial configuration."
  );
  const authentication = json?.commercialReadiness?.authentication;
  assert(
    authentication?.configured === true && authentication.livePublishableKey === true,
    "Production health did not confirm the fail-closed Clerk configuration."
  );
  // Clerk readiness validates the exact origins for a single domain or both migration domains.
  assert(
    [2, 4].includes(authentication.authorizedPartyCount),
    `Expected 2 or 4 authorized sign-in origins, received ${authentication.authorizedPartyCount ?? "unknown"}.`
  );

  console.log(`Permitext production health passed for ${baseURL} with ${json.storage}${json.schema ? ` (${json.schema})` : ""} and ${authentication.authorizedPartyCount} authorized sign-in origins.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
