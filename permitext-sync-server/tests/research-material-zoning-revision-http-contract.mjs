import { withSyntheticMaterialScopeProviderResponse } from "./research-applicability-response-double.mjs";
// Actual request schemas, HTTP handler, source bindings, fresh review and
// persistence. Handwritten provider doubles test the repair path, not accuracy.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { researchTargetedRevisionEligible } from '../research-targeted-revision.mjs';
import { buildResearchRequestEnvelopeBuilders, researchRequestEnvelopeEnvironment } from './research-request-envelope-preflight.mjs';

const material = { type: 'misstated_provision', detail: 'The exemption applies to its stated building recipient, not a room; update narrative, supported point and citation relevance together.' };
const prior = { answerText: 'Synthetic original conclusion.', supportedPoints: [{ explanation: 'Synthetic stale recipient.', sectionID: 'fake-section', sourceIDs: ['fake-passage'] }],
  citations: [{ sectionID: 'fake-section', sourceIDs: ['fake-passage'], relevance: 'Synthetic stale recipient.' }] };
const rewritePlan = { callPolicy: { allowFullAnswerRewrite: true }, questionSignals: { streetscapeExplanation: true } };
for (const issue of ['misstated_provision', 'unsupported_requirement', 'missed_material_conclusion', 'unnecessary_prerequisite', 'unresolved_project_fact']) {
  assert.equal(researchTargetedRevisionEligible({ zoningPlan: rewritePlan, previousInterpretation: prior, revisionFeedback: [{ type: issue }] }), false,
    'Rewrite permission must not make a material error eligible for a sentence patch.');
}
assert.equal(researchTargetedRevisionEligible({ zoningPlan: rewritePlan, previousInterpretation: prior, revisionFeedback: [] }), false);
for (const type of ['incorrect_citation', 'irrelevant_citation', 'unnecessary_qualification', 'repeated_established_fact']) {
  assert.equal(researchTargetedRevisionEligible({ zoningPlan: rewritePlan, previousInterpretation: prior, revisionFeedback: [{ type }] }), true);
  assert.equal(researchTargetedRevisionEligible({ zoningPlan: rewritePlan, previousInterpretation: prior, revisionFeedback: [{ type }, material] }), false);
}
const synthetic = [{ sectionID: 'fake-section', sourceID: 'fake-passage', codePrefix: 'BC', sectionNumber: '990', title: 'Synthetic scope rule',
  text: 'The test requirement applies to rooms. Exception: fabrication buildings used exclusively for fabrication are excluded.' }];
const builders = await buildResearchRequestEnvelopeBuilders({ ...researchRequestEnvelopeEnvironment,
  PERMITEXT_RESEARCH_MODEL: 'gpt-6-luna', PERMITEXT_RESEARCH_REASONING_EFFORT: 'low' });
const full = builders.buildAnswerRequest('Does a fabrication room in a mixed-purpose building qualify?', synthetic, 'offline-material',
  { zoningPlan: rewritePlan, responseStyle: 'conversational', previousInterpretation: prior, revisionFeedback: [material] });
assert.equal(full.text.format.name, 'permitext_code_interpretation');
assert(full.text.format.schema.properties.answerText && full.text.format.schema.properties.supportedPoints && full.text.format.schema.properties.citations);
assert(!full.text.format.schema.properties.edits);
assert.equal(full.reasoning.effort, 'medium', 'The existing bounded feedback revision effort is preserved.');
assert(full.input.includes(synthetic[0].text) && full.input.includes('fake-passage'));
assert(!full.input.includes('EDITABLE TEXT TARGETS'));
const narrow = builders.buildAnswerRequest('Explain the supplied rule.', synthetic, 'offline-material',
  { zoningPlan: rewritePlan, responseStyle: 'conversational', previousInterpretation: prior, revisionFeedback: [{ type: 'incorrect_citation' }] });
assert.equal(narrow.text.format.name, 'permitext_research_targeted_revision');
assert.equal(narrow.max_output_tokens, full.max_output_tokens);

const scratch = await mkdtemp(join(tmpdir(), 'permitext-material-zoning-revision-'));
const hybrid = process.argv.includes('--hybrid');
for (const name of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(name)) delete process.env[name];
Object.assign(process.env, { NODE_ENV: '', OPENAI_API_KEY: 'offline-response-double',
  PERMITEXT_SYNC_DATA_PATH: join(scratch, 'store.json'), PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, 'assets'),
  PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: '1', PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(), PERMITEXT_EVIDENCE_DISCOVERY_BETA: '1',
  PERMITEXT_RESEARCH_MODEL: 'gpt-6-luna', PERMITEXT_RESEARCH_FAST_MODEL: 'gpt-6-luna', PERMITEXT_RESEARCH_ROUTING_MODE: 'single',
  PERMITEXT_RESEARCH_REASONING_EFFORT: 'low', PERMITEXT_RESEARCH_VERIFICATION_REASONING_EFFORT: 'medium',
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: '.1', PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: '.01',
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: '.5', PERMITEXT_RESEARCH_PRICING_VERSION: 'offline-test',
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: '1', PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: '5', PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: '5',
  PERMITEXT_RESEARCH_DAILY_CAP_USD: '5', PERMITEXT_RESEARCH_MONTHLY_CAP_USD: '5' });
