function workerState(worker, states, timeoutMS) {
  if (states.includes(worker.state)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = error => { clearTimeout(timer); worker.removeEventListener("statechange", changed); error ? reject(error) : resolve(); };
    const changed = () => {
      if (states.includes(worker.state)) finish();
      else if (worker.state === "redundant") finish(new Error("The app update could not be prepared. Try again."));
    };
    const timer = setTimeout(() => finish(new Error("The update is still being prepared. Try Reload again in a moment.")), timeoutMS);
    worker.addEventListener("statechange", changed);
    changed();
  });
}

export async function activateWebAppUpdate({serviceWorker, MessageChannelClass = MessageChannel, timeoutMS = 20_000} = {}) {
  const registration = await serviceWorker?.getRegistration();
  if (!registration) return;
  await registration.update();
  let worker = registration.waiting || registration.installing;
  if (worker && !["installed", "activated"].includes(worker.state)) await workerState(worker, ["installed", "activated"], timeoutMS);
  worker = registration.waiting;
  if (!worker) return; // The newest worker is already active; navigation loads it.
  await new Promise((resolve, reject) => {
    const channel = new MessageChannelClass();
    const finish = error => { clearTimeout(timer); channel.port1.close(); channel.port2.close(); error ? reject(error) : resolve(); };
    const timer = setTimeout(() => finish(new Error("Close other Permitext tabs and app windows, then try Reload again.")), timeoutMS);
    channel.port1.onmessage = event => event.data?.ready === true ? finish() :
      finish(new Error(event.data?.reason === "other-tabs" ? "Close other Permitext tabs and app windows, then try Reload again. Their work will stay open until you close them." : "The app update could not be prepared. Try again."));
    worker.postMessage({type:"PERMITEXT_ACTIVATE_UPDATE"}, [channel.port2]);
  });
  await workerState(worker, ["activated"], timeoutMS);
}

export function createWebAppUpdatePrompt({document, serviceWorker, location, prepareReload,
  currentVersion, activate = activateWebAppUpdate} = {}) {
  if (!currentVersion) throw new Error("Missing web app version");
  let target = "", dismissed = "", busy = false, notice, message, reloadButton, laterButton;
  function mount() {
    if (notice) return;
    notice = document.createElement("aside");
    notice.className = "web-app-update-notice";
    notice.setAttribute("role", "status"); notice.setAttribute("aria-live", "polite");
    message = document.createElement("span");
    message.textContent = "A new version of Permitext is available.";
    reloadButton = document.createElement("button"); reloadButton.type = "button"; reloadButton.textContent = "Reload";
    reloadButton.addEventListener("click", () => void reload());
    laterButton = document.createElement("button"); laterButton.type = "button"; laterButton.textContent = "Later";
    laterButton.addEventListener("click", () => { dismissed = target; notice.hidden = true; });
    notice.append(message, reloadButton, laterButton); document.body.append(notice);
  }
  function observe(version, {required = false} = {}) {
    if (!required && (!version || version === currentVersion)) return;
    if (typeof version !== "string" || !/^[a-z0-9][a-z0-9-]{0,119}$/i.test(version)) return;
    if (version !== target) { target = version; dismissed = ""; }
    if (required) dismissed = "";
    if (dismissed === target) return;
    mount(); notice.hidden = false;
  }
  async function reload() {
    if (busy || !target) return false;
    busy = true; reloadButton.disabled = true; laterButton.disabled = true;
    let previousInert = document.body.inert, locked = false, navigating = false;
    try {
      const ready = await prepareReload();
      if (ready !== true) {
        message.textContent = ready?.message || "Finish saving or review pending changes, then reload. Your work stays on this device.";
        return false;
      }
      document.body.inert = true; locked = true;
      message.textContent = "Preparing the app update…";
      await activate({serviceWorker});
      message.textContent = "Reloading Permitext…";
      location.reload(); navigating = true;
      return true;
    } catch (error) {
      message.textContent = error.message || "The update could not be loaded. Your work is preserved. Try again.";
      return false;
    } finally {
      if (!navigating && locked) document.body.inert = previousInert;
      if (!navigating) { busy = false; reloadButton.disabled = false; laterButton.disabled = false; }
    }
  }
  return {observe, requireReload:version => observe(version || "required", {required:true}), reload};
}
