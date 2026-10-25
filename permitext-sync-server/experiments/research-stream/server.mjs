import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { openBudget, budgetedFetch } from './budget.mjs';
import { streamAnswer, citationCheck, sourceHash } from './stream.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const live = process.argv.includes('--live');
const configPath = process.argv.find(a => a.startsWith('--env-file='))?.slice(11);
const local = join(root, '.local');
await mkdir(local, { recursive: true });
const supplied = configPath ? parseEnv(await readFile(configPath, 'utf8')) : {};
// Importing app.mjs must never connect this lab to production storage/auth.
for (const key of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$|BLOB_)/.test(key)) delete process.env[key];
Object.assign(process.env, {
  OPENAI_API_KEY: live ? supplied.OPENAI_API_KEY || '' : '',
  PERMITEXT_SYNC_DATA_PATH: join(local, 'synthetic-sync.json'),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(local, 'assets'),
  PERMITEXT_RESEARCH_MODEL: 'gpt-6-luna', PERMITEXT_RESEARCH_LUNA_ONLY: '1',
  PERMITEXT_RESEARCH_REASONING_EFFORT: 'low', PERMITEXT_RESEARCH_SERVICE_TIER: 'default',
  PERMITEXT_RESEARCH_WEB_SUPPORT: '1', PERMITEXT_RUN_PAID_RESEARCH_EVALS: live ? '1' : '0',
  PERMITEXT_RESEARCH_EVAL_MAX_USD: '5', PERMITEXT_RESEARCH_MAX_REQUEST_USD: '2',
  PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: '5', PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: '5',
  PERMITEXT_RESEARCH_DAILY_CAP_USD: '5', PERMITEXT_RESEARCH_MONTHLY_CAP_USD: '5',
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: '.1', PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: '.01',
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: '.5', PERMITEXT_RESEARCH_PRICING_VERSION: 'openai-standard-20261025-luna',
  PERMITEXT_RESEARCH_MONTHLY_REQUEST_LIMIT: '12', PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: '1',
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomBytes(24).toString('hex')
});
if (live && !process.env.OPENAI_API_KEY) throw new Error('Live mode requires a configured API key file.');
const budget = await openBudget(join(local, 'budget.json'));
const nativeFetch = globalThis.fetch;
const paidFetch = budgetedFetch(budget, nativeFetch);
globalThis.fetch = async (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!live && !['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Offline mode blocks external requests.');
  return paidFetch(input, options);
};
const { catalog, prepareSources } = await import('./sources.mjs');
const { handleRequest } = await import('../../app.mjs');
const capability = randomBytes(32).toString('hex');
let origin, busy = false;
let runs;
try { runs = JSON.parse(await readFile(join(local, 'runs.json'), 'utf8')); }
catch (e) { if (e.code !== 'ENOENT') throw e; runs = []; }
const save = async () => {
  await writeFile(join(local, 'runs.json.tmp'), JSON.stringify(runs, null, 2), { mode: 0o600 });
  await rename(join(local, 'runs.json.tmp'), join(local, 'runs.json'));
};
const cookies = req => String(req.headers.cookie || '').split(';').map(v => v.trim());
const authorized = req => cookies(req).includes(`prototype=${capability}`) || req.headers['x-prototype-token'] === capability;
const json = (res, status, value) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); };
async function body(req) {
  let text = '';
  for await (const chunk of req) { text += chunk; if (text.length > 24000) throw new Error('Request too large.'); }
  return JSON.parse(text);
}
async function baseline(input, signal) {
  const request = async (path, payload, token) => {
    const response = await nativeFetch(`${origin}/baseline${path}`, { method: 'POST', signal,
      headers: { 'content-type': 'application/json', 'x-prototype-token': capability, ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || data.message || `Baseline HTTP ${response.status}`), { details: data });
    return data;
  };
  const signed = await request('/account/sign-in', { credential: { provider: 'web', providerUserID: 'stream-prototype-synthetic', email: 'stream-prototype@example.test', displayName: 'Local prototype' } });
  const userID = signed.account.appUserID, token = signed.account.backendSessionToken;
  await request('/admin/lifetime-grants/grant', { userID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const sources = await (await import('./sources.mjs')).librarySources(input.sectionIDs);
  const created = await request('/research/conversations/create', { auth: { accountUserID: userID },
    originSurface: 'reader', sectionID: sources[0].sectionID, selectedText: sources[0].text }, token);
  if (sources.length !== 1) throw new Error('Baseline comparison currently requires exactly one selected passage.');
  const start = performance.now();
  const response = await request('/research/conversations/message', { auth: { accountUserID: userID },
    conversationID: created.conversation.id, question: input.question, requestID: randomUUID() }, token);
  const answer = response.conversation.messages.findLast(m => m.role === 'assistant')?.answer;
  return { text: answer?.answerText || '', answer, sourceHash: sourceHash(sources), sources,
    status: answer?.verification?.pass ? 'completed_verified' : 'completed',
    firstTextMs: Math.round(performance.now() - start), generationMs: Math.round(performance.now() - start) };
}
const server = createServer(async (req, res) => {
  try {
    if (req.headers.host !== new URL(origin).host) return json(res, 403, { error: 'Unexpected host.' });
    const url = new URL(req.url, origin);
    if (url.pathname === '/' && url.searchParams.get('token') === capability) {
      res.writeHead(303, { location: '/', 'set-cookie': `prototype=${capability}; HttpOnly; SameSite=Strict; Path=/`, 'cache-control': 'no-store' }); return res.end();
    }
    if (!authorized(req)) return json(res, 401, { error: 'Open the local launch link to access this prototype.' });
    if (req.method === 'POST' && req.headers.origin !== origin && req.headers['x-prototype-token'] !== capability) return json(res, 403, { error: 'Unexpected origin.' });
    if (url.pathname.startsWith('/baseline/')) { req.url = url.pathname.slice('/baseline'.length); return handleRequest(req, res); }
    if (req.method === 'GET' && ['/', '/client.js', '/style.css'].includes(url.pathname)) {
      const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript' : 'text/css',
        'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
      return res.end(await readFile(join(root, file)));
    }
    if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, { live, budget: budget.snapshot(), runs: runs.slice(-25), busy });
    if (req.method === 'GET' && url.pathname === '/api/catalog') {
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const found = (await catalog()).filter(s => `${s.sectionNumber} ${s.title}`.toLowerCase().includes(q)).slice(0, 40);
      return json(res, 200, found.map(s => ({ id: String(s.id), title: `BC ${s.title}` })));
    }
    if (req.method !== 'POST' || url.pathname !== '/api/run') return json(res, 404, { error: 'Not found.' });
    if (busy) return json(res, 409, { error: 'Wait for the current run to finish or stop it.' });
    const input = await body(req);
    if (typeof input.question !== 'string' || !input.question.trim() || input.question.length > 8000 ||
        typeof (input.facts || '') !== 'string' || (input.facts || '').length > 4000 || !['stream', 'baseline'].includes(input.mode || 'stream')) return json(res, 400, { error: 'Invalid question or mode.' });
    if (input.mode === 'baseline' && (!live || input.facts || input.history?.length)) return json(res, 400, { error: 'Baseline supports a live, self-contained question with facts in the question itself.' });
    busy = true;
    const cancel = new AbortController(), signal = AbortSignal.any([cancel.signal, AbortSignal.timeout(240000)]);
    res.on('close', () => { if (!res.writableEnded) cancel.abort(); });
    res.writeHead(200, { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store', 'x-accel-buffering': 'no' });
    const emit = async event => { signal.throwIfAborted(); if (!res.destroyed) res.write(`${JSON.stringify(event)}\n`); };
    const run = { id: randomUUID(), at: new Date().toISOString(), mode: input.mode || 'stream', live, question: input.question,
      facts: input.facts || '', sectionIDs: input.sectionIDs, status: 'started', text: '' };
    const started = performance.now(), before = budget.snapshot().requests;
    try {
      await emit({ type: 'status', text: run.mode === 'baseline' ? 'Running the existing Research pipeline…' : 'Reading selected library passages…' });
      if (run.mode === 'baseline') Object.assign(run, await baseline(input, signal));
      else {
        const prepared = await prepareSources({ ...input, live, signal, emit: async event => {
          if (event.type === 'sources') run.sources = event.sources;
          await emit(event);
        } });
        Object.assign(run, prepared);
        if (live) Object.assign(run, await streamAnswer({ ...input, sources: prepared.sources,
          apiKey: process.env.OPENAI_API_KEY, signal, emit: async e => { if (e.type === 'delta') run.text += e.text; await emit(e); } }));
        else {
          run.text = '';
          const demo = 'Offline streaming demonstration. This is fixture text, not a model answer.\n\nThe selected library passage is loaded below. Live mode is required to evaluate answer quality and provider latency. [S1]';
          for (const piece of demo.match(/.{1,12}|\n/gs)) { signal.throwIfAborted(); run.text += piece; await emit({ type: 'delta', text: piece }); await new Promise(r => setTimeout(r, 25)); }
          Object.assign(run, { status: 'demo_complete', citations: citationCheck(run.text, run.sources), sourceHash: sourceHash(run.sources) });
        }
      }
      run.totalMs = Math.round(performance.now() - started);
      if (run.firstTextMs !== undefined) run.firstVisibleMs = run.mode === 'baseline' ? run.totalMs : (run.retrievalMs || 0) + run.firstTextMs;
      await paidFetch.drain(); run.providerRequests = budget.snapshot().requests - before;
      runs.push(run); await save();
      await emit({ type: 'result', run, budget: budget.snapshot() });
    } catch (error) {
      Object.assign(run, { status: signal.aborted ? 'interrupted' : 'failed', error: error.message,
        totalMs: Math.round(performance.now() - started), providerRequests: budget.snapshot().requests - before,
        ...(error.retrieval ? { retrieval: error.retrieval } : {}),
        ...(error.details ? { baselineError: error.details } : {}) });
      runs.push(run); await save();
      if (!res.destroyed) res.write(`${JSON.stringify({ type: 'error', run, error: error.message })}\n`);
    } finally { busy = false; res.end(); }
  } catch (error) { if (!res.headersSent) json(res, 400, { error: error.message }); else res.end(); }
});
const port = Number(process.argv.find(a => a.startsWith('--port='))?.slice(7) || 8792);
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
origin = `http://127.0.0.1:${server.address().port}`;
await writeFile(join(local, 'launch.json'), JSON.stringify({ origin, url: `${origin}/?token=${capability}`, token: capability, pid: process.pid, live }), { mode: 0o600 });
console.log(JSON.stringify({ origin, launchFile: join(local, 'launch.json'), live, budget: budget.snapshot() }));
async function shutdown() { server.closeAllConnections(); server.close(); await paidFetch.drain(); await budget.close(); process.exit(0); }
process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
