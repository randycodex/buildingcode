// Notes expose one highlight color. Clipboard CSS colors must not create marks
// that the editor can display but the save contract cannot accept.
export function notebookHighlightColor(value) {
  if (typeof value !== 'string') return value;
  const color = value.trim().toLowerCase();
  if (['', 'default', 'transparent', 'none'].includes(color)) return 'default';
  if (/^[a-z]+$/.test(color) || /^#[\da-f]{3,8}$/.test(color) || /^(?:rgb|hsl)a?\([\d\s.,%/+-]+\)$/.test(color)) return 'yellow';
  return value;
}

export function normalizeNotebookStyles(styles) {
  if (!styles || typeof styles !== 'object' || Array.isArray(styles)) return styles;
  const result = {...styles};
  if (Object.hasOwn(result, 'backgroundColor')) {
    const color = notebookHighlightColor(result.backgroundColor);
    if (color === 'default') delete result.backgroundColor;
    else result.backgroundColor = color;
  }
  return result;
}

export function normalizeNotebookDocumentStyles(document) {
  const inline = content => Array.isArray(content) ? content.map(node => ({...node,
    ...(node.styles ? {styles:normalizeNotebookStyles(node.styles)} : {}),
    ...(Array.isArray(node.content) ? {content:inline(node.content)} : {})})) : content;
  const blocks = items => items.map(block => ({...block,
    ...(Array.isArray(block.content) ? {content:inline(block.content)} : block.type === 'table' && block.content?.rows ? {
      content:{...block.content,rows:block.content.rows.map(row => ({...row,cells:row.cells.map(cell =>
        Array.isArray(cell) ? inline(cell) : {...cell,content:inline(cell.content)})}))}
    } : {}),
    ...(block.children ? {children:blocks(block.children)} : {})}));
  return {...document,document:blocks(document.document || [])};
}
