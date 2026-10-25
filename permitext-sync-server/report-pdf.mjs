import PDFDocument from "pdfkit";
import { fileURLToPath } from "node:url";
import { reportEvidenceDisplayText, reportCodeBasisLines, reportEvidenceEdition, reportFactPresentation, reportItemPreview } from "./report-presentation.mjs";
import { reportBlockRuns, reportRunsLines } from "./public/report-rich-text.js";
import { sourceFormattingRuns, sourceTextStyles } from "./public/report-source-formatting.js";

const colors = Object.freeze({
  ink: "#171717",
  muted: "#626262",
  rule: "#d8d3cd",
  accent: "#a65318",
  publishedCode: "#f4e9dc",
  userAuthored: "#f0edf7",
  aiAssisted: "#e9eef9",
  projectMaterial: "#edf2ee",
  paper: "#ffffff"
});

const classificationLabels = Object.freeze({
  "published-code": "Published code",
  "user-authored": "User-authored",
  "ai-assisted": "AI-assisted Research",
  "project-material": "Project material"
});

const classificationColors = Object.freeze({
  "published-code": colors.publishedCode,
  "user-authored": colors.userAuthored,
  "ai-assisted": colors.aiAssisted,
  "project-material": colors.projectMaterial
});

function reportDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: "UTC"
  }).format(date);
}

