/**
 * Coordinate independent pane loads without publishing obsolete completions.
 * identity must encode every construction-affecting input: once a retained load
 * starts, its original closure continues even when descriptor metadata changes.
 * existing denotes healthy DOM, never an unfinished loading placeholder.
 */
export function createWorkspacePaneHydrator({ isContextCurrent, onReady, onError, onDiscard }) {
  const jobs = new Map();
  let nextAttempt = 0;

  const owns = (job) => jobs.get(job.id) === job && isContextCurrent(job.context);
  const cancel = (job) => {
    job.controller?.abort();
    job.status = "cancelled";
  };
  const discard = (job, pane) => onDiscard?.(job, pane);

  function start(job) {
    job.controller = new AbortController();
    job.signal = job.controller.signal;
    job.attempt = ++nextAttempt;
    job.status = "pending";
    job.promise = Promise.resolve().then(async () => {
      if (!owns(job) || job.signal.aborted) return;
      let pane;
      try {
        pane = await job.descriptor.load(job.signal);
      } catch (error) {
        if (owns(job) && !job.signal.aborted) {
          job.status = "error";
          job.error = error;
          onError?.(job, error);
        }
        return;
      }
      if (!owns(job) || job.signal.aborted) {
        discard(job, pane);
        return;
      }
      job.status = "ready";
      job.pane = pane;
      onReady?.(job, pane);
    });
    // Callers can inspect callback failures through settled(); detached loads never
    // create an unhandled rejection when a pane closes before anyone awaits it.
    job.promise.catch(() => {});
  }

  function reconcile(descriptors, context) {
    const incoming = new Map();
    for (const descriptor of descriptors) {
      if (incoming.has(descriptor.id)) throw new Error(`Duplicate pane id: ${descriptor.id}`);
      incoming.set(descriptor.id, descriptor);
    }
    for (const [id, job] of jobs) {
      const descriptor = incoming.get(id);
      const externalReplacement = descriptor?.existing && descriptor.existing !== job.pane;
      if (!descriptor || descriptor.identity !== job.identity || context.key !== job.context.key || externalReplacement) {
        jobs.delete(id);
        cancel(job);
      }
    }
    for (const descriptor of descriptors) {
      const retained = jobs.get(descriptor.id);
      if (retained) {
        retained.context = context;
        retained.descriptor = descriptor;
        retained.placeholder = descriptor.placeholder;
        continue;
      }
      const job = {
        id: descriptor.id, identity: descriptor.identity, context, descriptor,
        placeholder: descriptor.placeholder, status: "ready", attempt: 0,
      };
      jobs.set(job.id, job);
      if (descriptor.existing) {
        job.pane = descriptor.existing;
        job.promise = Promise.resolve();
      } else {
        start(job);
      }
    }
  }

  function retry(id) {
    const previous = jobs.get(id);
    if (!previous || previous.status !== "error" || !owns(previous)) return false;
    const job = { ...previous, error: undefined, pane: undefined };
    jobs.set(id, job);
    cancel(previous);
    start(job);
    return true;
  }

  function cancelAll() {
    for (const job of jobs.values()) cancel(job);
    jobs.clear();
  }

  // Snapshot the current attempts, including failures, without waiting for jobs
  // already removed from the workspace. Later reconciliations are a new batch.
  const settled = () => Promise.allSettled([...jobs.values()].map((job) => job.promise));
  return { reconcile, retry, cancelAll, settled };
}
