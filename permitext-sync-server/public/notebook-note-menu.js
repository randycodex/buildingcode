import { openNotebookQuestions } from "./notebook-questions.js";
export function createNotebookNoteMenu({ onSelect, onTitleChange }) {
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
  createButton.className = 'notebook-card-add-action';
  createButton.textContent = '+ New note';
  createButton.setAttribute('aria-label', 'New Note');
  const management = document.createElement('div');
  management.className = 'notebook-card-rail-actions';
  footer.append(createButton, management);
  const questionFilter = document.createElement('button');
  questionFilter.type = 'button';
  questionFilter.className = 'notebook-question-filter';
  questionFilter.setAttribute('aria-pressed', 'false');
  let onlyOpenQuestions = false;
  questionFilter.addEventListener('click', () => { onlyOpenQuestions = !onlyOpenQuestions; render(state); });
  popup.append(questionFilter, list, footer);
  menu.append(toggle, popup);
  element.append(title, titleEditor, menu);
  let state = { activeCard: null, readOnly: false, selectingCards: false };
  const finishTitleEditing = () => {
    title.textContent = state.activeCard?.title || 'Untitled Note';
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
    title.textContent = titleEditor.value || 'Untitled Note';
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
    title.textContent = activeCard?.title || 'Untitled Note';
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
    const displayedCard = card => card.id && card.id === activeCard?.id ? activeCard : card;
    const count = cards.filter(card => Boolean(card.archivedAt) === showingArchivedCards)
      .reduce((sum, card) => sum + openNotebookQuestions(displayedCard(card)).length, 0)
      + (!activeCard?.id ? openNotebookQuestions(activeCard).length : 0);
    questionFilter.textContent = `${count} open ${count === 1 ? 'question' : 'questions'}`;
    questionFilter.setAttribute('aria-pressed', String(onlyOpenQuestions));
    const visibleCards = cards.filter(card => (!onlyOpenQuestions || openNotebookQuestions(displayedCard(card)).length) && Boolean(card.archivedAt) === showingArchivedCards &&
      !(activeCard && !activeCard.id && !card.id));
    if (!showingArchivedCards && activeCard && !activeCard.id && (!onlyOpenQuestions || openNotebookQuestions(activeCard).length)) visibleCards.unshift(activeCard);
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
      choice.className = 'notebook-card-tile';
      choice.setAttribute('aria-label', `${selectingCards ? 'Select' : 'Open'} note: ${card.title || 'Untitled Note'}`);
      if (current) choice.setAttribute('aria-current', 'true');
      if (selectingCards) choice.setAttribute('aria-pressed', String(selectedCardIDs.has(card.id)));
      const name = document.createElement('span');
      name.textContent = (current ? activeCard.title : card.title) || 'Untitled Note';
      const revision = document.createElement('small');
      const openCount = openNotebookQuestions(displayedCard(card)).length;
      revision.textContent = (current ? 'Current' : `Revision ${card.version || 1}`) + (openCount ? ` · ${openCount} open` : '');
      choice.append(name, revision);
      choice.addEventListener('click', () => {
        if (!state.selectingCards) {
          menu.open = false;
          toggle.focus({ preventScroll: true });
          if (current) return;
        }
        onSelect(card);
      });
      row.append(choice);
      list.append(row);
    }
  };
  return { element, menu, toggle, label, list, footer, management, createButton, titleEditor, editTitle, render };
}
