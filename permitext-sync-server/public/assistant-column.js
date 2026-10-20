// Switch presentation without unmounting the question, thread or source picker.
export function mountAssistantColumn({ panel, history, body, state = {}, changed = () => {} }) {
  const doc = panel.ownerDocument;
  const header = panel.querySelector(':scope > .panel-header');
  const menu = doc.createElement('details');
  menu.className = 'assistant-history-menu';
  const summary = doc.createElement('summary');
  summary.textContent = 'Conversations';
  summary.setAttribute('aria-label', 'Conversation history');
  menu.append(summary, history);
  header.querySelector('.panel-actions').prepend(menu);
  const tabs = doc.createElement('div');
  tabs.className = 'assistant-view-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Assistant view');
  const sources = doc.createElement('section');
  sources.className = 'assistant-sources-view';
  sources.setAttribute('role', 'tabpanel');
  sources.setAttribute('aria-label', 'Conversation sources');
  body.setAttribute('role', 'tabpanel');
  const buttons = new Map();
  for (const [key, label, target] of [['conversation', 'Conversation', body], ['sources', 'Sources', sources]]) {
    const button = doc.createElement('button');
    button.type = 'button'; button.textContent = label; button.dataset.assistantView = key;
    button.id = `assistant-${key}-tab-${panel.dataset.paneId}`;
    target.id = `${button.id}-panel`;
    button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', target.id);
    target.setAttribute('aria-labelledby', button.id);
    button.addEventListener('click', () => show(key));
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 'conversation' : event.key === 'End' ? 'sources' : key === 'sources' ? 'conversation' : 'sources';
      show(next); buttons.get(next).focus();
    });
    buttons.set(key, button); tabs.append(button);
  }
  panel.append(tabs, sources);
  function show(view) {
    view = view === 'sources' ? 'sources' : 'conversation';
    state.assistantView = view;
    panel.dataset.assistantView = view;
    // Native hidden retains DOM, selection, drafts and independent scroll offsets.
    body.hidden = view !== 'conversation'; sources.hidden = view !== 'sources';
    for (const [key, button] of buttons) {
      button.setAttribute('aria-selected', String(key === view)); button.tabIndex = key === view ? 0 : -1;
    }
    menu.open = false; changed();
  }
  const updateCount = () => {
    const material = sources.querySelector('.assistant-materials');
    const count = Number(material?.dataset.count) || 0;
    buttons.get('sources').textContent = `Sources · ${count}`;
    buttons.get('sources').setAttribute('aria-label', `Sources, ${count} included`);
  };
  panel.addEventListener('assistant-material-state', updateCount);
  const outside = event => { if (!menu.contains(event.target)) menu.open = false; };
  panel.addEventListener('pointerdown', outside);
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); menu.open = false; summary.focus(); }
  });
  history.addEventListener('click', event => {
    if (event.target.closest('.research-new-chat')) menu.open = false;
  });
  show(state.assistantView || 'sources');
  return { show, setMaterials(material) { sources.replaceChildren(material); updateCount(); } };
}
