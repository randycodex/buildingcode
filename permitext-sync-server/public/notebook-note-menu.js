export function createNotebookNoteMenu({ onSelect, onTitleChange, keepMenuVisible = false, selectCurrent = false }) {
  const element = document.createElement('div');
  element.className = 'notebook-title-control';
  const title = document.createElement('button');
  title.type = 'button';
  title.className = 'notebook-title-text';
  title.hidden = true;
  title.setAttribute('aria-label', 'Edit Note title');
  const titleEditor = document.createElement('input');
  titleEditor.className = 'notebook-title-editor notebook-card-list-title-editor';
  titleEditor.type = 'text';
  titleEditor.maxLength = 300;
  titleEditor.placeholder = 'Note title';
  titleEditor.setAttribute('aria-label', 'Edit Note title');
  titleEditor.hidden = true;
  const titleAction = document.createElement('div');
  titleAction.className = 'notebook-title-action';
  const menu = document.createElement('details');
  menu.className = 'notebook-card-menu notebook-note-menu';
  const toggle = document.createElement('summary');
  toggle.className = 'notebook-note-menu-toggle';
  toggle.setAttribute('aria-label', 'Choose note');
  const label = document.createElement('span');
  label.textContent = 'Notes';
  toggle.append(label);
  const popup = document.createElement('div');
  popup.className = 'workspace-menu notebook-note-menu-items';
  popup.setAttribute('role', 'group');
  popup.setAttribute('aria-label', 'Available notes');
  const list = document.createElement('div');
  list.className = 'notebook-card-list';
  const footer = document.createElement('div');
  footer.className = 'notebook-note-menu-footer';
  const createButton = document.createElement('button');
  createButton.type = 'button';
  createButton.className = 'notebook-card-add-action workspace-menu-option';
  createButton.textContent = '+ New note';
  createButton.setAttribute('aria-label', 'New Note');
  const management = document.createElement('div');
  management.className = 'notebook-card-rail-actions';
  footer.append(createButton, management);
  popup.append(list, footer);
  menu.append(toggle, popup);
  element.append(title, titleEditor, titleAction, menu);
  let state = { activeCard: null, readOnly: false, selectingCards: false };
  const finishTitleEditing = () => {
    title.textContent = state.activeCard?.title || 'Untitled';
    titleEditor.hidden = true;
    title.hidden = !state.activeCard;
  };
  const editTitle = () => {
    if (!state.activeCard || state.readOnly) return;
    titleEditor.value = state.activeCard.title || '';
    title.hidden = true;
    titleEditor.hidden = false;
    titleEditor.focus({ preventScroll: true });
    titleEditor.select();
  };
  title.addEventListener('click', editTitle);
  titleEditor.addEventListener('input', () => {
    if (!state.activeCard || state.readOnly) return;
    onTitleChange(titleEditor.value);
    title.textContent = titleEditor.value || 'Untitled';
    const currentTitle = list.querySelector('[aria-current="true"] > span');
    if (currentTitle) currentTitle.textContent = title.textContent;
  });
  titleEditor.addEventListener('blur', finishTitleEditing);
  titleEditor.addEventListener('keydown', event => {
    if (!['Enter', 'Escape'].includes(event.key)) return;
    event.preventDefault();
    finishTitleEditing();
    title.focus({ preventScroll: true });
  });
  createButton.addEventListener('click', () => { menu.open = false; });
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open && !state.selectingCards) {
      event.preventDefault();
      event.stopPropagation();
      menu.open = false;
      toggle.focus({ preventScroll: true });
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    if (event.target === toggle && !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    menu.open = true;
    const options = [...popup.querySelectorAll('button')].filter(button => !button.disabled && !button.hidden);
    const current = options.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 :
      current < 0 ? event.key === 'ArrowUp' ? options.length - 1 : 0 :
      (current + (event.key === 'ArrowUp' ? -1 : 1) + options.length) % options.length;
    options[next]?.focus({ preventScroll: true });
  });
  menu.addEventListener('focusout', event => {
    if (event.relatedTarget && !menu.contains(event.relatedTarget)) menu.open = false;
  });
  const render = ({ cards, activeCard, showingArchivedCards = false, selectingCards = false,
    selectedCardIDs = new Set(), readOnly = false }) => {
    const previousCard = state.activeCard;
    const keepTitleEditing = !titleEditor.hidden && activeCard && (previousCard === activeCard ||
      previousCard?.id === activeCard.id || previousCard && !previousCard.id && activeCard.id);
    state = { cards, activeCard, showingArchivedCards, selectedCardIDs, readOnly, selectingCards };
    const hasNotes = cards.length > 0 || Boolean(activeCard);
    element.hidden = !hasNotes;
    menu.hidden = !hasNotes && !keepMenuVisible;
    if (!hasNotes && !keepMenuVisible) menu.open = false;
    title.textContent = activeCard?.title || 'Untitled';
    title.disabled = titleEditor.disabled = readOnly;
    titleEditor.dataset.cardId = activeCard?.id || '';
    if (!keepTitleEditing) {
      titleEditor.value = activeCard?.title || '';
      titleEditor.hidden = true;
      title.hidden = !activeCard;
    }
    label.textContent = showingArchivedCards ? 'Archive' : 'Notes';
    toggle.setAttribute('aria-label', showingArchivedCards ? 'Choose archived note' : 'Choose note');
    createButton.disabled = readOnly;
    list.replaceChildren();
    const visibleCards = cards.filter(card => Boolean(card.archivedAt) === showingArchivedCards &&
      !(activeCard && !activeCard.id && !card.id));
    if (!showingArchivedCards && activeCard && !activeCard.id) visibleCards.unshift(activeCard);
    if (showingArchivedCards && !visibleCards.length) {
      const empty = document.createElement('p');
      empty.className = 'notebook-card-list-empty';
      empty.textContent = 'No archived notes.';
      list.append(empty);
    }
    for (const card of visibleCards) {
      const current = !showingArchivedCards && !selectingCards && (activeCard === card ||
        Boolean(card.id) && activeCard?.id === card.id);
      const row = document.createElement('article');
      row.className = 'notebook-card-row';
      row.dataset.cardId = card.id || '';
      row.classList.toggle('is-selected', selectedCardIDs.has(card.id));
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.className = 'notebook-card-tile workspace-menu-option';
      choice.setAttribute('aria-label', `${selectingCards ? 'Select' : 'Open'} note: ${card.title || 'Untitled'}`);
      if (current) choice.setAttribute('aria-current', 'true');
      if (selectingCards) choice.setAttribute('aria-pressed', String(selectedCardIDs.has(card.id)));
      const name = document.createElement('span');
      name.textContent = (current ? activeCard.title : card.title) || 'Untitled';
      choice.append(name);
      choice.addEventListener('click', () => {
        if (!state.selectingCards) {
          menu.open = false;
          toggle.focus({ preventScroll: true });
          if (current && !selectCurrent) return;
        }
        onSelect(card);
      });
      row.append(choice);
      list.append(row);
    }
  };
  return { element, menu, toggle, label, list, footer, management, createButton, titleEditor, titleAction, editTitle, render };
}

