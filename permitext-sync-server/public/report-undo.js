// Session history contains editable content only. Saving and undoing never
// rewind the Report's server ID, revision, or issued versions.
// Empty authoring placeholders contain no saved content. In particular,
// undoing the first words in a new paragraph must remain a saveable draft.
export const reportContentBlocks = blocks => blocks.filter(block=>{
  const runs = (block.richText || []).some(run=>run.text?.trim());
  if (['heading','paragraph'].includes(block.kind)) return Boolean(block.text?.trim() || runs);
  if (block.kind === 'list') return Boolean((block.items || []).some(item=>item.trim()) || runs);
  return true;
});
const content = draft => JSON.stringify({title:String(draft.title || '').trim(),
  reportDate:Number.isFinite(Date.parse(draft.reportDate)) ? new Date(draft.reportDate).toISOString() : draft.reportDate,
  introduction:String(draft.introduction || '').trim(), blocks:reportContentBlocks(draft.blocks).map(({order,sourceClassification,...block})=>{
    if (typeof block.text === 'string') block.text = block.text.trim();
    if (typeof block.label === 'string') block.label = block.label.trim().slice(0,500);
    if (block.items) block.items = block.items.map(item=>item.trim()).filter(Boolean);
    if (block.listStyle === 'bullet') delete block.listStyle;
    if (!block.excludedCommentKeys?.length) delete block.excludedCommentKeys;
    return block;
  })}, (_key,value)=>value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))) : value);

export function createReportUndo({limit = 100, maxBytes = 12000000, now = Date.now} = {}) {
  let owner = null, present = '', previous = [], future = [], group = null, changedAt = 0;
  const reset = draft => {
    owner = draft; present = content(draft); previous = []; future = []; group = null; changedAt = 0;
  };
  const bind = draft => {
    if (owner === draft) return;
    // A clean server refresh may replace the object after autosave. Retain
    // history only when both the saved identity and editable content match.
    if (owner?.id && owner.id === draft.id && present === content(draft)) owner = draft;
    else reset(draft);
  };
  const trim = stack => {
    let bytes = stack.reduce((total,item)=>total+item.length,0);
    while (stack.length > limit || bytes > maxBytes) bytes -= stack.shift().length;
  };
  return {
    bind,
    record(draft, editGroup = null) {
      bind(draft);
      const next = content(draft);
      if (next === present) return;
      const time = now();
      if (!editGroup || group !== editGroup || !previous.length || time-changedAt > 600 || time < changedAt) previous.push(present);
      present = next; future = []; group = editGroup; changedAt = time; trim(previous);
    },
    canUndo(draft) {bind(draft); return previous.length > 0;},
    canRedo(draft) {bind(draft); return future.length > 0;},
    undo(draft) {
      bind(draft);
      if (!previous.length) return null;
      future.push(present); present = previous.pop(); group = null; trim(future);
      return JSON.parse(present);
    },
    redo(draft) {
      bind(draft);
      if (!future.length) return null;
      previous.push(present); present = future.pop(); group = null; trim(previous);
      return JSON.parse(present);
    },
    clear() {owner = null; present = ''; previous = []; future = []; group = null;}
  };
}
