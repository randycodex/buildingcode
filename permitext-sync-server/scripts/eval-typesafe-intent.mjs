import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { model, inputUSDPerMillion, requestReservationUSD, requestFor, existingSignals, classify, validateCases, checkLiveBudget, summarize } from '../evals/typesafe-intent.mjs';

const args = process.argv.slice(2);
if (args.some(a => a !== '--live') || args.length > 1) throw new Error('Usage: eval-typesafe-intent.mjs [--live]');
const live = args.includes('--live');
const source = await readFile(new URL('../evals/typesafe-intent-cases.json', import.meta.url), 'utf8');
const { cases } = JSON.parse(source);
validateCases(cases);
const authorization = live ? checkLiveBudget(cases, process.env) : null;
const rows = cases.map(c => ({ ...c, existing: existingSignals(c.question) }));
const report = {
  mode: live ? 'live-observation-only' : 'offline-plan', model, generatedAt: new Date().toISOString(),
  datasetSHA256: createHash('sha256').update(source).digest('hex'),
  promptSHA256: createHash('sha256').update(JSON.stringify(requestFor('fixture').questions)).digest('hex'),
  pricing: { inputUSDPerMillion, checkedOn: '2026-09-18', source: 'https://docs.typesafe.ai/models' },
  authorization, plannedRequests: cases.length, reservedCostUSD: cases.length * requestReservationUSD,
  providerCalls: 0, status: live ? 'running' : 'prepared',
  existingModelComparator: 'Not run. Existing router signals are recorded; no existing-provider classification calls are authorized by this runner.',
  productionIntegration: 'None. Results cannot change Research routing, source policy, citations, or answers.', rows
};
// Local reports may contain provider performance information; keep out of Git/publication.
const outputDir = new URL('../.typesafe-local/', import.meta.url);
await mkdir(outputDir, { recursive: true, mode: 0o700 });
const reportURL = new URL(`${Date.now()}-${live ? 'live' : 'offline'}.json`, outputDir);
async function save() {
  report.summary = summarize(rows);
  await writeFile(reportURL, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
}
await save();
if (live) {
  for (const row of rows) {
    report.providerCalls++;
    row.status = 'attempting';
    await save(); // Persist attempted count before dispatch; no automatic resume/retry.
    const start = performance.now();
    try {
      row.result = await classify(row.question, { apiKey: process.env.TYPESAFE_API_KEY });
      row.status = 'completed';
    } catch (error) {
      row.error = error.message;
      row.status = 'failed';
      report.status = 'stopped-on-error';
    }
    row.latencyMs = Math.round(performance.now() - start);
    await save();
    if (row.error) break;
  }
  if (report.status === 'running') report.status = 'completed';
  await save();
}
console.log(JSON.stringify({ mode: report.mode, status: report.status, providerCalls: report.providerCalls,
  plannedRequests: report.plannedRequests, reservedCostUSD: report.reservedCostUSD,
  report: fileURLToPath(reportURL), summary: report.summary }, null, 2));
if (report.status === 'stopped-on-error') process.exitCode = 1;
