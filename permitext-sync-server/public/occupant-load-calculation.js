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
  const custom = input.factorMode === 'custom';
  const tableFactor = custom ? decimal(input.tableFactor) : null;
  const customReason = String(input.customReason || '').trim();
  const invalidMode = input.factorMode != null && !['table', 'custom'].includes(input.factorMode);
  const invalidCustomSource = custom && (!tableFactor || !input.tableRowID);
  if (invalidMode) errors.push('Choose the BC table or a custom factor.');
  if (invalidCustomSource) errors.push('Select a BC table function before using a custom factor.');
  if (custom && (!customReason || customReason.length > 2000)) errors.push('Enter a reason/reference for the custom factor, up to 2,000 characters.');
  if (!String(input.spaceFunction || '').trim() || String(input.spaceFunction).length > 300) errors.push('Describe the function of this space.');
  if (!area) errors.push('Enter a positive floor area, with up to six decimal places.');
  if (!factor) errors.push('Enter the applicable positive factor in ft² per person.');
  if (!['gross', 'net'].includes(input.areaBasis)) errors.push('Select gross or net area from the governing table.');
  if (!String(input.factorBasis || '').trim() || String(input.factorBasis).length > 4000) errors.push('Identify the table row and applicable footnotes.');
  if (input.seating !== 'without-fixed-seating') errors.push('This calculation supports one space without fixed seating only.');
  let people = null;
  if (area && factor) {
    const numerator = area.numerator * factor.scale;
    const denominator = area.scale * factor.numerator;
    const rounded = (numerator + denominator - 1n) / denominator;
    if (rounded > 10_000_000n) errors.push('The result exceeds the supported range. Check the area and factor.');
    else people = Number(rounded);
  }
  return {valid: errors.length === 0, errors, people: errors.length ? null : people,
    previewPeople: input.seating === 'fixed-seating' || invalidMode || invalidCustomSource ? null : people,
    input: {spaceFunction: String(input.spaceFunction || '').trim(), area: area?.text || '',
      factor: factor?.text || '', areaBasis: input.areaBasis, seating: input.seating,
      factorBasis: String(input.factorBasis || '').trim(),
      ...(input.tableRowID ? {tableRowID: input.tableRowID} : {}),
      ...(custom ? {factorMode: 'custom', tableFactor: tableFactor?.text || '', customReason} : {})}};
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

const compact = text => String(text || '').replace(/\s+/g, ' ').trim();
const tag = node => String(node.nodeName || '').toLowerCase();
const attribute = (node, name) => node.getAttribute?.(name) ?? node.attrs?.find(a => a.name === name)?.value ?? '';
const descendants = (node, predicate) => {
  const found = [];
  for (const child of node.childNodes || []) {
    if (predicate(child)) found.push(child);
    found.push(...descendants(child, predicate));
  }
  return found;
};
const textOf = node => tag(node) === '#text' ? (node.nodeValue ?? node.value ?? '')
  : Array.from(node.childNodes || [], textOf).join('');

