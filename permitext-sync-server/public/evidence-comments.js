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
export function createEvidenceCommentsEditor(value, label) {
  const editor = document.createElement('div');
  editor.className = 'section-detail-comments-editor';
  let readOnly = false;
  const add = text => {
    const box = document.createElement('label');
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
    box.append(marker, input);
    editor.append(box);
    return input;
  };
  Object.defineProperties(editor, {
    value: { get: () => serializeEvidenceComments([...editor.querySelectorAll('textarea')].map(input => input.value)),
      set: next => {
        if (next === editor.value && editor.children.length) return;
        editor.replaceChildren();
        const comments = evidenceComments(next);
        (comments.length ? comments : ['']).forEach(add);
      } },
    readOnly: { get: () => readOnly, set: next => {
      readOnly = next;
      editor.querySelectorAll('textarea').forEach(input => { input.readOnly = next; });
    } }
  });
  editor.addComment = () => {
    if (readOnly) return;
    add('').focus();
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  };
  editor.value = value;
  return editor;
}
export function evidenceCommentsText(value) {
  const comments = evidenceComments(value).filter(text => text.trim());
  return comments.length > 1 ? comments.map((text, index) => `${index + 1}. ${text}`).join('\n\n') : comments[0] || '';
}
