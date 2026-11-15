import {readFile, realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isAbsolute, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createResearchV2Budget} from '../research-v2-budget.mjs';
import {preparedResearchSemanticVectorPath, preparedResearchSemanticManifestPath,
  loadPreparedResearchSemanticVectors} from '../research-semantic-artifact.mjs';

const applicationRoot = fileURLToPath(new URL('../', import.meta.url));
const snapshot = JSON.parse(await readFile(new URL('../config/local-assistant-production.json', import.meta.url), 'utf8'));
const allowedSettings = new Set([
  'V2','V2_DEFAULT','V2_ROLLOUT','ENGINE','MODEL','FAST_MODEL','ACCURATE_MODEL','LUNA_ONLY','ROUTING_MODE',
  'REASONING_EFFORT','VERIFICATION_REASONING_EFFORT','REVISION_REASONING_EFFORT','SERVICE_TIER',
  'VERIFICATION_SERVICE_TIER','REVISION_SERVICE_TIER','ACCURATE_SERVICE_TIER','COMPLEX_VERIFICATION',
  'ROUTING_POLICY','SEMANTIC_SEARCH','ADVISORY_TOPIC_ROUTES','ADVISORY_ROUTE_RANKING','CURRENT_CORPUS_RECALL','PASSAGE_SEARCH'
].map(key => `PERMITEXT_RESEARCH_${key}`));

// Call before importing app.mjs: some prompt/configuration defaults are read at import time.
export async function configureLocalAssistant({apiKey, dataPath, assetsPath, budgetPath, environment = process.env} = {}) {
  if (environment.NODE_ENV === 'production' || environment.VERCEL || environment.VERCEL_ENV)
    throw new Error('This Assistant configuration is for local testing only.');
  if (!apiKey || ![dataPath,assetsPath,budgetPath].every(path => typeof path === 'string' && isAbsolute(path)) ||
      new Set([dataPath,assetsPath,budgetPath].map(path => resolve(path))).size !== 3)
    throw new Error('Use a local API key and separate absolute test-store, asset and existing budget paths.');
  // Never create a fresh ledger because of a typo or a different worktree.
  const durableBudgetPath = await realpath(budgetPath);
  if (snapshot.schemaVersion !== 1 || Object.keys(snapshot.environment).some(key => !allowedSettings.has(key)))
    throw new Error('The production Assistant snapshot contains unsupported configuration.');
  for (const [file, expected] of Object.entries(snapshot.sourceHashes)) {
    const actual = createHash('sha256').update(await readFile(resolve(applicationRoot,file))).digest('hex');
    if (actual !== expected) throw new Error(`Assistant source differs from the verified production snapshot: ${file}`);
  }
  if (snapshot.environment.PERMITEXT_RESEARCH_SEMANTIC_SEARCH === '1') await loadPreparedResearchSemanticVectors();
  const budget = createResearchV2Budget({path:durableBudgetPath});
  await budget.summary();
  for (const key of Object.keys(environment))
    if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$|BLOB_|CLERK_|STRIPE_|RESEND_|APPLE_.*(?:SECRET|KEY))/.test(key)) delete environment[key];
  Object.assign(environment, snapshot.environment, {
    NODE_ENV:'development', OPENAI_API_KEY:apiKey,
    PERMITEXT_SYNC_DATA_PATH:dataPath, PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:assetsPath,
    PERMITEXT_RESEARCH_V2_BUDGET_PATH:durableBudgetPath,
    PERMITEXT_RESEARCH_SEMANTIC_VECTOR_PATH:preparedResearchSemanticVectorPath,
    PERMITEXT_RESEARCH_SEMANTIC_MANIFEST_PATH:preparedResearchSemanticManifestPath,
    PERMITEXT_RESEARCH_MAX_REQUEST_USD:'1', PERMITEXT_RESEARCH_USER_DAILY_CAP_USD:'7',
    PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD:'7', PERMITEXT_RESEARCH_DAILY_CAP_USD:'7', PERMITEXT_RESEARCH_MONTHLY_CAP_USD:'7',
    PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS:'.1', PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS:'.01',
    PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:'.5', PERMITEXT_RESEARCH_PRICING_VERSION:'openai-luna-20261026'
  });
  return {budget, productionCommit:snapshot.productionCommit, deploymentId:snapshot.deploymentId,
    settingsCount:Object.keys(snapshot.environment).length};
}

// Generation already reserves this ledger in the shared v2 provider. Retrieval
// embeddings must use it too, including timeouts and ambiguous provider failures.
export function budgetLocalAssistantEmbeddings(budget, transport = globalThis.fetch) {
  return async (url, options) => {
    if (String(url) !== 'https://api.openai.com/v1/embeddings') return transport(url, options);
    options?.signal?.throwIfAborted();
    const id = await budget.reserveEmbedding(JSON.parse(options?.body));
    let payload;
    try {
      const response = await transport(url, options);
      if (response.ok) payload = await response.clone().json();
      return response;
    } finally { await budget.settle(id, payload); }
  };
}
