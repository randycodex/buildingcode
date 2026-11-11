import {bindFloatingWorkspacePanel} from './floating-workspace-panel.js?v=4';

// Deletion belongs to the history list; the server still reviews and fences the exact IDs.
export function createResearchHistoryManagement({request, confirm, isCurrent, project = () => null,
  beforeDelete, onDeleted, onIncludeHidden, onBusy, includeHidden = false}) {
  const node = (tag, className = '', text = '') => {
    const element = document.createElement(tag);
    element.className = className; element.textContent = text;
    return element;
  };
  const action = (label, callback, className = '') => {
    const button = node('button', className, label); button.type = 'button';
    button.addEventListener('click', callback); return button;
  };
  const element = node('div', 'assistant-history-management');
  const toolbar = node('div', 'assistant-history-management-toolbar');
  const selectionTools = node('div', 'assistant-history-selection-tools');
  const status = node('p', 'assistant-history-management-status'); status.setAttribute('role','status');
  const selected = new Set(), rows = new Map();
  let conversations = [], selecting = false, busy = false, disposed = false, menu, menuBinding, menuAnchor;
  const current = () => !disposed && isCurrent();
  const closeMenu = () => {
    menuBinding?.dispose(); menuBinding = null;
    menu?.remove(); menu = null;
    menuAnchor?.setAttribute('aria-expanded','false'); menuAnchor = null;
  };
  const showMenu = (anchor, items) => {
    if (!current() || busy) return;
    const closing = menuAnchor === anchor;
    closeMenu(); if (closing) return;
    menuAnchor = anchor;
    menu = node('div','assistant-history-menu'); menu.setAttribute('role','menu');
    for (const item of items) {
      const button = action(item.label, () => {closeMenu(); if (current()) return item.run();}, item.danger ? 'is-danger' : '');
      button.disabled = Boolean(item.disabled);
      button.setAttribute('role', item.checked === undefined ? 'menuitem' : 'menuitemcheckbox');
      if (item.checked !== undefined) button.setAttribute('aria-checked',String(item.checked));
      menu.append(button);
    }
    document.body.append(menu);
    menu.addEventListener('keydown', event => {
      const buttons = [...menu.children].filter(button => !button.disabled);
      const index = buttons.indexOf(document.activeElement);
      const next = event.key === 'ArrowDown' ? (index + 1) % buttons.length
        : event.key === 'ArrowUp' ? (index + buttons.length - 1) % buttons.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : -1;
      if (next < 0) return;
      event.preventDefault(); buttons[next]?.focus({preventScroll:true});
    });
    menuBinding = bindFloatingWorkspacePanel(menu, {anchor, dismiss:closeMenu, manageAnchor:true});
    [...menu.children].find(button => !button.disabled)?.focus({preventScroll:true});
  };
  const paint = () => {
    select.textContent = selecting ? 'Done' : 'Select';
    select.setAttribute('aria-pressed',String(selecting));
    select.setAttribute('aria-label',selecting ? 'Done selecting conversations' : 'Select conversations');
    select.disabled = busy || (!conversations.length && !selecting);
    select.hidden = !selecting;
    more.disabled = busy;
    selectionTools.hidden = !selecting;
    all.textContent = selected.size && selected.size === conversations.length ? 'Deselect all' : 'Select all shown';
    all.disabled = busy || !conversations.length;
    remove.disabled = busy || !selected.size;
    count.textContent = `${selected.size} selected`;
    element.setAttribute('aria-busy',String(busy));
    for (const [id, row] of rows) {
      row.row.classList.toggle('is-history-selecting',selecting);
      row.checkbox.hidden = !selecting; row.checkbox.checked = selected.has(id); row.checkbox.disabled = busy;
      row.menu.hidden = selecting; row.menu.disabled = busy; row.open.disabled = busy;
      if (selecting) row.open.setAttribute('aria-pressed',String(selected.has(id)));
      else row.open.removeAttribute('aria-pressed');
    }
  };
  const deleteConversations = async (input, title = '') => {
    if (busy || !current() || (input.scope === 'selected' && !input.conversationIDs.length)) return;
    const projectID = input.projectID;
    const valid = () => current() && (input.scope !== 'project' || project()?.id === projectID);
    if (!valid()) return false;
    busy = true; closeMenu(); paint(); onBusy?.(true); status.textContent = 'Checking deletion count…';
    try {
      const preview = await request('/research/conversations/delete-preview',input);
      if (!valid()) return false;
      if (!preview.count) {status.textContent = 'No conversations to delete in this scope.'; return false;}
      const label = `${preview.count} ${preview.count === 1 ? 'conversation' : 'conversations'}`;
      const place = input.scope === 'project' ? ` in “${project()?.name || 'this Project'}”`
        : input.scope === 'all' ? ' across your entire account, including hidden conversations' : ' you selected';
      const confirmed = await confirm(title ? `Permanently delete “${title}”?` : 'Permanently delete conversations?',
        `Delete ${label}${place}?\n\nThis removes their messages and drafts, research answers and evidence snapshots, feedback, and related research links and activity.\n\nSaved passages, Notes, Reports, project data, and usage/billing history are kept. Copies already saved in Notes or Reports are kept; live links to deleted research will stop opening.\n\nThis cannot be undone and does not go to Trash.`,
        {confirmLabel:`Delete ${label}`,className:'research-deletion-confirmation'});
      if (!confirmed) {if (valid()) status.textContent = ''; return false;}
      if (!valid()) return false;
      beforeDelete?.(preview.conversationIDs);
      status.textContent = 'Deleting conversations…';
      const result = await request('/research/conversations/delete-many', {...input,
        confirmationToken:preview.confirmationToken,confirmPermanentDeletion:true});
      if (!valid()) return false;
      await onDeleted(result);
      if (valid()) {selected.clear(); selecting = false; status.textContent = '';}
      return true;
    } catch (error) {
      if (valid()) status.textContent = error.message || 'The conversations could not be deleted. Try again.';
      return false;
    } finally {
      busy = false;
      if (current()) {paint(); onBusy?.(false);}
    }
  };
  const toggleSelection = () => {
    if (busy || !current() || (!selecting && !conversations.length)) return;
    selecting = !selecting; selected.clear(); closeMenu(); status.textContent = ''; paint();
    (selecting ? select : more).focus({preventScroll:true});
  };
  const select = action('Done', toggleSelection,'assistant-history-select');
  select.setAttribute('aria-label','Select conversations');
  const more = action('', () => {
    const activeProject = project();
    showMenu(more, [
      {label:selecting ? 'Done selecting conversations' : 'Select conversations',disabled:!conversations.length && !selecting,run:toggleSelection},
      {label:'Include hidden conversations',checked:includeHidden,run:async() => {
        includeHidden = !includeHidden; selected.clear(); selecting = false; paint();
        try {await onIncludeHidden?.(includeHidden);} catch(error) {if(current())status.textContent=error.message || 'History could not be loaded.';}
      }},
      ...(activeProject?.id ? [{label:`Delete all in ${activeProject.name || 'this Project'}…`,danger:true,
        run:() => deleteConversations({scope:'project',projectID:activeProject.id})}] : []),
      {label:'Delete all conversations…',danger:true,run:() => deleteConversations({scope:'all'})}
    ]);
  },'assistant-history-more');
  more.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>';
  more.setAttribute('aria-label','Conversation history options'); more.setAttribute('aria-haspopup','menu'); more.setAttribute('aria-expanded','false');
  const all = action('Select all shown', () => {
    if (busy || !current()) return;
    if (selected.size === conversations.length) selected.clear();
    else conversations.forEach(conversation => selected.add(conversation.id));
    paint();
  });
  const count = node('span','assistant-history-selected-count'); count.setAttribute('role','status');
  const remove = action('Delete selected', () => deleteConversations({scope:'selected',conversationIDs:[...selected]}),'is-danger');
  toolbar.append(select,more); selectionTools.append(all,count,remove); element.append(toolbar,selectionTools,status);
  const handleKeyDown = event => {
    if (event.key !== 'Escape' || !selecting || busy || event.defaultPrevented) return;
    event.preventDefault(); selecting = false; selected.clear(); paint(); more.focus({preventScroll:true});
  };
  paint();
  return {
    element, handleKeyDown,
    setConversations(next) {
      closeMenu(); conversations = next;
      const ids = new Set(next.map(conversation=>conversation.id));
      selected.forEach(id => {if (!ids.has(id)) selected.delete(id);});
      rows.forEach((value,id) => {if (!ids.has(id)) rows.delete(id);});
      if (!next.length) selecting = false;
      paint();
    },
    reset() {closeMenu(); selected.clear(); selecting = false; paint();},
    selectConversation(id) {
      if (!selecting) return false;
      if (busy || !current()) return true;
      selected.has(id) ? selected.delete(id) : selected.add(id); paint(); return true;
    },
    bindRow(row, open, conversation, title = conversation.title || 'Untitled conversation', {onRename} = {}) {
      row.classList.add('has-history-management');
      const checkbox = node('input','assistant-history-checkbox'); checkbox.type = 'checkbox';
      checkbox.setAttribute('aria-label',`Select ${title}`);
      checkbox.addEventListener('change', () => {
        if (busy || !current()) return;
        checkbox.checked ? selected.add(conversation.id) : selected.delete(conversation.id); paint();
      });
      const options = action('…', () => showMenu(options,[...(onRename ? [{label:'Rename conversation',run:onRename}] : []),{label:'Delete conversation…',danger:true,
        run:() => deleteConversations({scope:'selected',conversationIDs:[conversation.id]},title)}]),'assistant-history-row-menu');
      options.setAttribute('aria-label',`Options for ${title}`);
      options.setAttribute('aria-haspopup','menu'); options.setAttribute('aria-expanded','false');
      if (conversation.historyHiddenAt) open.append(node('span','assistant-history-hidden-label','Hidden from History'));
      row.prepend(checkbox); row.append(options); rows.set(conversation.id,{row,open,checkbox,menu:options}); paint();
    },
    dispose() {disposed = true; closeMenu(); rows.clear();}
  };
}
