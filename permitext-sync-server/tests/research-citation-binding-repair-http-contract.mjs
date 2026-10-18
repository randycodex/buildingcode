// Real retrieval, normalization, review loop and durable commit; synthetic
// provider judgments exercise mechanics, not legal accuracy or live latency.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const scratch = await mkdtemp(join(tmpdir(), 'permitext-citation-bindings-'));
for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(key)) delete process.env[key];
Object.assign(process.env, { NODE_ENV: '', OPENAI_API_KEY: 'offline-provider-double',
  PERMITEXT_SYNC_DATA_PATH: join(scratch, 'store.json'), PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, 'assets'),
  PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: '1', PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(),
  PERMITEXT_EVIDENCE_DISCOVERY_BETA: '1', PERMITEXT_RESEARCH_SEMANTIC_SEARCH: '0',
  PERMITEXT_RESEARCH_ENGINE: 'open', PERMITEXT_RESEARCH_LUNA_ONLY: '1',
  PERMITEXT_RESEARCH_MODEL: 'gpt-6-luna', PERMITEXT_RESEARCH_FAST_MODEL: 'gpt-6-luna', PERMITEXT_RESEARCH_ROUTING_MODE: 'single',
  PERMITEXT_RESEARCH_REASONING_EFFORT: 'low', PERMITEXT_RESEARCH_VERIFICATION_REASONING_EFFORT: 'medium',
  PERMITEXT_RESEARCH_SERVICE_TIER: 'priority', PERMITEXT_RESEARCH_REVISION_REASONING_EFFORT: 'high',
  PERMITEXT_RESEARCH_REVISION_SERVICE_TIER: 'default', PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: '.1',
  PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: '.01', PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: '.5',
  PERMITEXT_RESEARCH_PRICING_VERSION: 'offline-contract', PERMITEXT_RESEARCH_MAX_REQUEST_USD: '1',
  PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: '5', PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: '5',
  PERMITEXT_RESEARCH_DAILY_CAP_USD: '5', PERMITEXT_RESEARCH_MONTHLY_CAP_USD: '5' });
