import {codeSourceIdentity, codeSourceKey} from './active-code-sources.js';

export class ActiveCodeSourceNavigationError extends Error {
  constructor(code, message) { super(message); this.name = 'ActiveCodeSourceNavigationError'; this.code = code; }
}

// Caller owns an immutable exact target snapshot and its workspace-current check.
// `source` may bypass resolution only when obtained from trusted source metadata.
// resolveTarget must return one exact {target, source}, rejecting absent/ambiguous matches.
// This helper never loads a passage body or mutates a Reader.
export function createActiveCodeSourceNavigationGuard({controller, resolveTarget, confirmEnable}) {
  return async function guard({target, source, signal, isCurrent = () => true}) {
    const context = controller.captureContext();
    const check = (token = context) => {
      if (signal?.aborted) {
        const error = new Error('Navigation cancelled'); error.name = 'AbortError'; throw error;
      }
      if (!controller.isCurrent(token) || !isCurrent()) {
        throw new ActiveCodeSourceNavigationError('STALE_CONTEXT', 'Navigation context changed');
      }
      if (!controller.state.preferences || controller.state.error) {
        throw new ActiveCodeSourceNavigationError('PREFERENCES_UNAVAILABLE', 'Source preferences are unavailable');
      }
    };
    check();
    let resolved = {target, source};
    if (!source) {
      if (typeof resolveTarget !== 'function') throw new ActiveCodeSourceNavigationError('SOURCE_UNAVAILABLE', 'Exact source metadata is unavailable');
      resolved = await resolveTarget(target, {signal});
      check();
    }
    if (!resolved || !resolved.source || resolved.target === undefined || resolved.target === null) {
      throw new ActiveCodeSourceNavigationError('SOURCE_UNAVAILABLE', 'Exact source metadata is unavailable');
    }
    const identity = codeSourceIdentity(resolved.source);
    const catalog = await controller.ensureCatalog();
    check();
    const entry = catalog?.find(candidate => codeSourceKey(candidate) === codeSourceKey(identity));
    if (!entry) throw new ActiveCodeSourceNavigationError('SOURCE_UNAVAILABLE', 'The exact source is not installed');
    if (controller.state.preferences.isEnabled(identity)) {
      return Object.freeze({target: resolved.target, source: identity, context});
    }
    if (typeof confirmEnable !== 'function') throw new ActiveCodeSourceNavigationError('ENABLE_REQUIRED', 'Explicit source enablement is required');
    const accepted = await confirmEnable({target: resolved.target, source: identity, catalogEntry: entry, signal});
    check();
    if (accepted !== true) return null;
    controller.update(identity, true, context);
    const enabledContext = controller.captureContext();
    check(enabledContext);
    if (!controller.state.preferences.isEnabled(identity)) {
      throw new ActiveCodeSourceNavigationError('ENABLE_FAILED', 'Source could not be enabled');
    }
    return Object.freeze({target: resolved.target, source: identity, context: enabledContext});
  };
}
