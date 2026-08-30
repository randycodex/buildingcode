import { auditProductionMonitoringEntries } from "../production-monitoring-audit.mjs";

const argumentsSet = new Set(process.argv.slice(2));
let input = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) input += chunk;

const entries = [];
let invalidLineCount = 0;
for (const line of input.split(/\r?\n/)) {
  if (!line.trim()) continue;
  try {
    const parsed = JSON.parse(line);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) entries.push(parsed);
    else invalidLineCount += 1;
  } catch {
    invalidLineCount += 1;
  }
}

const report = {
  ...auditProductionMonitoringEntries(entries),
  input: {
    parsedEntryCount: entries.length,
    invalidLineCount
  }
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (invalidLineCount > 0) {
  process.exitCode = 3;
} else if (argumentsSet.has("--fail-on-actionable") && report.actionable.count > 0) {
  process.exitCode = 1;
} else if (argumentsSet.has("--require-health") && !report.healthCoverage.observed) {
  process.exitCode = 2;
}
