// PDF points are physical print units; CSS pixels use 96 px per inch.
// Keep the writing measure and default type shared with the Letter exporter.
export const letterDocumentLayout = Object.freeze({
  width: 612, height: 792, margin: 54,
  bodySize: 10, lineSpacing: 1.5, paragraphGap: 10,
  headingSizes: Object.freeze({1: 17, 2: 14, 3: 12}),
  noteTitleSize: 12, reportTitleSize: 28,
  tableSize: 8, tableLineSpacing: 1.3
});

export function applyLetterDocumentLayout(root) {
  const page = letterDocumentLayout;
  const px = points => `${points * 96 / 72}px`;
  const properties = {
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
