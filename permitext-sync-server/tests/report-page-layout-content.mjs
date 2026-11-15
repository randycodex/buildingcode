import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
import {getDocument, OPS, Util} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {renderReportPDF} from '../report-pdf.mjs';
import {reportPageFormats} from '../public/document-layout.js';

const runs = text => [{type: 'text', text, styles: {}}];
const table = (prefix, count) => ({type: 'table', content: {type: 'tableContent', headerRows: 1,
  rows: [{cells: [runs(`${prefix}Header`), runs('Value')]}, ...Array.from({length: count}, (_, n) => ({cells: [runs(`${prefix}Row${n}Token`), runs(`Value${n}`)]}))]}});
const image = await sharp({create: {width: 800, height: 500, channels: 3, background: '#d6e9f5'}}).png().toBuffer();
for (const [pageFormat, format] of Object.entries(reportPageFormats)) {
  const lines = Math.floor((format.height - 108 - 150) / 15);
  const manifest = {title: `${format.label} content pagination`, project: {name: 'Synthetic layout checks'},
    author: {displayName: 'Local check'}, reportDate: '2026-11-15', createdAt: '2026-11-15T12:00:00Z', reportVersion: 1, pageFormat,
    disclaimers: [], items: [
      {kind: 'paragraph', text: Array.from({length: lines}, (_, n) => `Leading line ${n}`).join('\n')},
      {kind: 'notebookCard', title: 'Tables and image', sourceClassification: 'user-authored', document: {document: [
        table('Small', 10), {type: 'image', props: {url: 'local-image', caption: 'Image kept on one page'}}, table('Long', 90)
      ]}}
    ]};
  const bytes = await renderReportPDF(manifest, {projectMaterialBySourceID: new Map([['local-image', {body: image}]])});
  const pdf = await getDocument({data: new Uint8Array(bytes), disableFontFace: true, useSystemFonts: false}).promise;
  const textPages = [], imageBoxes = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    textPages.push((await page.getTextContent()).items.map(item => item.str).join(' '));
    const operators = await page.getOperatorList(); let matrix = [1, 0, 0, 1, 0, 0]; const stack = [];
    for (let i = 0; i < operators.fnArray.length; i++) {
      const op = operators.fnArray[i], args = operators.argsArray[i];
      if (op === OPS.save) stack.push(matrix.slice());
      else if (op === OPS.restore) matrix = stack.pop();
      else if (op === OPS.transform) matrix = Util.transform(matrix, args);
      else if ([OPS.paintImageXObject, OPS.paintInlineImageXObject].includes(op)) {
        const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]]);
        imageBoxes.push(corners);
        for (const [x, y] of corners) {assert(x >= 53.9 && x <= format.width - 53.9); assert(y >= 53.9 && y <= format.height - 53.9);}
      }
    }
  }
  assert.equal(imageBoxes.length, 1, 'The image appears once and fits entirely within one printable page.');
  const first = textPages.findIndex(text => text.includes('SmallRow0Token'));
  assert.equal(textPages.findIndex(text => text.includes('SmallRow9Token')), first, 'A table that fits one page stays together.');
  const whole = textPages.join(' ');
  for (let n = 0; n < 90; n++) assert.equal(whole.split(`LongRow${n}Token`).length - 1, 1, 'Every large-table row appears once.');
  const longPages = textPages.filter(text => /LongRow\d+Token/.test(text));
  assert(longPages.length > 1);
  assert(longPages.every(text => text.includes('LongHeader')), 'Continued tables repeat their headers.');
  await pdf.destroy();
  if (process.env.PERMITEXT_REPORT_PAGE_QA_DIR) await writeFile(join(process.env.PERMITEXT_REPORT_PAGE_QA_DIR, `report-content-${pageFormat}.pdf`), bytes);
}
console.log('Report pagination content passed for Letter/A4/Legal/Tabloid: whole images within margins, small tables together, large tables between complete rows with repeated headers and no content loss.');
