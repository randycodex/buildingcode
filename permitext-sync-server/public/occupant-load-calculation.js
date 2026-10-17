// Arithmetic assistance, kept separate from the immutable Research answer.
// Suggested factors and applicability still require the author's source review.
const decimal = value => {
  const text = String(value ?? '').trim();
  if (!/^\d{1,10}(?:\.\d{1,6})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const numerator = BigInt(whole + fraction);
  return numerator > 0n ? {numerator, scale: 10n ** BigInt(fraction.length), text} : null;
};

export function calculateOccupantLoad(input = {}) {
  const errors = [];
  const area = decimal(input.area), factor = decimal(input.factor);
  if (!String(input.spaceFunction || '').trim() || String(input.spaceFunction).length > 300) errors.push('Describe the function of this space.');
  if (!area) errors.push('Enter a positive floor area, with up to six decimal places.');
  if (!factor) errors.push('Enter the applicable positive factor in ft² per person.');
  if (!['gross', 'net'].includes(input.areaBasis)) errors.push('Select gross or net area from the governing table.');
  if (!String(input.factorBasis || '').trim() || String(input.factorBasis).length > 500) errors.push('Identify the table row and applicable footnotes.');
  if (input.seating !== 'without-fixed-seating') errors.push('This calculation supports one space without fixed seating only.');
  if (input.reviewed !== true) errors.push('Review the factor, area basis, and applicable footnotes in Reader.');
  let people = null;
  if (area && factor) {
    const numerator = area.numerator * factor.scale;
    const denominator = area.scale * factor.numerator;
    const rounded = (numerator + denominator - 1n) / denominator;
    if (rounded > 10_000_000n) errors.push('The result exceeds the supported range. Check the area and factor.');
    else people = Number(rounded);
  }
  return {valid: errors.length === 0, errors, people: errors.length ? null : people,
    input: {spaceFunction: String(input.spaceFunction || '').trim(), area: area?.text || '',
      factor: factor?.text || '', areaBasis: input.areaBasis, seating: input.seating,
      factorBasis: String(input.factorBasis || '').trim(), reviewed: input.reviewed === true}};
}

export function occupantLoadSource(source = {}) {
  const version = String(source.codeVersion || source.sourceLibraryVersion || '');
  const number = String(source.sectionNumber || '').trim().replace(/^BC\s*/i, '');
  return String(source.codePrefix || source.codeBook || '').toUpperCase() === 'BC' &&
    version.includes('/2022-construction-codes/') && /^(?:1004\.1\.3|TABLE\s+1004\.1\.3)$/i.test(number) &&
    /^\d+$/.test(String(source.sectionID || source.id || ''));
}

// Automatically discovered evidence is carried on answer citations even when
// the conversation has no manually selected sources.
export function occupantLoadAnswerSource(sources = [], answer = {}) {
  return [...(Array.isArray(answer?.citations) ? answer.citations : []), ...sources].find(occupantLoadSource) || null;
}

export function occupantLoadPrefill(answer, source) {
  const proposal = answer?.occupantLoadDraft;
  const sourceIDs = [...(source?.sourceIDs || []), source?.sourceID].filter(Boolean);
  if (!occupantLoadSource(source) || !proposal || !sourceIDs.includes(proposal.sourceID)) return {};
  const values = {}, suggestions = [];
  for (const [key, label] of [['spaceFunction', 'Function of space'], ['area', 'Floor area'], ['areaBasis', 'Area basis'], ['seating', 'Seating'], ['factor', 'Occupant-load factor']]) {
    const field = proposal[key];
    if (!field || typeof field.value !== 'string' || !field.value.trim() || field.value.length > 300 || typeof field.quote !== 'string' || !field.quote.trim() || field.quote.length > 500) continue;
    if (['area', 'factor'].includes(key) && !decimal(field.value)) continue;
    if (key === 'areaBasis' && !['gross', 'net'].includes(field.value)) continue;
    if (key === 'seating' && !['without-fixed-seating', 'fixed-seating'].includes(field.value)) continue;
    values[key] = field.value;
    suggestions.push({label, value: field.value, quote: field.quote, origin: key === 'factor' ? 'Cited table row' : 'Your conversation'});
  }
  if (values.factor) values.factorBasis = `${proposal.factor.quote} · Review applicable footnotes.`.slice(0, 500);
  return suggestions.length ? {...values, reviewed: false, suggestions} : {};
}

export function calculationNoteBlocks(calculation, evidenceLinks, answerID = '') {
  if (!calculation?.valid || !evidenceLinks?.length) throw new Error('Complete the calculation and link its governing source first.');
  const c = calculation.input;
  const paragraph = text => ({type: 'paragraph', content: [{type: 'text', text, styles: {}}]});
  const blocks = [
    {type: 'heading', props: {level: 2}, content: [{type: 'text', text: 'Occupant load calculation', styles: {}}]},
    paragraph(`Needs review · calculation snapshot · ${c.spaceFunction}`),
    paragraph(`${c.area} ft² (${c.areaBasis}) ÷ ${c.factor} ft²/person = ${calculation.people} people (rounded up to a whole person).`),
    paragraph(`Factor basis supplied by author: ${c.factorBasis}`),
    paragraph('One space without fixed seating. The author confirmed the factor, area basis, and applicable footnotes. This arithmetic does not establish cumulative loads, exit count, or compliance.'),
    ...evidenceLinks.map(link => ({type: 'paragraph', content: [{type: 'permitextReference', props: {
      referenceKind: 'selectedPassage', referenceID: link.id, label: link.label
    }}]}))
  ];
  if (answerID) blocks.push({type: 'paragraph', content: [{type: 'permitextReference', props: {
    referenceKind: 'researchAnswer', referenceID: answerID, label: 'Original Assistant answer'
  }}]});
  return blocks;
}

export function createOccupantLoadCard({draft = {}, onSave, onOpenSource, sourceLabel, canSave = true, onOpenNote}) {
  const root = document.createElement('details');
  root.className = 'occupant-load-card';
  root.dataset.researchSelectionExclude = 'true';
  const summary = document.createElement('summary'); summary.textContent = 'Occupant load calculation';
  const body = document.createElement('div'); body.className = 'occupant-load-body';
  const scope = document.createElement('p'); scope.className = 'calculation-scope';
  scope.textContent = draft.suggestions?.length ? 'Suggested inputs from this conversation · review required' : 'One space without fixed seating · author-supplied inputs';
  const form = document.createElement('form'); form.className = 'occupant-load-form';
  const fields = {};
  for (const [key, label, options] of [
    ['spaceFunction', 'Function of space', null], ['area', 'Floor area · ft²', null],
    ['areaBasis', 'Area basis', [['', 'Choose gross or net'], ['gross', 'Gross'], ['net', 'Net']]],
    ['factor', 'Occupant-load factor · ft²/person', null],
    ['factorBasis', 'Table row and footnotes', null],
    ['seating', 'Seating', [['', 'Confirm seating'], ['without-fixed-seating', 'Without fixed seating'], ['fixed-seating', 'Fixed seating — separate method required']]]
  ]) {
    const wrapper = document.createElement('label'); wrapper.textContent = label;
    const field = document.createElement(options ? 'select' : 'input');
    field.setAttribute('aria-label', label);
    if (options) options.forEach(([value, text]) => {const option = document.createElement('option'); option.value = value; option.textContent = text; field.append(option);});
    else {field.type = 'text'; field.maxLength = key === 'factorBasis' ? 500 : 300; if (['area', 'factor'].includes(key)) field.inputMode = 'decimal';}
    field.value = draft[key] || ''; fields[key] = field; wrapper.append(field); form.append(wrapper);
  }
  const source = document.createElement('button'); source.type = 'button'; source.className = 'calculation-source';
  source.textContent = `Open in Reader · ${sourceLabel}`;
  const status = document.createElement('p'); status.className = 'calculation-status'; status.setAttribute('role', 'status');
  source.addEventListener('click', async () => {
    try {await onOpenSource();} catch (error) {status.textContent = error.message;}
  });
  const reviewLabel = document.createElement('label'); reviewLabel.className = 'calculation-confirm';
  const reviewed = document.createElement('input'); reviewed.type = 'checkbox'; reviewed.checked = draft.reviewed === true;
  const reviewText = document.createElement('span');
  reviewText.textContent = 'I confirmed the factor, gross/net basis, and applicable footnotes in Reader.';
  reviewLabel.append(reviewed, reviewText);
  const result = document.createElement('output'); result.className = 'calculation-result'; result.setAttribute('aria-live', 'polite');
  const formula = document.createElement('p'); formula.className = 'calculation-formula';
  const actions = document.createElement('div'); actions.className = 'calculation-actions';
  const save = document.createElement('button'); save.type = 'submit'; save.className = 'ghost-button'; save.textContent = 'Save calculation to Notebook';
  const open = document.createElement('button'); open.type = 'button'; open.className = 'ghost-button'; open.textContent = 'Open in Notebook'; open.hidden = true;
  open.addEventListener('click', async () => {try {await onOpenNote?.(savedCard);} catch (error) {status.textContent = error.message;}});
  let busy = false, savedCard = null, savedFingerprint = '';
  const values = () => ({...Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value])), reviewed: reviewed.checked});
  const update = () => {
    Object.assign(draft, values());
    const calculation = calculateOccupantLoad(draft);
    const awaitingReview = !calculation.valid && calculation.errors.length === 1 && !draft.reviewed;
    result.classList.toggle('is-pending', !calculation.valid);
    result.hidden = awaitingReview;
    result.textContent = calculation.valid ? `${calculation.people.toLocaleString()} people`
      : awaitingReview ? '' : 'Complete inputs and source review';
    formula.textContent = calculation.valid ? `${calculation.input.area} ÷ ${calculation.input.factor} · rounded up to a whole person` : calculation.errors[0];
    const changed = savedCard && JSON.stringify(calculation.input) !== savedFingerprint;
    save.disabled = busy || !calculation.valid || !canSave;
    save.textContent = savedCard ? (changed ? 'Save revised calculation as new Note' : 'Saved to Notebook') : 'Save calculation to Notebook';
    if (savedCard && !changed) save.disabled = true;
    if (changed) status.textContent = 'Inputs changed. The saved Note keeps its original snapshot and needs review.';
    return calculation;
  };
  form.addEventListener('input', event => {if (event.target !== reviewed) reviewed.checked = false; update();});
  form.addEventListener('change', event => {if (event.target !== reviewed) reviewed.checked = false; update();});
  form.addEventListener('submit', async event => {
    event.preventDefault(); const calculation = update(); if (!calculation.valid || save.disabled) return;
    busy = true; update(); status.textContent = 'Saving calculation and source snapshot…';
    // Lock inputs during the save so a delayed response cannot label newer inputs saved.
    Object.values(fields).forEach(field => field.disabled = true); reviewed.disabled = true;
    try {
      const card = await onSave(calculation);
      if (!card) return;
      savedCard = card; savedFingerprint = JSON.stringify(calculation.input); open.hidden = false;
      status.textContent = 'Saved to Notebook · needs review. The Assistant answer is unchanged.';
    } catch (error) {status.textContent = error.message;}
    finally {busy = false; Object.values(fields).forEach(field => field.disabled = false); reviewed.disabled = false; update();}
  });
  actions.append(save, open); form.append(reviewLabel, result, formula, actions);
  body.append(scope, source);
  body.append(form, status); root.append(summary, body); update();
  return root;
}
