export const notebookFontSizes = Object.freeze(['8','9','10','11','12','14','16','18','20','24','28','32','36','48']);
export const notebookLineSpacings = Object.freeze(['normal','1','1.15','1.5','2']);
export const notebookTextColors = Object.freeze({
  gray: {label: 'Gray', light: '#5f626a', dark: '#b6bac4'},
  red: {label: 'Red', light: '#ad252b', dark: '#ff8b89'},
  orange: {label: 'Orange', light: '#a34f0c', dark: '#ffae6e'},
  yellow: {label: 'Yellow', light: '#796006', dark: '#f0d06c'},
  green: {label: 'Green', light: '#26683d', dark: '#82d99d'},
  blue: {label: 'Blue', light: '#275bb0', dark: '#8bbcff'},
  purple: {label: 'Purple', light: '#6943a4', dark: '#c8a5ff'},
  pink: {label: 'Pink', light: '#9c3972', dark: '#f3a0d0'}
});

export function notebookTextColor(value) {
  return typeof value === 'string' && Object.hasOwn(notebookTextColors, value) ? notebookTextColors[value] : undefined;
}

export function notebookFontSize(value) {
  if (typeof value !== 'string' || !/^\d{1,2}(?:\.5)?(?:pt|px)?$/i.test(value.trim())) return undefined;
  const text=value.trim().toLowerCase();
  const points=parseFloat(text)*(text.endsWith('px')?0.75:1);
  const size=Math.round(points*2)/2;
  return size>=8&&size<=48?String(size):undefined;
}

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
