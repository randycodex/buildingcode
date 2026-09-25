/** A caller-classified, context-bound gate for private workspace presentation. */
export function createWorkspaceAccessGate({ isCurrent, verify }) {
  const listeners = new Set();
  let disposed = false;
  const current = () => !disposed && isCurrent();
  const notify = (listener) => {
    if (!current()) return;
    try {
      // Observers do not own verification settlement, including async observers.
      Promise.resolve(listener(gate)).catch(() => {});
    } catch {
      // A presentation observer must not reject ready or interrupt its peers.
    }
  };
  const gate = {
    phase: "pending",
    error: undefined,
    get allowed() {
      return current() && (gate.phase === "verified" || gate.phase === "permitted-offline");
    },
    subscribe(listener) {
      if (!current()) return () => {};
      if (gate.phase !== "pending") {
        notify(listener);
        return () => {};
      }
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      gate.phase = "unavailable";
      listeners.clear();
    },
  };
  gate.ready = Promise.resolve().then(async () => {
    if (!current()) {
      gate.phase = "unavailable";
      listeners.clear();
      return gate;
    }
    let phase;
    try {
      phase = await verify();
    } catch (error) {
      if (!disposed) gate.error = error;
      phase = "unavailable";
    }
    if (!current()) {
      gate.phase = "unavailable";
      listeners.clear();
      return gate;
    }
    gate.phase = phase === "verified" || phase === "permitted-offline" ? phase : "unavailable";
    const pending = [...listeners];
    listeners.clear();
    for (const listener of pending) notify(listener);
    return gate;
  });
  return gate;
}
