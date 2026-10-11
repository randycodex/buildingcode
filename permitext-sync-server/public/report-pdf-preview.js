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
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const item = entry.target;
      if (!entry.isIntersecting || item.dataset.rendered || disposed) continue;
      item.dataset.rendered = 'true';
      void (async () => {
        try {
          const page = await pdf.getPage(Number(item.dataset.page));
          if (disposed || !current()) return;
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width; canvas.height = viewport.height;
          canvas.setAttribute('aria-label', `Report page ${item.dataset.page} of ${pdf.numPages}`);
          canvas.setAttribute('role', 'img');
          item.append(canvas);
          const render = page.render({ canvasContext: canvas.getContext('2d'), viewport });
          renders.add(render);
          await render.promise;
          renders.delete(render);
          const text = await page.getTextContent();
          if (disposed) return;
          const accessible = document.createElement('p');
          accessible.className = 'report-pdf-accessible-text';
          accessible.textContent = text.items.map(part => part.str || '').join(' ');
          item.append(accessible);
        } catch (error) {
          if (!disposed && current()) {
            const message = document.createElement('p');
            message.textContent = 'This page could not be displayed. Download PDF to view the complete report.';
            item.append(message);
          }
        }
      })();
    }
  }, { root: container, rootMargin: '600px' });
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
    container.append(item);
    observer.observe(item);
  }
  const dispose = () => {
    disposed = true;
    observer.disconnect();
    renders.forEach(render => render.cancel());
    void pdf.destroy();
  };
  if (!current()) dispose();
  return dispose;
}
