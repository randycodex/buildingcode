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
    status:key => [...(scopes.get(key)?.operations.values() || [])].at(-1)?.label || '',
    blocksInput:key => [...(scopes.get(key)?.operations.values() || [])].some(operation => operation.blocksInput),
    subscribe(key, listener) {
      const state = entry(key); state.listeners.add(listener);
      return () => {state.listeners.delete(listener);notify(key,state);};
    },
    begin(key, label, {blocksInput = false} = {}) {
      const state = entry(key), token = {}; state.operations.set(token,{label,blocksInput});notify(key,state);
      return () => {state.operations.delete(token);notify(key,state);};
    }
  };
}
