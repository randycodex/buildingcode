import assert from 'node:assert/strict';
import {emptyNotebookDocument, validateNotebookDocument, renderNotebookDocumentHTML} from '../notebook-contract.mjs';
import {notebookFontSize, notebookTextColors} from '../public/notebook-styles.js';
import {renderReportPDF} from '../report-pdf.mjs';
import {getDocument, OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';

const note = {...emptyNotebookDocument(), document:[{
  type:'paragraph', props:{lineSpacing:'2'}, content:[
    {type:'text', text:'Large first line\nLarge second line', styles:{fontSize:'18', bold:true, textColor:'blue'}},
    {type:'link', href:'https://example.com', content:[{type:'text', text:' linked', styles:{fontSize:'12',italic:true,textColor:'red'}}]}
  ]
}, {type:'table', content:{type:'tableContent',headerRows:1,rows:[
  {cells:[[{type:'text',text:'Header',styles:{fontSize:'14'}}],[]]},
  {cells:[[{type:'text',text:'Cell',styles:{fontSize:'10'}}],[]]}
]}}]};
const saved=validateNotebookDocument(note).document;
assert.deepEqual(validateNotebookDocument(JSON.parse(JSON.stringify(saved))).document,saved);
assert.equal(saved.document[0].props.lineSpacing,'2');
assert.equal(saved.document[0].content[0].styles.fontSize,'18');
assert.equal(saved.document[0].content[0].styles.textColor,'blue');
assert.equal(saved.document[0].content[1].content[0].styles.textColor,'red');
assert.equal(saved.document[1].content.rows[0].cells[0][0].styles.fontSize,'14');
const html=renderNotebookDocumentHTML(saved);
assert.match(html,/<p style="line-height:2">/);
assert.match(html,/font-size:18pt/);
assert.ok(html.includes(`data-notebook-text-color="blue" style="color:${notebookTextColors.blue.light}"`));
assert.match(html,/<th><span style="font-size:14pt">Header<\/span><\/th>/);
assert.match(html,/href="https:\/\/example.com\/?"/);
assert.equal(notebookFontSize('24px'),'18');
assert.equal(notebookFontSize('12.5pt'),'12.5');
for(const value of ['0','7','49','100','NaN','18; color:red','calc(18px)','url(evil)']) {
  const invalid=structuredClone(note); invalid.document[0].content[0].styles.fontSize=value;
  assert.throws(()=>validateNotebookDocument(invalid),/font size/);
}
for (const value of ['url(evil)', '#123456', 'blue; font-size:40px', 'constructor', null]) {
  const invalid = structuredClone(note);
  invalid.document[0].content[0].styles.textColor = value;
  assert.throws(() => validateNotebookDocument(invalid), /text color/);
}
const defaultColor = structuredClone(note);
defaultColor.document[0].content[0].styles.textColor = 'default';
assert.equal(validateNotebookDocument(defaultColor).document.document[0].content[0].styles.textColor, undefined);
for(const value of ['0','3','2; color:red',2]) {
  const invalid=structuredClone(note); invalid.document[0].props.lineSpacing=value;
  assert.throws(()=>validateNotebookDocument(invalid),/line spacing/);
}
const normal=structuredClone(note); normal.document[0].props.lineSpacing='normal';
assert.equal(validateNotebookDocument(normal).document.document[0].props.lineSpacing,undefined);

const manifest={id:'note-typography',contentHash:'synthetic',title:'Typography check',createdAt:'2026-11-14T12:00:00Z',
  reportDate:'2026-11-14T12:00:00Z',reportVersion:1,project:{name:'Synthetic'},author:{displayName:'Local check'},disclaimers:[],
  items:[{id:'note',kind:'paragraph',text:'',notebookDocument:saved}]};
const pdf=await renderReportPDF(manifest);
const document=await getDocument({data:new Uint8Array(pdf),disableFontFace:true,useSystemFonts:false}).promise;
const items=[];
const fillColors = [];
for (let page = 1; page <= document.numPages; page++) {
  const pdfPage = await document.getPage(page);
  items.push(...(await pdfPage.getTextContent()).items);
  const {fnArray, argsArray} = await pdfPage.getOperatorList();
  fillColors.push(...argsArray.filter((_, index) => fnArray[index] === OPS.setFillRGBColor).flat());
}
const [first,second]=items.filter(item=>/^Large\b/.test(item.str));
assert(first && second,'Both authored lines must be in the exported Note');
assert.equal(first.height,18,'The PDF must retain the authored font size');
assert(Math.abs(first.transform[5]-second.transform[5]-36)<0.1,'Double spacing must use the authored 18 pt font');
assert(items.some(item=>item.str==='Header' && item.height===14),'Table cells must retain font size');
assert(fillColors.includes(notebookTextColors.blue.light) && fillColors.includes(notebookTextColors.red.light),
  'The PDF renders authored text and link colors.');
await document.destroy();
console.log('Notebook typography: save/reopen, safe HTML, table cells, and PDF fonts, spacing and colors passed.');
