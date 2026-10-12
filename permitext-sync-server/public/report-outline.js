// Both the document and its outline move the same live draft blocks.
export function reportDropIndex(sourceIndex, targetIndex, after = false) {
  const boundary = targetIndex + Number(after);
  return boundary > sourceIndex ? boundary - 1 : boundary;
}

export function moveReportBlock(blocks, sourceIndex, targetIndex) {
  if (!Number.isInteger(sourceIndex) || !Number.isInteger(targetIndex) ||
      sourceIndex < 0 || targetIndex < 0 || sourceIndex >= blocks.length ||
      targetIndex >= blocks.length || sourceIndex === targetIndex) return false;
  const [block] = blocks.splice(sourceIndex, 1);
  blocks.splice(targetIndex, 0, block);
  return true;
}

export function scrollReportTarget(container, target) {
  container.scrollTo({
    top: Math.max(0, container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top - 32),
    behavior: "smooth"
  });
}

export function revealOutlineHandle(container, handle) {
  const bounds = container.getBoundingClientRect(), item = handle.getBoundingClientRect();
  if (item.top < bounds.top + 8) container.scrollTop -= bounds.top + 8 - item.top;
  else if (item.bottom > bounds.bottom - 8) container.scrollTop += item.bottom - bounds.bottom + 8;
}

export async function navigateReportOutline({ requests, isCurrent, navigate }) {
  // Preview responses change the height of earlier items; measure after they render.
  await Promise.allSettled([...requests]);
  if (isCurrent()) navigate();
}

// Derive sections from the authored headings without sorting or changing sources.
export function groupReportOutline(blocks) {
  const groups = [];
  let section = null;
  for (const block of blocks) {
    if (block.kind === "heading") {
      section = { block, children: [] };
      groups.push(section);
    } else if (section) section.children.push(block);
    else groups.push({ block, children: [] });
  }
  return groups;
}

export function reportOutlineDropIndex(blocks, sourceIndex, targetIndex, after, collapsed) {
  // Dropping below a folded heading means after its hidden contents.
  if (after && collapsed && blocks[targetIndex]?.kind === "heading") {
    while (targetIndex + 1 < blocks.length && blocks[targetIndex + 1].kind !== "heading") targetIndex++;
  }
  return reportDropIndex(sourceIndex, targetIndex, after);
}