const nativeFetch = globalThis.fetch;
const nativeWarn = console.warn;
let scenario, calls, initial, beforeRepair, afterRepair, correct, wrong, providerError, reviews, packetSources, failures;
console.warn = (message, ...rest) => {
  try { const event = JSON.parse(message); if (Array.isArray(event.verificationAttempts)) failures.push(event); } catch { /* Non-JSON diagnostics are unchanged. */ }
  nativeWarn(message, ...rest);
};
globalThis.fetch = async (url, options) => {
  try {
    assert.equal(String(url), 'https://api.openai.com/v1/responses');
    const body = JSON.parse(options.body), phase = body.text.format.name; calls.push(phase);
    assert.equal(body.model, 'gpt-6-luna'); assert.equal(body.store, false);
    let value;
    if (phase === 'permitext_research_investigation') {
      const data = JSON.parse(body.input);
      packetSources = data.sources;
      const second = calls.filter(call => call === phase).length > 1;
      value = { ready: second, queries: second ? [] : ['commercial floor area ratio'],
        retainSourceIDs: data.sources.filter(source => source.sectionNumber === '12-10').map(source => source.sourceID), reason: 'Check the other definition passages.' };
    } else if (phase === 'permitext_code_interpretation') {
      const passages = body.input.split('PASSAGE_ID: ').slice(1).map(text => ({
        sourceID: text.split('\n')[0], sectionID: text.match(/SECTION_ID: ([^\n]+)/)?.[1],
        number: text.match(/SECTION: ([^\n]+)/)?.[1], text: text.split('ENACTED_TEXT: ')[1]?.split('\n\nPASSAGE_ID:')[0] || '' }));
      correct = passages.find(source => source.number === '12-10' && /A ["“]use["”] is/.test(source.text));
      wrong = passages.find(source => source.number === '12-10' && source.sourceID !== correct?.sourceID && !/A ["“]use["”] is/.test(source.text));
      assert(correct && wrong, JSON.stringify(passages.filter(source => source.number === '12-10').map(source => ({ id: source.sourceID, text: source.text.slice(0,90) }))));
      const repair = Boolean(initial);
      assert.equal(body.service_tier, repair ? 'default' : 'priority');
      const source = repair ? correct : wrong;
      value = { answerText: 'ZR §12-10 defines use by the intended or actual purpose or activity of a space.',
        supportedPoints: [{ heading: 'Meaning of use', explanation: 'Use is defined by purpose or activity.', sectionID: source.sectionID, sourceIDs: [source.sourceID] }],
        citations: [{ sectionID: source.sectionID, sourceIDs: [source.sourceID], relevance: 'The general definition of use.' }],
        assumptions: [], missingFacts: [], followUpQuestions: [], evidenceLimitations: [], additionalEvidenceNeeded: [], supportingSourceUses: [] };
      initial ||= structuredClone(value);
    } else if (phase === 'permitext_research_citation_binding_repair') {
      assert.equal(body.service_tier, 'default'); assert.equal(body.reasoning.effort, 'high');
      assert(!body.text.format.schema.properties.answerText);
      assert.match(body.instructions, /complete fresh Luna review/);
      const targets = JSON.parse(body.input.split('BINDING REPAIR TARGETS\n')[1]);
      value = { answerHash: body.text.format.schema.properties.answerHash.enum[0], cannotRepair: scenario === 'needs-wording',
        replacements: scenario === 'needs-wording' ? [] : targets.flatMap(target =>
          target.replacements.filter(item => item.fromSourceID === wrong.sourceID && item.toSourceIDs.includes(correct.sourceID))
            .map(item => ({ targetID: target.targetID, fromSourceID: item.fromSourceID, toSourceID: correct.sourceID }))) };
      assert(value.cannotRepair || value.replacements.length === 2);
      if (scenario === 'invalid-patch') value.answerText = 'Unapproved replacement prose.';
    } else {
      assert.equal(phase, 'permitext_research_open_review'); assert.equal(body.service_tier, 'priority');
      const data = JSON.parse(body.input); reviews++;
      assert(data.evidence.some(source => source.sourceID === correct.sourceID));
      if (reviews === 1) {
        beforeRepair = structuredClone(data.answer);
        value = { pass: false, issues: [{ type: 'incorrect_citation', message: `Use is not defined in ${wrong.sourceID}; the supplied definition is in ${correct.sourceID}.` }] };
      } else {
        afterRepair = data.answer;
        assert.equal(afterRepair.answerText, beforeRepair.answerText);
        if (scenario !== 'rejected') {
          assert.deepEqual(afterRepair.supportedPoints[0].sourceIDs, [correct.sourceID]);
          assert.deepEqual(afterRepair.citations[0].sourceIDs, [correct.sourceID]);
          assert(afterRepair.citations[0].supportingPassages[0].selectedText.includes('use'));
        }
        value = scenario === 'rejected' ? { pass: false, issues: [{ type: 'unsupported_requirement', message: 'Synthetic fresh review rejects the claim itself; a link change cannot certify it.' }] }
          : { pass: true, issues: [] };
      }
    }
    assert(calls.length <= 9);
    return Response.json({ model: body.model, status: 'completed', usage: { input_tokens: 100, output_tokens: 100 },
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] });
  } catch (error) { providerError = error; throw error; }
};
let server;
try {
  const { handleRequest } = await import('../app.mjs');
  server = createServer(handleRequest); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const request = async (path, body, token) => {
    const response = await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`, { method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const signed = await request('/account/sign-in', { credential: { provider: 'web', providerUserID: randomUUID() } });
  const account = signed.body.account, token = account.backendSessionToken, auth = { accountUserID: account.appUserID };
  await request('/admin/lifetime-grants/grant', { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  for (scenario of ['accepted', 'needs-wording', 'rejected', 'invalid-patch']) {
    calls = []; failures = []; reviews = 0; initial = beforeRepair = afterRepair = correct = wrong = providerError = undefined;
    const created = await request('/research/conversations/create', { auth }, token), conversationID = created.body.conversation.id;
    const response = await request('/research/conversations/message', { auth, conversationID, requestID: randomUUID(),
      question: 'how do you determine the use group for this site?' }, token);
    if (providerError) throw providerError;
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const answer = response.body.conversation.messages.at(-1).answer;
    assert.equal(answer.mode, ['accepted', 'needs-wording'].includes(scenario) ? 'openai' : 'clarification');
    assert(calls.includes('permitext_research_citation_binding_repair'), JSON.stringify(packetSources.filter(source => source.sectionNumber === '12-10').map(source => Object.fromEntries(['sourceID','sectionID','codePrefix','sectionNumber','corpusID','codeVersion','codeEdition','jurisdiction','evidencePriority'].map(key => [key, source[key]])))));
    if (scenario === 'accepted') {
      assert.equal(calls.filter(call => call === 'permitext_code_interpretation').length, 1, 'No full-answer rewrite');
      assert.equal(reviews, 2, 'A new full-answer review is mandatory');
      assert.equal(answer.verification.citationBindingRepairApplied, true);
      assert.equal(answer.verification.regenerated, false);
      assert.equal(answer.answerText, beforeRepair.answerText);
    } else if (scenario === 'needs-wording') {
      assert.equal(calls.filter(call => call === 'permitext_code_interpretation').length, 2, 'Cannot-repair preserves existing full revision');
      assert.equal(reviews, 2);
      assert.equal(answer.verification.regenerated, true);
    } else {
      assert.deepEqual(answer.citations, [], 'An unverified or malformed candidate is never delivered');
      if (scenario === 'invalid-patch') assert.equal(failures.at(-1).verificationAttempts[0].issues[0].type, 'incorrect_citation',
        'A malformed repair must preserve the original reviewer finding.');
    }
    if (['accepted', 'needs-wording'].includes(scenario)) {
      const stored = JSON.parse(await readFile(process.env.PERMITEXT_SYNC_DATA_PATH, 'utf8'));
      const usage = stored.researchUsageByUserID[account.appUserID].filter(entry => entry.mode === 'openai').at(-1);
      assert.equal(usage.providerRequestCount, calls.length, 'Retain accounting for the patch, fallback and every review.');
      assert.equal(usage.totalTokens, calls.length * 200);
    }
    const reopened = await request('/research/conversations/get', { auth, conversationID }, token);
    assert.equal(reopened.body.conversation.messages.at(-1).answer.answerText, answer.answerText);
  }
  console.log('Citation binding HTTP: real ZR passages, no answer rewrite for an eligible link correction, fresh full Luna review, full-revision fallback, malformed/rejected exclusion and durable reopening; zero live provider calls.');
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  globalThis.fetch = nativeFetch; console.warn = nativeWarn; await rm(scratch, { recursive: true, force: true });
}
