// Questions are authored note content, covered by the note's version/conflict
// checks. They inherit that note's linked evidence and saved Assistant answers.
export function normalizeNotebookQuestions(value = []) {
  if (!Array.isArray(value) || value.length > 40) throw new Error('A Note supports up to 40 questions.');
  const ids = new Set();
  const text = (value, label, limit, required = false) => {
    if (value !== undefined && typeof value !== 'string') throw new Error(`Invalid ${label}.`);
    const result = (value || '').trim();
    if ((required && !result) || result.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(result)) {
      throw new Error(`Invalid ${label}.`);
    }
    return result;
  };
  return value.map(question => {
    if (!question || typeof question !== 'object') throw new Error('Invalid Note question.');
    const id = text(question.id, 'question ID', 100, true);
    if (ids.has(id)) throw new Error('Question IDs must be unique within a Note.');
    ids.add(id);
    const status = question.status || 'open';
    if (!['open', 'resolved'].includes(status)) throw new Error('Invalid question status.');
    const kind = question.kind || 'question';
    if (!['question','action'].includes(kind)) throw new Error('Invalid Note item kind.');
    return {id, ...(kind === 'action' ? {kind} : {}), ...(question.includeInReport === true ? {includeInReport:true} : {}), text: text(question.text, 'question', 1000, true),
      why: text(question.why, 'question context', 2000), status,
      resolution: text(question.resolution, 'resolution explanation', 4000, status === 'resolved' && kind === 'question')};
  });
}

export function openNotebookQuestions(card) {
  return (card?.openQuestions || []).filter(question => question.status !== 'resolved');
}

export function notebookQuestionsText(questions = []) {
  if (!questions.length) return '';
  return ['Questions and actions', ...questions.map(question => [
    `${question.kind === 'action' ? 'Action' : 'Question'} · ${question.status === 'resolved' ? 'Resolved' : 'Open'}: ${question.text}`,
    question.why ? `Why it matters: ${question.why}` : '',
    question.resolution ? `Resolution: ${question.resolution}` : ''
  ].filter(Boolean).join('\n')), 'Resolution records research progress; it does not certify compliance.'].join('\n\n');
}

