const baseURL = process.env.PERMITEXT_SYNC_PRODUCTION_URL || "https://permitext-sync.vercel.app";
const expectedAppID = process.env.PERMITEXT_SYNC_EXPECTED_AASA_APP_ID || "";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const normalizedBaseURL = baseURL.replace(/\/+$/, "");
  const response = await fetch(`${normalizedBaseURL}/.well-known/apple-app-site-association`);
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  const apps = Array.isArray(json?.webcredentials?.apps) ? json.webcredentials.apps : [];
  const applinkDetails = Array.isArray(json?.applinks?.details) ? json.applinks.details : [];

  assert(response.ok, `AASA check failed with HTTP ${response.status}.`);
  assert(apps.length > 0, "AASA webcredentials.apps is empty.");
  assert(
    applinkDetails.some((detail) => detail.paths?.includes("/open/section/*")),
    "AASA applinks.details does not include /open/section/*."
  );

  if (expectedAppID) {
    assert(
      apps.includes(expectedAppID),
      `Expected AASA app ID "${expectedAppID}", received: ${apps.join(", ")}.`
    );
    assert(
      applinkDetails.some((detail) => detail.appID === expectedAppID),
      `Expected AASA universal-link app ID "${expectedAppID}".`
    );
  }

  if (apps.some((appID) => appID.startsWith("TEAMID."))) {
    console.warn("permitext production AASA warning: APPLE_TEAM_ID is still using the TEAMID placeholder.");
  }

  console.log(`permitext production AASA apps: ${apps.join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
