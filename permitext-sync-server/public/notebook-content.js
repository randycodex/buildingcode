export const notebookCellContent = cell => Array.isArray(cell) ? cell : cell?.content || [];
export function notebookInlineText(content) {
  return (Array.isArray(content) ? content : []).map(node => node.type === 'text' ? node.text : node.type === 'link'
    ? notebookInlineText(node.content) : node.type === 'permitextReference' ? node.props?.label || '' : '').join('');
}
export function notebookContentText(document) {
  const text = block => [block.type === 'table'
    ? block.content.rows.map(row => row.cells.map(cell => notebookInlineText(notebookCellContent(cell))).join(' | ')).join('\n')
    : block.type === 'image' ? block.props?.caption || block.props?.name || 'Image' : notebookInlineText(block.content),
    ...(block.children || []).map(text)].filter(Boolean).join('\n');
  return (document?.document || []).map(text).filter(Boolean).join('\n\n');
}

export function notebookTableDisplayData(table, {preserveInlineContent = false} = {}) {
  const grid = [];
  table.rows.forEach((row, r) => {
    grid[r] ||= [];
    let column = 0;
    for (const cell of row.cells) {
      while (grid[r][column] !== undefined) column++;
      const value = preserveInlineContent ? notebookCellContent(cell) : notebookInlineText(notebookCellContent(cell));
      for (let dr = 0; dr < (cell.props?.rowspan || 1); dr++) for (let dc = 0; dc < (cell.props?.colspan || 1); dc++) {
        grid[r + dr] ||= []; grid[r + dr][column + dc] = value;
      }
      column += cell.props?.colspan || 1;
    }
  });
  const columns = Math.max(...grid.map(row => row.length));
  const rows = grid.map(row => Array.from({length:columns}, (_, c) => row[c] ?? (preserveInlineContent ? [] : '')));
  const headers = table.headerRows || 0;
  const combinedHeader = column => {
    if (!preserveInlineContent) return [...new Set(rows.slice(0,headers).map(row => row[column]).filter(Boolean))].join('\n');
    const cells = [...new Map(rows.slice(0,headers).map(row => row[column]).filter(cell => cell.length)
      .map(cell => [JSON.stringify(cell), cell])).values()];
    return cells.flatMap((cell,index) => index ? [{type:'text',text:'\n',styles:{}}, ...cell] : cell);
  };
  if (headers > 1) return {rows:[Array.from({length:columns}, (_, c) => combinedHeader(c)),
    ...rows.slice(headers)], headerRowCount:1};
  return {rows, headerRowCount:headers};
}

// The editable presentation copy stays separate from the exact evidence locator.
export function notebookBlocksFromSourceElement(root) {
  const inline = (node, styles = {}) => {
    if (node.nodeType === 3) return [{type:'text', text:node.textContent.replace(/[\t\r\n ]+/g, ' '), styles}];
    if (node.nodeType !== 1 || ['SCRIPT','STYLE'].includes(node.tagName) || node.matches('[data-research-selection-exclude], .inline-bookmark-toggle, .inline-note-toggle')) return [];
    if (node.tagName === 'BR') return [{type:'text', text:'\n', styles}];
    const next = {...styles, ...(['B','STRONG'].includes(node.tagName) ? {bold:true} : {}), ...(['I','EM'].includes(node.tagName) ? {italic:true} : {})};
    const content = [...node.childNodes].flatMap(child => inline(child, next));
    if (node.tagName === 'A' && /^(https?:|mailto:)/i.test(node.href)) return [{type:'link', href:node.href, content}];
    return content;
  };
  const blocks = [];
  const visit = node => {
    if (node.nodeType === 1 && node.tagName === 'TABLE') {
      if (node.caption?.textContent.trim()) blocks.push({type:'paragraph',content:inline(node.caption)});
      const rows = [...node.rows].map(row => ({cells:[...row.cells].map(cell => ({type:'tableCell',
        props:{colspan:cell.colSpan || 1,rowspan:cell.rowSpan || 1},content:inline(cell)}))}));
      const firstBody = [...node.rows].findIndex(row => ![...row.cells].every(cell => cell.tagName === 'TH'));
      const mergedHeaderRows = Math.max(1, ...[...(node.rows[0]?.cells || [])].map(cell => cell.rowSpan || 1));
      if (rows.length) blocks.push({type:'table',content:{type:'tableContent',rows,
        headerRows:node.tHead?.rows.length || (firstBody < 0 ? rows.length : firstBody) || Math.min(mergedHeaderRows, rows.length)}});
      return;
    }
    if (node.nodeType === 1 && (node.querySelector('table') || !['P','LI','H1','H2','H3','H4','H5','H6'].includes(node.tagName) && [...node.children].some(child => /^(P|DIV|UL|OL|TABLE|H[1-6])$/.test(child.tagName)))) {
      [...node.childNodes].forEach(visit); return;
    }
    const content = inline(node);
    if (notebookInlineText(content).trim()) blocks.push({type: /^H[1-6]$/.test(node.tagName || '') ? 'heading' : node.tagName === 'LI' ? 'bulletListItem' : 'paragraph',
      ...(/^H[1-6]$/.test(node.tagName || '') ? {props:{level:Number(node.tagName[1])}} : {}), content});
  };
  [...root.childNodes].forEach(visit);
  return blocks;
}
