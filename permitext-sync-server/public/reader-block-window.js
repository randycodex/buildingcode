// Keep source data for the whole section, but only materialize nearby passages.
// Empty slots reserve scroll space; exact block IDs survive eviction/recreation.
export function createReaderBlockWindow({root, content, panel, blocks, blockID, render, release, beforeMount, isCurrent, initialBlockID = ''}) {
  const doc = root.ownerDocument;
  const slots = [], mounted = new Set(), heights = new Map(), presentation = new Map();
  const ids = new Map(blocks.map((block, index) => [blockID(block, index), index]));
  const windowSize = 40;
  let frame = 0, stopped = false, center = Math.max(0, ids.get(initialBlockID) ?? 0), width = content.clientWidth || 600;
  const estimate = index => Math.max(52, Math.ceil((blocks[index].plainText || '').length / Math.max(20, width / 8)) * 24 + 20);
  const placeholder = index => {
    const node = doc.createElement('div');
    node.className = 'reader-block-placeholder';
    node.dataset.blockId = blockID(blocks[index], index);
    node.setAttribute('aria-hidden', 'true');
    node.dataset.researchSelectionExclude = 'true';
    node.style.height = `${heights.get(index) ?? estimate(index)}px`;
    return node;
  };
  blocks.forEach((_block, index) => {const node = placeholder(index); slots.push(node); root.append(node);});
  const protectedNode = node => {
    const selection = doc.getSelection?.();
    return node.classList.contains('is-navigation-target') || node.classList.contains('is-source-target') ||
      Boolean(node.querySelector?.('.notebook-evidence-highlight')) || node.contains(doc.activeElement) || selection && !selection.isCollapsed &&
      (node.contains(selection.anchorNode) || node.contains(selection.focusNode) || selection.containsNode?.(node, true));
  };
  const evict = index => {
    const node = slots[index];
    // Do not measure offscreen descendants while suspending a whole Reader.
    presentation.set(index, ["is-source-target", "is-navigation-target"].filter(name => node.classList.contains(name)));
    release(node);
    const empty = placeholder(index);
    node.replaceWith(empty); slots[index] = empty; mounted.delete(index);
  };
  const range = (index, preserveAnchor = true) => {
    if (stopped || !isCurrent()) return null;
    center = Math.max(0, Math.min(blocks.length - 1, index));
    const start = Math.max(0, Math.min(blocks.length - windowSize, center - windowSize / 2));
    const end = Math.min(blocks.length, start + windowSize);
    const anchor = slots[center], top = preserveAnchor && root.isConnected ? anchor.getBoundingClientRect().top : null;
    for (const old of [...mounted]) if ((old < start || old >= end) && !protectedNode(slots[old])) evict(old);
    beforeMount();
    for (let next = start; next < end; next++) {
      if (mounted.has(next)) continue;
      const node = render(blocks[next], next);
      for (const name of presentation.get(next) || []) node.classList.add(name);
      slots[next].replaceWith(node); slots[next] = node; mounted.add(next);
    }
    // Measure just this bounded window, never the other 1,000+ source bodies.
    if (root.isConnected && visible()) for (const next of mounted) heights.set(next, slots[next].getBoundingClientRect().height);
    if (top !== null) content.scrollTop += slots[center].getBoundingClientRect().top - top;
    return slots[center];
  };
  const visible = () => {
    if (!panel.isConnected || panel.classList.contains('is-workflow-hidden') || panel.classList.contains('is-collapsed')) return false;
    const box = panel.getBoundingClientRect();
    return box.width > 0 && box.right > 0 && box.left < window.innerWidth;
  };
  const update = () => {
    frame = 0;
    if (stopped || !isCurrent()) return;
    if (!visible()) {
      for (const index of [...mounted]) if (!protectedNode(slots[index])) evict(index);
      return;
    }
    const viewport = content.getBoundingClientRect(), section = root.getBoundingClientRect();
    if (section.bottom < viewport.top - 600 || section.top > viewport.bottom + 600) {
      for (const index of [...mounted]) if (!protectedNode(slots[index])) evict(index);
      return;
    }
    const top = viewport.top;
    let lower = 0, upper = slots.length;
    while (lower < upper) {
      const middle = (lower + upper) >>> 1;
      if (slots[middle].getBoundingClientRect().bottom <= top) lower = middle + 1;
      else upper = middle;
    }
    const index = Math.min(lower, slots.length - 1);
    const previousTop = slots[index].getBoundingClientRect().top;
    const nextWidth = content.clientWidth;
    if (nextWidth !== width) {
      width = nextWidth; heights.clear();
      for (let index = 0; index < slots.length; index++) if (!mounted.has(index)) slots[index].style.height = `${estimate(index)}px`;
    }
    range(index);
    content.scrollTop += slots[index].getBoundingClientRect().top - previousTop;
  };
  const schedule = () => {if (!stopped && !frame) frame = requestAnimationFrame(update);};
  const observer = new IntersectionObserver(schedule);
  observer.observe(panel);
  const resize = new ResizeObserver(schedule); resize.observe(content);
  content.addEventListener('scroll', schedule, {passive:true});
  const track = doc; // Pane construction may precede its attachment to the track.
  // Scroll events do not bubble; observe the workspace track directly as well.
  track.addEventListener('scroll', schedule, {passive:true, capture:true});
  track?.addEventListener('permitext:workspace-layout-change', schedule);
  const controller = {
    text: () => blocks.map(block => block.plainText || "").join(" "),
    ensure(id) {const index = ids.get(id); return index === undefined ? null : range(index);},
    ensureText(text) {
      const needle = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!needle) return null;
      const index = blocks.findIndex(block => String(block.plainText || '').replace(/\s+/g, ' ').toLowerCase().includes(needle));
      return index < 0 ? null : range(index);
    },
    dispose() {
      stopped = true; cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect();
      content.removeEventListener('scroll', schedule); track.removeEventListener('scroll', schedule, true);
      track?.removeEventListener('permitext:workspace-layout-change', schedule);
      for (const index of mounted) release(slots[index]);
      mounted.clear();
    }
  };
  range(center, false); schedule();
  return controller;
}
