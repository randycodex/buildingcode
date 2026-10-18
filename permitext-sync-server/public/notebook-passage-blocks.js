export function notebookReferenceBlocks(reference, passages = []) {
  return [
    { type: "paragraph", content: [{ type: "permitextReference", props: { ...reference } }] },
    ...(Array.isArray(passages) ? passages : []).flatMap(passage => {
      const text = String(passage?.exact || "").trim();
      return text ? [{ type: "paragraph", content: [{ type: "text", text, styles: {} }] }] : [];
    })
  ];
}

// Restore only snapshots belonging to selected-passage references in this Note.
// A per-link marker lets later edits/removals to the copied text remain edits.
export function restoreNotebookPassageText(document, evidenceLinks = []) {
  const links = Array.isArray(evidenceLinks) ? evidenceLinks : [];
  if (!Array.isArray(document?.document) || !links.length) return { document, evidenceLinks: links, changed: false };
  const byID = new Map(links.map(link => [link.id, link]));
  const included = new Set();
  const normalized = text => String(text || "").replace(/\s+/g, " ").trim();
  const inlineText = content => (Array.isArray(content) ? content : []).map(node =>
    node.type === "text" ? node.text : node.type === "link" ? inlineText(node.content) : "").join("");
  const hasReference = block => (block.content || []).some(node => node.type === "permitextReference") ||
    (block.children || []).some(hasReference);
  const blockText = block => [inlineText(block.content), ...(block.children || []).map(blockText)].join("\n");
  let addedText = false;
  const restoreBlocks = blocks => blocks.flatMap((block, index) => {
    const additions = [];
    for (const node of Array.isArray(block.content) ? block.content : []) {
      const reference = node.props;
      if (node.type !== "permitextReference" || reference?.referenceKind !== "selectedPassage") continue;
      const link = byID.get(reference.referenceID);
      if (!link || link.noteTextVersion === 1 || included.has(link.id)) continue;
      const passages = (Array.isArray(link.passages) ? link.passages : []).filter(passage => String(passage?.exact || "").trim());
      if (!passages.length) continue;
      // Recent Notes may already contain the text, from before the marker was
      // introduced. Recognize nearby copied text without adding it twice.
      const nearby = [blockText(block)];
      for (const next of blocks.slice(index + 1)) {
        if (hasReference(next)) break;
        nearby.push(blockText(next));
      }
      const existing = normalized(nearby.join("\n"));
      const missing = passages.filter(passage => !existing.includes(normalized(passage.exact)));
      additions.push(...notebookReferenceBlocks(reference, missing).slice(1));
      included.add(link.id);
      if (missing.length) addedText = true;
    }
    const next = block.children?.length ? { ...block, children: restoreBlocks(block.children) } : block;
    return [next, ...additions];
  });
  const blocks = restoreBlocks(document.document);
  if (!included.size) return { document, evidenceLinks: links, changed: false };
  return {
    document: addedText ? { ...document, document: blocks } : document,
    evidenceLinks: links.map(link => included.has(link.id) ? { ...link, noteTextVersion: 1 } : link),
    changed: true
  };
}
