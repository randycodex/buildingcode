import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { classify, requestFor, validateCases, existingSignals } from '../evals/typesafe-intent.mjs';
import { classifyTerra, terraRequest, terraPricing, comparisonSummary } from '../evals/typesafe-terra-comparison.mjs';

const live = process.argv.slice(2).join(' ') === '--live';
if (process.argv.length > 2 && !live) throw new Error('Usage: compare-typesafe-terra.mjs [--live]');
if (live && (process.env.PERMITEXT_TYPESAFE_COMPARISON_LIVE !== '1' || !process.env.TYPESAFE_API_KEY || !process.env.OPENAI_API_KEY)) {
  throw new Error('Live comparison requires explicit authorization and both provider keys');
}
const fixture = await readFile(new URL('../evals/typesafe-intent-challenge.json', import.meta.url), 'utf8');
const { cases } = JSON.parse(fixture);
validateCases(cases);
const rows = cases.map(c => ({ ...c, existing: existingSignals(c.question) }));
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { mode: live ? 'live-comparison' : 'offline-comparison-plan', status: live ? 'running' : 'prepared',
  startedAt: new Date().toISOString(), fixtureSHA256: hash(fixture),
  jevPromptSHA256: hash(JSON.stringify(requestFor('fixture').questions)), terraPromptSHA256: hash(JSON.stringify(terraRequest('fixture'))),
  terraPricing, plannedRequests: cases.length * 2, providerCalls: 0,
  execution: 'One paired request per provider per question, pairs sequential, no retries, stop on error. Explicit user authorization without a monetary cap; bounded by fixed fixture count and Terra output limit.',
  rows };
const dir = new URL('../.typesafe-local/', import.meta.url);
await mkdir(dir, { recursive: true, mode: 0o700 });
const output = new URL(`${Date.now()}-comparison.json`, dir);
async function save() {
  report.summary = comparisonSummary(rows);
  await writeFile(output, JSON.stringify(report, null, 2)+'\n', { mode: 0o600 });
}
await save();
if (live) {
  for (const [index, row] of rows.entries()) {
    report.providerCalls += 2;
    row.jev = { status: 'attempting' }; row.terra = { status: 'attempting' };
    await save();
    // Independent providers receive identical semantic content, never expected labels.
    await Promise.allSettled([
      ['jev', classify, process.env.TYPESAFE_API_KEY], ['terra', classifyTerra, process.env.OPENAI_API_KEY]
    ].map(async ([provider, fn, apiKey]) => {
      const start = performance.now();
      try { row[provider] = { status: 'completed', result: await fn(row.question, { apiKey }) }; }
      catch(error) { row[provider] = { status: 'failed', error: error.message }; }
      row[provider].latencyMs = Math.round(performance.now() - start);
    }));
    await save();
    if (row.jev.error || row.terra.error) { report.status = 'stopped-on-error'; break; }
    if ((index+1)%10 === 0) console.log(`Completed ${index+1}/${rows.length} paired cases`);
  }
  if (report.status === 'running') report.status = 'completed';
  report.finishedAt = new Date().toISOString();
  await save();
}
console.log(JSON.stringify({ status: report.status, providerCalls: report.providerCalls, report: fileURLToPath(output), summary: report.summary },null,2));
if (report.status === 'stopped-on-error') process.exitCode = 1;
