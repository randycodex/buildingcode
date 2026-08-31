import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(testsDirectory, "..");
const paidEnvironment = {
  ...process.env,
  OPENAI_API_KEY: "",
  PERMITEXT_RUN_PAID_RESEARCH_EVALS: "",
  PERMITEXT_RESEARCH_EVAL_MAX_USD: ""
};
const combinedOutput = (result) => `${result.stdout || ""}\n${result.stderr || ""}`;

const remediation3DirectLive = spawnSync(process.execPath, [
  "tests/research-evals.mjs",
  "--zoning-successor-remediation-3",
  "--run-live"
], {
  cwd: serverRoot,
  encoding: "utf8",
  env: paidEnvironment
});
assert.equal(remediation3DirectLive.status, 1);
assert.match(
  combinedOutput(remediation3DirectLive),
  /remediation successor 3 has no paid authorization.*exact-cohort owner authorization and cumulative spend cap/is
);

const remediation3RunnerAttempt = spawnSync(process.execPath, [
  "scripts/run-zoning-successor.mjs",
  "--remediation-3"
], {
  cwd: serverRoot,
  encoding: "utf8",
  env: paidEnvironment
});
assert.equal(remediation3RunnerAttempt.status, 1);
assert.match(
  combinedOutput(remediation3RunnerAttempt),
  /unsupported Zoning successor paid-run argument.*no live runner or paid authorization/is
);

const remediation2AuthorizationText = await readFile(
  new URL(
    "../evals/zoning-successor-remediation-2-paid-authorization.json",
    import.meta.url
  ),
  "utf8"
);
const remediation2Authorization = JSON.parse(remediation2AuthorizationText);
assert.equal(
  createHash("sha256").update(remediation2AuthorizationText).digest("hex"),
  "671a88a1445f2c8c818fdf8746795cab95121fed425d916953cc8f4fa93511e0"
);
assert.equal(remediation2Authorization.status, "consumed");
assert.equal(
  remediation2Authorization.consumption.runID,
  "f35eed33-cb4e-4b7b-a719-86b072271660"
);
assert.equal(
  remediation2Authorization.cohort.sha256,
  "459b2273b7ebd209d4519bf9206b6135dc2fc7706052fa9b333c4bf5e63e8a8b"
);

const remediation2DirectLive = spawnSync(process.execPath, [
  "tests/research-evals.mjs",
  "--zoning-successor-remediation-2",
  "--run-live"
], {
  cwd: serverRoot,
  encoding: "utf8",
  env: paidEnvironment
});
assert.equal(remediation2DirectLive.status, 1);
assert.match(
  combinedOutput(remediation2DirectLive),
  /requires a new explicit owner authorization and cumulative spend cap/i
);

console.log("Zoning remediation successor 3 paid lock contract passed", {
  remediation3DirectLiveBlocked: true,
  remediation3RunnerUnsupported: true,
  remediation2AuthorizationStatus: remediation2Authorization.status,
  remediation2AuthorizationUnchanged: true,
  paidRequests: 0
});
