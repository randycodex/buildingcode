// Portable authored text only. Code excerpts and Research snapshots never use
// this representation, and no arbitrary HTML or CSS is accepted.
export function reportLinkURL(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

export const reportRunsText = runs => (runs || []).map(run => run.text).join('');
const sameStyle = (a, b) => ['bold', 'italic', 'underline', 'strike', 'highlight', 'href'].every(key => a[key] === b[key]);
function compact(runs) {
  const result = [];
  for (const run of runs) {
    if (!run.text) continue;
    if (result.length && sameStyle(result.at(-1), run)) result.at(-1).text += run.text;
    else result.push({...run});
  }
  return result;
}
export function sliceReportRuns(runs, start, end) {
  let offset = 0;
  return compact(runs.flatMap(run => {
    const from = Math.max(0, start - offset), to = Math.min(run.text.length, end - offset);
    offset += run.text.length;
    return to > from ? [{...run, text: run.text.slice(from, to)}] : [];
  }));
}
function trimRuns(runs) {
  const text = reportRunsText(runs);
  return sliceReportRuns(runs, text.length - text.trimStart().length, text.trimEnd().length);
}
export function reportRunsLines(runs) {
  const text = reportRunsText(runs);
  let start = 0;
  return text.split('\n').map(line => {
    const value = sliceReportRuns(runs, start, start + line.length);
    start += line.length + 1;
    return value;
  });
}
export function canonicalReportRuns(value, {list = false} = {}) {
  if (!Array.isArray(value) || value.length > 5000) throw new Error('Invalid Report formatting.');
  let total = 0;
  let runs = value.map(run => {
    if (!run || typeof run.text !== 'string') throw new Error('Invalid Report formatted text.');
    total += run.text.length;
    if (total > 210000) throw new Error('Report formatted text is too long.');
    const result = {text: run.text};
    for (const key of ['bold', 'italic', 'underline', 'strike', 'highlight']) {
      if (run[key] !== undefined && typeof run[key] !== 'boolean') throw new Error('Invalid Report text style.');
      if (run[key]) result[key] = true;
    }
    if (run.href) {
      if (typeof run.href !== 'string' || run.href.length > 2048 || !reportLinkURL(run.href)) throw new Error('Invalid Report link.');
      result.href = reportLinkURL(run.href);
    }
    return result;
  });
  if (list) {
    const lines = reportRunsLines(runs).map(trimRuns).filter(line => reportRunsText(line));
    runs = lines.flatMap((line, index) => index ? [{text:'\n'}, ...line] : line);
  }
  return compact(trimRuns(runs));
}
export function normalizeReportRuns(value, expectedText, list = false) {
  const runs = canonicalReportRuns(value, {list});
  if (reportRunsText(runs) !== expectedText) throw new Error('Report formatting does not match its text.');
  return runs;
}
export function reportBlockRuns(block) {
  const text = block.kind === 'list' ? (block.items || []).join('\n') : block.text || '';
  return block.richText || [{text}];
}
export function reportRunsDocument(runs) {
  return {type:'doc', content:reportRunsLines(runs).map(line => ({type:'paragraph', content:line.map(run => ({
    type:'text', text:run.text,
    marks:[...['bold','italic','underline','strike','highlight'].filter(key => run[key]).map(type => ({type})),
      ...(run.href ? [{type:'link', attrs:{href:run.href}}] : [])]
  }))}))};
}
export function reportDocumentRuns(doc) {
  return compact((doc.content || []).flatMap((paragraph, index) => [
    ...(index ? [{text:'\n'}] : []),
    ...(paragraph.content || []).map(node => {
      const run = {text:node.type === 'hardBreak' ? '\n' : node.text || ''};
      for (const mark of node.marks || []) {
        if (['bold','italic','underline','strike','highlight'].includes(mark.type)) run[mark.type] = true;
        if (mark.type === 'link' && reportLinkURL(mark.attrs?.href)) run.href = reportLinkURL(mark.attrs.href);
      }
      return run;
    })
  ]));
}
