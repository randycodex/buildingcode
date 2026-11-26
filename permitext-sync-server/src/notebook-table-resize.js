import { createExtension } from "@blocknote/core";
import { Extension } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import { Plugin } from "@tiptap/pm/state";
import { TableMap } from "@tiptap/pm/tables";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  isNotebookTableRowHeight,
  notebookTableMaxSize,
  notebookTableMinColumnWidth,
  notebookTableMinRowHeight
} from "./notebook-schema.js";

const rowHeightAttribute = Extension.create({
  name: "permitextNotebookRowHeight",
  addGlobalAttributes() {
    return [{
      types: ["tableRow"],
      attributes: {
        notebookHeight: {
          default: null,
          parseHTML(element) {
            const height = Number(element.getAttribute("data-notebook-row-height"));
            return isNotebookTableRowHeight(height) ? height : null;
          },
          renderHTML({ notebookHeight }) {
            return isNotebookTableRowHeight(notebookHeight)
              ? { "data-notebook-row-height": notebookHeight, style: `height: ${notebookHeight}px` }
              : {};
          }
        }
      }
    }];
  }
});

function isCell(node) {
  return node?.type.spec.tableRole === "cell" || node?.type.spec.tableRole === "header_cell";
}

function resizeTarget(view, cellPosition, axis, handle) {
  if (!view.editable) return;
  const cell = view.state.doc.nodeAt(cellPosition);
  const tableElement = handle.closest("table");
  if (!tableElement || !isCell(cell)) return;

  const position = view.state.doc.resolve(cellPosition);
  const table = position.node(position.depth - 1);
  const tableStart = position.start(position.depth - 1);
  const map = TableMap.get(table);
  const bounds = map.findCell(cellPosition - tableStart);
  const index = axis === "column" ? bounds.right - 1 : bounds.bottom - 1;
  const column = axis === "column" && tableElement.querySelectorAll(":scope > colgroup > col")[index];
  const row = axis === "row" && tableElement.rows[index];
  const size = axis === "column"
    ? column?.getBoundingClientRect().width || handle.parentElement.getBoundingClientRect().width / cell.attrs.colspan
    : row?.getBoundingClientRect().height;
  if (size > 0) return { axis, doc: view.state.doc, index, map, size, table, tableStart };
}

function boundedSize(target, delta) {
  const minimum = target.axis === "column" ? notebookTableMinColumnWidth : notebookTableMinRowHeight;
  return Math.max(minimum, Math.min(notebookTableMaxSize, Math.round(target.size + delta)));
}

function applySize(view, target, size) {
  if (!view.editable || view.state.doc !== target.doc || size === Math.round(target.size)) return;
  const { index, map, table, tableStart } = target;
  const transaction = view.state.tr;
  if (target.axis === "row") {
    table.forEach((row, offset, rowIndex) => {
      if (rowIndex === index && row.attrs.notebookHeight !== size) {
        transaction.setNodeAttribute(tableStart + offset, "notebookHeight", size);
      }
    });
  } else {
    const visited = new Set();
    for (let row = 0; row < map.height; row++) {
      const offset = map.map[row * map.width + index];
      if (visited.has(offset)) continue;
      visited.add(offset);
      const cell = table.nodeAt(offset);
      if (!cell) continue;
      const widths = cell.attrs.colwidth?.slice() ?? Array(cell.attrs.colspan).fill(0);
      widths[index - map.findCell(offset).left] = size;
      transaction.setNodeAttribute(tableStart + offset, "colwidth", widths);
    }
  }
  if (transaction.docChanged) view.dispatch(closeHistory(transaction));
}

