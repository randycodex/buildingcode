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

function Workboard({ projectID, projectName, onClose }) {
  const [initialData, setInitialData] = useState(null);
  const [elementCount, setElementCount] = useState(0);
  const [status, setStatus] = useState("Loading…");
  const saveTimer = useRef(null);
  const pendingBoard = useRef(null);
  const lastChangeSignature = useRef("");

  const flushSave = useCallback(async () => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const board = pendingBoard.current;
    if (!board) return;
    pendingBoard.current = null;
    try {
      await writeBoard(board);
      setStatus("Saved locally");
    } catch (error) {
      pendingBoard.current = board;
      setStatus(error.message || "Could not save");
    }
  }, []);

  useEffect(() => {
    let active = true;
    setStatus("Loading…");
    readBoard(projectID)
      .then((board) => {
        if (!active) return;
        const loadedData = {
          elements: board?.elements || [],
          appState: {
            ...(board?.appState || {}),
            theme: preferredTheme(),
            name: `${projectName} Workboard`
          },
          files: board?.files || {}
        };
        lastChangeSignature.current = boardChangeSignature(
          loadedData.elements,
          loadedData.appState,
          loadedData.files
        );
        setElementCount(loadedData.elements.length);
        setInitialData(loadedData);
        setStatus(board ? "Saved locally" : "New local board");
      })
      .catch((error) => {
        if (!active) return;
        const loadedData = { elements: [], appState: { theme: preferredTheme() }, files: {} };
        lastChangeSignature.current = boardChangeSignature(
          loadedData.elements,
          loadedData.appState,
          loadedData.files
        );
        setElementCount(0);
        setInitialData(loadedData);
        setStatus(error.message || "Local storage unavailable");
      });

    return () => {
      active = false;
      if (pendingBoard.current) void flushSave();
    };
  }, [flushSave, projectID, projectName]);

  const handleChange = useCallback((elements, appState, files) => {
    if (!initialData) return;
    const signature = boardChangeSignature(elements, appState, files);
    if (signature === lastChangeSignature.current) return;
    lastChangeSignature.current = signature;
    setElementCount(elements.length);
    pendingBoard.current = {
      id: projectID,
      projectName,
      elements: elements.map((element) => ({ ...element })),
      appState: persistedAppState(appState),
      files: { ...files },
      updatedAt: new Date().toISOString()
    };
    setStatus("Saving…");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void flushSave(), saveDelayMS);
  }, [flushSave, initialData, projectID, projectName]);

  return (
    <section className="permitext-workboard" data-element-count={elementCount}>
      <header className="permitext-workboard-header">
        <div>
          <p>Project Workboard</p>
          <h2>{projectName}</h2>
        </div>
        <div className="permitext-workboard-header-actions">
          <span className="permitext-workboard-save-state" role="status">{status}</span>
          <button type="button" onClick={onClose} aria-label="Close workboard" title="Close workboard">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <path d="m15 9-6 6M9 9l6 6" />
            </svg>
          </button>
        </div>
      </header>
      <div className="permitext-workboard-canvas">
        {initialData ? (
          <Excalidraw
            initialData={initialData}
            onChange={handleChange}
            theme={preferredTheme()}
            name={`${projectName} Workboard`}
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
              <MainMenu.DefaultItems.LoadScene />
              <MainMenu.DefaultItems.SaveToActiveFile />
              <MainMenu.DefaultItems.Export />
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