export function createReportOutline({ blocks, introduction, targets, documentBody, describe,
  onNavigate, onMove, dragIcon, sectionExpansion = new Map() }) {
  const outline = document.createElement("nav");
  outline.className = "report-outline";
  outline.setAttribute("aria-label", "Report outline");
  const title = document.createElement("h2");
  title.textContent = "Outline";
  const contents = document.createElement("div");
  contents.className = "report-outline-contents reader-nav-tree";
  const links = [];
  const rows = [];
  const entries = new Map();
  const parents = new Map();
  const sectionKey = block => block.id || block;
  const isExpanded = block => sectionExpansion.get(sectionKey(block)) !== false;
  let dragged = null;
  let scrollFrame = 0;
  let pointerDrag = null;
  let dragFrame = 0;
  let currentLink = null;
  const markCurrent = link => {
    currentLink = link;
    const parent = parents.get(blocks[links.indexOf(link) - 1]);
    if (parent && !isExpanded(parent)) link = entries.get(parent).link;
    links.forEach(candidate => {
      if (candidate === link) candidate.setAttribute("aria-current", "location");
      else candidate.removeAttribute("aria-current");
    });
  };
  const makeLink = (target, label) => {
    const link = document.createElement("button");
    link.type = "button";
    link.className = "reader-nav-label report-outline-link";
    link.addEventListener("click", () => { markCurrent(link); onNavigate(target); });
    link.textContent = label;
    links.push(link);
    return link;
  };
  const introRow = document.createElement("div");
  introRow.className = "reader-nav-row report-outline-introduction";
  const intro = makeLink(introduction, "Introduction");
  introRow.append(intro);
  const paintSection = block => {
    const { toggle, children } = entries.get(block);
    toggle.setAttribute("aria-expanded", String(isExpanded(block)));
    children.hidden = !isExpanded(block);
    if (currentLink) markCurrent(currentLink);
  };
  const dropIndex = (block, row, after) => {
    const targetIndex = rows.indexOf(row);
    return reportOutlineDropIndex(blocks, blocks.indexOf(block), targetIndex, after,
      !isExpanded(blocks[targetIndex]));
  };
  const clearDrag = () => rows.forEach(row => row.classList.remove("is-dragging", "is-drop-before", "is-drop-after"));
  const paintPointerDrop = () => {
    if (!pointerDrag?.started) return;
    const { y, block } = pointerDrag;
    const bounds = outline.getBoundingClientRect();
    const scroll = y < bounds.top + 36 ? -10 : y > bounds.bottom - 36 ? 10 : 0;
    if (scroll) outline.scrollTop += scroll;
    const visibleRows = rows.filter((row, index) => {
      const parent = parents.get(blocks[index]);
      return !parent || isExpanded(parent);
    });
    const target = visibleRows.find(row => row.getBoundingClientRect().bottom > y) || visibleRows.at(-1);
    if (!target) return;
    pointerDrag.index = dropIndex(block, target, y > target.getBoundingClientRect().top + target.offsetHeight / 2);
    clearDrag();
    rows[blocks.indexOf(block)]?.classList.add("is-dragging");
    if (target !== rows[blocks.indexOf(block)]) target.classList.add(
      y > target.getBoundingClientRect().top + target.offsetHeight / 2 ? "is-drop-after" : "is-drop-before");
    dragFrame = requestAnimationFrame(paintPointerDrop);
  };
  const refreshLabels = () => rows.forEach((row, index) => {
    const { title, detail = "" } = describe(blocks[index]);
    row.querySelector(".report-outline-item-title").textContent = title;
    const caption = row.querySelector(".report-outline-item-detail");
    caption.textContent = detail;
    caption.hidden = !detail;
    row.querySelector(".report-outline-link").title = [title, detail].filter(Boolean).join(" · ");
    row.querySelector(".report-outline-drag").setAttribute("aria-label", `Reorder ${title}`);
    const toggle = entries.get(blocks[index]).toggle;
    if (toggle) toggle.setAttribute("aria-label", `Expand or collapse ${title}`);
  });
  blocks.forEach((block, index) => {
    const row = document.createElement("div");
    row.className = "reader-nav-row report-outline-item";
    if (block.kind === "heading") row.classList.add("is-heading");
    row.dataset.blockId = block.id || `${block.kind}-${index}`;
    row.draggable = true;
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "report-outline-drag";
    handle.title = "Drag to reorder. Use Arrow Up or Arrow Down when focused.";
    handle.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown");
    handle.innerHTML = dragIcon;
    // Pointer capture keeps dragging predictable in WebKit and when crossing buttons.
    handle.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      event.preventDefault();
      handle.focus({ preventScroll: true });
      handle.setPointerCapture(event.pointerId);
      pointerDrag = { block, startY: event.clientY, y: event.clientY, started: false, index };
    });
    handle.addEventListener("pointermove", event => {
      if (!pointerDrag || pointerDrag.block !== block) return;
      pointerDrag.y = event.clientY;
      if (!pointerDrag.started && Math.abs(event.clientY - pointerDrag.startY) > 4) {
        pointerDrag.started = true;
        paintPointerDrop();
      }
    });
    const endPointerDrag = cancelled => {
      const move = pointerDrag;
      pointerDrag = null;
      cancelAnimationFrame(dragFrame);
      clearDrag();
      if (!cancelled && move?.started) onMove(move.block, move.index, "outline");
    };
    handle.addEventListener("pointerup", () => endPointerDrag(false));
    handle.addEventListener("pointercancel", () => endPointerDrag(true));
    handle.addEventListener("lostpointercapture", () => endPointerDrag(true));
    handle.addEventListener("keydown", event => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      onMove(block, blocks.indexOf(block) + (event.key === "ArrowUp" ? -1 : 1), "outline");
    });
    const link = makeLink(targets[index], "");
    const number = document.createElement("span");
    number.className = "report-outline-number";
    number.textContent = `${index + 1}.`;
    number.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "report-outline-item-label";
    const name = document.createElement("span");
    name.className = "report-outline-item-title";
    const detail = document.createElement("span");
    detail.className = "report-outline-item-detail";
    label.append(name, detail);
    link.append(number, label);
    const spacer = document.createElement("span");
    spacer.className = "reader-nav-chevron-space report-outline-section-space";
    spacer.setAttribute("aria-hidden", "true");
    row.append(spacer, handle, link);
    const entry = {row, link, spacer, target: targets[index]};
    if (block.kind === "heading") {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "reader-nav-chevron report-outline-section-toggle";
      toggle.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"></path></svg>';
      const children = document.createElement("div");
      children.className = "reader-nav-section-group report-outline-section-items";
      children.id = `report-outline-section-${row.dataset.blockId}`;
      toggle.setAttribute("aria-controls", children.id);
      toggle.addEventListener("click", () => {
        sectionExpansion.set(sectionKey(block), !isExpanded(block));
        paintSection(block);
      });
      row.replaceChildren(toggle, spacer, handle, link);
      const section = document.createElement("div");
      section.className = "reader-nav-chapter report-outline-section";
      Object.assign(entry, {toggle, children, section});
    }
    row.addEventListener("dragstart", event => {
      dragged = block;
      row.classList.add("is-dragging");
      event.dataTransfer?.setData("text/plain", row.dataset.blockId);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    });
    row.addEventListener("dragend", () => { dragged = null; clearDrag(); });
    row.addEventListener("dragover", event => {
      if (!dragged || dragged === block) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      clearDrag();
      rows[blocks.indexOf(dragged)]?.classList.add("is-dragging");
      row.classList.add(event.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2
        ? "is-drop-after" : "is-drop-before");
    });
    row.addEventListener("dragleave", event => {
      if (!row.contains(event.relatedTarget)) row.classList.remove("is-drop-before", "is-drop-after");
    });
    row.addEventListener("drop", event => {
      if (!dragged) return;
      event.preventDefault();
      const moved = dragged;
      const targetIndex = dropIndex(moved, row,
        event.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2);
      dragged = null;
      clearDrag();
      onMove(moved, targetIndex, "outline");
    });
    rows.push(row);
    entries.set(block, entry);
  });
  const renderGroups = () => {
    parents.clear();
    contents.replaceChildren();
    for (const { block, children } of groupReportOutline(blocks)) {
      const entry = entries.get(block);
      if (!entry.section) { contents.append(entry.row); continue; }
      entry.children.replaceChildren(...children.map(child => {
        parents.set(child, block);
        return entries.get(child).row;
      }));
      entry.toggle.hidden = !children.length;
      entry.spacer.hidden = Boolean(children.length);
      entry.section.append(entry.row, entry.children);
      contents.append(entry.section);
      paintSection(block);
    }
    if (currentLink) markCurrent(currentLink);
  };
  renderGroups();
  refreshLabels();
  const status = document.createElement("span");
  status.className = "sr-only";
  status.setAttribute("role", "status");
  outline.append(title, introRow, contents, status);
  const updateCurrent = () => {
    scrollFrame = 0;
    const top = documentBody.getBoundingClientRect().top + 48;
    let current = intro;
    targets.forEach((target, index) => {
      if (target.offsetHeight && target.getBoundingClientRect().top <= top) current = links[index + 1];
    });
    markCurrent(current);
  };
  const onScroll = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateCurrent); };
  documentBody.addEventListener("scroll", onScroll);
  onScroll();
  return { element: outline, refreshLabels,
    reorder() {
      const scroll = outline.scrollTop;
      rows.splice(0, rows.length, ...blocks.map(block => entries.get(block).row));
      targets.splice(0, targets.length, ...blocks.map(block => entries.get(block).target));
      links.splice(1, links.length - 1, ...blocks.map(block => entries.get(block).link));
      rows.forEach((row, index) => { row.querySelector(".report-outline-number").textContent = `${index + 1}.`; });
      renderGroups();
      refreshLabels();
      outline.scrollTop = scroll;
      onScroll();
    },
    reveal(block) {
      const parent = parents.get(block);
      if (parent && !isExpanded(parent)) {
        sectionExpansion.set(sectionKey(parent), true);
        paintSection(parent);
      }
    },
    announce: message => { status.textContent = message; },
    dispose() { documentBody.removeEventListener("scroll", onScroll); cancelAnimationFrame(scrollFrame); cancelAnimationFrame(dragFrame); }
  };
}
