import {createActiveCodeSourcePreferences, codeSourceIdentity, codeSourceKey, ActiveCodeSourcesError} from './active-code-sources.js';

// No DOM or network policy: caller supplies storage, catalog transport and cancellation.
export function createActiveCodeSourceController({storage, loadCatalog, onInvalidate = () => {}}) {
  const preferencesStore = createActiveCodeSourcePreferences(storage);
  let accountID = null, sessionID = null, initialized = false, revision = 0;
  let preferences = null, error = null, catalog = null, catalogStatus = 'unknown', pending = null;
  const issuedTokens = new WeakSet();
  const captureContext = () => {
    const token = Object.freeze({accountID, sessionID, revision});
    issuedTokens.add(token);
    return token;
  };
  const isCurrent = token => Boolean(initialized && token && issuedTokens.has(token) && token.accountID === accountID &&
    token.sessionID === sessionID && token.revision === revision);
  function invalidate() {
    revision += 1;
    pending = null;
    if (catalogStatus === 'loading') catalogStatus = catalog ? 'ready' : 'unknown';
  }
  function notify(reason) {
    // Observers see the completed state transition, never a transient preference.
    try { onInvalidate(captureContext(), reason); } catch {}
  }
  function readPreferences() {
    try { preferences = preferencesStore.load(accountID); error = null; }
    catch (failure) { preferences = null; error = failure; }
  }
  function reload() {
    if (!initialized) throw new ActiveCodeSourcesError('Source context is unavailable');
    preferences = null;
    invalidate();
    readPreferences();
    notify('reload');
    return state();
  }
  function state() {
    return Object.freeze({accountID, sessionID, revision, preferences, error,
      catalog: catalog && Object.freeze([...catalog]), catalogStatus});
  }
  function setContext(context) {
    if (!context || (context.accountID !== null && typeof context.accountID !== 'string') ||
        typeof context.sessionID !== 'string') throw new ActiveCodeSourcesError('Invalid source context');
    if (initialized && accountID === context.accountID && sessionID === context.sessionID) return state();
    accountID = context.accountID;
    sessionID = context.sessionID;
    initialized = true;
    preferences = null; error = null; catalog = null; catalogStatus = 'unknown';
    invalidate();
    readPreferences();
    notify('context');
    return state();
  }
  function update(source, enabled, token) {
    if (!isCurrent(token)) throw new ActiveCodeSourcesError('Source context changed');
    // Validate against a known installed catalog, never manufacture an enabled source.
    const key = codeSourceKey(source);
    if (!catalog || !catalog.some(entry => codeSourceKey(entry) === key)) {
      throw new ActiveCodeSourcesError('Source catalog is unavailable or source is not installed');
    }
    try {
      const next = preferencesStore.update(accountID, source, enabled);
      preferences = next; error = null;
      invalidate();
      notify('update');
      return state();
    } catch (failure) {
      error = failure;
      invalidate();
      readPreferences();
      error = failure;
      notify('update-failed');
      throw failure;
    }
  }
  function ensureCatalog() {
    if (!initialized) return Promise.reject(new ActiveCodeSourcesError('Source context is unavailable'));
    if (catalog) return Promise.resolve(catalog);
    if (pending) return pending;
    const token = captureContext();
    catalogStatus = 'loading';
    const attempt = Promise.resolve().then(() => loadCatalog(token)).then(payload => {
      if (!isCurrent(token) || pending !== attempt) return null;
      if (!Array.isArray(payload)) throw new ActiveCodeSourcesError('Invalid source catalog');
      const seen = new Set();
      const next = payload.map(entry => {
        const source = codeSourceIdentity(entry), key = codeSourceKey(source);
        if (seen.has(key)) throw new ActiveCodeSourcesError('Duplicate source catalog identity');
        seen.add(key);
        return Object.freeze({...entry, ...source});
      });
      catalog = Object.freeze(next); catalogStatus = 'ready';
      return catalog;
    }).catch(failure => {
      if (!isCurrent(token) || pending !== attempt) return null;
      catalogStatus = 'error';
      throw failure;
    }).finally(() => { if (pending === attempt) pending = null; });
    pending = attempt;
    return attempt;
  }
  function invalidateCatalog() {
    catalog = null;
    catalogStatus = 'unknown';
    invalidate();
    notify('catalog');
    return state();
  }
  function requestScope() {
    if (!initialized || !preferences || error) throw error || new ActiveCodeSourcesError('Source preferences are unavailable');
    // Omission means exactly the existing all-enabled default, not an empty catalog.
    if (!preferences.disabledSources().length) return undefined;
    if (!catalog) throw new ActiveCodeSourcesError('Source catalog is unavailable');
    return JSON.stringify({version: 1, enabledSources: preferences.enabledSources(catalog)});
  }
  return Object.freeze({setContext, captureContext, isCurrent, reload, update, ensureCatalog, invalidateCatalog, requestScope,
    get state() { return state(); }});
}
