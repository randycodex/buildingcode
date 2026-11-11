// Keep transient conversation/context writes separate from answer generation.
// New views of the same account/workspace observe an operation already in flight.
export function createResearchOperationGate() {
  const scopes = new Map();
  const entry = key => {
    if (!scopes.has(key)) scopes.set(key, {operations:new Map(), listeners:new Set()});
    return scopes.get(key);
  };
  const notify = (key, state) => {
    for (const listener of state.listeners) listener();
    if (!state.operations.size && !state.listeners.size) scopes.delete(key);
  };
  return {
    status:key => [...(scopes.get(key)?.operations.values() || [])].at(-1) || '',
    subscribe(key, listener) {
      const state = entry(key); state.listeners.add(listener);
      return () => {state.listeners.delete(listener);notify(key,state);};
    },
    begin(key, label) {
      const state = entry(key), token = {}; state.operations.set(token,label);notify(key,state);
      return () => {state.operations.delete(token);notify(key,state);};
    }
  };
}
