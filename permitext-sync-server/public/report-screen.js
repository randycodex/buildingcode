// Keep workspace columns and the draft mounted across view switches. A native
// modal makes the background inert without resizing or rebuilding its editors.
export function createReportScreen({ projectName, load, isCurrent, onClose, onDispose, screenTitle = "Report", screenClass = "", openProjectDetails, backLabel = () => "← Back to workspace" }) {
  const dialog = document.createElement("dialog");
  dialog.className = `report-screen ${screenClass}`.trim();
  dialog.setAttribute("aria-label", `${screenTitle} workspace`);
  const header = document.createElement("header");
  header.className = "report-screen-header";
  const back = document.createElement("button");
  back.type = "button";
  back.textContent = backLabel();
  back.addEventListener("click", () => dialog.close());
  const title = document.createElement("h1");
  title.textContent = screenTitle;
  const project = document.createElement(openProjectDetails ? "button" : "span");
  if (openProjectDetails) {
    project.type = "button";
    project.className = "screen-project-details-link";
    project.setAttribute("aria-label", "Project details");
    project.addEventListener("click", openProjectDetails);
  }
  project.textContent = projectName;
  header.append(back, title, project);
  const host = document.createElement("div");
  host.className = "report-screen-host";
  dialog.append(header, host);
  document.body.append(dialog);
  let disposed = false;
  let loaded = false;
  let loading = false;
  const current = () => !disposed && dialog.isConnected && isCurrent();
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearInterval(contextCheck);
    dialog.close();
    dialog.remove();
    onDispose();
  };
  const hydrate = async () => {
    if (loading || loaded || !current()) return;
    loading = true;
    const status = document.createElement("p");
    status.className = "report-screen-loading";
    status.setAttribute("role", "status");
    status.textContent = `Loading ${screenTitle}…`;
    host.replaceChildren(status);
    try {
      const panel = await load();
      if (!current()) { dispose(); return; }
      host.replaceChildren(panel);
      loaded = true;
    } catch (error) {
      if (!current()) { dispose(); return; }
      status.setAttribute("role", "alert");
      status.textContent = error.message || `Could not load ${screenTitle}.`;
      const retry = document.createElement("button");
      retry.textContent = "Try again";
      retry.addEventListener("click", () => void hydrate());
      host.append(retry);
    } finally { loading = false; }
  };
  dialog.addEventListener("close", onClose);
  const contextCheck = setInterval(() => { if (!current()) dispose(); }, 200);
  return {
    isCurrent: current,
    isOpen: () => current() && dialog.open,
    open() {
      if (!current()) { dispose(); return; }
      back.textContent = backLabel();
      if (!dialog.open) dialog.showModal();
      return hydrate();
    },
    close: () => dialog.close(),
    dispose
  };
}
