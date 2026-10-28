const minimum = 160, initial = 205, chatMinimum = 320;

export function attachResearchQuestionRail({root, divider, widthStore}) {
  let preferred = initial;
  try { const saved = Number(widthStore?.read()); if (Number.isFinite(saved) && saved >= minimum) preferred = saved; } catch {}
  let drag = null, disposed = false;
  const narrow = () => typeof matchMedia === 'function' && matchMedia('(max-width:680px)').matches;
  const maximum = () => root.clientWidth > 0 ? Math.max(minimum, root.clientWidth - chatMinimum - 1) : 10000;
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
