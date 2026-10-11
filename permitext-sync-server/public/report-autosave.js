// Serializes saves while leaving the live editor objects and selection intact.
export function createReportAutosave({ read, write, retain, acknowledge, onSaved, onState = () => {}, isCurrent = () => true, delay = 650, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let revision = 0, savedRevision = 0, retainedRevision = -1;
  let pending = null, timer = null, stopped = false, failure = null, retryAttempt = null;
  let journal = Promise.resolve();
  const current = () => !stopped && isCurrent();
  const dirty = () => revision !== savedRevision;
  const publish = (state, error = null) => { if (current()) onState({state, error, recoverable:retainedRevision === revision}); };
  const persist = (snapshot, atRevision) => {
    const owner = read();
    const operation = journal.catch(() => {}).then(() => retain(snapshot));
    journal = operation;
    operation.then(() => { if (read() === owner) retainedRevision = Math.max(retainedRevision, atRevision); }, () => {});
    return operation;
  };
  const cancelTimer = () => { if (timer !== null) clearTimer(timer); timer = null; };
  const flush = ({force = false} = {}) => {
    cancelTimer();
    if (!current()) return Promise.resolve(false);
    if (pending) return pending;
    if (force && !dirty()) revision++;
    if (!dirty()) return Promise.resolve(true);
    failure = null;
    pending = (async () => {
      while (current() && dirty()) {
        const draft = read();
        const attempt = retryAttempt?.draft === draft ? retryAttempt : {draft, snapshot:structuredClone(draft), atRevision:revision};
        const {snapshot, atRevision} = attempt;
        let recovery = null;
        publish('saving');
        try {
          recovery = await persist(structuredClone(draft), revision);
        } catch { /* Cloud saving can succeed even when device storage is full. */ }
        if (!current() || read() !== draft) return false;
        try {
          const saved = await write(snapshot);
          if (!current() || read() !== draft) return false;
          retryAttempt = null;
          onSaved(saved, snapshot);
          savedRevision = atRevision;
          if (recovery && revision === atRevision) await journal.catch(() => {}).then(() => acknowledge(recovery)).catch(() => {});
          if (!current() || read() !== draft) return false;
        } catch (error) {
          if (!current() || read() !== draft) return false;
          failure = error;
          retryAttempt = attempt;
          publish('error', error);
          return false;
        }
      }
      if (!current()) return false;
      publish('saved');
      return true;
    })().finally(() => { pending = null; });
    return pending;
  };
  return {
    change() {
      if (!current()) return;
      revision++;
      const atRevision = revision;
      void persist(structuredClone(read()), atRevision).then(() => {
        if (failure) publish('error', failure);
      }, () => { if (failure) publish('error', failure); });
      cancelTimer();
      if (failure) { publish('error', failure); return; }
      publish('pending');
      timer = setTimer(() => { timer = null; void flush(); }, delay);
    },
    flush,
    suspend: cancelTimer,
    settleRecovery: () => journal.catch(() => {}),
    resume() {
      cancelTimer();
      if (current() && dirty() && !failure && !pending) {
        timer = setTimer(() => { timer = null; void flush(); }, delay);
      }
    },
    isDirty: dirty,
    isSaving: () => Boolean(pending),
    isRecoverable: () => retainedRevision === revision,
    reset() {
      cancelTimer();
      revision = savedRevision = 0; retainedRevision = -1; failure = null; retryAttempt = null;
      publish('saved');
    },
    dispose() { stopped = true; cancelTimer(); }
  };
}
