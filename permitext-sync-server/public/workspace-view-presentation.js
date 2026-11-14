// Hold the last rendered workspace until the requested view has finished its
// layout and editor work. No cloned editors or cross-fade are involved.
export function createWorkspaceViewPresentation(document) {
  let generation = 0, active = null;
  const clear = () => document.documentElement.removeAttribute('data-workflow-presenting');
  return {
    cancel() {
      generation += 1;
      active?.skipTransition();
      active = null;
      clear();
    },
    async present({isCurrent, update}) {
      const request = ++generation;
      active?.skipTransition();
      active = null;
      const current = () => request === generation && isCurrent();
      if (!current()) { clear(); return false; }
      document.documentElement.setAttribute('data-workflow-presenting', 'true');
      let result = false;
      const apply = async () => {
        if (!current()) return;
        result = await update(current);
      };
      try {
        if (typeof document.startViewTransition === 'function') {
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
