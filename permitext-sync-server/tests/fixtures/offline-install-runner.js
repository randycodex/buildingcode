import * as storage from "/web/offline-storage.js";
const status = document.querySelector("#status"), results = document.querySelector("#results");
const owner = "offline-installer-synthetic-owner", project = "synthetic-project";
const evidence = { userAgent: navigator.userAgent, cases: [] };
const assert = (value, message) => { if (!value) throw new Error(message); };
const mode = (source, fail = false) => fetch(`/fixture/mode?source=${source}&fail=${fail ? 1 : 0}`, { method: "POST" });
const progress = value => { document.querySelector("#progress").value = value.percent; status.textContent = `${value.phase}: ${value.completed}/${value.total}${value.detail ? ` — ${value.detail}` : ""}`; };
const showEvidence = () => { document.querySelector("#evidence").textContent = JSON.stringify(evidence, null, 2); };
async function check(name, action) {
  const row = document.createElement("li"); results.append(row); row.textContent = name;
  try { await action(); row.className = "pass"; row.textContent = `PASS — ${name}`; evidence.cases.push({ name, passed: true }); }
  catch (error) { row.className = "fail"; row.textContent = `FAIL — ${name}: ${error.message}`; evidence.cases.push({ name, passed: false, message: error.message }); throw error; }
  finally { showEvidence(); }
}
async function installedChapterIDs() {
  const database = await new Promise((resolve, reject) => { const request = indexedDB.open("permitext-offline"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  try { return await new Promise((resolve, reject) => { const request = database.transaction("chapters").objectStore("chapters").getAll(); request.onsuccess = () => resolve([...new Set(request.result.map(row => row.installID))]); request.onerror = () => reject(request.error); }); }
  finally { database.close(); }
}
document.querySelector("#checks").addEventListener("click", async event => {
  event.target.disabled = true;
  try {
    await mode("synthetic");
    await check("Install complete current and historical chapter bodies", async () => {
      const installed = await storage.downloadOfflineLibrary({ onProgress: progress });
      assert(installed.chapterCount === 3 && installed.sectionCount === 67, "Incomplete synthetic install");
      const saved = await storage.offlineAPI("/code/sections/1062");
      assert(saved.section.blocks[0].plainText === "Complete synthetic body 1/62", "Final page body missing");
    });
    const original = await storage.offlineLibraryStatus();
    await storage.saveNotebookDraft({ accountUserID: owner, projectID: project, cardID: "draft", title: "Retained synthetic draft", document: { text: "Do not remove this unsent draft" } });
    const image = await storage.stageNotebookImage({ accountUserID: owner, projectID: project, cardID: "draft", assetID: "synthetic-image", blob: new Blob(["synthetic bytes"], { type: "image/png" }), name: "synthetic.png" });
    const draft = await storage.loadNotebookDraft(owner, project, "draft");
    await check("Failed replacement retains the previous library and private draft/image", async () => {
      await mode("synthetic", true);
      let failure = null;
      try { await storage.downloadOfflineLibrary({ onProgress: progress }); } catch (error) { failure = error; status.textContent = error.message; }
      assert(failure?.message.includes("500"), "Expected controlled server error");
      await new Promise(resolve => setTimeout(resolve, 150));
      assert(status.textContent === failure.message, "Progress overwrote the failure");
      assert((await storage.offlineLibraryStatus()).installID === original.installID, "Prior library changed");
      assert(JSON.stringify(await installedChapterIDs()) === JSON.stringify([original.installID]), "Abandoned install rows remain");
      assert(JSON.stringify(await storage.loadNotebookDraft(owner, project, "draft")) === JSON.stringify(draft), "Private draft changed");
      assert((await storage.notebookImageRecord(image.localURL, owner)).blob.size === image.blob.size, "Private image changed");
      evidence.failureDisplayed = failure.message;
    });
    await check("Retry activates a complete library and preserves the exact historical edition", async () => {
      await mode("synthetic");
      const replacement = await storage.downloadOfflineLibrary({ onProgress: progress });
      assert(replacement.installID !== original.installID, "Retry did not replace the install");
      const saved = await storage.offlineAPI("/code/sections/41000010");
      assert(saved.section.title === "Slope" && saved.section.codeVersion.includes("2014-construction"), "Historical source mismatch");
      assert(JSON.stringify(await storage.loadNotebookDraft(owner, project, "draft")) === JSON.stringify(draft), "Retry changed the private draft");
      evidence.syntheticInstall = { chapters: replacement.chapterCount, sections: replacement.sectionCount };
    });
    status.textContent = "Recovery checks passed";
  } catch (error) { status.textContent = error.message; }
  finally { event.target.disabled = false; showEvidence(); }
});
document.querySelector("#full").addEventListener("click", async event => {
  event.target.disabled = true;
  try {
    await mode("captured");
    const expected = await (await fetch("/fixture/expected")).json();
    await check("Install the complete captured public corpus in browser storage", async () => {
      const started = performance.now();
      const installed = await storage.downloadOfflineLibrary({ onProgress: progress });
      evidence.fullInstall = { chapters: installed.chapterCount, sections: installed.sectionCount, downloadedBytes: installed.downloadedBytes, milliseconds: Math.round(performance.now() - started), librarySchemaVersion: installed.librarySchemaVersion };
      assert(installed.chapterCount === expected.chapterCount && installed.sectionCount === expected.sectionCount, "Captured corpus count mismatch");
    });
    status.textContent = "Complete captured library installed";
  } catch (error) { status.textContent = error.message; }
  finally { event.target.disabled = false; showEvidence(); }
});
document.querySelector("#reopen").addEventListener("click", async () => {
  try {
    await mode("captured");
    const { values, chapterCount, sectionCount, assetCount } = await (await fetch("/fixture/expected")).json();
    await check("Installed chapter and figure counts survive reload", async () => {
      const installed = await storage.offlineLibraryStatus();
      const cache = await caches.open(storage.offlineFeatureMetadata.assetCacheName);
      const figures = await cache.keys();
      assert(installed.chapterCount === chapterCount && installed.sectionCount === sectionCount, "Installed metadata count mismatch");
      assert(figures.length === assetCount, "Incomplete figure cache");
      const sample = figures.find(request => new URL(request.url).pathname.endsWith(".png"));
      const image = document.createElement("img"); image.alt = "Sample figure read from offline storage"; image.style.maxWidth = "240px";
      const blobURL = URL.createObjectURL(await (await cache.match(sample)).blob());
      try { image.src = blobURL; await image.decode(); assert(image.naturalWidth > 0, "Cached figure does not decode"); document.body.append(image); }
      finally { URL.revokeObjectURL(blobURL); }
      evidence.afterReload = { chapters: installed.chapterCount, sections: installed.sectionCount, figures: figures.length, sampleFigureDecoded: true };
    });
    await check("Reopen stored 2014 Slope and 2022 Gates without a code API fetch", async () => {
      const opened = [];
      for (const expected of values) {
        const actual = (await storage.offlineAPI(`/code/sections/${expected.id}`))?.section;
        assert(actual?.title === expected.title && actual.codeVersion === expected.codeVersion && actual.blocks?.length > 0, "Stored citation does not match its edition and text");
        opened.push({ title: actual.title, codeVersion: actual.codeVersion, blocks: actual.blocks.length });
      }
      assert(opened.length === 2, "Expected both citations"); evidence.reopened = opened;
    });
    status.textContent = "Both installed citations reopened";
  } catch (error) { status.textContent = error.message; }
});
document.querySelector("#cleanup").addEventListener("click", async () => {
  try {
    await storage.disableOfflineFeature();
    await new Promise((resolve, reject) => { const request = indexedDB.deleteDatabase("permitext-offline"); request.onsuccess = resolve; request.onerror = () => reject(request.error); request.onblocked = () => reject(new Error("Test database still open")); });
    status.textContent = "Test origin cleaned: public caches, synthetic drafts and service worker removed";
  } catch (error) { status.textContent = error.message; }
});
