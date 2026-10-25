// Ephemeral discovery and review state. Nothing is attached until Include is
// pressed; callbacks bind every request and Reader opening to the owning chat.
export function createRelatedProvisionReview({ find, review, openReader, include, question, isCurrent, onVisibility }) {
  const panel = document.createElement('section');
  panel.className = 'research-related-panel';
  panel.setAttribute('aria-label', 'Related provisions');
  panel.hidden = true;
  let generation = 0, busy = false, result = null;
  const reviewed = new Map(), selected = new Set();
  const rows = new Map(), groups = [];
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
  queryDetails.open = true;
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
  const filters = create('div', undefined, 'research-related-filters');
  const containsLabel = create('label', 'Title contains');
  const contains = create('input'); contains.type = 'search'; contains.setAttribute('aria-label', 'Filter candidate titles');
  const excludesLabel = create('label', 'Hide titles containing');
  const excludes = create('input'); excludes.type = 'text'; excludes.placeholder = 'e.g. Group H, fabrication';
  excludes.setAttribute('aria-label', 'Hide candidate titles containing');
  containsLabel.append(contains); excludesLabel.append(excludes); filters.append(containsLabel, excludesLabel);
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
  panel.append(heading, queryDetails, scope, filters, status, list, footer,
    create('p', 'Discovery uses included passages and this question. Results are not added to Research until you include them.', 'research-passage-scope'));

  function applyFilters() {
    const needle = contains.value.trim().toLocaleLowerCase();
    const omitted = excludes.value.toLocaleLowerCase().split(',').map(value => value.trim()).filter(Boolean);
    let visible = 0;
    for (const [id, row] of rows) {
      const text = `${row.candidate.codePrefix} ${row.candidate.sectionNumber} ${row.candidate.title}`.toLocaleLowerCase();
      row.element.hidden = Boolean(needle && !text.includes(needle) || omitted.some(value => text.includes(value)));
      if (row.element.hidden) { selected.delete(id); if (row.check) row.check.checked = false; }
      else visible++;
    }
    for (const group of groups) group.element.hidden = !group.ids.some(id => !rows.get(id)?.element.hidden);
    if (result) status.textContent = `${visible} of ${rows.size} candidates shown · title filters do not change source discovery. Hidden passages are not selected.`;
    update();
  }
  contains.addEventListener('input', applyFilters); excludes.addEventListener('input', applyFilters);

  function row(candidate) {
    const item = create('article', undefined, 'research-related-candidate');
    const citation = `${candidate.codePrefix} § ${candidate.sectionNumber}`;
    item.append(create('h4', candidate.kind === 'unresolved' ? candidate.title : `${citation} ${candidate.title}`),
      create('p', candidate.codeEdition || candidate.codeVersion, 'research-passage-scope'),
      create('span', ({parent:'Parent scope',reference:'Cross-reference',topic:'Related topic',unresolved:'Reference needs review'})[candidate.kind], 'research-related-kind'),
      create('p', candidate.reason, 'research-passage-scope'));
    if (candidate.kind === 'topic') {
      const words = [...new Set(query.value.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [])]
        .filter(word => !['the','this','that','what','which','does','with','from','for','and','are','not','include','using'].includes(word));
      const matches = words.filter(word => String(candidate.title).toLocaleLowerCase().includes(word));
      item.append(create('p', matches.length ? `Question words in this title: ${matches.slice(0, 6).join(', ')}.`
        : 'No question words match this title. This is a broader suggestion; inspect its exact scope before including it.', 'research-passage-scope'));
    }
    rows.set(candidate.id, {element: item, candidate});
    if (candidate.kind === 'unresolved') {
      item.append(create('p', 'No resolved passage is available to include. Locate and select the exact provision in Reader.', 'research-passage-scope'));
      return item;
    }
    const actions = create('div', undefined, 'research-passage-actions');
    const check = create('input'); check.type = 'checkbox'; check.disabled = true;
    rows.get(candidate.id).check = check;
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
    const inspectSource = async (inReader = false) => {
      const attempt = generation; selected.delete(candidate.id); reviewed.delete(candidate.id); check.checked = false; busy = true; status.textContent = 'Preparing the exact source text…'; update();
      try {
        if (!current(attempt) || inReader && !await openReader(candidate) || !current(attempt)) return;
        const payload = await review(candidate);
        if (!current(attempt)) return;
        if (payload.requiresVisualReview) throw Error('This section includes visual evidence. Select the passage and review its visuals using Ask Assistant in Reader.');
        if (payload.selection?.sectionID !== candidate.sectionID || payload.selection?.codeVersion !== candidate.codeVersion ||
            !payload.selection?.sectionTextHash || !String(payload.selection?.selectedText || "").trim()) {
          throw Error('The source identity changed. Find related provisions again.');
        }
        reviewed.set(candidate.id, { ...payload.selection, reviewedSectionHash: payload.selection.sectionTextHash });
        quote.textContent = payload.selection.selectedText; excerpt.hidden = false; excerpt.open = true;
        labelText.textContent = 'Select passage'; status.textContent = 'Review the exact text, then select it for inclusion.';
      } catch (error) { if (current(attempt)) status.textContent = error.message; }
      finally { if (current(attempt)) { busy = false; update(); } }
    };
    actions.append(button('Inspect exact text', () => inspectSource()), button('Open in Reader', () => inspectSource(true)), label); item.append(actions, excerpt);
    return item;
  }

  async function run() {
    const attempt = ++generation; busy = true; result = null; selected.clear(); reviewed.clear();
    list.replaceChildren(); rows.clear(); groups.length = 0; status.textContent = 'Finding related provisions…'; update();
    try {
      const payload = await find(query.value);
      if (!current(attempt)) return;
      result = payload;
      query.value = payload.question;
      scope.textContent = `Searched: ${(payload.sourceEditions || []).map(item => item.codeEdition).join(' · ')}. Relevance does not establish applicability.`;
      const candidates = payload.candidates || [], unresolved = payload.unresolvedReferences || [];
      status.textContent = `${candidates.length} candidate passage${candidates.length === 1 ? '' : 's'} · ${unresolved.length} unresolved reference${unresolved.length === 1 ? '' : 's'}`;
      for (const [kind, label] of [['parent', 'Parent scope'], ['reference', 'References in included text'], ['topic', 'Broader topic suggestions'], ['unresolved', 'Unresolved references']]) {
        const members = [...candidates, ...unresolved].filter(candidate => candidate.kind === kind);
        if (!members.length) continue;
        const group = create('details', undefined, 'research-related-group');
        group.open = kind !== 'topic' || !candidates.some(candidate => ['parent', 'reference'].includes(candidate.kind));
        group.append(create('summary', `${label} · ${members.length}`));
        for (const candidate of members) group.append(row(candidate));
        groups.push({element: group, ids: members.map(candidate => candidate.id)}); list.append(group);
      }
      if (!candidates.length) list.prepend(create('p', 'No related passages were found. Refine the question or select additional text in Reader.'));
      if (payload.coverageLimitations?.length) {
        const limitations = create('details'); limitations.append(create('summary', 'Search coverage'));
        for (const text of payload.coverageLimitations) limitations.append(create('p', text, 'research-passage-scope'));
        list.append(limitations);
      }
      applyFilters();
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
