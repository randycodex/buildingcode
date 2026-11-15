// PDF points are physical print units; CSS pixels use 96 px per inch.
// Keep the writing measure and default type shared with the Letter exporter.
export const letterDocumentLayout = Object.freeze({
  width: 612, height: 792, margin: 54,
  bodySize: 10, lineSpacing: 1.5, paragraphGap: 10,
  headingSizes: Object.freeze({1: 17, 2: 14, 3: 12}),
  noteTitleSize: 12, reportTitleSize: 28,
  tableSize: 8, tableLineSpacing: 1.3
});

export const reportPageFormats = Object.freeze({
  letter: Object.freeze({label: 'Letter', dimensions: '8.5 × 11 in', width: 612, height: 792}),
  a4: Object.freeze({label: 'A4', dimensions: '210 × 297 mm', width: 595.275590551, height: 841.88976378}),
  legal: Object.freeze({label: 'Legal', dimensions: '8.5 × 14 in', width: 612, height: 1008}),
  tabloid: Object.freeze({label: 'Tabloid', dimensions: '11 × 17 in', width: 792, height: 1224})
});

export function normalizeReportPageFormat(value = 'letter') {
  if (!Object.hasOwn(reportPageFormats, value)) throw new Error('Choose Letter, A4, Legal, or Tabloid paper.');
  return value;
}

export function reportDocumentLayout(format = 'letter') {
  return {...letterDocumentLayout, ...reportPageFormats[normalizeReportPageFormat(format)]};
}

export function applyDocumentLayout(root, format = 'letter') {
  const page = reportDocumentLayout(format);
  const px = points => `${points * 96 / 72}px`;
  const properties = {
    '--document-page-width': px(page.width),
    '--document-page-height': px(page.height),
    '--document-printable-width': px(page.width - 2 * page.margin),
    '--document-printable-height': px(page.height - 2 * page.margin),
    '--document-body-size': `${page.bodySize}pt`,
    '--document-line-spacing': String(page.lineSpacing),
    '--document-paragraph-gap': `${page.paragraphGap}pt`,
    '--document-note-title-size': `${page.noteTitleSize}pt`,
    '--document-report-title-size': `${page.reportTitleSize}pt`,
    '--document-table-size': `${page.tableSize}pt`,
    '--document-table-line-spacing': String(page.tableLineSpacing)
  };
  for (const [level, size] of Object.entries(page.headingSizes)) properties[`--document-heading-${level}-size`] = `${size}pt`;
  for (const [name, value] of Object.entries(properties)) root.style.setProperty(name, value);
}

export const applyLetterDocumentLayout = root => applyDocumentLayout(root, 'letter');
