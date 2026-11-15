// Keep the document and its scrolling columns mounted as reports change.
export function retainReportChildren(container, ...children) {
  for (const child of [...container.children]) {
    if (!children.includes(child)) child.remove();
  }
  children.forEach((child, index) => {
    if (container.children[index] !== child) container.insertBefore(child, container.children[index] || null);
  });
}

// The outgoing report remains editable while the incoming sources are prepared.
export function createReportSwitch({read, isCurrent, preserve, prepare, commit, onError}) {
  let generation = 0;
  return {
    cancel() { generation += 1; },
    async select(id) {
      const request = ++generation;
      const outgoing = read();
      const current = () => request === generation && read() === outgoing && isCurrent();
      try {
        if (!current() || !await preserve(current) || !current()) return false;
        const incoming = await prepare(id);
        if (!current() || !await preserve(current) || !current()) return false;
        commit(incoming);
        return true;
      } catch (error) {
        if (current()) onError(error);
        return false;
      }
    }
  };
}

// Cache resolved content too, so a prepared report can render in one browser turn.
export function createReportSourcePreviews({request, isCurrent}) {
  const requests = new Map(), results = new Map();
  const keyFor = (block, source) => JSON.stringify([block.kind, block.sourceID, source]);
  return {
    requests,
    get: (block, source) => results.get(keyFor(block, source)),
    load(block, source) {
      const key = keyFor(block, source);
      if (!requests.has(key)) {
        const pending = request(block).then(result => {
          if (!isCurrent()) throw new Error('The Report workspace has changed.');
          results.set(key, result);
          return result;
        });
        requests.set(key, pending);
        pending.catch(() => { if (requests.get(key) === pending) requests.delete(key); });
      }
      return requests.get(key);
    }
  };
}