export function createNotebookQuestionsEditor({questions = [], readOnly = false, onChange}) {
  const section = document.createElement('details');
  section.className = 'notebook-questions';
  const summary = document.createElement('summary');
  const body = document.createElement('div');
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  let current = structuredClone(questions);
  let editingID = null;
  let editingKind = 'question';
  const commit = next => {
    try {
      const normalized = normalizeNotebookQuestions(next);
      onChange(normalized);
      current = normalized;
      editingID = null;
      render();
    } catch (error) { status.textContent = error.message; }
  };
  const remove = id => {
    try {
      const next = current.filter(question => question.id !== id);
      // Another question may still be incomplete. Removing this one must not
      // require completing unrelated input before saving the remaining draft.
      onChange(next);
      current = next;
      editingID = null;
      render();
    } catch (error) { status.textContent = error.message; }
  };
  const button = (label, action) => {
    const control = document.createElement('button');
    control.type = 'button'; control.className = 'notebook-secondary-action'; control.textContent = label;
    control.addEventListener('click', action);
    return control;
  };
  const render = () => {
    const count = openNotebookQuestions({openQuestions: current}).length;
    summary.textContent = `Questions and checklist · ${count} open`;
    body.replaceChildren(); status.textContent = '';
    const hint = document.createElement('p');
    hint.className = 'notebook-questions-hint';
    hint.textContent = 'Questions record what you need to know. Checklist items record what you need to do. Select which items to include in Report.';
    body.append(hint);
    for (const question of current) {
      const row = document.createElement('article');
      row.className = 'notebook-question';
      const heading = document.createElement('strong');
      heading.textContent = `${question.kind === 'action' ? 'Action' : 'Question'} · ${question.status === 'resolved' ? 'Resolved' : 'Open'} · ${question.text}`;
      row.append(heading);
      for (const [label, value] of [['Why it matters', question.why], ['Resolution', question.resolution]]) {
        if (!value) continue;
        const paragraph = document.createElement('p'); paragraph.textContent = `${label}: ${value}`; row.append(paragraph);
      }
      const reportLabel = document.createElement('label');
      const include = document.createElement('input'); include.type = 'checkbox'; include.checked = question.includeInReport === true; include.disabled = readOnly;
      include.addEventListener('change', () => commit(current.map(item => item.id === question.id ? {...item,includeInReport:include.checked} : item)));
      reportLabel.append(include, 'Include in Report'); row.append(reportLabel);
      if (!readOnly) row.append(button('Edit item', () => { editingID = question.id; editingKind = question.kind || 'question'; render(); }),
        button('Remove question', () => remove(question.id)),
        ...(question.kind === 'action' && question.status === 'open' ? [button('Mark completed', () => commit(current.map(item => item.id === question.id ? {...item,status:'resolved'} : item)))] : []),
        ...(question.status === 'resolved' ? [button('Reopen', () => commit(current.map(item => item.id === question.id ? {...item, status: 'open'} : item)))] : []));
      body.append(row);
    }
    if (!readOnly && editingID !== null) {
      const previous = current.find(item => item.id === editingID);
      const questionID = previous?.id || crypto.randomUUID();
      const form = document.createElement('form');
      form.className = 'notebook-question-form';
      const fields = {};
      for (const [key, label, maximum] of [['text', editingKind === 'action' ? 'Action' : 'Question', 1000], ['why', 'Why it matters', 2000], ['resolution', 'Resolution explanation or source', 4000]]) {
        const wrapper = document.createElement('label'); wrapper.textContent = label;
        const input = document.createElement('textarea'); input.rows = key === 'text' ? 2 : 3;
        input.maxLength = maximum; input.required = key === 'text'; input.value = previous?.[key] || '';
        input.setAttribute('aria-label', label); fields[key] = input; wrapper.append(input); form.append(wrapper);
      }
      const resolvedLabel = document.createElement('label');
      const resolved = document.createElement('input'); resolved.type = 'checkbox'; resolved.checked = previous?.status === 'resolved';
      resolvedLabel.append(resolved, editingKind === 'action' ? 'Mark completed' : 'Mark resolved'); form.append(resolvedLabel);
      resolved.addEventListener('change', () => { fields.resolution.required = resolved.checked && editingKind === 'question'; });
      fields.resolution.required = resolved.checked && editingKind === 'question';
      const save = document.createElement('button'); save.type = 'submit'; save.className = 'notebook-secondary-action'; save.textContent = 'Save item';
      form.append(save, button('Remove question', () => remove(questionID)));
      const capture = () => {
        const next = {...previous, id: questionID, kind:editingKind, text: fields.text.value, why: fields.why.value,
          resolution: fields.resolution.value, status: resolved.checked ? 'resolved' : 'open'};
        const items = current.some(item => item.id === questionID)
          ? current.map(item => item.id === questionID ? next : item) : [...current, next];
        // Retain incomplete input through the same durable draft path as note text.
        // Server validation prevents an empty question or unsupported resolution from syncing.
        try { onChange(items); current = items; } catch (error) { status.textContent = error.message; }
      };
      form.addEventListener('input', capture);
      form.addEventListener('change', capture);
      form.addEventListener('submit', event => {
        event.preventDefault();
        const next = {...previous, id: questionID, kind:editingKind, text: fields.text.value, why: fields.why.value,
          resolution: fields.resolution.value, status: resolved.checked ? 'resolved' : 'open'};
        commit(current.some(item => item.id === questionID) ? current.map(item => item.id === questionID ? next : item) : [...current, next]);
      });
      body.append(form);
    } else if (!readOnly && current.length < 40) {
      body.append(button('Add question', () => { editingID = ''; editingKind = 'question'; section.open = true; render(); }),
        button('Add checklist item', () => { editingID = ''; editingKind = 'action'; section.open = true; render(); }));
    }
    body.append(status);
  };
  section.append(summary, body); render();
  return section;
}

// Report reads a snapshot, with only the question/action items the author chose.
export function notebookReportDocument(document, questions = []) {
  if (!Array.isArray(document?.document)) return document;
  const selected = questions.filter(item => item.includeInReport === true);
  if (!selected.length) return document;
  return {...document, document:[...document.document,
    {type:'heading',props:{level:2},content:[{type:'text',text:'Questions and actions',styles:{}}]},
    ...selected.map(item => ({type:'paragraph',content:[{type:'text',text:[
      `${item.kind === 'action' ? 'Action' : 'Question'} · ${item.status === 'resolved' ? 'Resolved' : 'Open'} · ${item.text}`,
      item.why, item.resolution
    ].filter(Boolean).join('\n'),styles:{}}]}))]};
}