// Read the actual section payload, including its subrows and superscript notes.
// The optional parser lets offline tests use parse5 against the same corpus HTML.
export function occupantLoadTable(blocks, source, parseHTML = html => new DOMParser().parseFromString(html, 'text/html')) {
  if (!occupantLoadSource(source)) throw new Error('The calculator requires its exact 2022 BC table source.');
  const parse = html => parseHTML(String(html).replace(/<\/br\s*>/gi, ''));
  const notesRoot = parse((blocks || []).map(b => b.html || '').join(''));
  const tables = descendants(notesRoot, n => tag(n) === 'table').filter(table => {
    const trs = descendants(table, n => tag(n) === 'tr');
    const header = trs[0] && descendants(trs[0], n => ['td','th'].includes(tag(n)));
    return header?.length === 2 && /^Function of Space$/i.test(compact(textOf(header[0]))) &&
      /Occupant Load Factor/i.test(compact(textOf(header[1]))) && trs.length > 1;
  });
  if (tables.length !== 1) throw new Error('The complete BC table could not be loaded.');
  const notes = {};
  for (const node of descendants(notesRoot, n => attribute(n, 'class').split(/\s+/).includes('Small'))) {
    const text = compact(textOf(node));
    const match = text.match(/^([a-z])\.\s*(.+)$/) || text.match(/^(C\*)\s*-\s*(.+)$/);
    if (match) notes[match[1]] = match[2];
  }
  const cellLines = node => {
    const walk = n => {
      if (tag(n) === 'br') return '\n';
      if (tag(n) === '#text') return String(n.nodeValue ?? n.value ?? '').replace(/\s+/g, ' ');
      if (tag(n) === 'sup' || /vertical-align\s*:\s*super/i.test(attribute(n, 'style'))) {
        return `[[${compact(textOf(n))}]]` + '\n'.repeat(descendants(n, child => tag(child) === 'br').length);
      }
      return Array.from(n.childNodes || [], walk).join('');
    };
    const lines = walk(node).split('\n').map(line => {
      const markers = [];
      const text = compact(line.replace(/\[\[([^\]]+)\]\]/g, (_, letters) => {
        markers.push(...letters.split(',').map(compact)); return '';
      }));
      return {text, markers};
    });
    while (lines.length && !lines.at(-1).text && !lines.at(-1).markers.length) lines.pop();
    return lines;
  };
  const rows = [];
  for (const tr of descendants(tables[0], n => tag(n) === 'tr')) {
    const cells = Array.from(tr.childNodes || []).filter(n => ['td', 'th'].includes(tag(n)));
    if (cells.length !== 2) throw new Error('The BC table row structure has changed.');
    if (!compact(textOf(cells[0])) && !compact(textOf(cells[1]))) continue;
    if (/^Function of Space$/i.test(compact(textOf(cells[0])))) continue;
    const functions = cellLines(cells[0]), factors = cellLines(cells[1]);
    let group = '';
    if (functions.length > 1 && !factors[0]?.text) {group = functions.shift().text; factors.shift();}
    if (!functions.length || functions.length !== factors.length) throw new Error('The BC table subrows could not be aligned.');
    functions.forEach((fn, i) => {
      const factorText = factors[i].text;
      const label = group ? `${group} — ${fn.text}` : fn.text;
      const markers = [...new Set(['a', ...fn.markers, ...factors[i].markers, ...(factorText.includes('C*') ? ['C*'] : [])])];
      if (!fn.text || markers.some(marker => !notes[marker])) throw new Error('A BC row or its footnotes are missing.');
      const numeric = factorText.match(/^(\d+(?:\.\d+)?)\s+(gross|net)$/i);
      const fixed = /See Section 1004\.3\b/i.test(factorText);
      // Bowling includes people per lane in addition to its area-based part.
      const method = numeric && !/persons for each lane/i.test(label) ? 'area' : fixed ? 'fixed' : 'special';
      rows.push({id: `bc-1004.1.3:${label}`, label, sourceFunction: fn.text, factorText, method,
        factor: method === 'area' ? numeric[1] : '', areaBasis: method === 'area' ? numeric[2].toLowerCase() : '',
        footnotes: markers.map(marker => ({marker, text: notes[marker]})),
        description: `${label} · ${factorText}\n${markers.map(marker => `${marker}. ${notes[marker]}`).join('\n')}`});
    });
  }
  if (!rows.length) throw new Error('The BC table has no available functions.');
  return {rows, codeVersion: source.codeVersion || source.sourceLibraryVersion, sectionID: String(source.sectionID || source.id)};
}

export function occupantLoadTableInput(input, table, rowID = input.tableRowID) {
  const row = table?.rows.find(row => row.id === rowID);
  const {factorMode, customFactor, customReason, tableFactor, ...base} = input;
  return {...base, tableRowID: row?.id || '', spaceFunction: row?.label || '',
    factor: row?.factor || '', areaBasis: row?.areaBasis || '', factorBasis: row?.description || '',
    ...(factorMode === 'custom' && row?.method === 'area' ? {
      factorMode: 'custom', factor: String(customFactor ?? input.factor ?? ''),
      tableFactor: row.factor, customReason: String(customReason || '').trim()
    } : {}),
    ...(row?.method === 'fixed' ? {seating: 'fixed-seating'} : {})};
}

