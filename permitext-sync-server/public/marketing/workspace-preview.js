const previewDialog = document.querySelector('#workspace-preview');
const previewTrigger = document.querySelector('.expand-preview');
if (previewDialog && previewTrigger) {
  previewTrigger.addEventListener('click', () => previewDialog.showModal());
  previewDialog.addEventListener('click', (event) => {
    if (event.target !== previewDialog) return;
    const bounds = previewDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) previewDialog.close();
  });
  previewDialog.addEventListener('close', () => previewTrigger.focus({ preventScroll: true }));
}
