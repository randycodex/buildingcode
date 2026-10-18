import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {canonicalReportRuns, normalizeReportRuns, reportRunsText, reportRunsDocument, reportDocumentRuns, reportRunsLines} from '../public/report-rich-text.js';
import {normalizeReportDraftBlock, normalizeReportManifestItem, stableReportJSON} from '../report-contract.mjs';
import {emptyNotebookDocument, validateNotebookDocument, renderNotebookDocumentHTML} from '../notebook-contract.mjs';
import {renderReportPDF} from '../report-pdf.mjs';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';

const runs = [{text:'A '},{text:'bold',bold:true},{text:' and '},{text:'highlighted',highlight:true},
  {text:' passage '},{text:'with italics',italic:true},{text:' and '},{text:'removed',strike:true},{text:' text. '},
  {text:'Source link',href:'https://example.com/source'}];
const text = reportRunsText(runs);
assert.deepEqual(reportDocumentRuns(reportRunsDocument(runs)),runs);
const block = normalizeReportDraftBlock({id:'rich',kind:'paragraph',text,richText:runs});
assert.deepEqual(block.richText,runs);
assert.deepEqual(normalizeReportManifestItem(block).richText,runs);
assert.equal(stableReportJSON(block),stableReportJSON(normalizeReportDraftBlock(JSON.parse(JSON.stringify(block)))));
assert.throws(()=>normalizeReportRuns([{text:'other'}],text),/does not match/);
for (const href of ['javascript:alert(1)','data:text/html,test','file:///etc/passwd']) {
  assert.throws(()=>canonicalReportRuns([{text:'link',href}]),/Invalid Report link/);
}
assert.throws(()=>canonicalReportRuns([{text:'x',highlight:'yellow'}]),/Invalid Report text style/);
assert.throws(()=>normalizeReportDraftBlock({kind:'heading',text:'heading',headingLevel:4}),/heading level/);
const list = normalizeReportDraftBlock({id:'list',kind:'list',items:[' First ','Second'],listStyle:'ordered',
  richText:[{text:' First \n',bold:true},{text:'Second',highlight:true}]});
assert.equal(reportRunsText(list.richText),'First\nSecond');
assert.equal(reportRunsLines(list.richText)[1][0].highlight,true);
assert.equal(list.listStyle,'ordered');
const note = emptyNotebookDocument();
note.document[0].content = [{type:'text',text:'Highlighted note',styles:{backgroundColor:'yellow',bold:true}}];
const validated = validateNotebookDocument(note).document;
assert.equal(validated.document[0].content[0].styles.backgroundColor,'yellow');
assert.match(renderNotebookDocumentHTML(validated),/<mark><strong>Highlighted note<\/strong><\/mark>/);
note.document[0].content[0].styles.backgroundColor='url(evil)';
assert.throws(()=>validateNotebookDocument(note),/unsupported style/);

const manifest = {id:'rich-text-check',contentHash:'synthetic',title:'Report formatting verification',createdAt:'2026-10-18T12:00:00Z',
  reportDate:'2026-10-18T12:00:00Z',reportVersion:1,project:{name:'Synthetic formatting check'},author:{displayName:'Local check'},disclaimers:[],
  items:[normalizeReportDraftBlock({id:'title',kind:'heading',headingLevel:2,text:'Formatted report',richText:[{text:'Formatted report',highlight:true}]}),block,list,
    {id:'long',kind:'paragraph',text:'',richText:[{text:('Long wrapped and highlighted text. ').repeat(160),highlight:true,italic:true}]}]};
const pdf = await renderReportPDF(manifest);
const task = getDocument({data:new Uint8Array(pdf),disableFontFace:true,useSystemFonts:false});
const document = await task.promise;
let exportedText = '', links = [], highlighted = false;
for (let index=1; index<=document.numPages; index++) {
  const page = await document.getPage(index);
  const content = await page.getTextContent(); exportedText += content.items.map(item=>item.str).join(' ');
  links.push(...(await page.getAnnotations()).filter(item=>item.subtype==='Link'));
  const ops = await page.getOperatorList();
  highlighted ||= ops.argsArray.some(value => value?.some?.(entry => entry === '#f4d35e'));
  for (const item of content.items) if (/Long|wrapped|highlighted|Source link|First|Second/.test(item.str || '')) assert(item.transform[5] > 30, `Authored runs cannot overflow the printable page: ${item.str}`);
}
assert.match(exportedText,/bold/); assert.match(exportedText,/highlighted/);
assert.match(exportedText,/1\.\s+First/); assert.match(exportedText,/2\.\s+Second/);
assert(links.some(link=>link.url==='https://example.com/source'));
assert(highlighted,'The PDF must contain the actual yellow highlight fill');
if (process.env.PERMITEXT_FORMATTING_PDF) await writeFile(process.env.PERMITEXT_FORMATTING_PDF,pdf);
await document.destroy();
console.log('Report formatting: safe marks/links, Note highlight, stable persistence, heading/list styles, PDF highlights/links, wrapping and pagination passed.');
