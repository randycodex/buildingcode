// Ephemeral discovery and review state. Nothing is attached until Include is
// pressed; callbacks bind every request and Reader opening to the owning chat.
export function createRelatedProvisionReview({ find, review, openReader, include, question, isCurrent, onVisibility }) {
  const panel = document.createElement('section');
  panel.className = 'research-related-panel';
  panel.setAttribute('aria-label', 'Related provisions');
  panel.hidden = true;
  let generation = 0, busy = false, result = null;
  const reviewed = new Map(), selected = new Set();
  const create = (tag, text, className = '') => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const current = attempt => attempt === generation && !panel.hidden && panel.isConnected && isCurrent();
  const button = (label, action) => {
    const node = create('button', label, 'ghost-button'); node.type = 'button';
    node.addEventListener('click', action); return node;
  };
  const heading = create('div', undefined, 'research-related-heading');
  const title = create('h3', 'Related provisions');
  const close = () => { generation++; panel.hidden = true; onVisibility(false); };
  heading.append(title, button('Back to conversation', close));
  const queryDetails = create('details');
  queryDetails.append(create('summary', 'Discovery question'));
  const queryForm = create('form', undefined, 'research-related-query');
  const query = create('textarea'); query.rows = 2; query.maxLength = 2000;
  query.setAttribute('aria-label', 'Discovery question');
  const search = button('Find again', () => void run());
  queryForm.append(query, search); queryDetails.append(queryForm);
  queryForm.addEventListener('submit', event => { event.preventDefault(); void run(); });
  const scope = create('p', '', 'research-passage-scope');
  const status = create('p', '', 'research-passage-scope'); status.setAttribute('role', 'status');
  const list = create('div', undefined, 'research-related-results');
  const footer = create('div', undefined, 'research-related-footer');
  const count = create('span', '', 'research-passage-scope');
  const attach = button('Include selected passages', () => void attachSelected());
  const update = () => {
    count.textContent = `${selected.size} selected for inclusion`;
    attach.disabled = busy || !selected.size || !isCurrent();
    search.disabled = busy;
    for (const control of list.querySelectorAll('input, button')) control.disabled = busy ||
      (control.type === 'checkbox' && !reviewed.has(control.dataset.candidateID));
    panel.setAttribute('aria-busy', String(busy));
  };
  footer.append(count, attach);
  panel.append(heading, queryDetails, scope, status, list, footer,
    create('p', 'Discovery uses included passages and this question. Results are not added to Research until you include them.', 'research-passage-scope'));

  function row(candidate) {
    const item = create('article', undefined, 'research-related-candidate');
    const citation = `${candidate.codePrefix} § ${candidate.sectionNumber}`;
    item.append(create('h4', candidate.kind === 'unresolved' ? candidate.title : `${citation} ${candidate.title}`),
      create('p', candidate.codeEdition || candidate.codeVersion, 'research-passage-scope'),
      create('span', ({parent:'Parent scope',reference:'Cross-reference',topic:'Related topic',unresolved:'Reference needs review'})[candidate.kind], 'research-related-kind'),
      create('p', candidate.reason, 'research-passage-scope'));
    if (candidate.kind === 'unresolved') {
      item.append(create('p', 'No resolved passage is available to include. Locate and select the exact provision in Reader.', 'research-passage-scope'));
      return item;
    }
    const actions = create('div', undefined, 'research-passage-actions');
    const check = create('input'); check.type = 'checkbox'; check.disabled = true;
    check.dataset.candidateID = candidate.id;
    const label = create('label', undefined, 'research-related-select');
    const labelText = create('span', 'Inspect before selecting');
    label.append(check, labelText);
    check.addEventListener('change', () => {
      if (!reviewed.has(candidate.id)) { check.checked = false; return; }
      if (check.checked) selected.add(candidate.id); else selected.delete(candidate.id);
      update();
    });
    const excerpt = create('details', undefined, 'research-related-reviewed'); excerpt.hidden = true;
    excerpt.append(create('summary', 'Exact passage reviewed'));
    const quote = create('blockquote'); excerpt.append(quote);
    const inspect = button('Open in Reader', async () => {
      const attempt = generation; busy = true; status.textContent = 'Opening the exact source in Reader…'; update();
      try {
        if (!current(attempt) || !await openReader(candidate) || !current(attempt)) return;
        const payload = await review(candidate);
        if (!current(attempt)) return;
        if (payload.requiresVisualReview) throw Error('This section includes visual evidence. Select the passage and review its visuals using Research in Reader.');
        if (payload.selection?.sectionID !== candidate.sectionID || payload.selection?.codeVersion !== candidate.codeVersion ||
            !payload.selection?.sectionTextHash || !payload.selection?.selectedText) {
          throw Error('The source identity changed. Find related provisions again.');
        }
        reviewed.set(candidate.id, { ...payload.selection, reviewedSectionHash: payload.selection.sectionTextHash });
        quote.textContent = payload.selection.selectedText; excerpt.hidden = false; excerpt.open = true;
        labelText.textContent = 'Select passage'; status.textContent = 'Review the exact text, then select it for inclusion.';
      } catch (error) { if (current(attempt)) status.textContent = error.message; }
      finally { if (current(attempt)) { busy = false; update(); } }
    });
    actions.append(inspect, label); item.append(actions, excerpt);
    return item;
  }

  async function run() {
    const attempt = ++generation; busy = true; result = null; selected.clear(); reviewed.clear();
    list.replaceChildren(); status.textContent = 'Finding related provisions…'; update();
    try {
      const payload = await find(query.value);
      if (!current(attempt)) return;
      result = payload;
      query.value = payload.question;
      scope.textContent = `Searched: ${(payload.sourceEditions || []).map(item => item.codeEdition).join(' · ')}. Relevance does not establish applicability.`;
      const candidates = payload.candidates || [], unresolved = payload.unresolvedReferences || [];
      status.textContent = `${candidates.length} candidate passage${candidates.length === 1 ? '' : 's'} · ${unresolved.length} unresolved reference${unresolved.length === 1 ? '' : 's'}`;
      for (const candidate of [...candidates, ...unresolved]) list.append(row(candidate));
      if (!candidates.length) list.prepend(create('p', 'No related passages were found. Refine the question or select additional text in Reader.'));
      if (payload.coverageLimitations?.length) {
        const limitations = create('details'); limitations.append(create('summary', 'Search coverage'));
        for (const text of payload.coverageLimitations) limitations.append(create('p', text, 'research-passage-scope'));
        list.append(limitations);
      }
    } catch (error) { if (current(attempt)) status.textContent = error.message; }
    finally { if (current(attempt)) { busy = false; update(); } }
  }
  async function attachSelected() {
    const attempt = generation;
    if (busy || !result || !selected.size || !current(attempt)) return;
    busy = true; status.textContent = 'Including reviewed passages…'; update();
    try {
      await include([...selected].map(id => reviewed.get(id)), result);
      if (current(attempt)) close();
    } catch (error) { if (current(attempt)) status.textContent = error.message; }
    finally { if (current(attempt)) { busy = false; update(); } }
  }
  return { element: panel, open() {
    if (!isCurrent()) return;
    panel.hidden = false; onVisibility(true); query.value = question();
    void run();
  }, close };
}
