import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {letterDocumentLayout as layout, applyLetterDocumentLayout} from '../public/document-layout.js';
import {renderReportPDF} from '../report-pdf.mjs';

const properties = new Map();
applyLetterDocumentLayout({style:{setProperty:(name,value)=>properties.set(name,value)}});
assert.equal(properties.get('--document-printable-width'),'672px');
assert.equal(properties.get('--document-printable-height'),'912px');
assert.equal(Number.parseFloat(properties.get('--document-printable-width')) / 96,7);
assert.equal(layout.width / 72,8.5);
assert.equal(layout.height / 72,11);
for (const name of ['DejaVuSans.ttf','DejaVuSans-Bold.ttf']) {
  const hash = data => createHash('sha256').update(data).digest('hex');
  assert.equal(hash(await readFile(new URL(`../public/fonts/${name}`,import.meta.url))),
    hash(await readFile(new URL(`../fonts/${name}`,import.meta.url))), 'The browser and PDF must use identical font metrics.');
}

const paragraph = 'Letter layout uses the same font, text measure, and spacing for Notes and Reports. ';
const notebook = {schema:'permitext-notebook-card',schemaVersion:2,format:'blocknote-json',document:[
  ...[1,2,3].map(level=>({type:'heading',props:{level},content:[{type:'text',text:`NoteHeading${level}`,styles:{}}]})),
  {type:'paragraph',content:[{type:'text',text:'NoteBodyFirst\nNoteBodySecond',styles:{}}]},
  {type:'paragraph',props:{lineSpacing:'2'},content:[{type:'text',text:'AuthoredFirst\nAuthoredSecond',styles:{fontSize:'18',bold:true}}]}
]};
const manifest = {id:'letter-layout-fixture',contentHash:'synthetic',title:'Letter layout verification',
  createdAt:'2026-11-14T12:00:00Z',reportDate:'2026-11-14T12:00:00Z',reportVersion:1,
  project:{name:'Local layout check'},author:{displayName:'Local check'},disclaimers:[],items:[
    ...[1,2,3].map(level=>({id:`h${level}`,kind:'heading',headingLevel:level,text:`ReportHeading${level}`})),
    {id:'body',kind:'paragraph',text:'ReportBodyFirst\nReportBodySecond'},
    {id:'note',kind:'paragraph',text:'',notebookDocument:notebook},
    ...Array.from({length:14},(_,index)=>({id:`long-${index}`,kind:'paragraph',text:paragraph.repeat(4)}))
  ]};
const pdf = await renderReportPDF(manifest);
const document = await getDocument({data:new Uint8Array(pdf),disableFontFace:true,useSystemFonts:false}).promise;
const items=[];
for(let index=1;index<=document.numPages;index++) {
  const page=await document.getPage(index), viewport=page.getViewport({scale:1});
  assert.equal(viewport.width,layout.width);assert.equal(viewport.height,layout.height);
  items.push(...(await page.getTextContent()).items);
}
const find = text => {const item=items.find(item=>item.str===text);assert(item,`Export contains ${text}`);return item;};
for(const prefix of ['Report','Note']) {
  for(const level of [1,2,3]) assert.equal(find(`${prefix}Heading${level}`).height,layout.headingSizes[level]);
  const first=find(`${prefix}BodyFirst`),second=find(`${prefix}BodySecond`);
  assert.equal(first.height,layout.bodySize);
  assert(Math.abs(first.transform[5]-second.transform[5]-layout.bodySize*layout.lineSpacing)<0.01,
    'Report and Note default lines must use the same vertical measure.');
}
const authoredFirst=find('AuthoredFirst'),authoredSecond=find('AuthoredSecond');
assert.equal(authoredFirst.height,18);
assert(Math.abs(authoredFirst.transform[5]-authoredSecond.transform[5]-36)<0.01,'Authored sizes and spacing remain intact.');
for(const item of items.filter(item=>item.str==='Letter' || item.str==='Reports.')) {
  assert(item.transform[4]>=layout.margin-0.1);
  assert(item.transform[4]+item.width<=layout.width-layout.margin+0.1,'Exported body text stays within the same printable measure.');
}
assert(document.numPages>3,'The fixture exercises multiple printable pages.');
await document.destroy();
if(process.env.DOCUMENT_LAYOUT_PDF_PATH) await writeFile(process.env.DOCUMENT_LAYOUT_PDF_PATH,pdf);
console.log('Letter layout passed: physical page size/margins, matching web/PDF fonts, shared Note/Report defaults and heading hierarchy, authored overrides, wrapping and multipage export.');
