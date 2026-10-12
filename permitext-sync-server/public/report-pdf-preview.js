// Render the exported bytes, not a second HTML interpretation of the report.
export async function renderReportPDF(container, blob, current) {
  const pdfjs = await import('/web/pdf-preview-assets/pdf.min.js');
  if (!current()) return () => {};
  pdfjs.GlobalWorkerOptions.workerSrc = '/web/pdf-preview-assets/pdf.worker.min.js';
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false });
  const pdf = await task.promise;
  if (!current()) { await pdf.destroy(); return () => {}; }
  let disposed = false;
  const renders = new Set();
  const visible = new Set(), pages = new Map();
  let resizeTimer;
  const paint = async item => {
    if (disposed || !current()) return;
    const record = pages.get(item);
    if (record.painting) { record.pending = true; return; }
    record.painting = true;
    try {
      // Scale to the column's actual width. Bound raster memory, not column size.
      const scale = Math.max(1.5, Math.min(item.clientWidth * (window.devicePixelRatio || 1) / record.base.width,
        Math.sqrt(16000000 / (record.base.width * record.base.height))));
      if (scale <= record.scale) return;
      const viewport = record.page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      canvas.setAttribute('aria-label', `Report page ${item.dataset.page} of ${pdf.numPages}`);
      canvas.setAttribute('role', 'img');
      const render = record.page.render({ canvasContext: canvas.getContext('2d'), viewport });
      renders.add(render);
      try { await render.promise; } finally { renders.delete(render); }
      if (disposed || !current()) return;
      // Keep the existing image visible until its sharper replacement is ready.
      if (record.canvas) record.canvas.replaceWith(canvas);
      else item.append(canvas);
      record.canvas = canvas; record.scale = scale;
      record.error?.remove();
      if (!record.text) {
        const text = await record.page.getTextContent();
        if (disposed || !current()) return;
        const accessible = document.createElement('p');
        accessible.className = 'report-pdf-accessible-text';
        accessible.textContent = text.items.map(part => part.str || '').join(' ');
        item.append(accessible);
        record.text = accessible;
      }
    } catch (error) {
      if (!disposed && current() && !record.canvas && !record.error) {
        const message = document.createElement('p');
        message.textContent = 'This page could not be displayed. Download PDF to view the complete report.';
        item.append(message); record.error = message;
      }
    } finally {
      record.painting = false;
      if (record.pending) { record.pending = false; void paint(item); }
    }
  };
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const item = entry.target;
      if (!entry.isIntersecting) { visible.delete(item); continue; }
      visible.add(item);
      void paint(item);
    }
  }, { root: container, rootMargin: '600px' });
  const resizeObserver = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => visible.forEach(item => { void paint(item); }), 120);
  });
  resizeObserver.observe(container);
  container.replaceChildren();
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number);
    if (disposed || !current()) break;
    const viewport = page.getViewport({ scale: 1 });
    const item = document.createElement('section');
    item.className = 'report-pdf-page';
    item.dataset.page = String(number);
    item.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
    item.setAttribute('aria-label', `Page ${number}`);
    pages.set(item, {page, base: viewport, scale: 0});
    container.append(item);
    observer.observe(item);
  }
  const dispose = () => {
    disposed = true;
    observer.disconnect();
    resizeObserver.disconnect();
    clearTimeout(resizeTimer);
    renders.forEach(render => render.cancel());
    void pdf.destroy();
  };
  if (!current()) dispose();
  return dispose;
}
