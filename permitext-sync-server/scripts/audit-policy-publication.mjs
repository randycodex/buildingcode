import { readFile } from "node:fs/promises";
import { approvedPolicyArtifacts } from "../approved-policy-artifacts.mjs";
import {
  auditPolicyPublication,
  normalizePolicyPublicBaseURL
} from "../policy-publication-audit.mjs";

const argumentsSet = new Set(process.argv.slice(2));
const publicBaseURL = String(process.env.PERMITEXT_PUBLIC_BASE_URL || "https://permitext.com")
  .trim()
  .replace(/\/+$/, "");
const normalizedPublicBaseURL = normalizePolicyPublicBaseURL(publicBaseURL);
const serverRoot = new URL("../", import.meta.url);
const entries = Object.entries(approvedPolicyArtifacts);

const localBodies = Object.fromEntries(await Promise.all(entries.map(async ([key, artifact]) => [
  key,
  await readFile(new URL(artifact.sourcePath, serverRoot))
])));

const liveResponses = Object.fromEntries(await Promise.all(entries.map(async ([key, artifact]) => {
  if (!normalizedPublicBaseURL) {
    return [key, {
      statusCode: 0,
      contentType: "",
      body: null,
      error: "PERMITEXT_PUBLIC_BASE_URL must be a canonical HTTPS origin."
    }];
  }
  try {
    const response = await fetch(`${normalizedPublicBaseURL}${artifact.publicPath}`, {
      headers: { accept: "text/html" },
      redirect: "manual"
    });
    return [key, {
      statusCode: response.status,
      contentType: response.headers.get("content-type") || "",
      body: Buffer.from(await response.arrayBuffer())
    }];
  } catch (error) {
    return [key, {
      statusCode: 0,
      contentType: "",
      body: null,
      error: error instanceof Error ? error.message : "Policy route request failed."
    }];
  }
})));

const report = auditPolicyPublication({
  artifacts: approvedPolicyArtifacts,
  localBodies,
  liveResponses,
  publicBaseURL: normalizedPublicBaseURL
});

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (argumentsSet.has("--require-live") && !report.publicationReady) {
  process.exitCode = 1;
}
