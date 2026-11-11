// Keep repeated clicks/autosaves from consuming another request during a
// server-specified cooldown. Never replay a private mutation automatically.
export function createRequestRateLimit({now = Date.now} = {}) {
  const deadlines = new Map();
  const message = seconds => {
    const count = seconds < 60 ? seconds : Math.ceil(seconds / 60), unit = seconds < 60 ? 'second' : 'minute';
    return `Too many requests. Try again in ${count} ${unit}${count === 1 ? '' : 's'}.`;
  };
  const errorAt = deadline => {
    const seconds = Math.max(1, Math.ceil((deadline - now()) / 1000));
    return Object.assign(new Error(message(seconds)), {status:429, retryAfterSeconds:seconds});
  };
  return {
    check(key) {
      const deadline = deadlines.get(key);
      if (deadline > now()) throw errorAt(deadline);
      deadlines.delete(key);
    },
    rejected(key, retryAfter) {
      const seconds = Number(retryAfter);
      const date = Date.parse(retryAfter);
      const deadline = Number.isFinite(seconds) && seconds > 0 ? now() + seconds * 1000
        : Number.isFinite(date) && date > now() ? date : now() + 60_000;
      for (const [scope, expires] of deadlines) if (expires <= now()) deadlines.delete(scope);
      deadlines.set(key, deadline);
      return errorAt(deadline);
    }
  };
}