function stringList(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function reportPresentation(manifest) {
  const accent = String(manifest.presentation?.branding?.accentColorHex || "").trim().toLowerCase();
  return {
    accent: /^#[0-9a-f]{6}$/.test(accent) ? accent : colors.accent,
    coverLabel: manifest.presentation?.template?.coverLabel || "Permitext Project Report",
    displayName: manifest.presentation?.branding?.displayName || "Permitext",
    website: manifest.presentation?.branding?.website || "",
    footerText: manifest.presentation?.branding?.footerText || ""
  };
}

function ensureVerticalSpace(document, height = 72) {
  if (document.y + height <= document.page.height - document.page.margins.bottom) return;
  document.addPage();
}

function reserveHeading(document, title, body = "", { size = 9, gap = 4, bodySize = 9.5 } = {}) {
  const width = document.page.width - document.page.margins.left - document.page.margins.right;
  document.font("Report-Bold").fontSize(size);
  const heading = document.heightOfString(title, { width, paragraphGap: gap });
  document.font("Report-Regular").fontSize(bodySize);
  const firstParagraph = String(body || "").split(/\n\s*\n/)[0];
  const first = document.heightOfString(firstParagraph || "Text", { width, lineGap: 2 });
  ensureVerticalSpace(document, heading + gap + Math.min(80, Math.max(55, first)));
}

function drawTextSection(document, title, body) {
  if (!String(body || "").trim()) return;
  reserveHeading(document, title, body);
  document.fillColor(colors.ink).font("Report-Bold").fontSize(9).text(title, { paragraphGap: 4 });
  document.font("Report-Regular").fontSize(9.5).text(body, { lineGap: 2, paragraphGap: 8 });
}

function drawClassification(document, classification) {
  document.font("Report-Regular").fontSize(7.5).fillColor(colors.muted)
    .text((classificationLabels[classification] || "Project material").toUpperCase(), {paragraphGap:6});
}

function drawList(document, title, values) {
  const items = stringList(values);
  if (!items.length) return;
  reserveHeading(document, title.toUpperCase(), items[0], { size: 8.5 });
  document
    .fillColor(colors.ink)
    .font("Report-Bold")
    .fontSize(8.5)
    .text(title.toUpperCase(), { characterSpacing: 0.6 });
  document.moveDown(0.35);
  items.forEach((item) => {
    document
      .fillColor(colors.ink)
      .font("Report-Regular")
      .fontSize(9.5)
      .text(`- ${item}`, { indent: 8, paragraphGap: 4 });
  });
  document.moveDown(0.25);
}

// Paginate complete rows explicitly: PDFKit's automatic table breaks do not
// repeat headers. Measure using the same font, width and padding as rendering.
export function drawReportTable(document, table, startX, contentWidth) {
  const rows = table.rows || [];
  if (!rows.length) return;
  const columns = Math.max(...rows.map(row => row.length));
  const width = contentWidth / columns;
  const headers = rows.slice(0, table.headerRowCount || 0);
  const measure = row => Math.max(...row.map(value =>
    document.heightOfString(value, {width: width - 10, lineGap: 0}))) + 12;
  const heights = rows.map(measure);
  const headerHeight = heights.slice(0,headers.length).reduce((sum,height) => sum + height,0);
  let position = headers.length;
  while (position < rows.length || position === headers.length && position === rows.length) {
    const bottom = document.page.height - document.page.margins.bottom - 2;
    if (document.y + headerHeight + (heights[position] || 0) > bottom) document.addPage();
    let height = headerHeight;
    const pageRows = [...headers];
    const pageHeights = heights.slice(0,headers.length);
    while (position < rows.length) {
      const next = heights[position];
      if (document.y + height + next > bottom) {
        if (pageRows.length === headers.length) throw new Error("A Report table row is too tall for a PDF page. Narrow the selection before exporting.");
        break;
      }
      pageRows.push(rows[position]); pageHeights.push(next); height += next; position++;
    }
    document.table({position:{x:startX},maxWidth:contentWidth,
      defaultStyle:{border:0.5,borderColor:colors.rule,padding:5,textOptions:{lineGap:0}},
      rowStyles:index => ({height:pageHeights[index], ...(index < headers.length ? {backgroundColor:'#f0f0f0'} : {})}),
      data:pageRows});
    document.x = startX;
    if (position >= rows.length) break;
    document.addPage();
  }
}

function drawSourceItem(document, item, projectMaterialBySourceID, presentation, showClassification = true) {
  const width = document.page.width - document.page.margins.left - document.page.margins.right;
  document.font("Report-Bold").fontSize(12);
  const sourceTitle = item.reportTitle || item.title || (item.kind === "researchAnswer" && item.question?.length > 96
    ? `${item.question.slice(0, 95).trimEnd()}…` : item.question) || "Project content";
  const titleHeight = document.heightOfString(sourceTitle, { width, paragraphGap: 7 });
  document.font("Report-Regular").fontSize(9.5);
  const calculationHeight = item.kind === "notebookCard" && item.cardType === "calculation"
    ? document.heightOfString(item.plainText || "", { width, lineGap: 2, paragraphGap: 8 }) + titleHeight + 55 : 0;
  const pageSpace = document.page.height - document.page.margins.top - document.page.margins.bottom;
  ensureVerticalSpace(document, calculationHeight && calculationHeight < pageSpace ? calculationHeight : Math.max(105, titleHeight + 65));
  const startX = document.x;
  const contentWidth = document.page.width - document.page.margins.left - document.page.margins.right;
  if (showClassification) drawClassification(document, item.sourceClassification);

  const formatted = annotatedSourceParts(item);
  if (hasSourceMarks(formatted)) {
    const question = formatted.find(part=>part.label === 'Question');
    const title = item.kind === 'evidence' ? `${item.codeBook} ${item.sectionNumber}: ${item.title}` : sourceTitle;
    const questionIsTitle = title === item.question;
    drawReportRichText(document,questionIsTitle && question ? question.runs : [{text:title}],{size:12,bold:true,paragraphGap:7});
    if (item.kind === 'evidence') document.font('Report-Regular').fontSize(9).fillColor(colors.muted)
      .text(`Edition: ${reportEvidenceEdition(item)}`,{paragraphGap:8});
    for (const part of formatted) {
      if (part === question && questionIsTitle) continue;
      if (part.kind === 'table') {
        drawFormattedSourceTable(document,part,item.sourceFormatting,startX,contentWidth);
        document.moveDown(0.7);
      } else {
        if (part.label) {
          reserveHeading(document, part.label, part.text);
          document.fillColor(colors.ink).font('Report-Bold').fontSize(9).text(part.label,{paragraphGap:4});
        }
        drawReportRichText(document,part.runs,{size:9.5,paragraphGap:8});
      }
    }
  } else if (item.kind === "evidence") {
    document
      .fillColor(colors.ink)
      .font("Report-Bold")
      .fontSize(12)
      .text(`${item.codeBook} ${item.sectionNumber}: ${item.title}`, { paragraphGap: 4 });
    document.font("Report-Regular").fontSize(9).fillColor(colors.muted)
      .text(`Edition: ${reportEvidenceEdition(item)}`, { paragraphGap: 8 });
    document.font("Report-Regular").fontSize(9.5).fillColor(colors.ink);
    let remaining = item.passageText;
    for (const table of item.tables || []) {
      const index = remaining.indexOf(table.text);
      if (index < 0) continue;
      if (remaining.slice(0,index).trim()) document.text(reportEvidenceDisplayText(remaining.slice(0,index).trim()), {width:contentWidth,lineGap:2,paragraphGap:8});
      ensureVerticalSpace(document, 90);
      document.font("Report-Regular").fontSize(8);
      drawReportTable(document, table, startX, contentWidth);
      document.x = startX;
      document.moveDown(0.7).font("Report-Regular").fontSize(9.5);
      remaining = remaining.slice(index + table.text.length);
    }
    if (remaining.trim()) document.text(reportEvidenceDisplayText(remaining.trim()), {width:contentWidth,lineGap:2,paragraphGap:8});
  } else if (item.kind === "notebookCard") {
    document
      .fillColor(colors.ink)
      .font("Report-Bold")
      .fontSize(12)
      .text(item.title, { paragraphGap: 7 });
    if (item.plainText) {
      document
        .font("Report-Regular")
        .fontSize(9.5)
        .text(item.plainText, { lineGap: 2, paragraphGap: 8 });
    }
  } else if (item.kind === "researchAnswer") {
    const title = item.reportTitle || (item.question.length > 96 ? `${item.question.slice(0, 95).trimEnd()}…` : item.question);
    reserveHeading(document, title, item.conclusion, { size: 12, gap: 7 });
    document.fillColor(colors.ink).font("Report-Bold").fontSize(12).text(title, { paragraphGap: 7 });
    for (const part of reportItemPreview(item)) drawTextSection(document, part.label, part.text);

  } else {
    document
      .fillColor(colors.ink)
      .font("Report-Bold")
      .fontSize(12)
      .text(item.title || "Project material", { paragraphGap: 7 });
    const material = projectMaterialBySourceID.get(item.sourceID);
    if (item.kind === "workboardPreview" && material?.body) {
      try {
        ensureVerticalSpace(document, 240);
        document.image(material.body, {
          fit: [contentWidth, 360],
          align: "center"
        });
        document.moveDown(0.6);
      } catch {
        document
          .font("Report-Regular")
          .fontSize(9.5)
          .text("The stored Workboard preview could not be rendered.", { paragraphGap: 8 });
      }
    } else {
      document
        .font("Report-Regular")
        .fontSize(9.5)
        .text(item.contentType || "Included Project material", { paragraphGap: 8 });
    }
  }

  document.x = startX;
  document
    .moveDown(0.4)
    .strokeColor(colors.rule)
    .lineWidth(0.5)
    .moveTo(startX, document.y)
    .lineTo(startX + contentWidth, document.y)
    .stroke()
    .moveDown(1);
}

function drawCover(document, manifest) {
  const presentation = reportPresentation(manifest);
  const contentWidth = document.page.width - document.page.margins.left - document.page.margins.right;
  document.moveDown(4);
  document
    .fillColor(presentation.accent)
    .font("Report-Bold")
    .fontSize(9)
    .text(presentation.coverLabel.toUpperCase(), { characterSpacing: 1.25 });
  if (presentation.displayName.toLowerCase() !== presentation.coverLabel.toLowerCase()) {
    document
      .moveDown(0.5)
      .fillColor(colors.muted)
      .font("Report-Regular")
      .fontSize(8)
      .text(
        [presentation.displayName, presentation.website].filter(Boolean).join("  /  "),
        { characterSpacing: 0.25 }
      );
  }
  document.moveDown(1.4);
  document
    .fillColor(colors.ink)
    .font("Report-Bold")
    .fontSize(28)
    .text(manifest.title, { width: contentWidth, lineGap: 3 });
  document.moveDown(1.2);
  document
    .font("Report-Bold")
    .fontSize(16)
    .text(manifest.project?.name || "Project");
  const metadata = [
    manifest.project?.address,
    reportDate(manifest.reportDate),
    manifest.author?.displayName,
    `Report version ${manifest.reportVersion}`,
    ...reportCodeBasisLines(manifest)
  ].filter(Boolean);
  document.moveDown(0.8);
  document
    .fillColor(colors.muted)
    .font("Report-Regular")
    .fontSize(10)
    .text(metadata.join("  /  "), { lineGap: 3 });
  document.moveDown(3);
  Object.keys(classificationLabels).forEach((classification) => {
    drawClassification(document, classification);
  });
  document.moveDown(2);
  document
    .fillColor(colors.muted)
    .font("Report-Regular")
    .fontSize(8)
    .text(`Manifest ${manifest.id}\nSHA-256 ${manifest.contentHash}`, {
      lineGap: 3
    });
}

// Lay out authored runs explicitly so marks, links and printed highlights stay
// attached to their text across wrapping and page breaks.
export function drawReportRichText(document, runs, {size = 10, bold = false, paragraphGap = 10, indent = 0, prefix = "",
  left = document.page.margins.left + indent, width = document.page.width - document.page.margins.right - left,
  lineHeight = size * 1.5, paginate = true, measureOnly = false} = {}) {
  let line = [], used = 0, measuredHeight = 0;
  const measure = run => document.font(run.bold || bold ? "Report-Bold" : "Report-Regular").fontSize(size).widthOfString(run.text);
  const flush = () => {
    measuredHeight += lineHeight;
    if (measureOnly) {line = []; used = 0; return;}
    if (paginate) ensureVerticalSpace(document, lineHeight + 2);
    const top = document.y;
    let x = left;
    for (const run of line) {
      const runWidth = measure(run);
      if (run.highlight) document.save().fillColor("#f4d35e").fillOpacity(0.5).rect(x, top + 1, runWidth, size * 1.25).fill().restore();
      document.fillColor(colors.ink).font(run.bold || bold ? "Report-Bold" : "Report-Regular").fontSize(size)
        .text(run.text, x, top, {lineBreak:false, oblique:run.italic || false, strike:run.strike || false,
          underline:run.underline || Boolean(run.href), ...(run.href ? {link:run.href} : {})});
      x += runWidth;
    }
    document.x = document.page.margins.left;
    document.y = top + lineHeight;
    line = []; used = 0;
  };
  const append = run => {
    const runWidth = measure(run);
    if (used && used + runWidth > width) flush();
    if (runWidth > width) {
      for (const char of run.text) {
        const fragment = {...run,text:char}, charWidth = measure(fragment);
        if (used && used + charWidth > width) flush();
        line.push(fragment); used += charWidth;
      }
    } else {line.push(run); used += runWidth;}
  };
  if (prefix) append({text:prefix});
  for (const run of runs) {
    const tokens = run.text.split(/(\n|[^\S\n]+)/u).filter(Boolean);
    for (const token of tokens) {
      if (token === "\n") flush(); else append({...run,text:token});
    }
  }
  if (line.length) flush();
  if (!measureOnly) document.y += paragraphGap;
  return measuredHeight + paragraphGap;
}

function annotatedSourceParts(item) {
  if (!item.sourceFormatting?.length) return [];
  return reportItemPreview(item).map(part => part.kind === 'text' ? {...part,runs:sourceFormattingRuns(part,item.sourceFormatting)} : {...part,formatting:item.sourceFormatting});
}
const hasInlineStyle = run => sourceTextStyles.some(style=>run[style]);
function hasSourceMarks(parts) {
  return parts.some(part=>part.kind === 'text' ? part.runs.some(hasInlineStyle) : part.rows.some((row,r)=>row.some((text,c)=>
    sourceFormattingRuns({key:`${part.key}:${r}:${c}`,text},part.formatting || []).some(hasInlineStyle))));
}
function drawFormattedSourceTable(document,part,formatting,startX,contentWidth) {
  const columns = Math.max(...part.rows.map(row=>row.length)), width = contentWidth / columns;
  const size = 8, lineHeight = 10.4;
  const runs = part.rows.map((row,r)=>row.map((text,c)=>sourceFormattingRuns({key:`${part.key}:${r}:${c}`,text},formatting)));
  const heights = runs.map(row=>Math.max(10.4,...row.map(cell=>drawReportRichText(document,cell,{size,width:width-10,lineHeight,paragraphGap:0,measureOnly:true})))+12);
  const headers = part.headerRowCount || 0;
  let position = headers;
  while (position < part.rows.length || position === headers && position === part.rows.length) {
    const bottom = document.page.height-document.page.margins.bottom-2;
    const headerHeight = heights.slice(0,headers).reduce((a,b)=>a+b,0);
    if (document.y+headerHeight+(heights[position] || 0)>bottom) document.addPage();
    const indices = Array.from({length:headers},(_,i)=>i); let height = headerHeight;
    while (position < part.rows.length && document.y+height+heights[position]<=bottom) {indices.push(position); height+=heights[position++];}
    if (indices.length === headers && position < part.rows.length) throw new Error('A Report table row is too tall for a PDF page. Narrow the selection before exporting.');
    for (const r of indices) {
      const top = document.y;
      for (let c=0;c<columns;c++) {
        const x = startX+c*width;
        document.save().lineWidth(0.5).strokeColor(colors.rule);
        if (r < headers) document.rect(x,top,width,heights[r]).fillAndStroke('#f0f0f0',colors.rule);
        else document.rect(x,top,width,heights[r]).stroke();
        document.restore(); document.y=top+5;
        drawReportRichText(document,runs[r][c] || [],{size,left:x+5,width:width-10,lineHeight,paragraphGap:0,paginate:false});
      }
      document.x=startX; document.y=top+heights[r];
    }
    if (position>=part.rows.length) break;
    document.addPage();
  }
}

function drawBody(document, manifest, projectMaterialBySourceID) {
  const presentation = reportPresentation(manifest);
  document.addPage();
  let previousSourceClassification = null;
  (manifest.items || []).forEach((item, index, items) => {
    const sourceParts = annotatedSourceParts(item);
    const markedText = sourceParts.find(part=>part.kind === 'text' && part.runs.some(hasInlineStyle))?.runs;
    if (!["heading","paragraph","list"].includes(item.kind) && hasSourceMarks(sourceParts)) {
      drawSourceItem(document,item,projectMaterialBySourceID,presentation,previousSourceClassification !== item.sourceClassification);
      previousSourceClassification = item.sourceClassification;
      return;
    }
    if (item.kind === "heading") {
      const next = items[index + 1];
      reserveHeading(document, item.text, next?.text || next?.plainText || next?.conclusion || "", { size: item.presentationRole === "comment" ? 9 : ({1:17,2:14,3:12}[item.headingLevel] || 17), gap: 10, bodySize: 10 });
      if (item.richText || markedText) {
        drawReportRichText(document, item.richText || markedText, {bold:true, size:item.presentationRole === "comment" ? 9 : ({1:17,2:14,3:12}[item.headingLevel] || 17), paragraphGap:item.presentationRole === "comment" ? 4 : 10});
        return;
      }
      document
        .fillColor(colors.ink)
        .font("Report-Bold")
        .fontSize(item.presentationRole === "comment" ? 9 : 17)
        .text(item.text, { paragraphGap: item.presentationRole === "comment" ? 4 : 10 });
      return;
    }
    if (item.kind === "paragraph") {
      const noteTitle = item.reportTitle || (item.derivedFrom?.kind === "notebookCard" ? item.derivedFrom.title : "");
      if (noteTitle) {
        reserveHeading(document, noteTitle, item.text, { size: 12, gap: 7, bodySize: 10 });
        document.fillColor(colors.ink).font("Report-Bold").fontSize(12).text(noteTitle, { paragraphGap: 7 });
      } else ensureVerticalSpace(document, 55);
      if (item.richText || markedText) drawReportRichText(document, item.richText || markedText);
      else document
        .fillColor(colors.ink)
        .font("Report-Regular")
        .fontSize(10)
        .text(item.text, { lineGap: 2, paragraphGap: 10 });
      if (item.derivedFrom?.kind === "notebookCard" && item.evidenceLinks?.length) {
        const evidenceHeading = `Evidence linked to ${item.derivedFrom.title}`;
        const firstCitation = item.evidenceLinks.find(link => link.label || link.source?.sectionNumber);
        reserveHeading(document, evidenceHeading, firstCitation?.label || firstCitation?.source?.sectionNumber || "", {size: 8, gap: 3, bodySize: 8});
        document
          .fillColor(colors.muted)
          .font("Report-Bold")
          .fontSize(8)
          .text(evidenceHeading, { paragraphGap: 3 });
        item.evidenceLinks.forEach((link) => {
          const citation = link.label || [
            link.source?.codePrefix,
            link.source?.sectionNumber
          ].filter(Boolean).join(" § ");
          if (!citation) return;
          document
            .fillColor(colors.muted)
            .font("Report-Regular")
            .fontSize(8)
            .text(`- ${citation}`, { indent: 8, paragraphGap: 2 });
        });
        document.moveDown(0.5);
      }
      return;
    }
    if (item.kind === "list") {
      ensureVerticalSpace(document, 55);
      const richLines = item.richText ? reportRunsLines(reportBlockRuns(item)) : null;
      stringList(item.items).forEach((value, index) => {
        const prefix = item.listStyle === "ordered" ? `${index + 1}. ` : "- ";
        if (richLines) {drawReportRichText(document, richLines[index] || [{text:value}], {indent:8,prefix,paragraphGap:4}); return;}
        document
          .fillColor(colors.ink)
          .font("Report-Regular")
          .fontSize(10)
          .text(`${prefix}${value}`, { indent: 8, paragraphGap: 4 });
      });
      document.moveDown(0.6);
      return;
    }
    if (item.kind === "projectFacts") {
      ensureVerticalSpace(document, 90);
      drawClassification(document, item.sourceClassification);
      document
        .fillColor(colors.ink)
        .font("Report-Bold")
        .fontSize(12)
        .text(item.title || "Project facts", { paragraphGap: 7 });
      const facts = reportFactPresentation(item);
      if (item.address) document.font("Report-Regular").fontSize(9.5).text(item.address, { paragraphGap: 8 });
      for (const row of facts.rows) {
        const references = [row.qualification, row.source].filter(Boolean).map(id => `[${id}]`).join(" ");
        document.fillColor(colors.ink).font("Report-Regular").fontSize(9.5)
          .text([row.text, references].filter(Boolean).join(" "), { lineGap: 2, paragraphGap: 8 });
      }
      if (facts.notes.length) {
        ensureVerticalSpace(document, 45);
        document.fillColor(colors.muted).font("Report-Bold").fontSize(9)
          .text("Fact qualifications and sources", { paragraphGap: 6 });
        facts.notes.forEach((note, index) => document.font("Report-Regular").fontSize(8)
          .text(`[${index + 1}] ${note.kind}: ${note.displayText || note.text}`, { lineGap: 2, paragraphGap: 5 }));
      }
      document.moveDown(0.8);
      return;
    }
    drawSourceItem(document, item, projectMaterialBySourceID, presentation,
      previousSourceClassification !== item.sourceClassification);
    previousSourceClassification = item.sourceClassification;
  });

  // Reserve the measured notice, not a fixed 130pt block that can force an
  // otherwise unnecessary final page for a short notice.
  document.font("Report-Bold").fontSize(10);
  const noticeHeadingHeight = document.heightOfString("Professional-use notice", { paragraphGap: 6 });
  document.font("Report-Regular").fontSize(8);
  const noticeHeight = stringList(manifest.disclaimers).reduce((height, value) =>
    height + document.heightOfString(value, { lineGap: 2, paragraphGap: 5 }), noticeHeadingHeight + 28);
  ensureVerticalSpace(document, noticeHeight);
  document
    .moveDown(1)
    .strokeColor(colors.rule)
    .lineWidth(0.75)
    .moveTo(document.x, document.y)
    .lineTo(
      document.page.width - document.page.margins.right,
      document.y
    )
    .stroke()
    .moveDown(1);
  document
    .fillColor(colors.ink)
    .font("Report-Bold")
    .fontSize(10)
    .text("Professional-use notice", { paragraphGap: 6 });
  stringList(manifest.disclaimers).forEach((value) => {
    document
      .fillColor(colors.muted)
      .font("Report-Regular")
      .fontSize(8)
      .text(value, { lineGap: 2, paragraphGap: 5 });
  });

}

function drawPageFooters(document, manifest) {
  const presentation = reportPresentation(manifest);
  const footerLabel = presentation.footerText || `${presentation.displayName} professional report`;
  const range = document.bufferedPageRange();
  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
    document.switchToPage(pageIndex);
    const page = document.page;
    const originalBottomMargin = page.margins.bottom;
    page.margins.bottom = 0;
    try {
      document
        .fillColor(colors.muted)
        .font("Report-Regular")
        .fontSize(7)
        .text(
          `${footerLabel}  /  ${pageIndex + 1} of ${range.count}`,
          page.margins.left,
          page.height - 32,
          {
            width: page.width - page.margins.left - page.margins.right,
            align: "right",
            lineBreak: false
          }
        );
    } finally {
      page.margins.bottom = originalBottomMargin;
    }
  }
}

