import { codeSourceIdentity, codeSourceKey, createActiveCodeSources } from './public/active-code-sources.js';

export class ActiveCodeSearchScopeError extends Error {
  constructor(message) { super(message); this.statusCode = 400; }
}

// Absent is the legacy complete search. An explicit empty list is deliberately
// empty, never the legacy default. The installed catalog is public metadata.
export function parseActiveCodeSearchScope(searchParams, installedSources) {
  const values = searchParams.getAll('sourceScope');
  if (!values.length) return null;
  if (values.length !== 1 || values[0].length > 8192) {
    throw new ActiveCodeSearchScopeError('Invalid code source scope.');
  }
  let value;
  try { value = JSON.parse(values[0]); } catch {
    throw new ActiveCodeSearchScopeError('Invalid code source scope.');
  }
  if (!value || value.version !== 1 || !Array.isArray(value.enabledSources) || value.enabledSources.length > 128) {
    throw new ActiveCodeSearchScopeError('Unsupported code source scope.');
  }
  let sources;
  try { sources = createActiveCodeSources().enabledSources(value.enabledSources.map(codeSourceIdentity)); }
  catch { throw new ActiveCodeSearchScopeError('Invalid code source identity.'); }
  const installed = new Set(installedSources.map(codeSourceKey));
  if (sources.some(source => !installed.has(codeSourceKey(source)))) {
    throw new ActiveCodeSearchScopeError('A requested code source is not installed.');
  }
  const keys = new Set(sources.map(codeSourceKey));
  return Object.freeze({
    sources: Object.freeze(sources),
    token: JSON.stringify({ version: 1, enabledSources: sources }),
    isEnabled: source => keys.has(codeSourceKey(source)),
    get isEmpty() { return keys.size === 0; }
  });
}
