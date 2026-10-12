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

export function createReportOutline({ blocks, introduction, targets, documentBody, describe,
  onNavigate, onMove, dragIcon, expanded = true, onExpanded = () => {} }) {
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
  let dragged = null;
  let scrollFrame = 0;
  let pointerDrag = null;
  let dragFrame = 0;
  const markCurrent = link => links.forEach(candidate => {
    if (candidate === link) candidate.setAttribute("aria-current", "location");
    else candidate.removeAttribute("aria-current");
  });
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
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "report-outline-toggle";
  toggle.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"></path></svg>';
  const toggleLabel = document.createElement("span");
  toggleLabel.textContent = `Contents · ${blocks.length}`;
  toggle.append(toggleLabel);
  const paintExpanded = () => {
    toggle.setAttribute("aria-expanded", String(expanded));
    contents.hidden = !expanded;
  };
  toggle.addEventListener("click", () => { expanded = !expanded; paintExpanded(); onExpanded(expanded); });
  paintExpanded();
  const clearDrag = () => rows.forEach(row => row.classList.remove("is-dragging", "is-drop-before", "is-drop-after"));
  const paintPointerDrop = () => {
    if (!pointerDrag?.started) return;
    const { y, block } = pointerDrag;
    const bounds = outline.getBoundingClientRect();
    const scroll = y < bounds.top + 36 ? -10 : y > bounds.bottom - 36 ? 10 : 0;
    if (scroll) outline.scrollTop += scroll;
    const target = rows.find(row => row.getBoundingClientRect().bottom > y) || rows.at(-1);
    const index = rows.indexOf(target);
    pointerDrag.index = reportDropIndex(blocks.indexOf(block), index,
      y > target.getBoundingClientRect().top + target.offsetHeight / 2);
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
    row.append(handle, link);
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
      const targetIndex = reportDropIndex(blocks.indexOf(moved), rows.indexOf(row),
        event.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2);
      dragged = null;
      clearDrag();
      onMove(moved, targetIndex, "outline");
    });
    rows.push(row);
    entries.set(block, {row, link, target: targets[index]});
    contents.append(row);
  });
  refreshLabels();
  const status = document.createElement("span");
  status.className = "sr-only";
  status.setAttribute("role", "status");
  outline.append(title, introRow, toggle, contents, status);
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
      contents.append(...rows);
      refreshLabels();
      outline.scrollTop = scroll;
      onScroll();
    },
    announce: message => { status.textContent = message; },
    dispose() { documentBody.removeEventListener("scroll", onScroll); cancelAnimationFrame(scrollFrame); cancelAnimationFrame(dragFrame); }
  };
}