function resizeHandle(view, cellPosition, axis) {
  const handle = view.dom.ownerDocument.createElement("button");
  handle.type = "button";
  handle.className = `notebook-resize-handle notebook-resize-${axis}`;
  handle.setAttribute("aria-label", `Resize ${axis}`);
  // A native scroll container can move the web view during a touch drag.
  // Measure touch movement in screen coordinates to keep that scroll out of the delta.
  const coordinate = event => {
    if (event.pointerType === "touch") {
      const scale = view.dom.ownerDocument.defaultView.visualViewport?.scale ?? 1;
      return (axis === "column" ? event.screenX : event.screenY) / scale;
    }
    return axis === "column" ? event.clientX : event.clientY;
  };
  let drag;
  const clearDrag = () => {
    drag = undefined;
    delete handle.dataset.dragging;
    handle.style.removeProperty("--notebook-resize-offset");
  };
  handle.addEventListener("pointerdown", event => {
    if (event.button !== 0 || drag) return;
    const target = resizeTarget(view, cellPosition, axis, handle);
    if (!target) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    drag = { target, start: coordinate(event), pointerId: event.pointerId };
    handle.dataset.dragging = "true";
  });
  handle.addEventListener("mousedown", event => {
    event.preventDefault();
    event.stopPropagation();
  });
  handle.addEventListener("pointermove", event => {
    if (event.pointerId !== drag?.pointerId) return;
    const size = boundedSize(drag.target, coordinate(event) - drag.start);
    handle.style.setProperty("--notebook-resize-offset", `${size - drag.target.size}px`);
  });
  handle.addEventListener("pointerup", event => {
    if (event.pointerId !== drag?.pointerId) return;
    const { target, start } = drag;
    clearDrag();
    const delta = coordinate(event) - start;
    if (Math.abs(delta) >= 2) applySize(view, target, boundedSize(target, delta));
  });
  handle.addEventListener("lostpointercapture", clearDrag);
  handle.addEventListener("keydown", event => {
    const [smaller, larger] = axis === "column" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
    if (event.key !== smaller && event.key !== larger) return;
    const target = resizeTarget(view, cellPosition, axis, handle);
    if (!target) return;
    event.preventDefault();
    const delta = (event.key === smaller ? -1 : 1) * (event.shiftKey ? 32 : 8);
    applySize(view, target, boundedSize(target, delta));
  });
  return handle;
}

export const notebookTableResize = createExtension({
  key: "permitextNotebookTableResize",
  tiptapExtensions: [rowHeightAttribute],
  prosemirrorPlugins: [new Plugin({
    props: {
      decorations(state) {
        const position = state.selection.$head;
        for (let depth = position.depth; depth > 0; depth--) {
          if (!isCell(position.node(depth))) continue;
          const cellPosition = position.before(depth);
          return DecorationSet.create(state.doc, ["column", "row"].map(axis =>
            Decoration.widget(position.end(depth), view => resizeHandle(view, cellPosition, axis), {
              key: `${axis}-resize-${cellPosition}`, side: -1, stopEvent: () => true
            })
          ));
        }
        return null;
      }
    }
  })]
});

export function notebookBlocksWithTableHeights(editor) {
  const heights = new Map();
  editor.prosemirrorState.doc.descendants((node, _pos, parent) => {
    if (node.type.name !== "table") return;
    const rows = node.children.map(row => row.attrs.notebookHeight);
    if (rows.some(isNotebookTableRowHeight)) heights.set(parent.attrs.id, rows);
    return false;
  });
  const blocks = editor.document;
  if (!heights.size) return blocks;
  const withHeights = block => {
    const rows = heights.get(block.id);
    return {
      ...block,
      ...(rows ? { content: {
        ...block.content,
        rows: block.content.rows.map((row, index) => isNotebookTableRowHeight(rows[index])
          ? { ...row, height: rows[index] }
          : row)
      } } : {}),
      children: block.children.map(withHeights)
    };
  };
  return blocks.map(withHeights);
}

// BlockNote serializes cell widths but doesn't expose ProseMirror row attributes.
export function restoreNotebookTableHeights(transaction, blocks, blockID) {
  const tables = [];
  function collect(blocks) {
    for (const block of blocks) {
      if (block.type === "table" && (!blockID || block.id === blockID)) tables.push(block.content.rows);
      collect(block.children ?? []);
    }
  }
  collect(blocks);
  if (!tables.some(rows => rows.some(row => isNotebookTableRowHeight(row.height)))) return;
  let index = 0;
  transaction.doc.descendants((node, position, parent) => {
    if (node.type.name !== "table") return;
    if (blockID && parent.attrs.id !== blockID) return false;
    const rows = tables[index++];
    node.forEach((row, offset, rowIndex) => {
      const height = rows?.[rowIndex]?.height;
      if (isNotebookTableRowHeight(height) && row.attrs.notebookHeight !== height) {
        transaction.setNodeAttribute(position + 1 + offset, "notebookHeight", height);
      }
    });
    return false;
  });
}
