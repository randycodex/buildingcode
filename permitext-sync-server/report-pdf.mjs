import PDFDocument from "pdfkit";

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

function drawClassification(document, classification) {
  const label = classificationLabels[classification] || "Project material";
  const fill = classificationColors[classification] || colors.projectMaterial;
  const width = Math.min(190, document.widthOfString(label, { font: "Helvetica-Bold" }) + 18);
  const x = document.x;
  const y = document.y;
  document.roundedRect(x, y, width, 18, 9).fill(fill);
  document
    .fillColor(colors.ink)
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .text(label.toUpperCase(), x + 9, y + 5, { width: width - 18, lineBreak: false });
  document.y = y + 27;
}

function drawList(document, title, values) {
  const items = stringList(values);
  if (!items.length) return;
  ensureVerticalSpace(document, 50);
  document
    .fillColor(colors.ink)
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text(title.toUpperCase(), { characterSpacing: 0.6 });
  document.moveDown(0.35);
  items.forEach((item) => {
    document
      .fillColor(colors.ink)
      .font("Helvetica")
      .fontSize(9.5)
      .text(`- ${item}`, { indent: 8, paragraphGap: 4 });
  });
  document.moveDown(0.25);
}

function drawSourceItem(document, item, projectMaterialBySourceID, presentation) {
  ensureVerticalSpace(document, 105);
  const startX = document.x;
  const contentWidth = document.page.width - document.page.margins.left - document.page.margins.right;
  const top = document.y;
  document.save();
  document.roundedRect(startX - 10, top - 10, contentWidth + 20, 1, 7).fill(colors.paper);
  document.restore();
  drawClassification(document, item.sourceClassification);

  if (item.kind === "evidence") {
    document
      .fillColor(colors.ink)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(`${item.codeBook} ${item.sectionNumber}: ${item.title}`, { paragraphGap: 8 });
    const passageX = document.x + 12;
    const passageWidth = contentWidth - 12;
    const passageY = document.y;
    document
      .moveTo(document.x, passageY)
      .lineTo(document.x, passageY + Math.max(28, document.heightOfString(item.passageText, {
        width: passageWidth,
        font: "Helvetica",
        fontSize: 9.5
      })))
      .lineWidth(2)
      .strokeColor(presentation.accent)
      .stroke();
    document
      .fillColor(colors.ink)
      .font("Helvetica")
      .fontSize(9.5)
      .text(item.passageText, passageX, passageY, {
        width: passageWidth,
        lineGap: 2,
        paragraphGap: 8
      });
  } else if (item.kind === "notebookCard") {
    document
      .fillColor(colors.ink)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(item.title, { paragraphGap: 7 });
    if (item.plainText) {
      document
        .font("Helvetica")
        .fontSize(9.5)
        .text(item.plainText, { lineGap: 2, paragraphGap: 8 });
    }
  } else if (item.kind === "researchAnswer") {
    document
      .fillColor(colors.ink)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(item.question, { paragraphGap: 7 });
    document
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .text("Supported conclusion", { paragraphGap: 3 });
    document
      .font("Helvetica")
      .fontSize(9.5)
      .text(item.conclusion, { lineGap: 2, paragraphGap: 7 });
    if (item.explanation) {
      document.text(item.explanation, { lineGap: 2, paragraphGap: 7 });
    }
    drawList(document, "Assumptions", item.assumptions);
    drawList(document, "Missing Project facts", item.missingFacts);
    drawList(document, "Limitations", item.limitations);
    drawList(document, "Additional evidence needed", item.additionalEvidenceNeeded);
    drawList(
      document,
      "Citations",
      (item.citations || []).map((citation) =>
        [citation.sectionID, ...(citation.sourceIDs || [])].filter(Boolean).join(" / ")
      )
    );
  } else {
    document
      .fillColor(colors.ink)
      .font("Helvetica-Bold")
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
          .font("Helvetica")
          .fontSize(9.5)
          .text("The stored Workboard preview could not be rendered.", { paragraphGap: 8 });
      }
    } else {
      document
        .font("Helvetica")
        .fontSize(9.5)
        .text(item.contentType || "Included Project material", { paragraphGap: 8 });
    }
  }

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
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(presentation.coverLabel.toUpperCase(), { characterSpacing: 1.25 });
  if (presentation.displayName.toLowerCase() !== presentation.coverLabel.toLowerCase()) {
    document
      .moveDown(0.5)
      .fillColor(colors.muted)
      .font("Helvetica")
      .fontSize(8)
      .text(
        [presentation.displayName, presentation.website].filter(Boolean).join("  /  "),
        { characterSpacing: 0.25 }
      );
  }
  document.moveDown(1.4);
  document
    .fillColor(colors.ink)
    .font("Helvetica-Bold")
    .fontSize(28)
    .text(manifest.title, { width: contentWidth, lineGap: 3 });
  document.moveDown(1.2);
  document
    .font("Helvetica-Bold")
    .fontSize(16)
    .text(manifest.project?.name || "Project");
  const metadata = [
    manifest.project?.address,
    reportDate(manifest.reportDate),
    manifest.author?.displayName,
    `Report version ${manifest.reportVersion}`,
    manifest.codeEdition
  ].filter(Boolean);
  document.moveDown(0.8);
  document
    .fillColor(colors.muted)
    .font("Helvetica")
    .fontSize(10)
    .text(metadata.join("  /  "), { lineGap: 3 });
  document.moveDown(3);
  Object.keys(classificationLabels).forEach((classification) => {
    drawClassification(document, classification);
  });
  document.moveDown(2);
  document
    .fillColor(colors.muted)
    .font("Helvetica")
    .fontSize(8)
    .text(`Manifest ${manifest.id}\nSHA-256 ${manifest.contentHash}`, {
      lineGap: 3
    });
}

