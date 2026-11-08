const recoverySections = {
  projects: '.settings-project-management',
  savedContent: '.settings-delete-content',
  trash: '.settings-trash'
};

const browserStorage = {
  getItem: key => globalThis.localStorage.getItem(key),
  setItem: (key, value) => globalThis.localStorage.setItem(key, value)
};

// Account-wide presentation preferences, kept on this browser rather than synced content.
export function bindSettingsDisclosureState(root, { accountID, storage = browserStorage, lifecycle = globalThis.window } = {}) {
  if (!accountID) return { restore() {}, dispose() {} };
  const key = `permitext:settingsDisclosures:v1:${accountID}`;
  const sections = Object.entries(recoverySections).map(([id, selector]) => [id, root.querySelector(selector)]).filter(([, node]) => node);
  const controller = new AbortController();
  let disposed = false;
  const restore = () => {
    if (disposed) return;
    try {
      const saved = JSON.parse(storage.getItem(key) || '{}');
      for (const [id, node] of sections) {
        if (typeof saved?.[id] === 'boolean' && node.open !== saved[id]) node.open = saved[id];
      }
    } catch { /* Storage restrictions or invalid old preferences must not block Settings. */ }
  };
  const save = () => {
    if (disposed) return;
    try { storage.setItem(key, JSON.stringify(Object.fromEntries(sections.map(([id, node]) => [id, node.open])))); }
    catch { /* Settings remains usable when local preferences cannot be saved. */ }
  };
  restore();
  for (const [, node] of sections) node.addEventListener('toggle', save, { signal: controller.signal });
  lifecycle?.addEventListener('pagehide', save, { signal: controller.signal });
  return {
    restore,
    dispose() {
      if (disposed) return;
      // A close or refresh can happen before the browser dispatches a queued toggle.
      save();
      disposed = true;
      controller.abort();
    }
  };
}
