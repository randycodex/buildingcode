let nextScope = 0;

export function notebookPassageGroups(document, evidenceLinks = [], previous = new Map()) {
  const links = new Map(evidenceLinks.map(link => [link.id, link]));
  const groups = new Map();
  const normalized = text => String(text || "").replace(/\s+/g, " ").trim();
  const textOf = content => (Array.isArray(content) ? content : []).map(node =>
    node.type === "text" ? node.text : node.type === "link" ? textOf(node.content) : "").join("");
  const references = block => (Array.isArray(block.content) ? block.content : []).filter(node => node.type === "permitextReference");
  const visit = blocks => (Array.isArray(blocks) ? blocks : []).forEach((block, index) => {
    for (const node of references(block)) {
      const reference = node.props;
      if (reference?.referenceKind !== "selectedPassage") continue;
      const link = links.get(reference.referenceID);
      if (!link) continue;
      const texts = new Set((link.passages || []).map(passage => normalized(passage.exact)).filter(Boolean));
      const known = new Set(previous.get(reference.referenceID) || []);
      const ids = groups.get(reference.referenceID) || [];
      for (const next of blocks.slice(index + 1)) {
        if (references(next).length) break;
        if (!next.id) continue;
        const text = normalized(textOf(next.content));
        if (known.has(next.id) || texts.has(text)) {
          ids.push(next.id);
          if (!texts.delete(text) && known.has(next.id)) texts.delete(texts.values().next().value);
        }
      }
      if (ids.length) groups.set(reference.referenceID, [...new Set(ids)]);
    }
    visit(block.children);
  });
  visit(document?.document);
  return groups;
}

export function createNotebookPassageDisclosure(element, { getDocument, getEvidenceLinks }) {
  const document = element.ownerDocument;
  const scope = `notebook-passages-${++nextScope}`;
  const style = document.createElement("style");
  const collapsed = new Set();
  let groups = new Map(), disposed = false, scheduled = false;
  element.dataset.notebookPassages = scope;
  document.head.append(style);
  const paint = () => {
    const hidden = [...collapsed].flatMap(id => groups.get(id) || []);
    // Keep folding outside the editor document so it cannot change saved text,
    // undo history, export content, or the editor's mutation observer.
    style.textContent = hidden.length ? `${hidden.map(id =>
      `[data-notebook-passages="${scope}"] .bn-block-outer[data-id="${document.defaultView.CSS.escape(id)}"]`).join(",")} { display: none !important; }` : "";
    element.querySelectorAll("[data-notebook-passage-toggle]").forEach(button => {
      const reference = button.closest("[data-permitext-reference]");
      const id = reference.dataset.referenceId;
      const expanded = !collapsed.has(id);
      button.disabled = !groups.has(id);
      button.setAttribute("aria-expanded", String(expanded));
      button.setAttribute("aria-label", `${expanded ? "Collapse" : "Expand"} passage: ${reference.dataset.referenceLabel}`);
    });
  };
  const refresh = () => {
    if (disposed) return;
    groups = notebookPassageGroups(getDocument(), getEvidenceLinks(), groups);
    paint();
  };
  const observer = new document.defaultView.MutationObserver(() => {
    if (scheduled || disposed) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; refresh(); });
  });
  observer.observe(element, { childList: true, subtree: true, characterData: true });
  refresh();
  return {
    toggle(reference) {
      if (disposed) return false;
      refresh();
      const id = reference.dataset.referenceId;
      if (!groups.has(id)) return false;
      if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
      paint();
      return true;
    },
    destroy() {
      disposed = true;
      observer.disconnect();
      style.remove();
      delete element.dataset.notebookPassages;
    }
  };
}
