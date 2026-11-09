const text = value => String(value ?? '').trim();
const timestamp = record => Date.parse(record?.updatedAt || '') || 0;
const defaultKey = record => [record.codeVersion || 'nyc-2022', record.sectionID,
  record.blockID || record.anchorID || record.contentBlockID || ''].join(':');

// Presentation only: keep original records intact, including distinct notes on
// the same passage. The caller supplies its account-scoped, bulk-clear-aware summary.
export function settingsSavedContentSnapshot(summary = {}, {
  recordKey = defaultKey, projectID = record => text(record.clientID || record.id),
  belongsToProject = (link, project) => text(link.folderClientID || link.projectID) === projectID(project),
  workspace
} = {}) {
  const valid = record => record && !record.deletedAt && Number(record.sectionID) > 0;
  const projects = (summary.projects || []).filter(project => !project.deletedAt);
  const passages = new Map(), notes = new Map(), links = new Map();
  const addPassage = record => {
    const key = recordKey(record), previous = passages.get(key);
    if (!previous || timestamp(record) > timestamp(previous.item)) passages.set(key, {key, item: record});
  };
  for (const item of summary.savedItems || []) if (valid(item)) addPassage(item);
  for (const link of summary.projectSections || []) {
    if (!valid(link)) continue;
    // Do not resurrect a passage whose only membership belongs to a deleted Project.
    const project = projects.find(project => belongsToProject(link, project));
    if (!project) continue;
    const key = recordKey(link), membership = `${key}:${projectID(project)}`;
    if (!links.has(membership) || timestamp(link) > timestamp(links.get(membership).item)) {
      links.set(membership, {key, item: link, project});
    }
    if (!passages.has(key)) addPassage(link);
  }
  for (const item of summary.annotations || []) {
    if (!valid(item) || !text(item.noteBody)) continue;
    const key = `${recordKey(item)}:${text(item.noteBody).replace(/\r\n/g, '\n')}`;
    if (!notes.has(key) || timestamp(item) > timestamp(notes.get(key).item)) notes.set(key, {key, item});
  }
  const decorate = entry => ({...entry, projects: [...links.values()]
    .filter(link => link.key === recordKey(entry.item)).map(link => link.project)});
  const ordered = entries => [...entries.values()].map(decorate)
    .sort((a, b) => timestamp(b.item) - timestamp(a.item) || a.key.localeCompare(b.key));
  const inWorkspace = entry => workspace === undefined || Boolean(workspace && entry.projects.some(project => projectID(project) === projectID(workspace)));
  return {passages: ordered(passages).filter(inWorkspace), notes: ordered(notes).filter(inWorkspace),
    projectLinkCount: [...links.values()].filter(link => workspace === undefined || Boolean(workspace && projectID(link.project) === projectID(workspace))).length};
}

