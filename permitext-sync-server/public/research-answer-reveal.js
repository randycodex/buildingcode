// Present the completed, checked answer. This never displays a provider draft.
export function revealResearchAnswer({entry, tokens, isCurrent = () => true, onDone = () => {}, environment = globalThis}) {
  const motion = environment.matchMedia?.('(prefers-reduced-motion: reduce)');
  const doc = environment.document;
  let frame = 0, timer = 0, disposed = false, complete = false;
  const clear = () => {
    environment.cancelAnimationFrame?.(frame);
    environment.clearTimeout(timer);
    doc?.removeEventListener?.('visibilitychange', changedVisibility);
    motion?.removeEventListener?.('change', changedMotion);
    entry.classList.remove('is-answer-revealing');
    entry.inert = false;
    entry.setAttribute('aria-busy', 'false');
  };
  const finish = () => {
    if (complete || disposed) return;
    complete = true;
    clear();
    if (isCurrent()) onDone();
  };
  function changedVisibility() { if (doc.visibilityState === 'hidden') finish(); }
  function changedMotion(event) { if (event.matches) finish(); }
  if (!tokens.length || motion?.matches || doc?.visibilityState === 'hidden') {
    finish();
  } else {
    // A long answer must not make the user wait word-count × a fixed delay.
    const step = Math.min(24, 1200 / Math.max(1, tokens.length - 1));
    tokens.forEach((token, index) => token.style.setProperty('--rv2-reveal-delay', `${Math.round(index * step)}ms`));
    entry.classList.add('is-answer-revealing');
    entry.inert = true;
    entry.setAttribute('aria-busy', 'true');
    doc?.addEventListener?.('visibilitychange', changedVisibility);
    motion?.addEventListener?.('change', changedMotion);
    frame = environment.requestAnimationFrame(() => {
      if (!isCurrent()) { clear(); return; }
      timer = environment.setTimeout(finish, Math.round((tokens.length - 1) * step) + 200);
    });
  }
  return {dispose() { disposed = true; clear(); }};
}
