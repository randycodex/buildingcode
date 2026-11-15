const expandedWidth = 300, collapsedWidth = 35;

export function attachResearchQuestionRail({root, divider, toggle, collapsedStore, onCollapse}) {
  let collapsed = false, disposed = false;
  try { collapsed = collapsedStore?.read() === true; } catch {}
  const narrow = () => typeof matchMedia === 'function' && matchMedia('(max-width:680px)').matches;
  const apply = () => {
    if (disposed) return;
    root.classList.toggle('is-history-collapsed', collapsed);
    if (toggle) {
      const label = collapsed ? 'Show conversations list' : 'Hide conversations list';
      toggle.setAttribute('aria-label', label);
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.title = label;
    }
    onCollapse?.(collapsed);
    if (!narrow()) root.style.setProperty('--rv2-rail-width', `${collapsed ? collapsedWidth : expandedWidth}px`);
  };
  // The boundary still occupies its layout slot, but the list has a fixed
  // expanded width. Its dedicated toggle keeps the saved collapse behavior.
  divider.tabIndex = -1;
  divider.setAttribute('aria-hidden', 'true');
  const toggleHistory = () => {
    if (disposed || narrow()) return;
    collapsed = !collapsed;
    apply();
    try { collapsedStore?.write(collapsed); } catch {}
    toggle?.focus({preventScroll:true});
  };
  toggle?.addEventListener('click', toggleHistory);
  const resize = new ResizeObserver(apply);
  resize.observe(root);
  apply();
  return {dispose() {
    disposed = true;
    resize.disconnect();
    toggle?.removeEventListener('click', toggleHistory);
  }};
}

// One delegated controller serves a title list, including rows added later.
// Scroll once at a steady speed, hold the end, and reset as soon as focus/hover leaves.
export function attachResearchHistoryTitleScroll({root, environment = globalThis,
  buttonSelector = '.rv2-question-link', titleSelector = '.rv2-question-title', textSelector = '.rv2-question-title-text'}) {
  let hovered = null, focused = null, active = null, timer = null, animation = null, title = null;
  let observedTitle = null, observedWidth = 0;
  const resize = typeof environment.ResizeObserver === 'function' ? new environment.ResizeObserver(() => {
    if (observedTitle && observedTitle.clientWidth !== observedWidth) refresh(true);
  }) : null;
  const reducedMotion = environment.matchMedia?.('(prefers-reduced-motion: reduce)');
  const buttonFor = target => {
    const button = target?.closest?.(buttonSelector);
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
    const clip = active?.querySelector(titleSelector) || null;
    observedWidth = clip?.clientWidth || 0;
    if (clip !== observedTitle) {
      resize?.disconnect(); observedTitle = clip;
      if (clip) resize?.observe(clip);
    }
    if (!active || reducedMotion?.matches) return;
    const current = active;
    timer = environment.setTimeout(() => {
      timer = null;
      if (active !== current || !root.isConnected || !root.contains(current) || reducedMotion?.matches) return;
      const clip = current.querySelector(titleSelector);
      const text = current.querySelector(textSelector);
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
      resize?.disconnect(); observedTitle = null;
      for (const [type, handler] of Object.entries(handlers)) root.removeEventListener(type, handler);
      reducedMotion?.removeEventListener?.('change', motionChanged);
    }
  };
}
