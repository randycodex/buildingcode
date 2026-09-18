import { criteria, requestFor, summarize } from './typesafe-intent.mjs';

export const terraModel = 'gpt-5.6-terra';
export const terraPricing = { input: 2, cachedInput: 0.2, cacheWrite: 2.5, output: 12,
  checkedOn: '2026-09-18', source: 'https://developers.openai.com/api/docs/models/gpt-5.6-terra' };

export function terraRequest(question) {
  const shared = requestFor(question);
  return { model: terraModel, store: false, reasoning: { effort: 'low' }, max_output_tokens: 1024,
    instructions: `${shared.questions.intent.instructions}\nCategory criteria:\n${JSON.stringify(criteria)}`,
    input: JSON.stringify(shared.state),
    text: { format: { type: 'json_schema', name: 'research_intent', strict: true,
      schema: { type: 'object', additionalProperties: false,
        properties: { choice: { type: 'string', enum: Object.keys(criteria) } }, required: ['choice'] } } } };
}

export function validateTerra(body) {
  if (body?.status !== 'completed' || !/^gpt-5\.6-terra(?:-\d{4}-\d{2}-\d{2})?$/.test(body?.model || '')) throw new Error('Invalid Terra completion');
  const content = (body.output || []).filter(o => o.type === 'message').flatMap(o => o.content || []);
  if (content.some(c => c.type === 'refusal')) throw new Error('Terra refused classification');
  let answer;
  try { answer = JSON.parse(content.filter(c => c.type === 'output_text').map(c => c.text).join('')); }
  catch { throw new Error('Invalid Terra classification JSON'); }
  if (Object.keys(answer || {}).length !== 1 || !Object.hasOwn(criteria, answer?.choice)) throw new Error('Invalid Terra classification');
  const inputTokens = body.usage?.input_tokens;
  const outputTokens = body.usage?.output_tokens;
  const cachedInputTokens = body.usage?.input_tokens_details?.cached_tokens ?? 0;
  const cacheWriteTokens = body.usage?.input_tokens_details?.cache_write_tokens ?? 0;
  if (![inputTokens, outputTokens, cachedInputTokens, cacheWriteTokens].every(n => Number.isSafeInteger(n) && n >= 0) ||
      cachedInputTokens + cacheWriteTokens > inputTokens || inputTokens > 272000) throw new Error('Invalid Terra usage');
  return { model: body.model, choice: answer.choice, confidence: null, inputTokens, outputTokens, cachedInputTokens, cacheWriteTokens,
    estimatedCostUSD: ((inputTokens-cachedInputTokens-cacheWriteTokens)*terraPricing.input +
      cachedInputTokens*terraPricing.cachedInput + cacheWriteTokens*terraPricing.cacheWrite + outputTokens*terraPricing.output)/1e6 };
}

export async function classifyTerra(question, { apiKey, fetchImpl = fetch } = {}) {
  if (!apiKey?.trim()) throw new Error('Missing OPENAI_API_KEY');
  const body = terraRequest(question);
  let response;
  try {
    response = await fetchImpl('https://api.openai.com/v1/responses', { method: 'POST', redirect: 'error',
      signal: AbortSignal.timeout(45000), headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body) });
  } catch { throw new Error('Terra transport failure; no retry performed'); }
  if (!response.ok) throw new Error(`Terra HTTP ${response.status}; no retry performed`);
  let payload;
  try { payload = await response.json(); } catch { throw new Error('Invalid Terra JSON'); }
  return validateTerra(payload);
}

export function comparisonSummary(rows) {
  const forProvider = p => summarize(rows.map(r => ({ id: r.id, expected: r.expected, ...r[p] })));
  const paired = rows.filter(r => r.jev?.result && r.terra?.result);
  return { jev: forProvider('jev'), terra: forProvider('terra'), paired: paired.length,
    disagreements: paired.filter(r => r.jev.result.choice !== r.terra.result.choice).map(r => ({
      id: r.id, expected: r.expected, jev: r.jev.result.choice, jevConfidence: r.jev.result.confidence, terra: r.terra.result.choice })),
    limitations: ['Synthetic draft labels, not human-approved accuracy.', 'Classification-only test, not full Research answer quality, cost, or speed.',
      'Terra returns a choice without invented confidence; Jev confidence is not comparable to a Terra self-rating.',
      'One observation per question/provider; no statistical calibration or production readiness claim.'] };
}
