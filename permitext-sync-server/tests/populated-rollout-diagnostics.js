const key = new URL(import.meta.url).searchParams.get('key');
const endpoint = path => `${path}?key=${encodeURIComponent(key)}`;
let lastAction = 'Ready';
const documentProbe = Object.freeze(JSON.parse(document.querySelector('#document-probe').textContent));
let notebookProbe = {attempted:false};
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
    const notebookAssets = documentProbe.notebook ? await Promise.all(Object.values(documentProbe.notebook).map(async url => ({url, present:Boolean(await cache.match(url))}))) : [];
    cacheStates.push({name, notebookAssets, entries:(await cache.keys()).length, workspacePresent:Boolean(shell), assets});
  }
  document.querySelector('#diagnostics').textContent = JSON.stringify({lastAction, documentProbe, notebookProbe, server, controller: navigator.serviceWorker.controller?.scriptURL ?? null, workers, cacheStates}, null, 2);
}
async function act(fn) { try { await fn(); } catch (error) { lastAction = `Failed: ${error.message}`; } await inspect(); }
async function control(value) { const response = await fetch(endpoint('/fixture/rollout-control'), {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(value)}); if (!response.ok) throw new Error(`Control ${response.status}`); lastAction = JSON.stringify(value); }
for (const button of document.querySelectorAll('[data-phase]')) button.onclick = () => act(() => control({phase:button.dataset.phase}));
document.querySelector('#offline').onclick = () => act(() => control({networkOff:true}));
document.querySelector('#online').onclick = () => act(() => control({networkOff:false}));
document.querySelector('#prepare').onclick = () => act(async () => {
  lastAction = 'Preparing'; document.querySelector('#diagnostics').textContent = lastAction;
  const version = documentProbe.version;
  const {prepareOfflineShell} = await import(`/web/offline-storage.js?v=${version}`);
  await prepareOfflineShell(); lastAction = 'Offline shell preparation succeeded';
});
document.querySelector('#update').onclick = () => act(async () => { const registration = await navigator.serviceWorker.getRegistration('/'); if (!registration) throw new Error('No worker registered'); await registration.update(); lastAction = 'Worker update requested; refresh diagnostics after installation'; });
document.querySelector('#inspect').onclick = () => act(async () => { lastAction = 'Diagnostics refreshed'; });
document.querySelector('#notebook').onclick = () => act(async () => {
  if (!documentProbe.notebook) throw new Error('Snapshot has no Notebook module declaration');
  if (notebookProbe.attempted) throw new Error('Probe already attempted in this document; use a separate untouched tab for a first import');
  notebookProbe = {attempted:true, moduleLoaded:false, stylesLoaded:false};
  const styles = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = documentProbe.notebook.css;
    link.onload = () => {notebookProbe.stylesLoaded = true; resolve();};
    link.onerror = () => reject(new Error('Notebook stylesheet failed'));
    document.head.append(link);
  });
  const module = import(documentProbe.notebook.js).then(value => {
    notebookProbe.moduleLoaded = true;
    notebookProbe.exports = Object.keys(value);
  });
  const results = await Promise.allSettled([styles, module]);
  notebookProbe.errors = results.filter(result => result.status === 'rejected').map(result => String(result.reason));
  lastAction = notebookProbe.errors.length ? 'Notebook probe failed' : 'Notebook module and stylesheet loaded; no component mounted';
});
await inspect();
