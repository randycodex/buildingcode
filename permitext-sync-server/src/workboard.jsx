import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Excalidraw, MainMenu } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import "./workboard.css";

const databaseName = "permitext-workboards";
const storeName = "boards";
const saveDelayMS = 500;
const roots = new WeakMap();

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open workboard storage."));
  });
}

async function readBoard(id) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(storeName, "readonly").objectStore(storeName).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Could not load this workboard."));
    });
  } finally {
    database.close();
  }
}

async function writeBoard(board) {
  const database = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).put(board);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Could not save this workboard."));
      transaction.onabort = () => reject(transaction.error || new Error("Workboard save was interrupted."));
    });
  } finally {
    database.close();
  }
}

async function deleteBoard(id) {
  const database = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Could not delete this workboard."));
      transaction.onabort = () => reject(transaction.error || new Error("Workboard deletion was interrupted."));
    });
  } finally {
    database.close();
  }
}

function persistedAppState(appState) {
  const keys = [
    "currentItemBackgroundColor",
    "currentItemEndArrowhead",
    "currentItemFillStyle",
    "currentItemFontFamily",
    "currentItemFontSize",
    "currentItemOpacity",
    "currentItemRoughness",
    "currentItemStartArrowhead",
    "currentItemStrokeColor",
    "currentItemStrokeStyle",
    "currentItemStrokeWidth",
    "currentItemTextAlign",
    "gridSize",
    "scrollX",
    "scrollY",
    "viewBackgroundColor",
    "zoom"
  ];
  return Object.fromEntries(keys.filter((key) => appState?.[key] !== undefined).map((key) => [key, appState[key]]));
}

function boardChangeSignature(elements, appState, files) {
  const fileMetadata = Object.keys(files || {}).sort().map((id) => {
    const file = files[id] || {};
    return [id, file.mimeType, file.created, file.lastRetrieved];
  });
  return JSON.stringify({ elements, appState: persistedAppState(appState), fileMetadata });
}

function preferredTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function updatedAtTime(board) {
  const timestamp = Date.parse(board?.updatedAt || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function filesWithoutInlineData(files = {}) {
  return Object.fromEntries(Object.entries(files).map(([id, file]) => {
    const { dataURL: _dataURL, ...metadata } = file || {};
    return [id, metadata];
  }));
}

async function hydrateRemoteFiles(board, loadAsset) {
  if (!board || !loadAsset) return board;
  const files = { ...(board.files || {}) };
  await Promise.all(Object.entries(board.assets || {}).map(async ([fileID, asset]) => {
    try {
      const dataURL = await loadAsset(asset);
      if (dataURL) files[fileID] = { ...(files[fileID] || {}), dataURL };
    } catch {
      // Keep the rest of the drawing usable if one remote image is unavailable.
    }
  }));
  return { ...board, files };
}

async function prepareBoardForSync(board, uploadAsset) {
  const assets = { ...(board.assets || {}) };
  if (uploadAsset) {
    for (const [fileID, file] of Object.entries(board.files || {})) {
      if (assets[fileID] || typeof file?.dataURL !== "string" || !file.dataURL.startsWith("data:")) continue;
      assets[fileID] = await uploadAsset(fileID, file);
    }
  }
  return {
    ...board,
    files: filesWithoutInlineData(board.files),
    assets
  };
}

function Workboard({
  projectID,
  projectName,
  onClose,
  onDetach,
  detachLabel = "Detach project and Workboard",
  syncEnabled = false,
  loadSyncedBoard,
  saveSyncedBoard,
  uploadAsset,
  loadAsset,
  remoteRevision = ""
}) {
  const [boardView, setBoardView] = useState(null);
  const [elementCount, setElementCount] = useState(0);
  const [status, setStatus] = useState("Loading…");
  const saveTimer = useRef(null);
  const pendingBoard = useRef(null);
  const lastChangeSignature = useRef("");
  const ignoreInitialChange = useRef(true);
  const remoteUpdatedAt = useRef(null);
  const assets = useRef({});
  const canvasHost = useRef(null);
  const excalidrawAPI = useRef(null);
  const refreshFrame = useRef(null);

  const refreshCanvasOrigin = useCallback(() => {
    window.cancelAnimationFrame(refreshFrame.current);
    refreshFrame.current = window.requestAnimationFrame(() => {
      excalidrawAPI.current?.refresh();
    });
  }, []);

  const captureExcalidrawAPI = useCallback((api) => {
    excalidrawAPI.current = api;
    api.toggleSidebar({ name: null, force: false });
    refreshCanvasOrigin();
  }, [refreshCanvasOrigin]);

  const flushSave = useCallback(async () => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const board = pendingBoard.current;
    if (!board) return;
    pendingBoard.current = null;
    try {
      await writeBoard(board);
      if (!syncEnabled || !saveSyncedBoard) {
        setStatus("Saved locally");
        return;
      }
      setStatus("Syncing…");
      const syncBoard = await prepareBoardForSync(board, uploadAsset);
      const savedBoard = await saveSyncedBoard(syncBoard, { baseUpdatedAt: remoteUpdatedAt.current });
      remoteUpdatedAt.current = savedBoard?.updatedAt || syncBoard.updatedAt;
      assets.current = syncBoard.assets;
      await writeBoard({ ...board, assets: syncBoard.assets, syncedAt: remoteUpdatedAt.current });
      setStatus("Synced");
    } catch (error) {
      pendingBoard.current = board;
      setStatus(syncEnabled ? "Saved locally · Sync pending" : error.message || "Could not save");
    }
  }, [saveSyncedBoard, syncEnabled, uploadAsset]);

  useEffect(() => {
    let active = true;
    setStatus("Loading…");
    Promise.all([
      readBoard(projectID),
      syncEnabled && loadSyncedBoard ? loadSyncedBoard(projectID).catch(() => null) : Promise.resolve(null)
    ])
      .then(async ([localBoard, remoteBoard]) => {
        if (!active) return;
        remoteUpdatedAt.current = remoteBoard?.updatedAt || null;
        const useRemote = remoteBoard && (!localBoard || updatedAtTime(remoteBoard) >= updatedAtTime(localBoard));
        const board = useRemote ? await hydrateRemoteFiles(remoteBoard, loadAsset) : localBoard;
        assets.current = { ...(board?.assets || {}) };
        const loadedData = {
          elements: board?.elements || [],
          appState: {
            ...(board?.appState || {}),
            theme: preferredTheme(),
            name: `${projectName} Workboard`
          },
          files: board?.files || {},
          assets: assets.current
        };
        lastChangeSignature.current = boardChangeSignature(
          loadedData.elements,
          loadedData.appState,
          loadedData.files
        );
        ignoreInitialChange.current = true;
        setElementCount(loadedData.elements.length);
        setBoardView({ projectID, projectName, initialData: loadedData });
        if (useRemote) {
          await writeBoard({ ...remoteBoard, files: loadedData.files, syncedAt: remoteBoard.updatedAt });
          setStatus("Synced");
        } else if (board && syncEnabled && saveSyncedBoard && updatedAtTime(board) > updatedAtTime(remoteBoard)) {
          pendingBoard.current = board;
          setStatus("Syncing…");
          void flushSave();
        } else {
          setStatus(board ? "Saved locally" : "New local board");
        }
      })
      .catch((error) => {
        if (!active) return;
        const loadedData = {
          elements: [],
          appState: { theme: preferredTheme(), name: `${projectName} Workboard` },
          files: {}
        };
        lastChangeSignature.current = boardChangeSignature(
          loadedData.elements,
          loadedData.appState,
          loadedData.files
        );
        ignoreInitialChange.current = true;
        setElementCount(0);
        setBoardView({ projectID, projectName, initialData: loadedData });
        setStatus(error.message || "Local storage unavailable");
      });

    return () => {
      active = false;
      if (pendingBoard.current) void flushSave();
    };
  }, [flushSave, loadAsset, loadSyncedBoard, projectID, projectName, remoteRevision, saveSyncedBoard, syncEnabled]);

  useEffect(() => {
    const host = canvasHost.current;
    if (!host || !boardView) return undefined;
    const panelTrack = host.closest(".panel-track");
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(refreshCanvasOrigin);
    const observeWorkspacePanels = () => {
      resizeObserver?.observe(host);
      if (!panelTrack) return;
      resizeObserver?.observe(panelTrack);
      panelTrack.querySelectorAll(":scope > .workspace-panel").forEach((panel) => resizeObserver?.observe(panel));
    };
    const mutationObserver = panelTrack && typeof MutationObserver !== "undefined"
      ? new MutationObserver(() => {
        observeWorkspacePanels();
        refreshCanvasOrigin();
      })
      : null;

    observeWorkspacePanels();
    mutationObserver?.observe(panelTrack, { childList: true });
    panelTrack?.addEventListener("scroll", refreshCanvasOrigin, { passive: true });
    panelTrack?.addEventListener("transitionend", refreshCanvasOrigin, true);
    window.addEventListener("resize", refreshCanvasOrigin, { passive: true });
    refreshCanvasOrigin();

    return () => {
      window.cancelAnimationFrame(refreshFrame.current);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      panelTrack?.removeEventListener("scroll", refreshCanvasOrigin);
      panelTrack?.removeEventListener("transitionend", refreshCanvasOrigin, true);
      window.removeEventListener("resize", refreshCanvasOrigin);
    };
  }, [boardView, refreshCanvasOrigin]);

  const handleChange = useCallback((elements, appState, files) => {
    if (!boardView || boardView.projectID !== projectID) return;
    const signature = boardChangeSignature(elements, appState, files);
    if (ignoreInitialChange.current) {
      ignoreInitialChange.current = false;
      lastChangeSignature.current = signature;
      setElementCount(elements.length);
      return;
    }
    if (signature === lastChangeSignature.current) return;
    lastChangeSignature.current = signature;
    setElementCount(elements.length);
    pendingBoard.current = {
      id: boardView.projectID,
      projectName: boardView.projectName,
      elements: elements.map((element) => ({ ...element })),
      appState: persistedAppState(appState),
      files: { ...files },
      assets: { ...assets.current },
      updatedAt: new Date().toISOString()
    };
    setStatus("Saving…");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void flushSave(), saveDelayMS);
  }, [boardView, flushSave, projectID]);

  return (
    <section className="permitext-workboard" data-element-count={elementCount}>
      <header className="permitext-workboard-header">
        <div>
          <p>Project Workboard</p>
          <h2>{projectName}</h2>
        </div>
        <div className="permitext-workboard-header-actions">
          <span className="permitext-workboard-save-state" role="status">{status}</span>
          {onDetach ? (
            <button type="button" onClick={onDetach} aria-label={detachLabel} title={detachLabel}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 3h7v7" />
                <path d="m10 14 11-11" />
                <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
              </svg>
            </button>
          ) : null}
          <button type="button" onClick={onClose} aria-label="Close workboard" title="Close workboard">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <path d="m15 9-6 6M9 9l6 6" />
            </svg>
          </button>
        </div>
      </header>
      <div className="permitext-workboard-canvas" ref={canvasHost}>
        {boardView ? (
          <Excalidraw
            key={boardView.projectID}
            initialData={boardView.initialData}
            excalidrawAPI={captureExcalidrawAPI}
            onChange={handleChange}
            theme={preferredTheme()}
            name={`${boardView.projectName} Workboard`}
            autoFocus
            aiEnabled={false}
            UIOptions={{
              canvasActions: {
                changeViewBackgroundColor: true,
                clearCanvas: true,
                export: { saveFileToDisk: true },
                loadScene: false,
                saveAsImage: true,
                saveToActiveFile: false,
                toggleTheme: false
              },
              tools: { image: true }
            }}
          >
            <MainMenu>
              <MainMenu.DefaultItems.SaveAsImage />
              <MainMenu.DefaultItems.SearchMenu />
              <MainMenu.DefaultItems.Help />
              <MainMenu.DefaultItems.ClearCanvas />
              <MainMenu.Separator />
              <MainMenu.DefaultItems.ToggleTheme />
              <MainMenu.DefaultItems.ChangeCanvasBackground />
            </MainMenu>
          </Excalidraw>
        ) : (
          <div className="permitext-workboard-loading" aria-live="polite">Loading workboard…</div>
        )}
      </div>
    </section>
  );
}

export function mountWorkboard(container, options) {
  if (window.location.hash.startsWith("#addLibrary=")) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }
  root.render(<Workboard {...options} />);
  return () => {
    root.unmount();
    roots.delete(container);
  };
}

export async function replaceLocalWorkboard(projectID, board) {
  const id = String(projectID || "").trim();
  if (!id) return;
  if (!board || board.deletedAt) {
    await deleteBoard(id);
    return;
  }
  await writeBoard({ ...board, id });
}

export async function deleteLocalWorkboard(projectID) {
  const id = String(projectID || "").trim();
  if (id) await deleteBoard(id);
}
