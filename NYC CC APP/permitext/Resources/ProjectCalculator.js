// The calculator and draft list come from the same modules as the web workspace.
globalThis.startProjectCalculator = configuration => {
  const bridge = window.webkit.messageHandlers.projectCalculator;
  const root = document.querySelector('#calculator');
  const savedNote = document.querySelector('#saved-note');
  const send = message => bridge.postMessage(message);
  const source = configuration.source;
  const sourceLabel = `BC § ${source.sectionNumber} · ${source.codeEdition}`;
  const context = JSON.stringify([configuration.projectID, source.sectionID, source.codeVersion, 'manual']);
  const store = calculationDraftStore({
    getItem: () => configuration.drafts,
    setItem: (_, value) => {
      if (value === configuration.drafts) return;
      configuration.drafts = value;
      void send({type: 'drafts', value}).catch(error => { savedNote.textContent = String(error); });
    }
  }, 'drafts');
  const table = occupantLoadTable(configuration.blocks, source);
  const tableExcerpt = configuration.excerpt;
  let pendingSave;

  document.querySelector('#governing-source').addEventListener('click', () => {
    void send({type: 'source'}).catch(error => { savedNote.textContent = String(error); });
  });

  function show(initial) {
    let record = initial;
    const card = createOccupantLoadCard({
      draft: record.input,
      column: true,
      sourceLabel,
      canSave: configuration.canSave,
      recentDrafts: store.list(context),
      activeDraftID: record.id,
      savedInputFingerprint: record.savedNote ? record.savedFingerprint : null,
      onChooseDraft: id => show(store.open(context, {}, id)),
      onNewDraft: () => show(store.create(context)),
      onLoadTable: () => table,
      onDraftChange: input => {
        record = store.update(record, input);
        card.refreshDraftChoices(store.list(context));
        savedNote.textContent = '';
      },
      onSave: async calculation => {
        const checked = calculateOccupantLoad(occupantLoadTableInput(calculation.input, table));
        if (!checked.valid) throw new Error(checked.errors[0]);
        const spaceName = String(record.input.spaceName || '').trim();
        const spaceLocation = record.input.spaceLocation || '';
        const fingerprint = JSON.stringify({spaceName, ...(spaceLocation ? {spaceLocation} : {}), input: checked.input});
        if (pendingSave?.fingerprint !== fingerprint) {
          pendingSave = {fingerprint, id: crypto.randomUUID(), createdAt: new Date().toISOString()};
        }
        const {id, createdAt} = pendingSave;
        const body = calculationNoteBlocks(checked, [{id, label: sourceLabel}], '', spaceLocation);
        if (spaceName) body.unshift({
          type: 'paragraph',
          content: [{type: 'text', text: `Space / room: ${spaceName}`, styles: {}}]
        });
        const title = `Occupant load · ${spaceName || checked.input.spaceFunction}${checked.input.factorMode === 'custom' ? ' · Custom factor' : ''}`;
        const note = await send({type: 'note', value: {
          id, createdAt, title, label: sourceLabel, exact: tableExcerpt,
          blocks: body.map((block, index) => ({
            ...block, id: `${id}-${index}`, props: block.props || {}, children: []
          }))
        }});
        if (!note) return null;
        pendingSave = null;
        record = store.markSaved(record, note, fingerprint);
        card.refreshDraftChoices(store.list(context));
        savedNote.textContent = `Saved to ${note.title}`;
        return note;
      }
    });
    savedNote.textContent = '';
    root.replaceChildren(card);
    card.open = true;
  }
  show(store.open(context));
};
