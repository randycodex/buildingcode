import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parseZoningChapterHTML } from "./zoning-resolution.mjs";

const directory = new URL("./config/zoning-adopted-amendments/2026-11-12/", import.meta.url);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const escape = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const paragraph = (text, sections) => `<p>${escape(text)
  .replace(/#([^#]+)#/g, "<strong><em>$1</em></strong>")
  .replace(/\b\d{2,3}-\d{2,3}\b/g, number => {
    const target = sections.find(section => section.sectionNumber === number);
    return target ? `<a href="${escape(target.sourceURL)}" data-permitext-zr-source="${escape(target.sourceURL)}">${number}</a>` : number;
  })}</p>`;

function uniqueIndex(blocks, predicate, label) {
  const indexes = blocks.flatMap((block, index) => predicate(block) ? [index] : []);
  if (indexes.length !== 1) throw new Error(`Expected one ${label}; found ${indexes.length}. Stop for source review.`);
  return indexes[0];
}

function parseReplacement(section, html, title = section.title) {
  return parseZoningChapterHTML(`<article class="node--type-section node--view-mode-default"
    data-node-id="${section.sourceNodeID}" data-section="${escape(section.sectionNumber)}" about="${escape(section.sourcePath)}">
    <h3>${escape(title)}</h3><time datetime="2026-11-12">11/12/2026</time>
    <div class="sec-body"><div class="field--name-body field__item">${html}</div></div></article>`, {
    articleRoman: section.article.roman, articleTitle: section.article.title,
    chapterNumber: section.chapter.number, chapterTitle: section.chapter.title,
    canonicalChapterNumber: section.chapter.canonicalNumber, sourcePath: section.sourcePath
  }).sections[0];
}

/** Apply only the finally adopted resolutions, retaining all omitted/unchanged law. */
export async function applyZoningAdoptedAmendments(sections) {
  const renderParagraph = text => paragraph(text, sections);
  const manifest = JSON.parse(await readFile(new URL("amendments.json", directory), "utf8"));
  const embeddedAssets = new Map();
  for (const adoption of manifest.amendments) {
    const original = await readFile(new URL(`../${adoption.sourceFile}`, import.meta.url));
    if (digest(original) !== adoption.sourceSHA256) throw new Error(`Council resolution ${adoption.resolution} source checksum changed.`);
    const affected = [];
    for (const enacted of adoption.sections) {
      const section = sections.find(section => section.sectionNumber === enacted.sectionNumber);
      if (!section) throw new Error(`Missing amended section ${enacted.sectionNumber}.`);
      if (section.lastAmended >= adoption.adoptedDate) throw new Error(`DCP already revised ${enacted.sectionNumber}; reconcile the adopted supplement before importing.`);
      let html;
      if (enacted.sectionNumber === "81-744") {
        // Resolution 737 prints only the changed opening and paragraph (a).
        // Paragraphs (b), (c), and the contribution-rate footnote remain law.
        const blocks = section.blocks.map(block => ({ ...block }));
        const granting = uniqueIndex(blocks, block => block.plainText.startsWith('A “granting site”'), "granting-site definition");
        const definition = enacted.paragraphs.find(text => text.startsWith('A “granting site”'));
        if (!definition) throw new Error("Missing adopted granting-site definition.");
        blocks[granting].html = renderParagraph(definition);
        const maximum = uniqueIndex(blocks, block => /^\(1\)\s+the maximum amount of floor area transferred/.test(block.plainText), "81-744(a)(1)");
        const start = enacted.paragraphs.findIndex(text => /^\(1\)/.test(text));
        const end = enacted.paragraphs.findIndex((text, index) => index > start && /^\(2\)/.test(text));
        if (start < 0 || end < 0) throw new Error("Unrecognized 81-744(a)(1) adopted excerpt.");
        blocks.splice(maximum, 1, ...enacted.paragraphs.slice(start, end).map(text => ({ html: renderParagraph(text) })));
        html = blocks.map(block => block.html).join("\n");
      } else {
        html = enacted.paragraphs.map(renderParagraph).join("\n");
      }
      const replacement = parseReplacement(section, html, enacted.title);
      Object.assign(section, replacement, {
        chapterID: section.chapterID,
        amendmentHistory: section.amendmentHistory,
        consolidatedSourceContentHash: section.sourceContentHash,
        supplementaryAdoptions: [adoption.application]
      });
      affected.push(section);
    }
    if (adoption.maps) {
      const section = sections.find(section => section.sourceNodeID === 21188);
      if (!section) throw new Error("South Richmond Appendix A must be imported with its chapter.");
      const blocks = section.blocks.map(block => ({ ...block }));
      for (const map of adoption.maps) {
        const heading = uniqueIndex(blocks, block => block.plainText.startsWith(`Map ${map.number} — Open Space Network`), `South Richmond Map ${map.number}`);
        const image = heading + 1 + uniqueIndex(blocks.slice(heading + 1).slice(0, 2), block => block.html.includes("<img"), `Map ${map.number} image`);
        blocks[heading].html = renderParagraph(`Map ${map.number} — Open Space Network (11/12/2026)`);
        blocks[image].html = map.images.map((asset, index) => `<img src="${escape(asset.sourceURL)}" alt="Map ${map.number} — Open Space Network${map.images.length > 1 && index === 0 ? ' legend' : ''}; adopted November 12, 2026, Resolution 736">`).join("\n");
        for (const asset of map.images) {
          const bytes = await readFile(new URL(asset.file, directory));
          if (digest(bytes) !== asset.sha256) throw new Error(`Map ${map.number} checksum changed.`);
          embeddedAssets.set(asset.sourceURL, { bytes, contentType: asset.contentType });
        }
      }
      const replacement = parseReplacement(section, blocks.map(block => block.html).join("\n"));
      Object.assign(section, replacement, {
        chapterID: section.chapterID, appendix: section.appendix,
        amendmentHistory: section.amendmentHistory,
        amendmentHistorySourceURL: section.amendmentHistorySourceURL,
        consolidatedSourceContentHash: section.sourceContentHash,
        supplementaryAdoptions: [adoption.application]
      });
      affected.push(section);
    }
    for (const section of affected) {
      section.amendmentHistory = section.amendmentHistory.filter(event =>
        event.reportNumber !== adoption.application.replaceAll(" ", ""));
      section.amendmentHistory.unshift({ effectiveDate: adoption.effectiveDate,
        reportNumber: adoption.application.replaceAll(" ", ""), reportURL: adoption.sourceURL,
        projectName: adoption.title, action: "Amended", notes: `Council Resolution ${adoption.resolution}; adopted ${adoption.adoptedDate}; DCP consolidation through ${manifest.consolidatedTextChangesThrough}.`,
        description: adoption.title });
    }
  }
  return { manifest, embeddedAssets };
}
