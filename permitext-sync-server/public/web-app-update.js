const updateFailure = "Couldn’t update Permitext. Try again.";
const otherTabsError = () => Object.assign(new Error("Close other Permitext tabs, then try again."), {code:"OTHER_TABS"});

function workerState(worker, states, timeoutMS) {
  if (states.includes(worker.state)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = error => { clearTimeout(timer); worker.removeEventListener("statechange", changed); error ? reject(error) : resolve(); };
    const changed = () => {
      if (states.includes(worker.state)) finish();
      else if (worker.state === "redundant") finish(new Error(updateFailure));
    };
    const timer = setTimeout(() => finish(new Error(updateFailure)), timeoutMS);
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
    const timer = setTimeout(() => finish(new Error(updateFailure)), timeoutMS);
    channel.port1.onmessage = event => event.data?.ready === true ? finish() :
      finish(event.data?.reason === "other-tabs" ? otherTabsError() : new Error(updateFailure));
    worker.postMessage({type:"PERMITEXT_ACTIVATE_UPDATE"}, [channel.port2]);
  });
  await workerState(worker, ["activated"], timeoutMS);
}

export function createWebAppUpdatePrompt({document, button = document.querySelector("#web-app-update-button"), serviceWorker, location, prepareReload,
  currentVersion, activate = activateWebAppUpdate} = {}) {
  if (!currentVersion) throw new Error("Missing web app version");
  let target = "", busy = false, notice, message;
  function showMessage(text) {
    if (!notice) {
      notice = document.createElement("aside");
      notice.className = "web-app-update-notice";
      notice.setAttribute("role", "status"); notice.setAttribute("aria-live", "polite");
      message = document.createElement("span");
      const dismiss = document.createElement("button"); dismiss.type = "button"; dismiss.textContent = "Dismiss";
      dismiss.addEventListener("click", () => { notice.hidden = true; });
      notice.append(message, dismiss); document.body.append(notice);
    }
    message.textContent = text; notice.hidden = false;
  }
  function observe(version, {required = false} = {}) {
    if (!required && (!version || version === currentVersion)) return;
    if (typeof version !== "string" || !/^[a-z0-9][a-z0-9-]{0,119}$/i.test(version)) return;
    if (version !== target && notice) notice.hidden = true;
    target = version;
    button.hidden = false;
  }
  button.addEventListener("click", () => void reload());
  async function reload() {
    if (busy || !target) return false;
    busy = true; button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.title = "Updating Permitext…"; button.setAttribute("aria-label", button.title);
    if (notice) notice.hidden = true;
    let previousInert = document.body.inert, locked = false, navigating = false;
    try {
      const ready = await prepareReload();
      if (ready !== true) {
        showMessage(ready?.message || "Finish saving or review pending work, then try again.");
        return false;
      }
      document.body.inert = true; locked = true;
      await activate({serviceWorker});
      location.reload(); navigating = true;
      return true;
    } catch (error) {
      showMessage(error.code === "OTHER_TABS" ? error.message : updateFailure);
      return false;
    } finally {
      if (!navigating && locked) document.body.inert = previousInert;
      if (!navigating) {
        busy = false; button.disabled = false; button.setAttribute("aria-busy", "false");
        button.title = "Update Permitext"; button.setAttribute("aria-label", button.title);
      }
    }
  }
  return {observe, requireReload:version => observe(version || "required", {required:true}), reload};
}
