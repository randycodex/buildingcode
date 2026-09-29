// Opt-in loopback test transport. Production files are served byte-for-byte.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
export async function createRolloutFixture({ baselineDir, currentDir, capability }) {
  const names = ['index.html', 'app.js', 'offline-storage.js', 'service-worker.js'];
  const load = async dir => Object.fromEntries(await Promise.all(names.map(async name => [name, await readFile(join(dir, name))])));
  const baseline = await load(baselineDir), current = await load(currentDir);
  const assetVersion = files => files['index.html'].toString().match(/\/web\/app\.js\?v=([^"\s]+)/)?.[1];
  const versions = { baseline: assetVersion(baseline), current: assetVersion(current) };
  assert.ok(versions.baseline && versions.current && versions.baseline !== versions.current, 'Distinct baseline/current asset versions required');
  const notebookAssets = new Map();
  const notebook = {};
  for (const [label, files, dir] of [['baseline', baseline, baselineDir], ['current', current, currentDir]]) {
    const version = files['app.js'].toString().match(/const\s+notebookClientVersion\s*=\s*["']([^"']+)["']/)?.[1];
    notebook[label] = version ? Object.fromEntries(['js', 'css'].map(ext => [ext, `/web/notebook-assets/notebook.${ext}?v=${version}`])) : null;
    if (!version) continue; // Preserve minimal four-file fixture compatibility.
    for (const ext of ['js', 'css']) {
      const bytes = await readFile(join(dir, 'notebook-assets', `notebook.${ext}`));
      const url = notebook[label][ext];
      if (notebookAssets.has(url)) assert.ok(notebookAssets.get(url).bytes.equals(bytes), `Same Notebook URL must have identical bytes: ${url}`);
      notebookAssets.set(url, {bytes, type: ext === 'css' ? 'text/css' : 'text/javascript'});
    }
  }
  let phase = 'baseline', networkOff = false;
  const state = () => ({ phase, networkOff, versions });
  const send = (res, status, type, bytes) => res.writeHead(status, {'content-type': type, 'cache-control': 'no-store', 'service-worker-allowed': '/', 'x-content-type-options': 'nosniff'}).end(bytes);
  return { state, async handle(req, res, url) {
    if (url.pathname.startsWith('/fixture/rollout')) {
      if (url.searchParams.get('key') !== capability) { send(res, 403, 'application/json', '{"error":"Fixture capability required"}'); return true; }
      if (url.pathname === '/fixture/rollout-state' && req.method === 'GET') send(res, 200, 'application/json', JSON.stringify(state()));
      else if (url.pathname === '/fixture/rollout-control' && req.method === 'POST') {
        let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 1024) throw new Error('Oversized rollout control'); }
        let value; try { value = JSON.parse(body); } catch { value = null; }
        if (!value || Object.keys(value).some(key => !['phase','networkOff'].includes(key)) ||
          (value.phase !== undefined && !['baseline','current-failed-install','current'].includes(value.phase)) ||
          (value.networkOff !== undefined && typeof value.networkOff !== 'boolean')) send(res, 400, 'application/json', '{"error":"Invalid rollout control"}');
        else { phase = value.phase ?? phase; networkOff = value.networkOff ?? networkOff; send(res, 200, 'application/json', JSON.stringify(state())); }
      } else if (url.pathname === '/fixture/rollout.js' && req.method === 'GET') send(res, 200, 'text/javascript', await readFile(new URL('./populated-rollout-diagnostics.js', import.meta.url)));
      else if (url.pathname === '/fixture/rollout' && req.method === 'GET') send(res, 200, 'text/html; charset=utf-8', `<!doctype html><meta charset="utf-8"><title>Rollout acceptance fixture</title><h1>Rollout acceptance fixture</h1><p>Isolated synthetic account. Transport outage is simulated; this is not airplane-mode evidence.</p><p><a href="/fixture/start?key=${capability}" target="_blank">Open synthetic workspace</a></p><button data-phase="baseline">Serve baseline</button><button data-phase="current-failed-install">Fail current install</button><button data-phase="current">Serve current</button><button id="offline">Network off</button><button id="online">Network on</button><button id="prepare">Prepare offline shell</button><button id="update">Check worker update</button><button id="inspect">Refresh diagnostics</button><button id="notebook">Load Notebook module and styles (no mounting)</button><p>This probe does not verify private Notebook or Report functionality.</p><script id="document-probe" type="application/json">${JSON.stringify({version:versions[phase === 'baseline' ? 'baseline' : 'current'], notebook:notebook[phase === 'baseline' ? 'baseline' : 'current']}).replaceAll('<', '\\u003c')}</script><pre id="diagnostics">Loading</pre><script type="module" src="/fixture/rollout.js?key=${capability}"></script>`);
      else send(res, 404, 'application/json', '{"error":"Unknown rollout route"}');
      return true;
    }
    // Keep fixture controls reachable during a simulated application transport outage.
    if (url.pathname.startsWith('/fixture/')) return false;
    if (networkOff && req.method === 'GET') { res.destroy(); return true; }
    const notebookAsset = notebookAssets.get(url.pathname + url.search);
    if (notebookAsset) { send(res, 200, notebookAsset.type, notebookAsset.bytes); return true; }
    let name = url.pathname === '/workspace' ? 'index.html' : url.pathname === '/service-worker.js' ? 'service-worker.js' : url.pathname.startsWith('/web/') ? url.pathname.slice(5) : '';
    if (!names.includes(name)) return false;
    const version = url.searchParams.get('v');
    const files = version === versions.baseline ? baseline : version === versions.current ? current : phase === 'baseline' ? baseline : current;
    if (phase === 'current-failed-install' && name === 'app.js' && files === current) send(res, 503, 'text/plain', 'Synthetic current app installation failure');
    else send(res, 200, name === 'index.html' ? 'text/html; charset=utf-8' : 'text/javascript', files[name]);
    return true;
  }};
}
