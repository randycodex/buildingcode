// Capability-gated synthetic fixture only. Observes existing UI; never drives it.
(() => {
  const key = new URL(document.currentScript.src).searchParams.get("key");
  const run = crypto.randomUUID();
  const stats = globalThis.__permitextAuditStats = {};
  const longTasks = [], paints = [], shifts = [], events = [];
  const supported = {};
  const observe = (type, entries, options = {}) => {
    try {
      const observer = new PerformanceObserver(list => {
        for (const item of list.getEntries()) if (entries.length < 200) entries.push({ name: item.name, start: item.startTime, duration: item.duration, value: item.value, input: item.hadRecentInput });
      });
      observer.observe({ type, buffered: true, ...options }); supported[type] = true;
    } catch { supported[type] = false; }
  };
  observe("longtask", longTasks); observe("largest-contentful-paint", paints);
  observe("layout-shift", shifts); observe("event", events, { durationThreshold: 16 });
  performance.setResourceTimingBufferSize(2000);
  let eventSequence = 0, lastEvent = "startup", eventAt = 0, timers = [], settledTimer;
  const visible = element => element.getClientRects().length > 0;
  const sample = () => {
    const panes = [...document.querySelectorAll(".workspace-panel")].filter(visible);
    const inputs = [...document.querySelectorAll(".search-input, .saved-search-input")].filter(visible);
    const navigation = performance.getEntriesByType("navigation")[0];
    const data = {
      run, sequence: eventSequence, trigger: lastEvent, eventAt, at: performance.now(), visibility: document.visibilityState,
      viewport: { width: innerWidth, height: innerHeight }, supported, stats,
      navigation: navigation ? { responseEnd: navigation.responseEnd, interactive: navigation.domInteractive, complete: navigation.domComplete, transferSize: navigation.transferSize } : null,
      dom: { all: document.getElementsByTagName("*").length, panes: panes.length, saved: document.querySelectorAll(".saved-section-row").length, notes: document.querySelectorAll(".notebook-card-row").length, readerSections: document.querySelectorAll(".chapter-section").length, searchInputs: inputs.length, loading: document.querySelectorAll("[data-workspace-pane-loading]").length },
      resources: performance.getEntriesByType("resource").filter(item => !item.name.includes("/fixture/")).slice(-300).map(item => ({path:new URL(item.name).pathname,start:item.startTime,duration:item.duration,transfer:item.transferSize,decoded:item.decodedBodySize,initiator:item.initiatorType})),
      longTasks, paints, shifts, events
    };
    void fetch(`/fixture/audit?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
  };
  const schedule = event => {
    lastEvent = event?.target?.closest?.("button, summary, input, textarea")?.getAttribute("aria-label") || event?.type || "startup";
    eventAt = performance.now(); eventSequence++; timers.forEach(clearTimeout); timers = [250, 1500, 5000].map(delay => setTimeout(sample, delay));
  };
  document.addEventListener("click", schedule, true); document.addEventListener("input", schedule, true);
  document.addEventListener("keydown", event => { if (["Enter", " ", "Escape"].includes(event.key)) schedule(event); }, true);
  document.addEventListener("DOMContentLoaded", () => {
    schedule();
    new MutationObserver(() => {
      clearTimeout(settledTimer);
      settledTimer = setTimeout(sample, 700);
    }).observe(document.getElementById("panel-track"), { childList: true, subtree: true });
  });
})();
