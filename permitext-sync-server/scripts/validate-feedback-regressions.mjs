import { readFile } from "node:fs/promises";
import { validateFeedbackRegressionExport } from "../research-feedback.mjs";
const path = process.argv[2];
if (!path) { console.error("Usage: npm run eval:feedback:validate -- /path/to/export.json"); process.exitCode = 1; }
else {
  try {
    const dataset = validateFeedbackRegressionExport(JSON.parse(await readFile(path, "utf8")));
    const results = dataset.cases.flatMap(item => (item.comparisons || []).filter(result => result.referenceSHA256 === item.referenceSHA256));
    console.log(JSON.stringify({ approvedCases: dataset.cases.length, recordedHumanPasses: results.filter(item => item.decision === "pass").length, recordedHumanFailures: results.filter(item => item.decision === "fail").length, providerCalls: 0, scope: "Validates saved reference/source integrity. Does not generate answers or verify professional correctness." }, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
