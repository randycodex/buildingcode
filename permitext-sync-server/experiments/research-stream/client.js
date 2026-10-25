const $ = id => document.getElementById(id);
let selected = [{ id: '2152', title: 'BC 1004.1.3 Areas without fixed seating.' }], controller, live = false, lastHistory = [], searchSequence = 0;
const examples = {
  office: { id: '2152', title: 'BC 1004.1.3 Areas without fixed seating.', question: 'Using only the selected 2022 NYC BC 1004.1.3 passage, calculate the occupant load for 6,000 square feet of gross Business areas, entirely indoors, without fixed seating. No rooftop or terrace area is included and no optional fixture or amenity deduction is proposed. Explain the applicable table footnotes and any mandatory condition that could change the result.' },
  title: { id: '1', title: 'BC 101.1 Title.', question: 'Based only on this selected passage, what is the code called and how are section numbers designated?' },
  missing: { id: '1', title: 'BC 101.1 Title.', question: 'Does this selected passage establish that my proposed four-story office building must have sprinklers? Explain what this passage can actually establish.' },
  web: { id: '1', title: 'BC 101.1 Title.', question: 'According to official NYC DOB guidance, may a filing representative attest for the owner in DOB NOW: Build? Explain who must provide the owner attestation, citing the official guidance.' }
};
function element(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
function renderSelected() {
  $('selected').replaceChildren(...selected.map(s => { const node = element('div', s.title, 'selectedSource'), remove = element('button', '×');
    remove.type = 'button'; remove.setAttribute('aria-label', `Remove ${s.title}`); remove.onclick = () => { selected = selected.filter(x => x.id !== s.id); lastHistory = []; renderSelected(); }; node.append(remove); return node; }));
  $('sourceCount').textContent = `(${selected.length}/3)`;
}
function evidence(sources) {
  $('evidence').replaceChildren(...sources.map(s => { const card = element('div', undefined, 'sourceCard'); card.id = `source-${s.id}`;
    const link = element('a', `[${s.id}] ${s.title}`); link.href = s.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    const detail = element('details'), summary = element('summary', 'Read the supplied passage'); detail.append(summary, element('pre', s.text));
    card.append(link, element('p', `${s.edition} · ${s.authority.replaceAll('_', ' ')}`), detail); return card; }));
}
function linkedText(node, text, sources = []) {
  node.replaceChildren(); const ids = new Set(sources.map(s => s.id)); let end = 0;
  for (const match of text.matchAll(/\[((?:S|W)\d+)\]|\*\*([^*\n]+)\*\*/g)) { node.append(document.createTextNode(text.slice(end, match.index)));
    if (match[2]) node.append(element('strong',match[2]));
    else if (ids.has(match[1])) { const a = element('a', match[0]); a.href = `#source-${match[1]}`; a.onclick = () => { evidence(sources); const detail = $(`source-${match[1]}`)?.querySelector('details'); if (detail) detail.open = true; }; node.append(a); }
    else node.append(document.createTextNode(match[0])); end = match.index + match[0].length;
  } node.append(document.createTextNode(text.slice(end)));
}
const seconds = ms => Number.isFinite(ms) ? `${(ms / 1000).toFixed(2)} s` : '—';
function timing(run) { $('timing').textContent = `${run.mode === 'baseline' ? 'Existing Research' : 'Streamed prototype'}${run.live ? '' : ' · OFFLINE FIXTURE'}\nFirst visible text: ${seconds(run.firstVisibleMs)}\nCompleted / stopped: ${seconds(run.totalMs)}\nProvider requests: ${run.providerRequests ?? 0}\n${run.status.replaceAll('_', ' ')}`; }
function budgetView(b) { $('budget').textContent = `$${b.reservedUSD.toFixed(2)} of $${b.capUSD.toFixed(2)} conservatively reserved · ${b.requests} requests`; }
async function refresh() {
  const response = await fetch('/api/state'); if (!response.ok) throw new Error('Open the local launch link to access the prototype.');
  const state = await response.json(); live = state.live;
  $('modeBadge').textContent = live ? 'LIVE · $5 CAPPED BATCH' : 'OFFLINE DEMONSTRATION'; $('baseline').disabled = !live; budgetView(state.budget);
  $('history').replaceChildren(...state.runs.slice().reverse().map(run => { const button = element('button', `${run.mode} · ${run.status.replaceAll('_', ' ')} · ${run.question.slice(0,65)}`, 'savedRun');
    button.onclick = () => showSavedRun(run); return button; }));
  return state;
}
function makeTurn(question) { const turn = element('article', undefined, 'turn'), answer = element('div', '', 'answerText'), status = element('div', '', 'status');
  turn.append(element('div', question, 'questionBubble'), element('div', 'PERMITEXT · GENERATED EXPLANATION', 'answerLabel'), answer, status); $('conversation').append(turn); return { turn, answer, status }; }
function showSavedRun(run) {
  selected = (run.sources || []).filter(s => s.sectionID).map(s => ({ id:s.sectionID, title:s.title }));
  $('question').value = run.question; $('facts').value = run.facts || ''; $('baseline').checked = run.mode === 'baseline';
  lastHistory = []; renderSelected();
  const view = makeTurn(run.question); linkedText(view.answer, run.text || '', run.sources);
  view.status.textContent = run.error || run.status.replaceAll('_',' '); timing(run); if (run.sources) evidence(run.sources);
}
async function search() { const sequence = ++searchSequence, q = $('sourceSearch').value; const response = await fetch(`/api/catalog?q=${encodeURIComponent(q)}`); const results = await response.json(); if (sequence !== searchSequence) return;
  $('searchResults').replaceChildren(...results.map(s => { const button = element('button', s.title); button.type = 'button'; button.onclick = () => { if (selected.length >= 3 || selected.some(x => x.id === s.id)) return; selected.push(s); lastHistory = []; renderSelected(); }; return button; })); }
$('sourceSearch').oninput = search;
for (const button of document.querySelectorAll('[data-example]')) button.onclick = () => { const e = examples[button.dataset.example]; selected = [{ id:e.id, title:e.title }]; $('question').value = e.question; $('facts').value = ''; lastHistory = []; renderSelected(); };
$('stop').onclick = () => controller?.abort();
$('composer').onsubmit = async event => {
  event.preventDefault(); if (!selected.length) { $('question').setCustomValidity('Select a library passage first.'); $('question').reportValidity(); $('question').setCustomValidity(''); return; }
  const question = $('question').value.trim(), mode = $('baseline').checked ? 'baseline' : 'stream', view = makeTurn(question);
  controller = new AbortController(); $('send').disabled = true; $('stop').hidden = false;
  const started = performance.now(); let firstVisible = null, sources = [], text = '', terminal = false;
  try {
    const response = await fetch('/api/run', { method:'POST', headers:{'content-type':'application/json'}, signal:controller.signal,
      body:JSON.stringify({ question, sectionIDs:selected.map(s=>s.id), facts:$('facts').value, mode, history: mode === 'baseline' ? [] : lastHistory }) });
    if (!response.ok) throw new Error((await response.json()).error);
    const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
    const consume = line => { if (!line.trim()) return; const e = JSON.parse(line);
      if (e.type === 'sources') { sources = e.sources; evidence(sources); }
      if (e.type === 'status') view.status.textContent = e.text;
      if (e.type === 'delta') { if (firstVisible === null && e.text.trim()) firstVisible = performance.now() - started; text += e.text; view.answer.textContent = text; view.status.textContent = 'Writing…'; }
      if (e.type === 'result') { terminal = true; sources = e.run.sources || sources; evidence(sources); linkedText(view.answer, e.run.text, sources); timing(e.run); budgetView(e.budget);
        const issues = e.run.citations?.unknown?.length ? ' · Contains unresolved citation IDs' : e.run.citations?.missing ? ' · No citation markers' : '';
        view.status.textContent = `${e.run.status.replaceAll('_',' ')}${issues}`;
        if (live && e.run.status === 'completed_unreviewed') lastHistory = [...lastHistory, {role:'user',text:question},{role:'assistant',text:e.run.text}].slice(-6);
      }
      if (e.type === 'error') { terminal = true; timing(e.run); throw new Error(e.error); }
    };
    while (true) { const {value,done} = await reader.read(); buffer += decoder.decode(value,{stream:!done}); const lines=buffer.split('\n'); buffer=lines.pop(); lines.forEach(consume); if(done)break; }
    consume(buffer); if (!terminal) throw new Error('Connection ended before completion.');
  } catch(error) { view.status.classList.add('error'); view.status.textContent = error.name === 'AbortError' ? 'Stopped · partial answer, not completed' : error.message; }
  finally { controller = null; $('send').disabled = false; $('stop').hidden = true; await refresh().catch(()=>{}); }
};
renderSelected(); $('question').value = examples.office.question;
try { const state = await refresh(); await search(); if (state.runs.length) showSavedRun(state.runs.at(-1)); }
catch(e) { $('modeBadge').textContent=e.message; }
