const key = new URL(import.meta.url).searchParams.get('key');
const endpoint = path => `${path}?key=${encodeURIComponent(key)}`;
let lastAction = 'Ready';
async function inspect() {
  const server = await (await fetch(endpoint('/fixture/rollout-state'))).json();
  const registrations = await navigator.serviceWorker.getRegistrations();
  const workers = registrations.map(reg => ({ scope: reg.scope, active: reg.active?.state, waiting: reg.waiting?.state, installing: reg.installing?.state }));
  const cacheStates = [];
  for (const name of await caches.keys()) {
    if (!name.startsWith('permitext-pro-shell-')) continue;
    const cache = await caches.open(name), shell = await cache.match('/workspace');
    const html = shell ? await shell.text() : '';
    const references = [...html.matchAll(/(?:src|href)="(\/web\/[^" ]+)"/g)].map(match => match[1]);
    const assets = await Promise.all([...new Set(references)].map(async url => ({url, present: Boolean(await cache.match(url))})));
    cacheStates.push({name, entries:(await cache.keys()).length, workspacePresent:Boolean(shell), assets});
  }
  document.querySelector('#diagnostics').textContent = JSON.stringify({lastAction, server, controller: navigator.serviceWorker.controller?.scriptURL ?? null, workers, cacheStates}, null, 2);
}
async function act(fn) { try { await fn(); } catch (error) { lastAction = `Failed: ${error.message}`; } await inspect(); }
async function control(value) { const response = await fetch(endpoint('/fixture/rollout-control'), {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(value)}); if (!response.ok) throw new Error(`Control ${response.status}`); lastAction = JSON.stringify(value); }
for (const button of document.querySelectorAll('[data-phase]')) button.onclick = () => act(() => control({phase:button.dataset.phase}));
document.querySelector('#offline').onclick = () => act(() => control({networkOff:true}));
document.querySelector('#online').onclick = () => act(() => control({networkOff:false}));
document.querySelector('#prepare').onclick = () => act(async () => {
  lastAction = 'Preparing'; document.querySelector('#diagnostics').textContent = lastAction;
  const state = await (await fetch(endpoint('/fixture/rollout-state'))).json();
  const version = state.versions[state.phase === 'baseline' ? 'baseline' : 'current'];
  const {prepareOfflineShell} = await import(`/web/offline-storage.js?v=${version}`);
  await prepareOfflineShell(); lastAction = 'Offline shell preparation succeeded';
});
document.querySelector('#update').onclick = () => act(async () => { const registration = await navigator.serviceWorker.getRegistration('/'); if (!registration) throw new Error('No worker registered'); await registration.update(); lastAction = 'Worker update requested; refresh diagnostics after installation'; });
document.querySelector('#inspect').onclick = () => act(async () => { lastAction = 'Diagnostics refreshed'; });
await inspect();