// The toolbar owns the project-wide list; the Note editors remain mounted.
export function createNotebookToolbarMenu({ onOpen, onCreate, onArchive, onTrash, icons, getActiveCardID, readOnly = false }) {
  let cards = [], archived = false, selecting = false, busy = false;
  const selected = new Set();
  const notes = createNotebookNoteMenu({keepMenuVisible:true, selectCurrent:true, onTitleChange() {},
    onSelect(card) {
      if (selecting) {
        selected.has(card.id) ? selected.delete(card.id) : selected.add(card.id);
        render(cards);
      } else onOpen(card);
    }});
  const action = (className, label, content) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = className;
    button.title = label; button.setAttribute('aria-label',label);
    button.innerHTML = content; return button;
  };
  const archive = action('notebook-card-archive-action','Show archived notes',icons.archive);
  const select = action('notebook-card-select-action','Select notes',icons.select);
  const cancel = action('notebook-card-selection-cancel','Cancel selection','Cancel');
  const archiveSelected = action('notebook-card-selection-action','Archive selected notes',icons.archive);
  const trash = action('notebook-card-selection-action','Move selected notes to Trash',icons.trash);
  notes.management.append(cancel,archive,archiveSelected,trash,select);
  notes.menu.classList.add('notebook-toolbar-note-manager');
  notes.toggle.hidden = true;
  notes.createButton.addEventListener('click',onCreate);
  archive.addEventListener('click',() => { archived = !archived; selecting = false; selected.clear(); render(cards); });
  select.addEventListener('click',() => { selecting = !selecting; selected.clear(); render(cards); });
  cancel.addEventListener('click',() => { selecting = false; selected.clear(); render(cards); select.focus({preventScroll:true}); });
  const mutate = async callback => {
    if (busy || readOnly) return;
    const targets = cards.filter(card => selected.has(card.id));
    if (!targets.length) return;
    busy = true; render(cards);
    try { if (await callback(targets) !== false) { selecting = false; selected.clear(); } }
    finally { busy = false; render(cards); }
  };
  archiveSelected.addEventListener('click',() => void mutate(targets => onArchive(targets,!archived)));
  trash.addEventListener('click',() => void mutate(onTrash));
  function render(nextCards) {
    cards = nextCards.filter(card => !card.deletedAt);
    const visible = cards.filter(card => Boolean(card.archivedAt) === archived);
    for (const id of selected) if (!visible.some(card => card.id === id)) selected.delete(id);
    notes.render({cards,activeCard:cards.find(card => card.id === getActiveCardID()),showingArchivedCards:archived,
      selectingCards:selecting,selectedCardIDs:selected,readOnly:readOnly || busy});
    notes.list.querySelectorAll('button').forEach(button => { button.disabled = busy; });
    notes.menu.classList.toggle('is-selecting-cards',selecting);
    notes.menu.classList.toggle('is-showing-archived-cards',archived);
    notes.createButton.hidden = selecting || archived;
    archive.hidden = selecting;
    archive.title = archived ? 'Show active notes' : 'Show archived notes';
    archive.setAttribute('aria-label',archive.title); archive.setAttribute('aria-pressed',String(archived));
    archive.innerHTML = archived ? icons.active : icons.archive;
    select.hidden = !visible.length; select.disabled = readOnly || busy;
    select.setAttribute('aria-pressed',String(selecting));
    cancel.hidden = archiveSelected.hidden = trash.hidden = !selecting;
    cancel.disabled = archive.disabled = busy;
    archiveSelected.disabled = trash.disabled = readOnly || busy || !selected.size;
    archiveSelected.title = archived ? 'Restore selected notes' : 'Archive selected notes';
    archiveSelected.setAttribute('aria-label',archiveSelected.title);
    archiveSelected.innerHTML = archived ? icons.restore : icons.archive;
    if (!visible.length && !archived) {
      const empty = document.createElement('p'); empty.className = 'notebook-card-list-empty';
      empty.textContent = 'No notes yet.'; notes.list.append(empty);
    }
  }
  return {menu:notes.menu,render};
}
