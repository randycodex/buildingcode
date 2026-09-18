import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { model, criteria, requestFor, classify, validateResponse, validateCases, checkLiveBudget, summarize } from '../evals/typesafe-intent.mjs';
import { terraRequest, validateTerra, classifyTerra, comparisonSummary } from '../evals/typesafe-terra-comparison.mjs';

const cases = JSON.parse(readFileSync(new URL('../evals/typesafe-intent-cases.json', import.meta.url))).cases;
const response = () => ({ model, answers: { intent: { type: 'choice', choice: 'code_lookup', confidence: 0.9,
  probabilities: Object.fromEntries(Object.keys(criteria).map(k => [k, k === 'code_lookup' ? 0.96 : 0.01])) } },
  usage: { input_tokens: 600, output_tokens: 20 } });

test('fixtures retain provenance and draft labels; payload excludes labels and project metadata', () => {
  validateCases(cases);
  assert.equal(new Set(cases.map(c => c.expected)).size, 5);
  const payload = requestFor(cases[0].question);
  assert.deepEqual(payload.state, { question: cases[0].question });
  assert.equal(JSON.stringify(payload).includes('labelStatus'), false);
  assert.throws(() => validateCases([cases[0], cases[0]]));
  assert.throws(() => requestFor('x'.repeat(4001)));
});

test('live calls require explicit bounded authorization even when a key exists', () => {
  assert.throws(() => checkLiveBudget(cases, { TYPESAFE_API_KEY: 'test' }));
  const env = { TYPESAFE_API_KEY: 'test', PERMITEXT_TYPESAFE_LIVE: '1', PERMITEXT_TYPESAFE_BUDGET_USD: '0.10' };
  assert.ok(checkLiveBudget(cases, env).reservedUSD < 0.10);
  for (const cap of ['0','NaN','Infinity','-1','0.001','2']) assert.throws(() => checkLiveBudget(cases, { ...env, PERMITEXT_TYPESAFE_BUDGET_USD: cap }));
});

test('adapter pins endpoint/model and returns only validated fields', async () => {
  const result = await classify('Quote BC 1005.1.', { apiKey: 'test-only', fetchImpl: async (url, opts) => {
    assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
    assert.equal(opts.redirect, 'error');
    assert.equal(JSON.parse(opts.body).model, model);
    return { ok: true, json: async () => ({ ...response(), secret: 'must not survive' }) };
  } });
  assert.equal(result.choice, 'code_lookup');
  assert.equal(result.secret, undefined);
  assert.equal(result.estimatedCostUSD, 600 * 0.042 / 1e6);
});

test('malformed distributions, model changes, and missing usage fail closed', () => {
  for (const mutate of [b => b.model = 'jev-latest', b => delete b.usage,
    b => b.answers.intent.confidence = 2,
    b => b.answers.intent.probabilities.code_lookup = 0.1,
    b => b.answers.intent.choice = 'calculation',
    b => b.answers.intent.probabilities.extra = 0,
    b => b.usage.input_tokens = 70000]) {
    const b = response(); mutate(b); assert.throws(() => validateResponse(b));
  }
});

test('HTTP and transport failures do not retry or expose response bodies/secrets', async () => {
  let calls = 0;
  await assert.rejects(classify('Question', { apiKey: 'secret', fetchImpl: async () => {
    calls++; return { ok: false, status: 429, json: async () => ({ secret: 'secret' }) };
  } }), /^Error: TypeSafe HTTP 429; no retry performed$/);
  assert.equal(calls, 1);
  await assert.rejects(classify('Question', { apiKey: 'secret', fetchImpl: async () => { throw new Error('secret'); } }), /^Error: TypeSafe transport failure; no retry performed$/);
  await assert.rejects(classify('Question', { apiKey: 'secret', fetchImpl: async () => ({ ok: true, json: async () => { throw new Error('secret'); } }) }), /^Error: Invalid TypeSafe JSON$/);
});

test('report distinguishes no observations, failures, and dangerous lookup errors', () => {
  assert.equal(summarize(cases).draftLabelAgreement, null);
  const result = validateResponse(response());
  const summary = summarize([{ id: 'unsafe', expected: 'project_application', result, latencyMs: 20 }, { id: 'failed', error: 'failure' }]);
  assert.equal(summary.completed, 1); assert.equal(summary.errors, 1);
  assert.equal(summary.draftLabelAgreement, 0);
  assert.deepEqual(summary.lookupMisclassifications, ['unsafe']);
  assert.deepEqual(summary.highConfidenceDisagreements, ['unsafe']);
});

test('CLI blocks unauthorized live run before any network call', () => {
  const run = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/eval-typesafe-intent.mjs', import.meta.url)), '--live'],
    { env: { PATH: process.env.PATH }, encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /Live run requires explicit authorization/);
});

const terraResponse = () => ({ model: 'gpt-5.6-terra', status: 'completed',
  output: [{ type: 'message', content: [{ type: 'output_text', text: '{"choice":"code_lookup"}' }] }],
  usage: { input_tokens: 600, output_tokens: 30, input_tokens_details: { cached_tokens: 100 } } });

test('Terra uses the same rubric/state with bounded output and no self-rated confidence', () => {
  const request = terraRequest('What does BC 1005.1 say?');
  assert.equal(request.store, false);
  assert.equal(request.max_output_tokens, 1024);
  assert.ok(request.instructions.includes(JSON.stringify(criteria)));
  assert.deepEqual(JSON.parse(request.input), requestFor('What does BC 1005.1 say?').state);
  const result = validateTerra(terraResponse());
  assert.equal(result.confidence, null);
  assert.equal(result.estimatedCostUSD, (500*2+100*0.2+30*12)/1e6);
});

test('Terra rejects incomplete output, refusals, wrong model, bad labels, and invalid usage', () => {
  for (const mutate of [b => b.status = 'incomplete', b => b.model = 'different',
    b => b.output[0].content = [{ type: 'refusal' }],
    b => b.output[0].content[0].text = '{"choice":"other"}',
    b => b.usage.input_tokens_details.cached_tokens = 700]) {
    const b = terraResponse(); mutate(b); assert.throws(() => validateTerra(b));
  }
});

test('Terra adapter sanitizes errors and never retries', async () => {
  let calls = 0;
  await assert.rejects(classifyTerra('Question', { apiKey: 'secret', fetchImpl: async () => {
    calls++; throw new Error('secret');
  } }), /^Error: Terra transport failure; no retry performed$/);
  assert.equal(calls, 1);
});

test('comparison fixtures are new and balanced; summary keeps provider outcomes separate', () => {
  const challenge = JSON.parse(readFileSync(new URL('../evals/typesafe-intent-challenge.json', import.meta.url))).cases;
  validateCases(challenge);
  assert.equal(challenge.length, 50);
  for (const label of Object.keys(criteria)) assert.equal(challenge.filter(c => c.expected === label).length, 10);
  assert.ok(challenge.every(c => !cases.some(old => old.question === c.question)));
  const summary = comparisonSummary([{ id: 'disagree', expected: 'code_lookup',
    jev: { result: validateResponse(response()), latencyMs: 20 },
    terra: { result: { ...validateTerra(terraResponse()), choice: 'project_application' }, latencyMs: 100 } }]);
  assert.equal(summary.jev.draftLabelAgreement, 1);
  assert.equal(summary.terra.draftLabelAgreement, 0);
  assert.equal(summary.disagreements.length, 1);
  assert.equal(summary.paired, 1);
});
