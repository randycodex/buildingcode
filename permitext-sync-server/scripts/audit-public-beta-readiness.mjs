import { readFile } from "node:fs/promises";
import { paidResearchTurnsEnabled } from "../research-turns.mjs";
import { publicBetaReleaseReadiness } from "../public-beta-readiness.mjs";

const argumentsSet = new Set(process.argv.slice(2));
const recordURL = new URL("../../docs/BETA1_PUBLIC_RELEASE_GATE_RECORD.json", import.meta.url);
const record = JSON.parse(await readFile(recordURL, "utf8"));
const report = publicBetaReleaseReadiness({
  record,
  paidResearchTurnsEnabled: paidResearchTurnsEnabled(process.env)
});

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (argumentsSet.has("--require-ready") && !report.ready) {
  process.exitCode = 1;
}