if (hybrid) Object.assign(process.env, {
  PERMITEXT_RESEARCH_ROUTING_MODE: 'hybrid', PERMITEXT_RESEARCH_ACCURATE_MODEL: 'gpt-6.1-sol', PERMITEXT_RESEARCH_COMPLEX_VERIFICATION: '1',
  PERMITEXT_RESEARCH_ACCURATE_SERVICE_TIER: 'default', PERMITEXT_RESEARCH_MAX_REQUEST_USD: '.5',
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: '2', PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: '.1',
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: '10',
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: '.1', PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: '.01',
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: '.5', PERMITEXT_RESEARCH_FAST_PRICING_VERSION: 'offline-test'
});
const nativeFetch = globalThis.fetch;
let phases = [], acceptRevision = true, proposed, revised, doubleError, finalReviewCount = 0;
const badScope = 'Community-facility space is excluded from the transparency requirement.';
const correctedScope = 'The supplied exception identifies community facility buildings; the supplied definition requires a building used only for a community facility use.';
globalThis.fetch = async (url, options) => {
  try {
    assert.equal(String(url), 'https://api.openai.com/v1/responses', 'Unexpected external request.');
    const body = JSON.parse(options.body), phase = body.text.format.name;
    phases.push(phase);
    assert.equal(body.model, hybrid && phases.length !== 1 ? 'gpt-6.1-sol' : 'gpt-6-luna');
    if (hybrid && phases.length !== 1) assert.equal(body.service_tier, 'default');
    assert(phases.length <= 4, 'One draft, two reviews and one revision; no extra calls.');
    assert.notEqual(phase, 'permitext_research_targeted_revision', 'Material zoning feedback must receive a fresh answer schema.');
    const input = typeof body.input === 'string' ? body.input : body.input.flatMap(item => item.content.map(part => part.text || '')).join('\n');
    let output;
    if (phase === 'permitext_code_interpretation') {
      assert([1, 3].includes(phases.length));
      assert(body.text.format.schema.properties.answerText && body.text.format.schema.properties.supportedPoints && body.text.format.schema.properties.citations);
      assert.equal(body.text.format.strict, true);
      assert.equal(body.max_output_tokens, hybrid && phases.length === 3 ? 8_000 : 24_000);
      const sources = Array.from(input.matchAll(/PASSAGE_ID: ([^\n]+)\nSECTION_ID: ([^\n]+)\nCODE: [^\n]+\nSECTION: ([^\n]+)/g),
        ([, sourceID, sectionID, sectionNumber]) => ({ sourceID, sectionID, sectionNumber }));
      assert.deepEqual(new Set(body.text.format.schema.properties.supportedPoints.items.properties.sourceIDs.items.enum), new Set(sources.map(source => source.sourceID)));
      assert.deepEqual(new Set(body.text.format.schema.properties.citations.items.properties.sectionID.enum), new Set(sources.map(source => source.sectionID)));
      const tier = sources.find(source => source.sectionNumber === '32-321'), primary = sources.find(source => source.sectionNumber === '37-34'), definition = sources.find(source => source.sectionNumber === '12-10');
      assert(tier && primary && definition, 'Full canonical framework and complete definition entries are in both requests.');
      assert.match(input, /building used only for a community facility use/);
      const tierRule = 'If the Tier B framework governs, its ground-floor street-wall transparency requirement is at least 50 percent in the stated height band.';
      const primaryRule = 'If the primary-frontage framework governs, its ground-floor street-wall transparency requirement is also at least 50 percent in the stated height band.';
      output = { answerText: `${tierRule} ${primaryRule} ${phases.length === 3 ? correctedScope : 'The community-facility exception needs its exact source scope checked.'}`,
        supportedPoints: [
          { heading: 'Exemption scope', explanation: phases.length === 3 && acceptRevision ? correctedScope : badScope,
            sectionID: tier.sectionID, sourceIDs: phases.length === 3 ? [tier.sourceID, definition.sourceID] : [tier.sourceID] },
          { heading: 'Primary-frontage rule', explanation: primaryRule, sectionID: primary.sectionID, sourceIDs: [primary.sourceID] }
        ], citations: [
          { sectionID: tier.sectionID, sourceIDs: [tier.sourceID], relevance: phases.length === 3 ? 'The exemption recipient is a building.' : 'An exemption for a community-facility space.' },
          { sectionID: primary.sectionID, sourceIDs: [primary.sourceID], relevance: 'The conditional primary-frontage transparency rule.' },
          ...(phases.length === 3 ? [{ sectionID: definition.sectionID, sourceIDs: [definition.sourceID], relevance: 'The complete building definition and its exclusive-use condition.' }] : [])
        ], assumptions: [], missingFacts: ['What ground-floor uses and street-frontage conditions apply?'], followUpQuestions: [],
        evidenceLimitations: ['The frontage framework is unresolved in this test.'], additionalEvidenceNeeded: [], supportingSourceUses: [] };
      if (phases.length === 1) {
        assert.equal(body.reasoning.effort, 'low', 'This fix does not raise normal initial-draft effort.');
        proposed = output;
      }
      else {
        assert.equal(body.reasoning.effort, hybrid ? 'low' : 'medium');
        assert(input.includes(material.detail) && input.includes(badScope), 'Full regeneration sees actual rejected answer and material feedback.');
        assert(!input.includes('EDITABLE TEXT TARGETS'));
        revised = output;
      }
    } else {
      assert.equal(phase, 'permitext_research_verification');
      const actual = JSON.parse(input.split('PROPOSED ANSWER JSON\n')[1]);
      if (phases.length === 2) {
        assert.equal(actual.supportedPoints[0].explanation, proposed.supportedPoints[0].explanation);
        output = { pass: false, issues: [material], unnecessaryMissingFactIndices: [] };
      } else {
        assert.equal(phases.length, 4);
        finalReviewCount += 1;
        assert.equal(actual.answerText, revised.answerText, 'Fresh review sees the actual regenerated narrative.');
        assert.equal(actual.supportedPoints[0].explanation, revised.supportedPoints[0].explanation, 'Fresh review also sees the actual point, including deliberately stale negative case.');
        assert.deepEqual(actual.supportedPoints[0].sourceIDs, revised.supportedPoints[0].sourceIDs);
        assert(actual.citations.some(citation => citation.relevance.includes('exclusive-use condition')));
        assert(!actual.citations.some(citation => citation.relevance === 'An exemption for a community-facility space.'));
        output = { pass: acceptRevision, issues: acceptRevision ? [] : [material], unnecessaryMissingFactIndices: [] };
      }
    }
    return Response.json(withSyntheticMaterialScopeProviderResponse(body, { model: body.model, status: 'completed', usage: { input_tokens: 100, output_tokens: 100 },
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] }));
  } catch (error) { doubleError = error; throw error; }
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
  const signed = await request('/account/sign-in', { credential: { provider: 'web', providerUserID: randomUUID(), displayName: 'Offline material revision contract' } });
  const account = signed.body.account, token = account.backendSessionToken, auth = { accountUserID: account.appUserID };
  await request('/admin/lifetime-grants/grant', { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const fixture = JSON.parse(await readFile(new URL('./fixtures/research-transparency-project-facts.json', import.meta.url)));
  const projectID = randomUUID();
  await request('/sync/push', { batch: { user: { id: account.appUserID }, mutations: [{ project: { id: projectID, clientID: projectID,
    userID: account.appUserID, name: 'Material repair contract', address: fixture.address, structuredFacts: fixture.structuredFacts, updatedAt: new Date().toISOString() } }] } }, token);
  for (const accepted of [true, false]) {
    acceptRevision = accepted; phases = []; doubleError = null;
    const created = await request('/research/conversations/create', { auth, projectID }, token);
    const conversationID = created.body.conversation.id;
    const response = await request('/research/conversations/message', { auth, conversationID, question: fixture.questions[0], requestID: randomUUID() }, token);
    if (doubleError) throw doubleError;
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.deepEqual(phases, ['permitext_code_interpretation', 'permitext_research_verification', 'permitext_code_interpretation', 'permitext_research_verification']);
    const message = response.body.conversation.messages.at(-1), answer = message.answer;
    assert.equal(answer.mode, accepted ? 'openai' : 'clarification');
    if (accepted) {
      assert.equal(answer.routing.fullAnswerRewriteAllowed, true, 'Exercise the previous unconditional zoning override.');
      assert.equal(answer.supportedPoints[0].explanation, correctedScope);
      assert(!JSON.stringify(answer).includes(badScope));
      assert(answer.verification.history.at(-1).pass);
      if (hybrid) {
        assert.equal(answer.routing.verificationModel, 'gpt-6.1-sol');
        assert.equal(answer.verification.history.at(-1).reasoningEffort, 'low');
      }
      const saved = await request('/research/answers/get', { auth, answerID: message.id }, token);
      assert.equal(saved.status, 200);
      assert.equal(saved.body.answer.answer.supportedPoints[0].explanation, correctedScope);
    } else {
      const telemetry = await request('/internal/evaluations/data', { auth }, token);
      const failed = telemetry.body.researchSpend.operationMetrics.find(operation => operation.failureCode === 'RESEARCH_VERIFICATION_FAILED');
      assert(failed && !failed.charged && failed.providerRequestCount === 4 && failed.pendingProviderRequestCount === 0);
      assert(!JSON.stringify(answer).includes(badScope), 'Rejected regenerated points never reach the user.');
    }
  }
  assert.equal(finalReviewCount, 2);
  console.log('Material zoning revision passed: unconditional patch override removed; narrow repairs preserved; actual full-answer schema/source bindings, updated points/citations and mandatory final review; accepted revision persisted, stale-point revision withheld; four calls per turn, all mocked.');
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  globalThis.fetch = nativeFetch; await rm(scratch, { recursive: true, force: true });
}