export async function renderReportPDF(manifest, { projectMaterialBySourceID = new Map() } = {}) {
  const document = new PDFDocument({
    size: "LETTER",
    margins: { top: 54, right: 54, bottom: 54, left: 54 },
    bufferPages: true,
    autoFirstPage: true,
    tagged: true,
    displayTitle: true,
    lang: "en-US",
    info: {
      Title: manifest.title,
      Author: manifest.author?.displayName || "Permitext user",
      Subject: `${manifest.project?.name || "Project"} code research report`,
      Creator: manifest.generatorVersion || "Permitext",
      CreationDate: new Date(manifest.createdAt),
      ModDate: new Date(manifest.createdAt)
    }
  });
  document.registerFont("Report-Regular", fileURLToPath(new URL("./fonts/DejaVuSans.ttf", import.meta.url)));
  document.registerFont("Report-Bold", fileURLToPath(new URL("./fonts/DejaVuSans-Bold.ttf", import.meta.url)));
  const chunks = [];
  document.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  const completed = new Promise((resolve, reject) => {
    document.once("end", () => resolve(Buffer.concat(chunks)));
    document.once("error", reject);
  });

  drawCover(document, manifest);
  drawBody(document, manifest, projectMaterialBySourceID);
  drawPageFooters(document, manifest);
  document.end();
  return completed;
}
