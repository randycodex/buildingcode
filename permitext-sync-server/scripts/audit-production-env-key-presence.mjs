import { auditProductionEnvironmentKeyPresence } from "../production-environment-key-audit.mjs";

let source = "";
for await (const chunk of process.stdin) source += chunk;

if (!source.trim()) {
  throw new Error("Pipe `vercel env ls production --json` into this command.");
}

const report = auditProductionEnvironmentKeyPresence(JSON.parse(source));
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.metadataReady) process.exitCode = 1;
