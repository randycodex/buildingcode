// Event-driven only: walking away never schedules work or a network request.
export const returnSyncIdleMs = 5 * 60_000;
export const returnSyncCooldownMs = 60_000;

export function bindReturnSyncChecks({window, document, check, context, eligible,
  now = Date.now, idleMs = returnSyncIdleMs, cooldownMs = returnSyncCooldownMs}) {
  let lastActivity = now(), awayAt = null, lastCheck = -Infinity, flight = null, pendingReturn = false;
  let currentContext = context();
  function activity() {
    const time = now(), nextContext = context();
    if (nextContext !== currentContext) {
      currentContext = nextContext;
      lastActivity = time;
      awayAt = null;
      lastCheck = -Infinity;
      pendingReturn = false;
      return;
    }
    if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
    const idleFor = time - Math.min(lastActivity, awayAt ?? time);
    pendingReturn ||= idleFor >= idleMs;
    lastActivity = time;
    awayAt = null;
    if (!pendingReturn || time - lastCheck < cooldownMs || flight || !eligible()) return;
    pendingReturn = false;
    lastCheck = time;
    const request = Promise.resolve().then(check).catch(() => false)
      .finally(() => { if (flight === request) flight = null; });
    flight = request;
  }
  function away() { awayAt ??= now(); }
  function visibility() { if (document.visibilityState === 'visible') activity(); else away(); }
  const bindings = [
    [window, 'focus', activity], [window, 'blur', away],
    [window, 'pageshow', activity], [window, 'pagehide', away], [window, 'online', activity],
    [document, 'visibilitychange', visibility],
    ...['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'].map(type => [document, type, activity])
  ];
  for (const [target, type, listener] of bindings) target.addEventListener(type, listener, {capture:true, passive:true});
  return () => { for (const [target, type, listener] of bindings) target.removeEventListener(type, listener, {capture:true}); };
}

// Keep a loaded revision and the exact revisions acknowledged by this browser.
// A local save at revision 8 cannot hide an unseen remote revision 7.
export function observeReturnRevision(previous, revision, {write = false} = {}) {
  revision = Number(revision || 0);
  if (!Number.isSafeInteger(revision) || revision < 0) return previous;
  if (!previous) return {loaded:write ? Math.max(0, revision - 1) : revision, own:write ? [revision] : []};
  return write && revision > previous.loaded
    ? {...previous, own:[...new Set([...previous.own, revision])].sort((a,b) => a-b)} : previous;
}

export function returnRevisionIsNewer(previous, revision) {
  if (!previous) return Number(revision || 0) > 0;
  let known = previous.loaded;
  for (const own of previous.own) { if (own === known + 1) known = own; else if (own > known + 1) break; }
  return Number(revision || 0) > known;
}

export function acknowledgeReturnRevision(previous, revision) {
  const loaded = Math.max(Number(previous?.loaded || 0), Number(revision || 0));
  return {loaded, own:(previous?.own || []).filter(value => value > loaded)};
}

export function hasNewReturnContent(changes, known = new Map()) {
  return Boolean(changes?.truncated || changes?.records?.some(record =>
    Date.parse(known.get(record.recordID) || '') !== Date.parse(record.updatedAt || '')));
}
