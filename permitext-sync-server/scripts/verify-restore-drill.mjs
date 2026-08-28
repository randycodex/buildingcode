import { verifyRestoreDrill } from "../restore-drill-contract.mjs";

function nonnegativeInteger(value) {
  if (!String(value ?? "").trim()) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

const result = await verifyRestoreDrill({
  sourceBaseURL: process.env.PERMITEXT_RESTORE_SOURCE_URL,
  targetBaseURL: process.env.PERMITEXT_RESTORE_TARGET_URL,
  sourceAdminToken: process.env.PERMITEXT_RESTORE_SOURCE_ADMIN_TOKEN,
  targetAdminToken: process.env.PERMITEXT_RESTORE_TARGET_ADMIN_TOKEN,
  representativeUserID: process.env.PERMITEXT_RESTORE_TEST_USER_ID,
  targetIsolated: process.env.PERMITEXT_RESTORE_TARGET_ISOLATED === "1",
  providerWritesDisabled: process.env.PERMITEXT_RESTORE_PROVIDER_WRITES_DISABLED === "1",
  expectedTargetStorage: process.env.PERMITEXT_RESTORE_EXPECT_TARGET_STORAGE || "postgres",
  sourceAssetCount: nonnegativeInteger(process.env.PERMITEXT_RESTORE_SOURCE_ASSET_COUNT),
  targetAssetCount: nonnegativeInteger(process.env.PERMITEXT_RESTORE_TARGET_ASSET_COUNT),
  sourceAssetInventoryTimestamp: process.env.PERMITEXT_RESTORE_SOURCE_ASSET_INVENTORY_TIMESTAMP
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.pass) process.exitCode = 1;
