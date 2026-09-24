// Source preferences are independent of installed content and saved references.
export class ActiveCodeSourcesError extends Error {}
const identityFields = ['canonicalEdition', 'jurisdictionID', 'codeID', 'categoryID'];
export function codeSourceIdentity(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source) ||
      typeof source.canonicalEdition !== 'string' || !source.canonicalEdition.length ||
      !identityFields.slice(1).every(key => Number.isSafeInteger(source[key]))) {
    throw new ActiveCodeSourcesError('Invalid code source identity');
  }
  return Object.freeze(Object.fromEntries(identityFields.map(key => [key, source[key]])));
}
export function codeSourceKey(source) {
  const value = codeSourceIdentity(source);
  return JSON.stringify(identityFields.map(key => value[key]));
}
function compare(left, right) {
  for (const key of identityFields) {
    if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
  }
  return 0;
}
export function createActiveCodeSources(disabledSources = []) {
  if (!Array.isArray(disabledSources)) throw new ActiveCodeSourcesError('Invalid disabled sources');
  const disabled = new Map(disabledSources.map(source => {
    const identity = codeSourceIdentity(source);
    return [codeSourceKey(identity), identity];
  }));
  return Object.freeze({
    isEnabled(source) { return !disabled.has(codeSourceKey(source)); },
    disabledSources() { return [...disabled.values()].sort(compare); },
    withEnabled(source, enabled) {
      if (typeof enabled !== 'boolean') throw new ActiveCodeSourcesError('Enabled must be boolean');
      const next = new Map(disabled), identity = codeSourceIdentity(source), key = codeSourceKey(identity);
      if (enabled) next.delete(key); else next.set(key, identity);
      return createActiveCodeSources([...next.values()]);
    },
    enabledSources(installed) {
      if (!Array.isArray(installed)) throw new ActiveCodeSourcesError('Invalid installed sources');
      const unique = new Map(installed.map(source => [codeSourceKey(source), codeSourceIdentity(source)]));
      return [...unique.values()].filter(source => !disabled.has(codeSourceKey(source))).sort(compare);
    },
    scopeKey(installed) { return JSON.stringify(this.enabledSources(installed).map(codeSourceKey)); },
    serialize() { return JSON.stringify({version: 1, disabledSources: this.disabledSources()}); }
  });
}
export function decodeActiveCodeSources(serialized) {
  // localStorage missing is null. undefined is also an explicit absent value.
  if (serialized === null || serialized === undefined) return createActiveCodeSources();
  if (typeof serialized !== 'string') throw new ActiveCodeSourcesError('Unexpected stored preference type');
  let value;
  try { value = JSON.parse(serialized); } catch { throw new ActiveCodeSourcesError('Malformed source preference'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1 || !Array.isArray(value.disabledSources)) {
    throw new ActiveCodeSourcesError('Unsupported or malformed source preference');
  }
  return createActiveCodeSources(value.disabledSources);
}
export function createActiveCodeSourcePreferences(storage, prefix = 'permitext.active-code-sources.v1.') {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new ActiveCodeSourcesError('Storage adapter required');
  }
  const storageKey = accountID => {
    if (accountID === null || accountID === undefined) return prefix + 'guest';
    if (typeof accountID !== 'string') throw new ActiveCodeSourcesError('Invalid account identity');
    // Exact JSON strings preserve Unicode and distinguish every account from guest.
    return prefix + 'account.' + JSON.stringify(accountID);
  };
  const load = accountID => decodeActiveCodeSources(storage.getItem(storageKey(accountID)));
  return Object.freeze({
    load,
    update(accountID, source, enabled) {
      const preference = load(accountID).withEnabled(source, enabled);
      // Publish only after storage accepts the write. Never reset malformed data.
      storage.setItem(storageKey(accountID), preference.serialize());
      return preference;
    }
  });
}
