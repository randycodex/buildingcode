const baseURL = process.env.PERMITEXT_SYNC_PRODUCTION_URL || "https://permitext-sync.vercel.app";
const expectedStorage = process.env.PERMITEXT_SYNC_EXPECTED_STORAGE || "postgres";
const expectedSchema = process.env.PERMITEXT_SYNC_EXPECTED_SCHEMA || "normalized-v2";

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

  console.log(`permitext production health passed: ${baseURL} uses ${json.storage}${json.schema ? ` (${json.schema})` : ""}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
