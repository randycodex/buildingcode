// Multiple comments retain the existing synced text field and remain readable
// in older clients and exports. Escape heading-like user text losslessly.
const prefix = '## Passage comments\n\n';
export function evidenceComments(value) {
  const text = String(value || '');
  if (!text.startsWith(prefix + '### Comment 1\n')) return text ? [text] : [];
  const parts = text.slice(prefix.length).split(/^### Comment (\d+)\n/gm);
  if (parts[0] !== '' || parts.length < 3) return [text];
  const result = [];
  for (let i = 1; i < parts.length; i += 2) {
    if (Number(parts[i]) !== result.length + 1) return [text];
    const body = i + 2 < parts.length ? parts[i + 1].replace(/\n\n$/, '') : parts[i + 1];
    result.push(body.replace(/^\\(\\|### Comment )/gm, '$1'));
  }
  return result;
}
export function serializeEvidenceComments(comments) {
  const values = comments.map(value => String(value || ''));
  if (!values.some(value => value.trim())) return '';
  if (values.length === 1 && !values[0].startsWith(prefix)) return values[0];
  return prefix + values.map((value, index) => `### Comment ${index + 1}\n${value.replace(/^(\\|### Comment )/gm, '\\$1')}`).join('\n\n');
}
export function evidenceCommentBlocks(comments = []) {
  return comments.filter(value => String(value).trim()).map((text, index) => ({
    type: 'paragraph', content: [{ type: 'text', text: `Comment ${index + 1}: ${text}`, styles: {} }]
  }));
}
export function createEvidenceCommentsEditor(value, label, history = {}) {
  const editor = document.createElement('div');
  editor.className = 'section-detail-comments-editor';
  let readOnly = false;
  let initialized = false;
  const deletions = history.deletions ||= [];
  const undoNotice = document.createElement('div');
  undoNotice.className = 'section-detail-comment-undo';
  undoNotice.hidden = true;
  undoNotice.setAttribute('role', 'status');
  const undoMessage = document.createElement('span');
  undoMessage.textContent = 'Comment deleted.';
  const undo = document.createElement('button');
  undo.type = 'button';
  undo.textContent = 'Undo';
  undo.setAttribute('aria-label', 'Undo comment deletion');
  undoNotice.append(undoMessage, undo);
  editor.undoNotice = undoNotice;
  const refreshUndo = () => {
    undoNotice.hidden = deletions.length === 0;
    undo.disabled = readOnly || deletions.length === 0;
  };
  const renumber = () => {
    [...editor.children].forEach((box, index) => {
      const number = index + 1;
      box.querySelector('.section-detail-comment-number').textContent = `${number}.`;
      box.querySelector('textarea').setAttribute('aria-label', `${label} ${number}`);
      const remove = box.querySelector('button');
      remove.setAttribute('aria-label', `Delete comment ${number}`);
      remove.title = `Delete comment ${number}`;
    });
  };
  undo.addEventListener('click', () => {
    if (readOnly || !deletions.length) return;
    const { text, index } = deletions.pop();
    const before = editor.children[Math.min(index, editor.children.length)] || null;
    const input = add(text, before);
    renumber();
    refreshUndo();
    input.focus();
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const add = (text, before = null) => {
    const box = document.createElement('div');
    box.className = 'section-detail-note-box';
    const number = editor.children.length + 1;
    const marker = document.createElement('span');
    marker.className = 'section-detail-comment-number';
    marker.textContent = `${number}.`;
    const input = document.createElement('textarea');
    input.value = text;
    input.placeholder = 'Add a comment';
    input.setAttribute('aria-label', `${label} ${number}`);
    input.readOnly = readOnly;
    const header = document.createElement('div');
    header.className = 'section-detail-comment-header';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'section-detail-comment-delete';
    remove.textContent = 'Delete';
    remove.setAttribute('aria-label', `Delete comment ${number}`);
    remove.title = `Delete comment ${number}`;
    remove.disabled = readOnly;
    remove.addEventListener('click', () => {
      if (readOnly || box.parentElement !== editor) return;
      const index = [...editor.children].indexOf(box);
      deletions.push({ text: input.value, index });
      if (deletions.length > 50) deletions.shift();
      box.remove();
      refreshUndo();
      renumber();
      const remaining = editor.querySelectorAll('textarea');
      const next = remaining[Math.min(index, remaining.length - 1)];
      if (next) next.focus();
      else editor.closest('.section-detail-panel')?.querySelector('.section-detail-add-comment')?.focus();
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    });
    header.append(marker, remove);
    box.append(header, input);
    editor.insertBefore(box, before);
    return input;
  };
  Object.defineProperties(editor, {
    value: { get: () => serializeEvidenceComments([...editor.querySelectorAll('textarea')].map(input => input.value)),
      set: next => {
        if (initialized && next === editor.value) return;
        initialized = true;
        if (next !== history.value) deletions.length = 0;
        history.value = next;
        refreshUndo();
        editor.replaceChildren();
        const comments = evidenceComments(next);
        comments.forEach(text => add(text));
      } },
    readOnly: { get: () => readOnly, set: next => {
      readOnly = next;
      editor.querySelectorAll('textarea').forEach(input => { input.readOnly = next; });
      editor.querySelectorAll('button').forEach(button => { button.disabled = next; });
      refreshUndo();
    } }
  });
  editor.addComment = () => {
    if (readOnly) return;
    add('').focus();
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  };
  editor.addEventListener('input', () => { history.value = editor.value; });
  editor.value = value;
  return editor;
}
export function evidenceCommentsText(value) {
  const comments = evidenceComments(value).filter(text => text.trim());
  return comments.length > 1 ? comments.map((text, index) => `${index + 1}. ${text}`).join('\n\n') : comments[0] || '';
}
