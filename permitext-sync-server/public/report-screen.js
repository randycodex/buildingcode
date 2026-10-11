// Keep workspace columns and the draft mounted across view switches. A native
// modal or embedded view keeps inactive editors inert without rebuilding them.
export function createReportScreen({ projectName, load, isCurrent, onClose, onDispose, screenTitle = "Report", screenClass = "", mount = null, coveredElements = [], onOpen = () => {}, openProjectDetails, backLabel = () => "← Back to workspace" }) {
  const dialog = document.createElement(mount ? "section" : "dialog");
  dialog.className = `report-screen ${mount ? "report-workspace-view" : ""} ${screenClass}`.trim();
  const coveredState = new Map();
  if (mount) {
    dialog.hidden = true;
    dialog.open = false;
    dialog.close = () => {
      if (!dialog.open) return;
      dialog.open = false;
      dialog.hidden = true;
      coveredState.forEach((inert, element) => { element.inert = inert; });
      coveredState.clear();
      onClose();
    };
  }
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
  if (!mount) dialog.append(header);
  dialog.append(host);
  (mount || document.body).append(dialog);
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
  if (!mount) dialog.addEventListener("close", onClose);
  const contextCheck = setInterval(() => { if (!current()) dispose(); }, 200);
  return {
    isCurrent: current,
    isOpen: () => current() && dialog.open,
    open() {
      if (!current()) { dispose(); return; }
      back.textContent = backLabel();
      if (!dialog.open) {
        if (mount) {
          coveredElements.forEach(element => { coveredState.set(element, element.inert); element.inert = true; });
          dialog.hidden = false;
          dialog.open = true;
        } else dialog.showModal();
        onOpen();
      }
      return hydrate();
    },
    close: () => dialog.close(),
    dispose
  };
}
