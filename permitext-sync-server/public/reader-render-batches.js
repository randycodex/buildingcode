function yieldTask() {
  if (typeof MessageChannel === "undefined") return new Promise(resolve => setTimeout(resolve, 0));
  return new Promise(resolve => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => { channel.port1.close(); channel.port2.close(); resolve(); };
    channel.port2.postMessage(null);
  });
}

// Yield between bounded batches even when a section contains thousands of
// paragraphs. Cancellation must stop detached construction as well as live DOM.
export async function renderReaderBlockBatches(blocks, render, isCurrent, options = {}) {
  const yieldToBrowser = options.yieldTask || yieldTask;
  const now = options.now || (() => performance.now());
  let start = now();
  for (let index = 0; index < blocks.length; index++) {
    if (!isCurrent()) throw new DOMException("Reader cancelled", "AbortError");
    render(blocks[index], index);
    if (index + 1 < blocks.length && ((index + 1) % 24 === 0 || now() - start >= 8)) {
      await yieldToBrowser();
      start = now();
    }
  }
  if (!isCurrent()) throw new DOMException("Reader cancelled", "AbortError");
}
