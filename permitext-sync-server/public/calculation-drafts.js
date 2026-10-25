// Account storage prefix is supplied by the workspace's private-storage contract.
// Saved Notes are immutable snapshots; these records are editable device drafts.
export function calculationDraftStore(storage, key) {
  const read = () => {
    const raw = storage.getItem(key);
    if (!raw) return {version: 1, records: [], active: {}};
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.records) || !data.records.every(record => record && typeof record.id === "string" && typeof record.context === "string" && typeof record.updatedAt === "string" && Number.isInteger(record.revision) && record.input && typeof record.input === "object" && !Array.isArray(record.input)) || !data.active || typeof data.active !== "object")
      throw new Error("Calculation drafts could not be read. The original device data has been preserved.");
    return data;
  };
  const write = data => storage.setItem(key, JSON.stringify(data));
  return {
    list(context) { return read().records.filter(record => record.context === context).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)); },
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
      const data = read(); delete data.active[context]; write(data);
      return this.open(context);
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
