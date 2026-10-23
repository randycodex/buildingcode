// Reserve the whole chapter without downloading or rendering its whole body.
// Measured heights are reusable only for the same corpus and text layout.
const measuredLayouts = new Map();

export function readerExtentWindow(loaded, index, limit) {
  if (index < 0 || index >= loaded.length || loaded[index]) return null;
  let lower = index, upper = index + 1;
  while (lower > 0 && !loaded[lower - 1]) lower -= 1;
  while (upper < loaded.length && !loaded[upper]) upper += 1;
  const end = Math.min(upper, Math.max(lower, index - Math.floor(limit / 2)) + limit);
  return { start: Math.max(lower, end - limit), end };
}

export function createReaderChapterExtent(content, sections, initialStart, initialEnd, chapter) {
  const loaded = sections.map((_section, index) => index >= initialStart && index < initialEnd);
  const slots = sections.map(() => null);
  let live = [], layoutKey = "", heights, estimate = 600;
  const style = () => getComputedStyle(content);
  const signature = () => {
    const css = style();
    const width = Math.min(800, content.clientWidth - parseFloat(css.paddingLeft || 0) - parseFloat(css.paddingRight || 0));
    return JSON.stringify([chapter?.id, chapter?.codeVersion, chapter?.corpusRevision,
      Math.round(width), css.fontFamily, css.fontSize,
      ...["--reader-line-height", "--body-text-scale", "--subsection-title-scale", "--section-label-scale", "--space-2", "--space-3"]
        .map(name => css.getPropertyValue(name))]);
  };
  const refreshLive = () => { live = slots.map((node, index) => ({ node, index })).filter(item => item.node?.isConnected); };
  const firstAfter = y => {
    let lower = 0, upper = live.length;
    while (lower < upper) {
      const middle = (lower + upper) >>> 1;
      if (live[middle].node.getBoundingClientRect().bottom <= y) lower = middle + 1;
      else upper = middle;
    }
    return live[lower];
  };
  const anchor = () => {
    const top = content.getBoundingClientRect().top;
    const item = firstAfter(top);
    if (!item) return null;
    const rect = item.node.getBoundingClientRect();
    return { ...item, offset: rect.top - top,
      atEnd: content.scrollHeight > content.clientHeight && content.scrollHeight - content.clientHeight - content.scrollTop <= 1,
      fraction: loaded[item.index] ? null : Math.max(0, Math.min(1, (top - rect.top) / Math.max(1, rect.height))) };
  };
  const restore = saved => {
    if (!saved) return;
    if (saved.atEnd) { content.scrollTop = Math.max(0, content.scrollHeight - content.clientHeight); return; }
    const node = saved.node.isConnected ? saved.node : slots[saved.index]?.isConnected ? slots[saved.index]
      : live.find(item => item.node.dataset.sectionAliases?.split(/\s+/).includes(String(sections[saved.index].id)))?.node;
    if (!node?.isConnected) return;
    const rect = node.getBoundingClientRect();
    const offset = saved.fraction === null ? saved.offset : -saved.fraction * rect.height;
    content.scrollTop += rect.top - content.getBoundingClientRect().top - offset;
  };
  const rememberBatch = items => {
    const connected = items.filter(({node, index}) => {
      if (node?.isConnected) return true;
      heights.set(String(sections[index].id), 0);
      return false;
    });
    // Reveal the bounded batch together, read its geometry, then restore
    // containment together. Interleaving these writes and reads forces a fresh
    // style/layout pass for every section when opening or resuming a Reader.
    connected.forEach(({node}) => { node.style.contentVisibility = "visible"; });
    const measured = connected.map(item => ({...item, height: item.node.getBoundingClientRect().height}));
    measured.forEach(({node, index, height}) => {
      heights.set(String(sections[index].id), height);
      node.style.containIntrinsicSize = `auto ${Math.max(0, height)}px`;
      node.style.contentVisibility = "auto";
    });
  };
  const refreshLayout = () => {
    const next = signature();
    if (next === layoutKey) return;
    const saved = anchor();
    layoutKey = next;
    heights = measuredLayouts.get(layoutKey) || new Map();
    measuredLayouts.delete(layoutKey);
    measuredLayouts.set(layoutKey, heights);
    while (measuredLayouts.size > 8) measuredLayouts.delete(measuredLayouts.keys().next().value);
    // Sample a bounded number of already loaded sections. Never materialize
    // all skipped text during a column resize.
    const sample = live.filter(item => loaded[item.index]).slice(0, 12);
    rememberBatch(sample);
    slots.forEach((node, index) => {
      if (loaded[index] && !node?.isConnected) heights.set(String(sections[index].id), 0);
    });
    const known = [...heights.values()];
    estimate = known.length ? Math.max(48, known.reduce((total, value) => total + value, 0) / known.length) : 600;
    slots.forEach((node, index) => {
      if (loaded[index] || !node) return;
      node.style.height = `${Math.max(1, heights.get(String(sections[index].id)) ?? estimate)}px`;
    });
    restore(saved);
  };

  const initialNodes = [...content.querySelectorAll(".chapter-section")];
  for (let index = initialStart; index < initialEnd; index += 1) {
    const node = initialNodes.find(candidate => candidate.dataset.sectionId === String(sections[index].id));
    if (node) { node.dataset.readerExtentIndex = String(index); slots[index] = node; }
  }
  // Initialize estimates while the selected text is measurable. Its DOM stays
  // intact so source navigation, selection and saved-block identity are kept.
  refreshLive();
  refreshLayout();
  const initialAnchor = anchor();
  const before = document.createDocumentFragment(), after = document.createDocumentFragment();
  sections.forEach((section, index) => {
    if (loaded[index]) return;
    const node = document.createElement("div");
    node.className = "reader-section-placeholder";
    node.dataset.readerExtentIndex = String(index);
    node.dataset.researchSelectionExclude = "true";
    node.setAttribute("aria-hidden", "true");
    node.style.height = `${Math.max(1, heights.get(String(section.id)) ?? estimate)}px`;
    slots[index] = node;
    (index < initialStart ? before : after).append(node);
  });
  content.insertBefore(before, initialNodes[0] || content.firstChild);
  content.insertBefore(after, content.querySelector(".reader-progressive-status"));
  refreshLive();
  restore(initialAnchor);

  return {
    get loadedCount() { return loaded.filter(Boolean).length; },
    unloadedScrollPosition(contentKey) {
      const saved = anchor();
      if (!saved || loaded[saved.index]) return null;
      return { contentKey, sectionID: String(sections[saved.index].id), blockID: "",
        anchorOffset: saved.offset, sectionOffset: saved.offset, estimatedFraction: saved.fraction };
    },
    nextWindow(limit, threshold) {
      refreshLayout();
      const bounds = content.getBoundingClientRect();
      // Prefer missing text actually on screen before prefetching either side.
      const visible = firstAfter(bounds.top);
      let item = visible;
      while (item && item.node.getBoundingClientRect().top < bounds.bottom) {
        if (!loaded[item.index]) return readerExtentWindow(loaded, item.index, limit);
        item = live[live.indexOf(item) + 1];
      }
      const near = firstAfter(bounds.top - threshold);
      item = near;
      while (item && item.node.getBoundingClientRect().top < bounds.bottom + threshold) {
        if (!loaded[item.index]) return readerExtentWindow(loaded, item.index, limit);
        item = live[live.indexOf(item) + 1];
      }
      return null;
    },
    replace(start, nodes, collapseAliases) {
      const saved = anchor();
      nodes.forEach((node, offset) => {
        const index = start + offset;
        if (loaded[index]) return;
        node.dataset.readerExtentIndex = String(index);
        node.style.contentVisibility = "visible";
        slots[index].replaceWith(node);
        slots[index] = node;
        loaded[index] = true;
      });
      collapseAliases();
      rememberBatch(nodes.map((_node, offset) => ({node: slots[start + offset], index: start + offset})));
      refreshLive();
      restore(saved);
    }
  };
}
