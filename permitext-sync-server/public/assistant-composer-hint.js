// Guidance appears after an explicit composer interaction, never automatic focus.
export function bindAssistantComposerHint({ form, composerBox, input, hasReader, hasPassage = () => false, openReader, openSavedEvidence, onError }) {
  const doc = form.ownerDocument;
  const hint = doc.createElement('div');
  hint.className = 'assistant-composer-hint';
  hint.hidden = true;
  const message = doc.createElement('p');
  message.id = `assistant-passage-hint-${crypto.randomUUID()}`;
  message.setAttribute('role', 'status');
  const actions = doc.createElement('div');
  actions.className = 'assistant-composer-hint-actions';
  hint.append(message, actions);
  form.append(hint);
  let controller, observer;
  const describe = visible => {
    const ids = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== message.id);
    if (visible) ids.push(message.id);
    if (ids.length) input.setAttribute('aria-describedby', ids.join(' '));
    else input.removeAttribute('aria-describedby');
  };
  const hide = () => {
    hint.hidden = true;
    describe(false);
    controller?.abort();
    controller = null;
    observer?.disconnect();
    observer = null;
  };
  const action = (label, callback) => {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'ghost-button';
    button.textContent = label;
    button.addEventListener('click', async () => {
      if (!form.isConnected || input.disabled || hasPassage()) return hide();
      hide();
      try { await callback(); }
      catch (error) { onError?.(error); }
    });
    return button;
  };
  const show = () => {
    if (!form.isConnected || input.disabled || hasPassage()) return hide();
    const readerOpen = hasReader();
    message.textContent = readerOpen
      ? 'Select text in Reader, then choose Ask Assistant.'
      : 'Choose a passage to begin.';
    actions.replaceChildren();
    if (!readerOpen) actions.append(action('Open Reader', openReader));
    actions.append(action('Saved Evidence', openSavedEvidence));
    hint.hidden = false;
    describe(true);
    if (controller) return;
    controller = new AbortController();
    const { signal } = controller;
    doc.addEventListener('pointerdown', event => {
      if (!form.contains(event.target)) hide();
    }, { capture: true, signal });
    doc.addEventListener('focusin', event => {
      if (!form.contains(event.target)) hide();
    }, { signal });
    doc.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      if (hint.contains(doc.activeElement)) input.focus({ preventScroll: true });
      hide();
    }, { capture: true, signal });
    observer = new MutationObserver(() => {
      if (!form.isConnected || input.disabled || hasPassage()) hide();
    });
    observer.observe(doc.body, { childList: true, subtree: true });
  };
  composerBox.addEventListener('click', show);
  input.addEventListener('input', show);
  return { hide, dispose() {
    hide();
    composerBox.removeEventListener('click', show);
    input.removeEventListener('input', show);
    hint.remove();
  } };
}
