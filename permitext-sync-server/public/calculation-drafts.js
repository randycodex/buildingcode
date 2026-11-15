// Account storage prefix is supplied by the workspace's private-storage contract.
// Local-first working copies; project calculations are also synced independently of Notes.
export function calculationDraftContent(record) {
  return {context: record.context, input: record.input,
    ...(record.savedNote ? {savedNote: record.savedNote, savedFingerprint: record.savedFingerprint || ''} : {})};
}
export function calculationDraftFingerprint(record) {
  const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
  return JSON.stringify(stable(calculationDraftContent(record)));
}
export const calculationHasInput = record => Boolean(record.savedNote) || record.input.factorMode === 'custom' ||
  ['spaceName', 'spaceFunction', 'area', 'factor', 'spaceLocation', 'seating', 'customReason']
    .some(key => String(record.input[key] ?? '').trim());
const projectFor = record => {try {return JSON.parse(record.context)[0];} catch {return null;}};
export function calculationDraftStore(storage, key) {
  const read = () => {
    const raw = storage.getItem(key);
    if (!raw) return {version: 1, records: [], active: {}};
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.records) || !data.records.every(record => record && typeof record.id === "string" && typeof record.context === "string" && typeof record.updatedAt === "string" && Number.isInteger(record.revision) && record.input && typeof record.input === "object" && !Array.isArray(record.input)) || !data.active || typeof data.active !== "object")
      throw new Error("Calculation drafts could not be read. The original device data has been preserved.");
    return data;
  };
  const hasInput = calculationHasInput;
  const write = data => storage.setItem(key, JSON.stringify(data));
  return {
    projectRecords(projectID) { return read().records.filter(record => projectFor(record) === projectID); },
    pending(projectID) { return this.projectRecords(projectID).filter(record => hasInput(record) && record.syncedFingerprint !== calculationDraftFingerprint(record)); },
    get(id) { return structuredClone(read().records.find(record => record.id === id) || null); },
    acknowledge(sent, remote) {
      const data = read(), prior = data.records.find(record => record.id === sent.id && record.context === sent.context);
      if (!prior) return;
      if (remote.version < (prior.serverVersion || 0)) return;
      prior.serverVersion = remote.version;
      prior.syncedFingerprint = calculationDraftFingerprint(remote);
      write(data);
    },
    merge(projectID, records) {
      const data = read(); let changed = false;
      for (const remote of records) {
        if (projectFor(remote) !== projectID || !Number.isSafeInteger(remote.version) || remote.version < 1) continue;
        const index = data.records.findIndex(record => record.id === remote.id);
        const prior = data.records[index];
        if (prior && prior.context !== remote.context) throw new Error('Calculation identity does not match its saved Project.');
        if (prior && remote.version < (prior.serverVersion || 0)) continue;
        const fingerprint = calculationDraftFingerprint(remote);
        if (prior && fingerprint === calculationDraftFingerprint(prior)) {
          prior.serverVersion = remote.version; prior.syncedFingerprint = fingerprint; changed = true; continue;
        }
        if (prior && remote.version === (prior.serverVersion || 0)) continue;
        if (prior && hasInput(prior) && prior.syncedFingerprint !== calculationDraftFingerprint(prior)) {
          // Never replace an offline/concurrent edit. Keep it as a separate calculation.
          const copy = {...prior, id: crypto.randomUUID(), serverVersion: 0, syncedFingerprint: null,
            input: {...prior.input, spaceName: `${prior.input.spaceName || 'Calculation'} (conflict copy)`}};
          data.records.push(copy);
          if (data.active[prior.context] === prior.id) data.active[prior.context] = copy.id;
        }
        const next = {...remote, serverVersion: remote.version, syncedFingerprint: fingerprint, revision: (prior?.revision || 0) + 1};
        delete next.version;
        if (index < 0) data.records.push(next); else data.records[index] = next;
        changed = true;
      }
      // A new browser opens the latest project calculation instead of an empty placeholder.
      for (const remote of records) {
        const active = data.records.find(record => record.id === data.active[remote.context]);
        if ((!active || !hasInput(active) && !active.keepBlank) && projectFor(remote) === projectID && hasInput(remote)) {
          data.active[remote.context] = remote.id; changed = true;
        }
      }
      if (changed) write(data);
      return changed;
    },
    list(context) {
      const data = read();
      const records = data.records.filter(record => record.context === context).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
      const blank = records.find(record => record.id === data.active[context] && !hasInput(record)) || records.find(record => !hasInput(record));
      return records.filter(record => hasInput(record) || record === blank);
    },
    open(context, initial = {}, chosenID = null) {
      const data = read();
      const id = chosenID || data.active[context];
      let record = data.records.find(item => item.context === context && item.id === id);
      if (!record) {
        record = {id: crypto.randomUUID(), context, input: {...initial}, revision: 0, updatedAt: new Date().toISOString()};
        data.records.push(record);
      }
      data.active[context] = record.id; write(data);
      return structuredClone(record);
    },
    create(context) {
      const data = read();
      const blank = data.records.find(record => record.context === context && !hasInput(record));
      delete data.active[context];
      write(data);
      const record = this.open(context, {}, blank?.id);
      const next = read(); next.records.find(item => item.id === record.id).keepBlank = true; write(next);
      return this.get(record.id);
    },
    update(record, input) {
      const data = read();
      const prior = data.records.find(item => item.id === record.id && item.context === record.context);
      if (!prior || prior.revision !== record.revision)
        throw new Error("This calculation changed in another view. Reopen its recent draft before editing; your saved device draft is preserved.");
      const stable = value => JSON.stringify(Object.keys(value).sort().map(key => [key, value[key]]));
      if (stable(prior.input) === stable(input)) return structuredClone(prior);
      Object.assign(prior, {input: {...input}, revision: prior.revision + 1, updatedAt: new Date().toISOString()});
      write(data); return structuredClone(prior);
    },
    markSaved(record, note, fingerprint) {
      const data = read();
      const prior = data.records.find(item => item.id === record.id && item.context === record.context);
      if (!prior) throw new Error("The calculation draft is unavailable; the saved Note remains in Notebook.");
      prior.savedNote = {id: note.id, title: note.title}; prior.savedFingerprint = fingerprint;
      write(data); return structuredClone(prior);
    }
  };
}
