// Explicit local live acceptance runner. Isolated account/store; never writes production.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
if (!process.argv.includes('--live')) throw new Error('Pass --live to authorize provider calls; aggregate local spend cap is $3.');
const local = parseEnv(await readFile(new URL('../.env.local', import.meta.url), 'utf8'));
const apiKey = process.env.OPENAI_API_KEY || local.OPENAI_API_KEY;
assert(apiKey && apiKey !== '[SENSITIVE]', 'A configured API key is required.');
const scratch = await mkdtemp(join(tmpdir(), 'permitext-transparency-live-'));
for (const name of Object.keys(process.env)) {
  if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(name)) delete process.env[name];
}
Object.assign(process.env, {
  NODE_ENV: "", OPENAI_API_KEY: apiKey,
  PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"), PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"),
  PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1", PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(),
  PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: "0.85", PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "3",
  PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "3", PERMITEXT_RESEARCH_DAILY_CAP_USD: "3", PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "3",
  PERMITEXT_RESEARCH_MODEL: "gpt-5.6-terra", PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna", PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2", PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".2",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12", PERMITEXT_RESEARCH_PRICING_VERSION: "configured-live-acceptance",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: ".2", PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".02",
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "1.2", PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "configured-live-acceptance",
  // Use the ordinary answer/verifier path, with one verified revision permitted.
  PERMITEXT_RESEARCH_MODEL_EVIDENCE_ANALYSIS: "0", PERMITEXT_RESEARCH_WEB_SUPPORT: "1"
});

const { handleRequest } = await import('../app.mjs');
const server = createServer(handleRequest);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const results = [];
const repeatProject = process.argv.includes('--repeat-project');
const output = repeatProject ? '/tmp/permitext-transparency-project-repeat.json' : '/tmp/permitext-transparency-live-20260930.json';
try {
  const request = async (path, body, token) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
  };
  const signed = await request('/account/sign-in', { credential: { provider: 'web', providerUserID: randomUUID(), displayName: 'Local transparency acceptance' } });
  const account = signed.body.account;
  const token = account.backendSessionToken;
  const auth = { accountUserID: account.appUserID };
  await request('/admin/lifetime-grants/grant', { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const projectID = repeatProject ? randomUUID() : null;
  if (repeatProject) {
    const { researchPropertyContext } = await import('../research-property-context.mjs');
    const property = await researchPropertyContext({ question: '1070 Southern Blvd, Bronx' });
    assert.equal(property.status, 'retrieved');
    const saved = await request('/sync/push', { batch: { user: { id: account.appUserID }, mutations: [{ project: {
      id: projectID, clientID: projectID, userID: account.appUserID, name: 'Local transparency repetition',
      address: property.normalizedAddress, description: 'Schematic design. Proposed work scope has not been recorded.',
      structuredFacts: property.structuredFacts, updatedAt: new Date().toISOString()
    } }] } }, token);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
  }
  let created = await request('/research/conversations/create', { auth, projectID }, token);
  assert.equal(created.status, 201);
  const questions = repeatProject ? Array(3).fill('can you explain the transparency requirements for this project?') : [
    'Can you explain the transparency requirements for this project? The project is in schematic design phase, at 1070 Southern Blvd, Bronx',
    'where should I measure the 2 feet from?',
    'yes, the sidewalk slopes. If I use the highest point to measure the 2 feet and at the lowest it is not higher than 2 feet 6 inches, should it be fine?',
    'what is the governing zr number?',
    'then explain the 141-32'
  ];
  for (const question of questions) {
    if (repeatProject && results.length) created = await request('/research/conversations/create', { auth, projectID }, token);
    const started = Date.now();
    const response = await request('/research/conversations/message', { auth, conversationID: created.body.conversation.id, question, requestID: randomUUID() }, token);
    const answer = response.body.conversation?.messages.at(-1)?.answer;
    results.push({ question, status: response.status, seconds: (Date.now() - started) / 1000, answer, error: response.body.error });
    await writeFile(output, JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ turn: results.length, status: response.status, mode: answer?.mode, seconds: results.at(-1).seconds }));
    if (response.status !== 200) break;
  }
  console.log(`Review actual answers at ${output}`);
  assert.equal(results.length, questions.length, 'Every acceptance question must complete.');
  assert(results.every(result => result.status === 200 && result.answer?.mode === 'openai' && result.answer?.verification?.pass === true),
    'A clarification is conversational recovery, not a successful substantive-answer acceptance result.');
  if (repeatProject) for (const result of results) {
    assert(/37-34/.test(result.answer.answerText) && /32-321/.test(result.answer.answerText), 'Both retrieved candidate transparency rules must be explained.');
    assert(!/appendix J|self[- ](?:service[- ])?storage/i.test(result.answer.answerText), 'Transparency must not wander into self-storage.');
    assert(/work|new build|development|enlargement|change of use/i.test(result.answer.followUpQuestions.join(' ')), 'The first missing intake fact is proposed work scope.');
  }
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await rm(scratch, { recursive: true, force: true });
}
