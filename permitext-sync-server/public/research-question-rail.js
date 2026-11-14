const minimum = 200, maximumWidth = 350, initial = 320, chatMinimum = 320;

export function attachResearchQuestionRail({root, divider, widthStore}) {
  let preferred = initial;
  try { const saved = Number(widthStore?.read()); if (Number.isFinite(saved) && saved > 0) preferred = Math.max(minimum, Math.min(saved, maximumWidth)); } catch {}
  let drag = null, disposed = false;
  const narrow = () => typeof matchMedia === 'function' && matchMedia('(max-width:680px)').matches;
  const maximum = () => root.clientWidth > 0 ? Math.min(maximumWidth, Math.max(minimum, root.clientWidth - chatMinimum - 1)) : maximumWidth;
  const clamp = value => Math.max(minimum, Math.min(value, maximum()));
  const apply = () => {
    if (disposed || narrow()) return;
    const width = clamp(preferred);
    root.style.setProperty('--rv2-rail-width', `${width}px`);
    divider.setAttribute('aria-valuemin', String(minimum));
    divider.setAttribute('aria-valuemax', String(Math.floor(maximum())));
    divider.setAttribute('aria-valuenow', String(Math.round(width)));
    divider.setAttribute('aria-valuetext', `Questions width ${Math.round(width)} pixels`);
  };
  const save = () => { try { widthStore?.write(preferred); } catch {} };
  const finish = (cancel = false) => {
    if (!drag) return;
    const previous = drag;
    drag = null;
    root.classList.toggle('is-question-rail-resizing', false);
    if (cancel) { preferred = previous.preferred; apply(); }
    else save();
    if (divider.hasPointerCapture?.(previous.id)) divider.releasePointerCapture(previous.id);
  };
  const down = event => {
    if (disposed || narrow() || event.isPrimary === false || event.button !== 0 || drag) return;
    event.preventDefault();
    event.stopPropagation();
    drag = {id:event.pointerId, x:event.clientX, width:clamp(preferred), preferred};
    divider.setPointerCapture(event.pointerId);
    root.classList.toggle('is-question-rail-resizing', true);
  };
  const move = event => {
    if (!drag || event.pointerId !== drag.id) return;
    preferred = clamp(drag.width + event.clientX - drag.x);
    apply();
  };
  const up = event => { if (drag?.id === event.pointerId) finish(); };
  const cancel = event => { if (drag?.id === event.pointerId) finish(true); };
  const lost = event => { if (drag?.id === event.pointerId) finish(); };
  const key = event => {
    if (disposed || narrow()) return;
    if (event.key === 'Escape' && drag) { event.preventDefault(); finish(true); return; }
    const step = event.shiftKey ? 80 : 24;
    const width = clamp(preferred);
    const next = event.key === 'ArrowLeft' ? width - step : event.key === 'ArrowRight' ? width + step
      : event.key === 'Home' ? minimum : event.key === 'End' ? maximum() : null;
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    preferred = clamp(next);
    apply();
    save();
  };
  divider.setAttribute('role', 'separator');
  divider.setAttribute('aria-label', 'Resize Questions and chat');
  divider.setAttribute('aria-orientation', 'vertical');
  divider.tabIndex = 0;
  for (const [type, handler] of Object.entries({pointerdown:down,pointermove:move,pointerup:up,pointercancel:cancel,lostpointercapture:lost,keydown:key})) divider.addEventListener(type, handler);
  const resize = new ResizeObserver(apply);
  resize.observe(root);
  apply();
  return {dispose() {
    disposed = true;
    finish(true);
    resize.disconnect();
    for (const [type, handler] of Object.entries({pointerdown:down,pointermove:move,pointerup:up,pointercancel:cancel,lostpointercapture:lost,keydown:key})) divider.removeEventListener(type, handler);
  }};
}

// One delegated controller serves the whole history, including rows added later.
// Scroll once at a steady speed, hold the end, and reset as soon as focus/hover leaves.
export function attachResearchHistoryTitleScroll({root, environment = globalThis}) {
  let hovered = null, focused = null, active = null, timer = null, animation = null, title = null;
  const reducedMotion = environment.matchMedia?.('(prefers-reduced-motion: reduce)');
  const buttonFor = target => {
    const button = target?.closest?.('.rv2-question-link');
    return button && root.contains(button) ? button : null;
  };
  const stop = () => {
    if (timer !== null) environment.clearTimeout(timer);
    timer = null;
    animation?.cancel(); animation = null;
    title?.classList.toggle('is-title-scrolling', false); title = null;
  };
  const refresh = (force = false) => {
    if (hovered && !root.contains(hovered)) hovered = null;
    if (focused && !root.contains(focused)) focused = null;
    const next = hovered || focused;
    if (!force && next === active) return;
    stop(); active = next;
    if (!active || reducedMotion?.matches) return;
    const current = active;
    timer = environment.setTimeout(() => {
      timer = null;
      if (active !== current || !root.isConnected || !root.contains(current) || reducedMotion?.matches) return;
      const clip = current.querySelector('.rv2-question-title');
      const text = current.querySelector('.rv2-question-title-text');
      const distance = (text?.getBoundingClientRect().width || 0) - (clip?.clientWidth || 0);
      if (distance <= 1 || !text?.animate) return;
      title = clip; title.classList.toggle('is-title-scrolling', true);
      animation = text.animate([{left:'0px'}, {left:`-${distance}px`}],
        {duration:distance / 30 * 1000, easing:'linear', fill:'forwards'});
    }, 700);
  };
  const handlers = {
    pointerover:event => { if (event.pointerType !== 'touch') { hovered = buttonFor(event.target); refresh(); } },
    pointerout:event => { if (event.pointerType !== 'touch') { hovered = buttonFor(event.relatedTarget); refresh(); } },
    focusin:event => { focused = buttonFor(event.target); refresh(); },
    focusout:event => { focused = buttonFor(event.relatedTarget); refresh(); }
  };
  for (const [type, handler] of Object.entries(handlers)) root.addEventListener(type, handler);
  const motionChanged = () => refresh(true);
  reducedMotion?.addEventListener?.('change', motionChanged);
  return {
    refresh:() => refresh(true),
    dispose() {
      stop(); active = hovered = focused = null;
      for (const [type, handler] of Object.entries(handlers)) root.removeEventListener(type, handler);
      reducedMotion?.removeEventListener?.('change', motionChanged);
    }
  };
}