function drawBody(document, manifest, projectMaterialBySourceID) {
  const presentation = reportPresentation(manifest);
  document.addPage();
  if (manifest.project?.description) {
    document
      .fillColor(colors.muted)
      .font("Helvetica")
      .fontSize(10)
      .text(manifest.project.description, { lineGap: 2, paragraphGap: 14 });
  }
  (manifest.items || []).forEach((item) => {
    if (item.kind === "heading") {
      ensureVerticalSpace(document, 70);
      document
        .fillColor(colors.ink)
        .font("Helvetica-Bold")
        .fontSize(17)
        .text(item.text, { paragraphGap: 10 });
      return;
    }
    if (item.kind === "paragraph") {
      ensureVerticalSpace(document, 55);
      document
        .fillColor(colors.ink)
        .font("Helvetica")
        .fontSize(10)
        .text(item.text, { lineGap: 2, paragraphGap: 10 });
      return;
    }
    if (item.kind === "list") {
      ensureVerticalSpace(document, 55);
      stringList(item.items).forEach((value) => {
        document
          .fillColor(colors.ink)
          .font("Helvetica")
          .fontSize(10)
          .text(`- ${value}`, { indent: 8, paragraphGap: 4 });
      });
      document.moveDown(0.6);
      return;
    }
    drawSourceItem(document, item, projectMaterialBySourceID, presentation);
  });

  ensureVerticalSpace(document, 130);
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
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("Professional-use notice", { paragraphGap: 6 });
  stringList(manifest.disclaimers).forEach((value) => {
    document
      .fillColor(colors.muted)
      .font("Helvetica")
      .fontSize(8)
      .text(value, { lineGap: 2, paragraphGap: 5 });
  });
  document
    .font("Helvetica")
    .fontSize(7)
    .text(
      `Manifest ${manifest.id} / ${manifest.generatorVersion} / SHA-256 ${manifest.contentHash}`,
      { lineGap: 2 }
    );
}

function drawPageFooters(document, manifest) {
  const presentation = reportPresentation(manifest);
  const footerLabel = presentation.footerText || `${presentation.displayName} professional report`;
  const range = document.bufferedPageRange();
  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
    document.switchToPage(pageIndex);
    const page = document.page;
    document
      .fillColor(colors.muted)
      .font("Helvetica")
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
  }
}

export async function renderReportPDF(manifest, { projectMaterialBySourceID = new Map() } = {}) {
  const document = new PDFDocument({
    size: "LETTER",
    margins: { top: 54, right: 54, bottom: 54, left: 54 },
    bufferPages: true,
    autoFirstPage: true,
    info: {
      Title: manifest.title,
      Author: manifest.author?.displayName || "Permitext user",
      Subject: `${manifest.project?.name || "Project"} code research report`,
      Creator: manifest.generatorVersion || "Permitext"
    }
  });
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
