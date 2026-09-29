// Fixture-only observer. It never selects, edits, or changes application state.
(() => {
  const script = document.currentScript;
  const key = new URL(script.src).searchParams.get('key');
  const started = performance.now();
  const summaryStats = globalThis.__permitextFixtureSummaryStats = {};
  const milestones = {};
  const longTasks = [];
  let finished = false, framePending = false;
  const project = 'performance-project-1';
  const ready = () => {
    const saved = document.querySelector('.saved-panel.has-selected-project-folder');
    const notebook = document.querySelector(`.notebook-panel[data-project-id="${project}"]`);
    const report = document.querySelector(`.report-draft-panel[data-project-id="${project}"]`);
    const editor = notebook?.querySelector('.notebook-editor-surface');
    const images = [...(editor?.querySelectorAll('img') || [])];
    const counts = {
      saved: saved?.querySelectorAll('.saved-section-row, .project-detail-saved-row').length || 0,
      notes: notebook?.querySelectorAll('.notebook-card-row').length || 0,
      paragraphs: editor?.querySelectorAll('.bn-editor p').length || 0,
      images: images.length,
      reportHeadings: report?.querySelectorAll('[aria-label="Report heading"]').length || 0,
    };
    const selectedNote = notebook?.querySelector('.notebook-card-list-title-editor')?.value === 'Synthetic Note 1';
    const savedProject = saved?.querySelector(`.saved-folder-context[data-project-id="${project}"]`);
    return {counts, checks: {
      search: Boolean(document.querySelector('.search-panel .search-input')),
      saved: Boolean(savedProject) && counts.saved === 3,
      notebook: selectedNote && counts.notes === 4 && counts.paragraphs === 1 && counts.images === 1 && images.every(image => image.complete && image.naturalWidth > 0),
      report: counts.reportHeadings === 8,
    }};
  };
  const resources = () => {
    const counts = {}, timings = [];
    for (const item of performance.getEntriesByType('resource')) {
      const path = new URL(item.name, location.href).pathname;
      const route = /^\/(notebook\/cards\/(list|get|save)|reports\/drafts\/(list|get|save)|projects\/foundation\/state|sync\/(pull|push)|notebook\/assets\/read)$/.test(path) ? path
        : path.startsWith('/code/') ? '/code/*' : /\.(js|css|woff2?)$/.test(path) ? '/static/*' : '/other';
      counts[route] = (counts[route] || 0) + 1;
      if (timings.length < 150) timings.push({route, startTime: item.startTime, duration: item.duration, responseEnd: item.responseEnd,
        transferSize: item.transferSize, decodedBodySize: item.decodedBodySize});
    }
    return {counts, timings};
  };
  let taskObserver, longTasksSupported = false;
  const appendTasks = entries => { for (const entry of entries) if (longTasks.length < 100) longTasks.push({startTime: entry.startTime, duration: entry.duration}); };
  try {
    taskObserver = new PerformanceObserver(list => {
      appendTasks(list.getEntries());
    });
    taskObserver.observe({type: 'longtask', buffered: true});
    longTasksSupported = true;
  } catch { /* Unsupported is reported, never interpreted as zero long tasks. */ }
  const finish = async (status) => {
    if (finished) return;
    finished = true; observer.disconnect(); clearTimeout(timeout);
    if (longTasksSupported) appendTasks(taskObserver.takeRecords());
    taskObserver?.disconnect();
    const state = ready();
    const resource = resources();
    const sample = {summaryStats, resourceTimings: resource.timings, status, observerStartedAt: started, completedAt: performance.now(), milestones,
      counts: state.counts, checks: state.checks, resourceCounts: resource.counts, longTasks,
      longTasksSupported, visibilityState: document.visibilityState,
      viewport: {width: innerWidth, height: innerHeight}};
    await fetch(`/fixture/benchmark?key=${encodeURIComponent(key)}`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(sample)});
  };
  const inspect = () => {
    if (finished) return;
    const state = ready();
    for (const [pane, value] of Object.entries(state.checks)) if (value && milestones[pane] === undefined) milestones[pane] = performance.now();
    if (Object.values(state.checks).every(Boolean) && !framePending) {
      framePending = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        framePending = false;
        if (Object.values(ready().checks).every(Boolean)) void finish('ready');
      }));
    }
  };
  const observer = new MutationObserver(inspect);
  observer.observe(document.documentElement, {subtree: true, childList: true, attributes: true, characterData: true});
  document.addEventListener('load', inspect, true);
  const timeout = setTimeout(() => void finish('timeout'), 60000);
  inspect();
})();
