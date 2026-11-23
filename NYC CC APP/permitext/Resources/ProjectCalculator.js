// The SwiftUI form uses the same table, calculation, Note and draft rules as the web.
globalThis.makeProjectCalculator = (configuration, parseHTML) => {
  const {source, blocks, excerpt, projectID, drafts} = JSON.parse(configuration);
  const table = occupantLoadTable(blocks, source, html => JSON.parse(parseHTML(html)));
  const sourceLabel = `BC § ${source.sectionNumber} · ${source.codeEdition}`;
  const context = JSON.stringify([projectID, source.sectionID, source.codeVersion, 'manual']);
  let raw = drafts;
  const store = calculationDraftStore({
    getItem: () => raw,
    setItem: (_, value) => { raw = value; }
  }, 'drafts');
  const resolve = input => occupantLoadTableInput({...input, customFactor: input.factor}, table);
  const calculate = input => {
    const result = calculateOccupantLoad(resolve(input));
    const spaceName = (input.spaceName || '').trim();
    const spaceLocation = input.spaceLocation || '';
    return {...result, fingerprint: JSON.stringify({
      spaceName, ...(spaceLocation ? {spaceLocation} : {}), input: result.input
    })};
  };
  const snapshot = record => ({
    record, recent: store.list(context), raw, result: calculate(record.input)
  });
  const actions = {
    rows: () => table.rows,
    open: ({id}) => snapshot(store.open(context, {}, id || null)),
    create: () => snapshot(store.create(context)),
    update: ({record, input}) => snapshot(store.update(record, resolve(input))),
    saved: ({record, note, fingerprint}) => snapshot(store.markSaved(record, note, fingerprint)),
    note: ({input, id, createdAt}) => {
      const calculation = calculate(input);
      const spaceName = (input.spaceName || '').trim();
      const body = calculationNoteBlocks(calculation, [{id, label: sourceLabel}], '', input.spaceLocation);
      if (spaceName) body.unshift({
        type: 'paragraph',
        content: [{type: 'text', text: `Space / room: ${spaceName}`, styles: {}}]
      });
      const result = calculation.input;
      const title = `Occupant load · ${spaceName || result.spaceFunction}${result.factorMode === 'custom' ? ' · Custom factor' : ''}`;
      return {id, createdAt, title, label: sourceLabel, exact: excerpt,
        blocks: body.map((block, index) => ({
          ...block, id: `${id}-${index}`, props: block.props || {}, children: []
        }))};
    }
  };
  return (action, payload) => JSON.stringify(actions[action](JSON.parse(payload)));
};
