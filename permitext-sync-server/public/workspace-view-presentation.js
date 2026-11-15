// Hold the last rendered workspace until the requested view has finished its
// layout and editor work. No cloned editors or cross-fade are involved.
export function createWorkspaceViewPresentation(document) {
  let generation = 0, active = null, presenting = false, scoped = false;
  const scopes = new Set();
  const clear = () => {
    document.documentElement.removeAttribute('data-workflow-presenting');
    document.documentElement.removeAttribute('data-reader-tab-presenting');
    for (const element of scopes) element.removeAttribute('data-reader-tab-presenting');
    scopes.clear();
    presenting = scoped = false;
  };
  const markScope = scope => {
    const element = scope();
    if (!element) return;
    scopes.add(element);
    element.setAttribute('data-reader-tab-presenting', 'true');
  };
  return {
    coversWorkspace: () => presenting && !scoped,
    cancel() {
      generation += 1;
      active?.skipTransition();
      active = null;
      clear();
    },
    async present({isCurrent, update, scope = null}) {
      const request = ++generation;
      active?.skipTransition();
      active = null;
      clear();
      const current = () => request === generation && isCurrent();
      if (!current()) { clear(); return false; }
      presenting = true;
      scoped = Boolean(scope);
      document.documentElement.setAttribute('data-workflow-presenting', 'true');
      if (scope) {
        document.documentElement.setAttribute('data-reader-tab-presenting', 'true');
        markScope(scope);
      }
      let result = false;
      const apply = async () => {
        if (!current()) return;
        result = await update(current);
        if (scope && current()) markScope(scope);
      };
      try {
        if (scope) {
          // A ready column commits in one turn. Native snapshots materialize
          // virtual Reader sections and can change their reserved heights.
          await apply();
        } else if (typeof document.startViewTransition === 'function') {
          const transition = document.startViewTransition(apply);
          active = transition;
          // Skipping a superseded transition rejects ready, while its update
          // callback still runs and must honor the request ownership check.
          void transition.ready.catch(() => {});
          void transition.finished.catch(() => {});
          await transition.updateCallbackDone;
          await transition.finished;
        } else {
          await apply();
        }
        return current() ? result : false;
      } catch (error) {
        if (!current()) return false;
        throw error;
      } finally {
        if (request === generation) { active = null; clear(); }
      }
    }
  };
}
