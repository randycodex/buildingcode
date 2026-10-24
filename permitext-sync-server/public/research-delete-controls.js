// Settings-only, on-demand deletion. No recurring background history checks.
export function mountResearchDeleteControls(root, {request, confirm, isCurrent, project, currentProjectID, beforeDelete, onDeleted}) {
  let generation = 0, busy = false, loading = false, cursor = null;
  const selected = new Set();
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const help = node('p', 'settings-card-copy', 'Permanently delete your conversations, including conversations hidden from History.');
  const scope = node('select');
  scope.setAttribute('aria-label', 'Conversations to delete');
  for (const [value, label] of [['selected','Selected conversations'], ['project',`This project${project?.name ? ': '+project.name : ''}`], ['all','All projects and unassigned']]) {
    const option = node('option', '', label); option.value = value;
    option.disabled = value === 'project' && !project?.id;
    scope.append(option);
  }
  const chooser = node('div', 'settings-conversation-chooser');
  const search = node('input'); search.type = 'search'; search.placeholder = 'Find conversations';
  search.setAttribute('aria-label','Find conversations');
  const list = node('div', 'settings-conversation-list'); list.setAttribute('role','group'); list.setAttribute('aria-label','Conversations');
  const more = node('button', 'settings-link-button', 'Load more'); more.type = 'button'; more.hidden = true;
  const selectionCount = node('p', 'settings-card-copy', '0 selected');
  const tools = node('div', 'settings-conversation-selection-tools');
  const refresh = node('button','settings-link-button','Refresh list'); refresh.type='button';
  const clear = node('button','settings-link-button','Clear selection'); clear.type='button';
  tools.append(refresh, clear);
  chooser.append(search, tools, list, more, selectionCount);
  const review = node('button','settings-secondary-button settings-destructive-secondary','Review deletion'); review.type = 'button';
  const status = node('p','settings-conversation-delete-status'); status.setAttribute('role','status');
  root.replaceChildren(help, scope, chooser, review, status);
  const validScope = () => scope.value !== 'project' || project?.id === currentProjectID();
  const paint = () => {
    chooser.hidden = scope.value !== 'selected';
    selectionCount.textContent = `${selected.size} selected`;
    review.disabled = busy || (scope.value === 'selected' && !selected.size) || !validScope();
    scope.disabled = busy; search.disabled = busy; more.disabled = busy || loading;
    refresh.disabled = busy || loading; clear.disabled = busy || !selected.size;
    for (const box of list.querySelectorAll('input')) box.disabled = busy;
    review.setAttribute('aria-busy',String(busy));
  };
  const load = async (append = false) => {
    const token = ++generation;
    if (!isCurrent() || scope.value !== 'selected') return;
    loading=true; paint();
    status.textContent = 'Loading conversations…';
    try {
      const result = await request('/research/conversations/list', {limit:30, includeHidden:true, q:search.value.trim(), ...(append && cursor ? {cursor} : {})});
      if (token !== generation || !isCurrent() || scope.value !== 'selected') return;
      if (!append) list.replaceChildren();
      for (const conversation of result.conversations) {
        const row = node('label','settings-conversation-choice');
        const box = node('input'); box.type = 'checkbox'; box.value = conversation.id; box.checked = selected.has(conversation.id);
        const title = node('span','',conversation.title || 'Untitled conversation');
        if (conversation.historyHiddenAt) title.append(node('small','',' · Hidden from History'));
        box.addEventListener('change', () => {box.checked ? selected.add(conversation.id) : selected.delete(conversation.id); paint();});
        row.append(box,title); list.append(row);
      }
      cursor = result.nextCursor; more.hidden = !cursor;
      status.textContent = result.conversations.length || append ? '' : 'No conversations found.';
      paint();
    } catch (error) {if (token === generation && isCurrent()) status.textContent = error.message;}
    finally {if (token === generation) {loading=false; if (isCurrent()) paint();}}
  };
  let searchTimer;
  search.addEventListener('input', () => {
    ++generation; clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {if (root.isConnected) void load();},250);
  });
  more.addEventListener('click', () => void load(true));
  refresh.addEventListener('click', () => void load());
  clear.addEventListener('click', () => {selected.clear();for(const box of list.querySelectorAll('input'))box.checked=false;paint();});
  scope.addEventListener('change', () => {++generation; status.textContent=''; paint(); if (scope.value === 'selected') void load();});
  review.addEventListener('click', async () => {
    if (busy || !isCurrent() || !validScope()) return;
    busy = true; paint(); status.textContent='Checking deletion count…';
    const input = {scope:scope.value, ...(scope.value === 'selected' ? {conversationIDs:[...selected]} : {}), ...(scope.value === 'project' ? {projectID:project.id} : {})};
    try {
      const preview = await request('/research/conversations/delete-preview',input);
      if (!isCurrent() || !validScope()) return;
      if (!preview.count) {status.textContent='No conversations to delete in this scope.'; return;}
      const countLabel = `${preview.count} ${preview.count === 1 ? 'conversation' : 'conversations'}`;
      const place = input.scope === 'project' ? ` in “${project.name}”` : input.scope === 'all' ? ' across all projects and unassigned history' : ' you selected';
      const confirmed = await confirm('Permanently delete conversations?',
        `Delete ${countLabel}${place}?\n\nThis removes their messages and drafts, research answers and evidence snapshots, feedback, and related research links and activity.\n\nSaved passages, Notes, Reports, project data, and usage/billing history are kept. Copies already saved in Notes or Reports are kept; live links to deleted research will stop opening.\n\nThis cannot be undone and does not go to Trash.`,
        {confirmLabel:`Delete ${countLabel}`, className:'research-deletion-confirmation'});
      if (!confirmed) {status.textContent='Deletion canceled.'; return;}
      if (!isCurrent() || !validScope()) {status.textContent='The account or project changed. Review again before deleting.'; return;}
      beforeDelete?.(preview.conversationIDs);
      status.textContent='Deleting conversations…';
      const result = await request('/research/conversations/delete-many', {...input, confirmationToken:preview.confirmationToken, confirmPermanentDeletion:true});
      if (!isCurrent()) return;
      await onDeleted(result);
      if (!isCurrent()) return;
      selected.clear();
      if (scope.value === 'selected') await load();
      status.textContent=`Permanently deleted ${result.deletedCount} ${result.deletedCount === 1 ? 'conversation' : 'conversations'}.`;
    } catch (error) {if (isCurrent()) status.textContent=error.message || 'Could not confirm deletion. Refresh the list before trying again.';}
    finally {busy=false; if (isCurrent()) paint();}
  });
  paint(); void load();
}