export function occupantLoadSuggestedRow(draft, table) {
  if (draft.tableRowID) return table.rows.find(row => row.id === draft.tableRowID) || null;
  const exact = table.rows.find(row => compact(row.label) === compact(draft.spaceFunction));
  if (exact) return exact;
  const quote = compact(draft.suggestions?.find(s => s.label === 'Occupant-load factor')?.quote);
  const matches = table.rows.filter(row => row.method === 'area' && quote.includes(compact(row.sourceFunction)) &&
    (!draft.factor || draft.factor === row.factor) &&
    new RegExp(`\\b${row.factor}\\s+${row.areaBasis}\\b`, 'i').test(quote));
  return matches.length === 1 ? matches[0] : null;
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

export function occupantLoadFootnoteAssessment(answer, source) {
  if (answer?.verification?.pass !== true || !Array.isArray(answer.occupantLoadDraft?.footnoteChecks)) return null;
  const selection=occupantLoadPrefill(answer,source);
  if (!selection.factor) return null;
  return {selection,sourceID:answer.occupantLoadDraft.sourceID,checks:answer.occupantLoadDraft.footnoteChecks.slice(0,5),
    workFacts:answer.occupantLoadDraft.footnoteWorkFacts||[]};
}

const occupantLoadSpaceLocations = Object.freeze({
  interior: 'This calculation is entirely for an interior space; no rooftop or terrace area is included.',
  rooftop: 'This calculation is for a rooftop area.',
  terrace: 'This calculation is for a terrace area.',
  mixed: 'The location is mixed or other; an interior-only calculation has not been established.'
});
const occupantLoadSpaceLocationText = value => Object.hasOwn(occupantLoadSpaceLocations, value) ? occupantLoadSpaceLocations[value] : '';

export function occupantLoadFootnoteState(assessment, table, row, input) {
  if (input.factorMode === 'custom' || !assessment || !row || occupantLoadSuggestedRow(assessment.selection,table)?.id!==row.id ||
    ['area','seating'].some(key=>String(assessment.selection[key]||'')!==String(input[key]||'')) ||
    String(assessment.selection.areaBasis||'')!==String(input.userMeasurementBasis||'')) return null;
  const location = occupantLoadSpaceLocationText(input.spaceLocation);
  const locationChecks = assessment.checks.filter(check => ['c', 'd'].includes(check.marker));
  if (location && locationChecks.length && !locationChecks.some(check => check.factQuotes?.some(fact => compact(fact.quote).includes(compact(location))))) return null;
  return row.footnotes.map(note=>{
    const check=assessment.checks.find(check=>check.sourceID===assessment.sourceID && check.marker===note.marker && compact(check.footnoteText)===compact(note.text) &&
      ['applies','not_applicable','needs_information'].includes(check.status));
    return {...note,check:check||null};
  });
}

export function occupantLoadFootnoteQuestion(input) {
  return ['Explain this calculation and the relevant footnotes of 2022 NYC BC Table 1004.1.3 using the entered area as-is.',
    ...(input.spaceName?.trim() ? [`User-entered space / room name: ${input.spaceName.trim()}.`] : []),
    `Function of space: ${input.spaceFunction}.`,
    input.area?`The calculator floor area is ${input.area} square feet${input.userMeasurementBasis?` of ${input.userMeasurementBasis} area`:''}.`:'The calculator area is blank; reuse earlier stated values only if their measurement basis is established.',
    input.seating==='without-fixed-seating'?'This space has no fixed seating.':input.seating==='fixed-seating'?'This space has fixed seating.':'The seating condition has not been entered.',
    ...(occupantLoadSpaceLocationText(input.spaceLocation) ? [occupantLoadSpaceLocationText(input.spaceLocation)] : []),
    ...(input.factorMode === 'custom' ? [
      `The user selected a custom factor of ${input.factor} ft²/person; the BC table factor remains ${input.tableFactor} ${input.areaBasis} ft²/person.`,
      `User-provided reason/reference: ${input.customReason || '(not entered)'}. Treat this as user input, not enacted text or proof of approval.`
    ] : []),
    'This calculation uses the entered area without any additional optional fixture or amenity deduction. Explain any optional deduction separately; fixture dimensions are not requested for this as-entered calculation. If the user wants to evaluate a deduction, ask for the relevant details then.',
    'Use the included passages and facts stated in this conversation, respecting later corrections and the specific space. Saved Project Context and Facts are not included. The selected code row does not establish how the area was measured or whether the space is indoors, a rooftop or a terrace. Identify genuinely missing facts that affect mandatory conditions or applicability. Do not infer approvals, deduct area automatically or declare overall compliance.'
  ].join('\n');
}

export function calculationNoteBlocks(calculation, evidenceLinks, answerID = '', spaceLocation = '') {
  if (!calculation?.valid || !evidenceLinks?.length) throw new Error('Complete the calculation and link its governing source first.');
  const c = calculation.input;
  const paragraph = text => ({type: 'paragraph', content: [{type: 'text', text, styles: {}}]});
  const blocks = [
    ...(occupantLoadSpaceLocationText(spaceLocation) ? [paragraph(`User-stated location: ${occupantLoadSpaceLocationText(spaceLocation)}`)] : []),
    {type: 'heading', props: {level: 2}, content: [{type: 'text', text: 'Occupant load calculation', styles: {}}]},
    paragraph(`Needs review · ${c.factorMode === 'custom' ? 'Custom factor · ' : ''}calculation snapshot · ${c.spaceFunction}`),
    paragraph(`${c.area} ft² (${c.areaBasis}) ÷ ${c.factor} ft²/person = ${calculation.people} people (rounded up to a whole person).`),
    ...(c.factorMode === 'custom' ? [
      paragraph(`Custom factor (user-defined): ${c.factor} ft²/person. BC table factor: ${c.tableFactor} ft²/person (${c.areaBasis}).`),
      paragraph(`Reason/reference (user-provided): ${c.customReason}`)
    ] : []),
    paragraph(`Factor basis: ${c.factorBasis}`),
    paragraph('One space without fixed seating. Source applicability and footnotes need review. This arithmetic does not establish cumulative loads, exit count, or compliance.'),
    ...evidenceLinks.map(link => ({type: 'paragraph', content: [{type: 'permitextReference', props: {
      referenceKind: 'selectedPassage', referenceID: link.id, label: link.label
    }}]}))
  ];
  if (answerID) blocks.push({type: 'paragraph', content: [{type: 'permitextReference', props: {
    referenceKind: 'researchAnswer', referenceID: answerID, label: 'Original Assistant answer'
  }}]});
  return blocks;
}

export function createOccupantLoadCard({draft = {}, onDraftChange, savedNote = null, savedInputFingerprint = "", recentDrafts = [], activeDraftID = "", onChooseDraft, onNewDraft, onReloadDraft, onSave, onOpenSource, onLoadTable, onControlsReady, sourceLabel, canSave = true, onOpenNote, assessment = null, getAssessment, onCheckFootnotes, onReplyFootnotes, savedMessage = 'Saved to Notebook · needs review. The Assistant answer is unchanged.'}) {
  const initialDraft = {...draft};
  let areaMeasurementBasis = draft.areaMeasurementBasis || draft.areaBasis || '';
  let userMeasurementBasis = draft.userMeasurementBasis ?? draft.areaBasis ?? '';
  let table = null, loading = false;
  let customFactor = draft.factorMode === 'custom' ? draft.factor || '' : '';
  let selectedRowID = draft.tableRowID || '';
  const root = document.createElement('details');
  root.className = 'occupant-load-card';
  root.dataset.researchSelectionExclude = 'true';
  const summary = document.createElement('summary'); summary.textContent = 'Occupant load calculation';
  const body = document.createElement('div'); body.className = 'occupant-load-body';
  const form = document.createElement('form'); form.className = 'occupant-load-form';
  const draftTools = document.createElement('div'); draftTools.className = 'calculation-draft-tools';
  const draftState = document.createElement('p'); draftState.className = 'calculation-draft-state';
  draftState.textContent = 'Device draft · inputs are saved on this device';
  const recentLabel = document.createElement('label'); recentLabel.textContent = 'Recent calculations';
  const recent = document.createElement('select'); recent.setAttribute('aria-label', 'Recent calculations');
  for (const item of recentDrafts) {
    const option = document.createElement('option'); option.value = item.id;
    option.textContent = `${item.input.spaceName || 'Unnamed space'} · ${item.savedNote ? 'has saved Note' : 'Device draft'}`;
    recent.append(option);
  }
  recent.value = activeDraftID;
  recent.addEventListener('change', () => onChooseDraft?.(recent.value));
  const newDraft = document.createElement('button'); newDraft.type = 'button'; newDraft.className = 'ghost-button'; newDraft.textContent = 'New calculation';
  newDraft.addEventListener('click', () => onNewDraft?.());
  const reloadDraft = document.createElement('button'); reloadDraft.type = 'button'; reloadDraft.className = 'ghost-button'; reloadDraft.textContent = 'Reload device draft'; reloadDraft.hidden = true;
  reloadDraft.addEventListener('click', () => onReloadDraft?.());
  recentLabel.append(recent); draftTools.append(draftState, reloadDraft, recentLabel, newDraft);
  const fields = {};
  for (const [key, label, options] of [
    ['spaceName', 'Space / room name (optional)', null],
    ['spaceLocation', 'Space location (for footnotes)', [['', 'Not stated'], ['interior', 'Interior only — no rooftop or terrace'], ['rooftop', 'Rooftop'], ['terrace', 'Terrace'], ['mixed', 'Mixed / other — describe in question']]],
    ['spaceFunction', 'Function of space', [['', 'Select a BC table function']]], ['area', 'Floor area · ft²', null],
    ['areaBasis', 'Area basis', null],
    ['factor', 'Occupant-load factor · ft²/person', null],
    ['seating', 'Seating', [['', 'Confirm seating'], ['without-fixed-seating', 'Without fixed seating'], ['fixed-seating', 'Fixed seating — separate method required']]],
    ['factorMode', 'Factor source', [['table', 'BC table (default)'], ['custom', 'Custom factor']]]
  ]) {
    const wrapper = document.createElement('label'); wrapper.textContent = label;
    const field = document.createElement(options ? 'select' : 'input');
    field.setAttribute('aria-label', label);
    if (options) options.forEach(([value, text]) => {const option = document.createElement('option'); option.value = value; option.textContent = text; field.append(option);});
    else {field.type = 'text'; field.maxLength = 300; if (['area', 'factor'].includes(key)) field.inputMode = 'decimal';}
    const derived = ['areaBasis', 'factor'].includes(key);
    field.readOnly = derived;
    field.value = derived || key === 'spaceFunction' ? '' : draft[key] || (key === 'factorMode' ? 'table' : '');
    if (key === 'spaceFunction') field.disabled = true;
    if (key === 'spaceFunction') field.className = 'occupant-load-function-select';
    fields[key] = field; wrapper.append(field); form.append(wrapper);
  }
  const tableReference = document.createElement('span'); tableReference.className = 'calculation-table-factor';
  fields.factor.parentElement.append(tableReference);
  const reasonLabel = document.createElement('label'); reasonLabel.className = 'calculation-custom-reason';
  reasonLabel.textContent = 'Reason / reference (required)';
  const reason = document.createElement('textarea'); reason.rows = 2; reason.maxLength = 2000;
  reason.setAttribute('aria-label', 'Reason / reference'); reason.value = draft.customReason || '';
  fields.customReason = reason; reasonLabel.append(reason); form.append(reasonLabel);
  const notesSection = document.createElement('section'); notesSection.className = 'calculation-table-notes';
  const notesHeading = document.createElement('h3'); notesHeading.textContent = 'Table row and footnotes';
  const tableNotes = document.createElement('div'); tableNotes.className = 'calculation-table-notes-content';
  notesSection.append(notesHeading, tableNotes); form.append(notesSection);
  const source = document.createElement('button'); source.type = 'button'; source.className = 'calculation-source';
  source.textContent = `Open in Reader · ${sourceLabel}`;
  const status = document.createElement('p'); status.className = 'calculation-status'; status.setAttribute('role', 'status');
  source.addEventListener('click', async () => {
    try {await onOpenSource();} catch (error) {status.textContent = error.message;}
  });
  const result = document.createElement('output'); result.className = 'calculation-result'; result.setAttribute('aria-live', 'polite');
  const formula = document.createElement('p'); formula.className = 'calculation-formula';
  const footnotes = document.createElement('section'); footnotes.className='calculation-footnote-checks';
  const checkNotes = document.createElement('button'); checkNotes.type='button';checkNotes.className='ghost-button';
  checkNotes.textContent='Ask Assistant about footnotes';
  checkNotes.addEventListener('click',async()=>{
    checkNotes.disabled=true;
    try {await onCheckFootnotes?.({...draft});} catch(error){status.textContent=error.message;}
    finally {update();}
  });
  let invalidatedAnswerID='';
  root.refreshDraftChoices = items => {
    const currentID = recent.value;
    recent.replaceChildren();
    for (const item of items) {
      const option = document.createElement('option'); option.value = item.id;
      option.textContent = `${item.input.spaceName || 'Unnamed space'} · ${item.savedNote ? 'has saved Note' : 'Device draft'}`;
      recent.append(option);
    }
    recent.value = currentID;
  };
  root.addEventListener('calculation-context-changed',()=>{invalidatedAnswerID=(getAssessment?.()||assessment)?.answerID||'';assessment=null;update();});
  root.addEventListener('calculation-assessment-refreshed',()=>update());
  const actions = document.createElement('div'); actions.className = 'calculation-actions';
  const save = document.createElement('button'); save.type = 'submit'; save.className = 'ghost-button'; save.textContent = 'Save calculation to Notebook';
  const open = document.createElement('button'); open.type = 'button'; open.className = 'ghost-button'; open.textContent = 'Open in Notebook'; open.hidden = true;
  open.addEventListener('click', async () => {try {await onOpenNote?.(savedCard);} catch (error) {status.textContent = error.message;}});
  let staleDraft = false;
  let busy = false, savedCard = savedNote, savedFingerprint = savedInputFingerprint;
  open.hidden = !savedCard;
  const fingerprint = calculation => JSON.stringify({spaceName: draft.spaceName || '', ...(draft.spaceLocation ? {spaceLocation: draft.spaceLocation} : {}), input: calculation.input});
  root.markDraftChanged = () => {
    staleDraft = true; reloadDraft.hidden = false;
    Object.values(fields).forEach(field => field.disabled = true);
    update();
  };
  const values = () => occupantLoadTableInput({area: fields.area.value, seating: fields.seating.value,
    spaceLocation: Object.hasOwn(occupantLoadSpaceLocations, fields.spaceLocation.value) ? fields.spaceLocation.value : '',
    factorMode: fields.factorMode.value, customFactor, customReason: reason.value,
    areaMeasurementBasis,userMeasurementBasis}, table, fields.spaceFunction.value);
  const update = () => {
    for (const key of ['factorMode', 'customReason', 'tableFactor']) delete draft[key];
    Object.assign(draft, values());
    const row = table?.rows.find(row => row.id === draft.tableRowID);
    const custom = draft.factorMode === 'custom';
    fields.factorMode.value = custom ? 'custom' : 'table';
    fields.factorMode.disabled = staleDraft || busy || row?.method !== 'area';
    fields.factorMode._syncCustomSelect?.();
    fields.factor.readOnly = !custom;
    const factorLabel = custom ? 'Custom factor · ft²/person' : 'Occupant-load factor · ft²/person';
    fields.factor.parentElement.firstChild.textContent = factorLabel;
    fields.factor.setAttribute('aria-label', factorLabel);
    fields.factor.value = draft.factor;
    tableReference.hidden = !custom;
    tableReference.textContent = custom ? `BC table: ${row.factor} ${row.areaBasis} ft²/person` : '';
    reasonLabel.hidden = !custom; reason.required = custom; reason.disabled = staleDraft || busy || !custom;
    fields.areaBasis.value = draft.areaBasis ? draft.areaBasis[0].toUpperCase() + draft.areaBasis.slice(1) : '';
    tableNotes.textContent = draft.factorBasis;
    notesSection.hidden = !draft.factorBasis;
    const areaLabel = fields.area.parentElement.firstChild;
    areaLabel.textContent = draft.areaBasis ? `Floor area · ${draft.areaBasis} ft²` : 'Floor area · ft²';
    const calculation = calculateOccupantLoad(draft);
    const hasResult = calculation.previewPeople !== null;
    const fixedSeating = draft.seating === 'fixed-seating';
    const special = row && row.method !== 'area';
    footnotes.replaceChildren();
    const currentAssessment=getAssessment?.()||assessment;
    const checks=occupantLoadFootnoteState(currentAssessment?.answerID && currentAssessment.answerID===invalidatedAnswerID?null:currentAssessment,table,row,draft);
    if(checks) {
      const heading=document.createElement('p');heading.className='calculation-footnote-heading';heading.textContent='Footnote checks';footnotes.append(heading);
      const questions=new Set();
      for(const note of checks) {
        const item=document.createElement('div');item.className='calculation-footnote-item';
        const link=document.createElement('button');link.type='button';link.className='calculation-source';
        link.textContent=`Footnote ${note.marker}`;
        link.addEventListener('click',()=>void Promise.resolve(onOpenSource({exact:note.text})).catch(error=>{status.textContent=error.message;}));
        const state=document.createElement('span');state.textContent=note.check?({applies:'Applies',not_applicable:'Not applicable',needs_information:'Needs information'}[note.check.status]):'Not checked';
        item.append(link,state);
        if(note.check) {
          const why=document.createElement('p');why.textContent=note.check.reason;item.append(why);
          for(const fact of note.check.factQuotes||[]) {const quote=document.createElement('blockquote');quote.textContent=fact.quote;item.append(quote);}
          if(note.check.status==='needs_information' && note.check.question && !questions.has(note.check.question)) {
            questions.add(note.check.question);const question=document.createElement('p');question.className='calculation-footnote-question';question.textContent=note.check.question;item.append(question);
          }
        }
        footnotes.append(item);
      }
      if(questions.size && onReplyFootnotes) {
        const reply=document.createElement('button');reply.type='button';reply.className='ghost-button';reply.textContent='Reply in Assistant';
        reply.addEventListener('click',()=>void Promise.resolve(onReplyFootnotes()).catch(error=>{status.textContent=error.message;}));footnotes.append(reply);
      }
    }
    checkNotes.hidden=!onCheckFootnotes || !row || special;
    checkNotes.disabled=staleDraft || busy || !table;
    checkNotes.textContent=checks?'Ask Assistant to recheck footnotes':'Ask Assistant about footnotes';
    if(!checkNotes.hidden) footnotes.append(checkNotes);
    result.classList.toggle('is-pending', !hasResult);
    result.textContent = hasResult ? `${calculation.previewPeople.toLocaleString()} people${custom ? ' · Custom factor' : ''}`
      : fixedSeating || special ? 'Separate method required' : 'Complete calculation inputs';
    formula.hidden = hasResult;
    formula.textContent = hasResult ? ''
      : special ? row.factorText : fixedSeating ? 'Fixed seating uses a separate calculation method.' : calculation.errors[0];
    const changed = savedCard && fingerprint(calculation) !== savedFingerprint;
    draftState.textContent = staleDraft ? 'Updated in another view · reload this device draft to continue' : savedCard ? (changed ? 'Device draft · changes have not been saved to a new Note' : 'Saved snapshot in Notebook · editable device draft') : 'Device draft · inputs are saved on this device';
    save.disabled = staleDraft || busy || !calculation.valid || !canSave;
    save.textContent = savedCard ? (changed ? 'Save revised calculation as new Note' : 'Saved to Notebook') : 'Save calculation to Notebook';
    if (savedCard && !changed) save.disabled = true;
    return calculation;
  };
  const handleInput = event => {
    if (event.target === fields.spaceLocation) invalidatedAnswerID=(getAssessment?.()||assessment)?.answerID||'';
    if (event.target === fields.spaceFunction) {
      const next = table?.rows.find(row => row.id === fields.spaceFunction.value);
      if (fields.spaceFunction.value !== selectedRowID) {
        fields.factorMode.value = 'table'; customFactor = ''; reason.value = '';
        selectedRowID = fields.spaceFunction.value;
      }
      if (areaMeasurementBasis && next?.areaBasis && areaMeasurementBasis !== next.areaBasis) fields.area.value = '';
      if (next?.areaBasis) areaMeasurementBasis = next.areaBasis;
      if (next?.method === 'fixed' && fields.seating.value !== 'fixed-seating') {
        fields.seating.value = 'fixed-seating'; fields.seating.dispatchEvent(new Event('change', {bubbles: true}));
      }
    }
    if (event.target === fields.factorMode) {
      customFactor = fields.factorMode.value === 'custom' ? table?.rows.find(row => row.id === fields.spaceFunction.value)?.factor || '' : '';
      reason.value = '';
    }
    if (event.target === fields.factor && fields.factorMode.value === 'custom') customFactor = fields.factor.value;
    if (event.target === fields.area) {areaMeasurementBasis = table?.rows.find(row => row.id === fields.spaceFunction.value)?.areaBasis || '';userMeasurementBasis=areaMeasurementBasis;}
    draft.spaceName = fields.spaceName.value.trim();
    status.textContent = ''; update();
    if (table) { try {onDraftChange?.({...draft});} catch (error) {status.textContent = `Device draft not saved: ${error.message}`;} }
  };
  form.addEventListener('input', handleInput);
  form.addEventListener('change', handleInput);
  form.addEventListener('submit', async event => {
    event.preventDefault(); const calculation = update(); if (!calculation.valid || save.disabled) return;
    busy = true; root.setAttribute('aria-busy', 'true'); recent.disabled = true; newDraft.disabled = true; update(); status.textContent = 'Saving calculation and source snapshot…';
    // Lock inputs during the save so a delayed response cannot label newer inputs saved.
    Object.values(fields).forEach(field => field.disabled = true);
    try {
      const card = await onSave(calculation);
      if (!card) return;
      savedCard = card; savedFingerprint = fingerprint(calculation); open.hidden = false;
      status.textContent = savedMessage;
    } catch (error) {status.textContent = error.message;}
    finally {busy = false; root.removeAttribute('aria-busy'); recent.disabled = false; newDraft.disabled = false; Object.values(fields).forEach(field => field.disabled = staleDraft); fields.spaceFunction.disabled = staleDraft || !table; update();}
  });
  root.addEventListener('toggle', async () => {
    if (!root.open || table || loading) return;
    loading = true;
    try {
      table = await onLoadTable();
      const selected = occupantLoadSuggestedRow(initialDraft, table);
      for (const row of table.rows) {
        const option = document.createElement('option'); option.value = row.id; option.textContent = row.label;
        fields.spaceFunction.append(option);
      }
      fields.spaceFunction.disabled = staleDraft;
      fields.spaceFunction.value = selected?.id || '';
      selectedRowID = fields.spaceFunction.value;
      fields.factorMode.value = initialDraft.factorMode === 'custom' ? 'custom' : 'table';
      if (selected?.areaBasis && areaMeasurementBasis && selected.areaBasis !== areaMeasurementBasis) fields.area.value = '';
      if (selected?.areaBasis) areaMeasurementBasis = selected.areaBasis;
      if (selected?.method === 'fixed') fields.seating.value = 'fixed-seating';
      update(); onControlsReady?.(form);
      fields.spaceFunction.dispatchEvent(new Event('change', {bubbles: true}));
      fields.seating.dispatchEvent(new Event('change', {bubbles: true}));
    } catch (error) {table = null; status.textContent = error.message;}
    finally {loading = false;}
  });
  actions.append(save, open); form.append(result, formula, footnotes, actions);
  body.append(source);
  body.append(draftTools, form, status); root.append(summary, body); update();
  return root;
}
