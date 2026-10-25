import { readFile, writeFile, rename, mkdir, open } from 'node:fs/promises';
import { dirname } from 'node:path';

// Conservative, never-released allowance per dispatched request. At most twelve
// requests fit in the approved $5 batch. Unknown usage still consumes its allowance.
// Only Luna/default, <=24k output and <=3 web searches are allowed. $0.40 exceeds
// the full 922k long-context/cache-write input + output + search allowance at the
// official 2026-10-25 rates. Actual token estimates are reported separately.
export const reservationUSD = 0.40;
export async function openBudget(path, capUSD = 5) {
  if (!(capUSD > 0 && capUSD <= 5)) throw new Error('This batch is authorized for at most $5.');
  await mkdir(dirname(path), { recursive: true });
  const lock = await open(`${path}.lock`, 'wx', 0o600);
  let ledger;
  try {
    try { ledger = JSON.parse(await readFile(path, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; ledger = { capUSD, requests: [] }; }
    if (ledger.capUSD !== capUSD || !Array.isArray(ledger.requests)) throw new Error('Budget file does not match this batch.');
  } catch (error) { await lock.close(); const { unlink } = await import('node:fs/promises'); await unlink(`${path}.lock`); throw error; }
  let queue = Promise.resolve();
  const save = async () => {
    await writeFile(`${path}.tmp`, `${JSON.stringify(ledger, null, 2)}\n`, { mode: 0o600 });
    await rename(`${path}.tmp`, path);
  };
  const serialized = fn => { const work = queue.then(fn); queue = work.catch(() => {}); return work; };
  return {
    snapshot: () => ({ capUSD, reservedUSD: Number((ledger.requests.length * reservationUSD).toFixed(2)),
      requests: ledger.requests.length, estimatedUSD: ledger.requests.reduce((n, r) => n + (r.estimatedUSD || 0), 0),
      usageUnknown: ledger.requests.filter(r => !r.usage).length }),
    reserve: body => serialized(async () => {
      if (body.model !== 'gpt-6-luna' || !['default', undefined].includes(body.service_tier) ||
          !(body.max_output_tokens > 0 && body.max_output_tokens <= 24000) ||
          (body.tools || []).some(t => t.type !== 'web_search') ||
          ((body.tools || []).length && !(body.max_tool_calls > 0 && body.max_tool_calls <= 3))) {
        throw new Error('Request exceeds the approved model/cost envelope.');
      }
      if ((ledger.requests.length + 1) * reservationUSD > capUSD + 1e-9) throw new Error('The $5 comparison budget cannot cover another request.');
      const id = ledger.requests.length;
      ledger.requests.push({ id, reservedUSD: reservationUSD, at: new Date().toISOString(),
        model: body.model, streaming: body.stream === true,
        stage: body.text?.format?.name || (body.tools?.length ? 'official_web' : 'streamed_answer') });
      await save(); return id;
    }),
    recordUsage: (id, payload) => serialized(async () => {
      const u = payload?.usage;
      if (!u || !Number.isSafeInteger(u.input_tokens) || !Number.isSafeInteger(u.output_tokens)) return;
      const cached = u.input_tokens_details?.cached_tokens || 0;
      const writes = u.input_tokens_details?.cache_write_tokens || 0;
      const long = u.input_tokens > 272000;
      const searches = (payload.output || []).filter(i => i.type === 'web_search_call').length;
      const estimate = ((u.input_tokens - cached - writes) * .1 + cached * .01 + writes * .125) * (long ? 2 : 1) / 1e6 + u.output_tokens * .5 * (long ? 1.5 : 1) / 1e6 + searches * .01;
      Object.assign(ledger.requests[id], { usage: u, searchCalls: searches, estimatedUSD: estimate, status: payload.status });
      await save();
    }),
    close: async () => { await queue; await lock.close(); const { unlink } = await import('node:fs/promises'); await unlink(`${path}.lock`); }
  };
}

export function budgetedFetch(budget, baseFetch = fetch) {
  const pending = new Set();
  const wrapped = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (url.href !== 'https://api.openai.com/v1/responses') return baseFetch(input, options);
    options.signal?.throwIfAborted();
    const body = JSON.parse(options.body), id = await budget.reserve(body);
    const response = await baseFetch(input, options);
    const copy = response.clone();
    const task = (async () => {
      if (!response.ok) { await copy.body?.cancel(); return; }
      if (!body.stream) await budget.recordUsage(id, await copy.json());
      else {
        const { responseEvents } = await import('./stream.mjs');
        for await (const event of responseEvents(copy.body)) {
          if (event.response?.usage) await budget.recordUsage(id, event.response);
        }
      }
    })().catch(() => {}).finally(() => pending.delete(task));
    pending.add(task);
    return response;
  };
  wrapped.drain = () => Promise.all([...pending]);
  return wrapped;
}