export function createSettingsSavedContent(root, {
  isCurrent, hydrate, codeLabel, noteText = text, projectID, projectName, availableProjects,
  onOpen, onAssign, onRefresh, workspaceScoped = false
}) {
  const document = root.ownerDocument;
  const controller = new AbortController();
  let snapshot = {passages: [], notes: []}, expanded = '', generation = 0, disposed = false;
  const cache = new Map();
  const current = () => !disposed && isCurrent();
  const node = (tag, className, value) => {
    const element = document.createElement(tag);
    element.className = className;
    if (value !== undefined) element.textContent = value;
    return element;
  };
  const button = (label, className = 'settings-library-action') => {
    const element = node('button', className, label);
    element.type = 'button';
    return element;
  };
  const entriesFor = kind => kind === 'bookmarks' ? snapshot.passages : snapshot.notes;
  const controls = [...root.querySelectorAll('[data-browse-content]')].map(trigger => {
    const kind = trigger.dataset.browseContent;
    const list = root.querySelector(`#${trigger.getAttribute('aria-controls')}`);
    trigger.addEventListener('click', () => {
      if (!current()) return;
      expanded = expanded === kind ? '' : kind;
      render();
    }, {signal: controller.signal});
    return {trigger, kind, list};
  });

  function render() {
    const renderID = ++generation;
    for (const {trigger, kind, list} of controls) {
      const open = expanded === kind;
      trigger.setAttribute('aria-expanded', String(open));
      trigger.querySelector('.settings-content-view-label').textContent = open ? 'Hide' : 'View';
      list.hidden = !open;
      if (!open) { list.replaceChildren(); continue; }
      const entries = entriesFor(kind);
      list.replaceChildren();
      if (!entries.length) {
        list.append(node('p', 'settings-library-empty', kind === 'bookmarks'
          ? `No saved passages in ${workspaceScoped ? 'this workspace' : 'your account'}` : `No section notes in ${workspaceScoped ? 'this workspace' : 'your account'}`));
        continue;
      }
      const keyFor = entry => `${kind}:${entry.key}:${entry.item.updatedAt || ''}`;
      const missing = entries.filter(entry => !cache.has(keyFor(entry)));
      if (missing.length) {
        const batch = Promise.resolve().then(() => hydrate(missing.map(entry => entry.item)));
        missing.forEach((entry, index) => cache.set(keyFor(entry), batch.then(items => items[index])));
      }
      const ordered = node('ol', 'settings-library-entries');
      list.append(ordered);
      for (const entry of entries) {
        const row = node('li', 'settings-library-row');
        const body = node('div', 'settings-library-body');
        const meta = node('p', 'settings-library-code', codeLabel(entry.item));
        const title = button(sectionTitle(entry.item), 'settings-library-open');
        title.setAttribute('aria-label', `Open ${sectionTitle(entry.item)} in Reader`);
        const preview = node('p', `settings-library-preview${kind === 'notes' ? ' is-note' : ''}`,
          kind === 'notes' ? noteText(entry.item.noteBody) : previewText(entry.item));
        const membership = node('p', 'settings-library-membership', entry.projects.length
          ? entry.projects.map(projectName).join(' · ') : 'Not linked to a Project');
        const actions = node('div', 'settings-library-actions');
        const assign = button('Add to Project');
        const feedback = node('p', 'settings-library-feedback');
        feedback.setAttribute('role', 'status');
        feedback.hidden = true;
        const picker = node('div', 'settings-library-projects');
        picker.hidden = true;
        picker.setAttribute('role', 'group');
        picker.setAttribute('aria-label', 'Choose a Project');
        let hydrated = entry.item, busy = false;
        const rowCurrent = () => current() && generation === renderID && row.isConnected;
        const setFeedback = message => { feedback.textContent = message; feedback.hidden = !message; };
        title.addEventListener('click', async () => {
          if (!rowCurrent() || busy) return;
          busy = true; title.disabled = true;
          try { await onOpen(hydrated); }
          catch (error) { if (rowCurrent()) setFeedback(error.message || 'This section could not be opened.'); }
          finally { busy = false; if (rowCurrent()) title.disabled = false; }
        });
        assign.setAttribute('aria-expanded', 'false');
        assign.addEventListener('click', () => {
          if (!rowCurrent() || busy) return;
          const open = picker.hidden;
          picker.hidden = !open;
          assign.setAttribute('aria-expanded', String(open));
          if (!open) return;
          picker.replaceChildren();
          const projects = availableProjects().filter(project => !entry.projects.some(linked => projectID(linked) === projectID(project)));
          if (!projects.length) picker.append(node('p', 'settings-library-empty', entry.projects.length
            ? 'Already linked to every available Project' : 'Create a workspace to add this passage to a Project'));
          for (const project of projects) {
            const choose = button(projectName(project), 'settings-library-project-option');
            choose.setAttribute('aria-label', `Add passage to ${projectName(project)}`);
            choose.addEventListener('click', async () => {
              if (!rowCurrent() || busy) return;
              busy = true;
              [title, assign, ...picker.querySelectorAll('button')].forEach(control => { control.disabled = true; });
              try {
                const result = await onAssign(project, hydrated);
                if (!rowCurrent()) return;
                if (!result?.saved) throw new Error('This passage could not be added.');
                onRefresh();
                root.querySelector(`[data-browse-content="${kind}"]`)?.focus({preventScroll: true});
              } catch (error) { if (rowCurrent()) setFeedback(error.message || 'This passage could not be added.'); }
              finally {
                busy = false;
                if (rowCurrent()) [title, assign, ...picker.querySelectorAll('button')].forEach(control => { control.disabled = false; });
              }
            });
            picker.append(choose);
          }
        });
        picker.addEventListener('keydown', event => {
          if (event.key !== 'Escape') return;
          event.preventDefault(); event.stopPropagation();
          picker.hidden = true; assign.setAttribute('aria-expanded', 'false'); assign.focus();
        });
        if (!workspaceScoped) actions.append(membership, assign);
        body.append(meta, title, preview, actions, picker, feedback);
        row.append(body);
        ordered.append(row);
        const cacheKey = keyFor(entry);
        cache.get(cacheKey).then(item => {
          if (!rowCurrent()) return;
          hydrated = {...entry.item, ...item};
          meta.textContent = codeLabel(hydrated);
          title.textContent = sectionTitle(hydrated);
          title.setAttribute('aria-label', `Open ${sectionTitle(hydrated)} in Reader`);
          if (kind === 'bookmarks') preview.textContent = previewText(hydrated) || 'Open this section to read the saved passage';
        }).catch(() => {
          cache.delete(cacheKey);
          if (rowCurrent() && kind === 'bookmarks' && !preview.textContent) preview.textContent = 'Preview unavailable · Open the section to read it';
        });
      }
    }
  }
  return {
    refresh(value) { if (!current()) return; if (snapshot.workspaceKey !== value.workspaceKey) expanded = ''; snapshot = value; render(); },
    dispose() { disposed = true; generation++; controller.abort(); cache.clear(); }
  };
}

export function settingsSavedContentTitle(item) {
  const number = text(item.sectionNumber || item.blockLabel), title = text(item.title);
  if (number && title.startsWith(number) && (!title.slice(number.length) || /^[\s.:—-]/.test(title.slice(number.length)))) return title;
  return [number, title].filter(Boolean).join(' ').trim() || `Section ${item.sectionID}`;
}
const sectionTitle = settingsSavedContentTitle;
function previewText(item) {
  const value = text(item.selectedText || item.savedContentComparisonText || item.previewText || item.excerpt).replace(/\s+/g, ' ');
  return value.length > 320 ? `${value.slice(0, 320).trimEnd()}…` : value;
}
