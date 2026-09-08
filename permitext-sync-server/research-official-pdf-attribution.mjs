import { createHash } from "node:crypto";
import { Worker } from "node:worker_threads";

function extractionError(code, message) {
  return Object.assign(new Error(message), { code });
}

export async function researchOfficialPDFPassages(bytes, sourceURL, options = {}) {
  if (!Buffer.from(bytes).subarray(0, 1024).includes(Buffer.from("%PDF-"))) {
    throw extractionError("RESEARCH_OFFICIAL_PDF_INVALID", "The official source did not contain a PDF header.");
  }
  options.signal?.throwIfAborted();
  const contentHash = createHash("sha256").update(bytes).digest("hex");
  const extracted = await new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./research-official-pdf-worker.mjs", import.meta.url), {
      workerData: {
        bytes,
        maximumPages: options.maximumPages ?? 200,
        maximumCharacters: options.maximumCharacters ?? 1_000_000,
        maximumPageCharacters: options.maximumPageCharacters ?? 18_000
      },
      // A caller may be running a REPL or --input-type=module. Those arguments
      // are not valid for this file-backed worker.
      execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: 256 }
    });
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      void worker.terminate();
      if (error) reject(error);
      else resolve(result);
    };
    const abort = () => finish(options.signal.reason || new DOMException("Research was cancelled.", "AbortError"));
    const timer = setTimeout(() => finish(extractionError(
      "RESEARCH_OFFICIAL_SOURCE_TIMEOUT", "The official PDF extraction timed out."
    )), options.timeoutMilliseconds ?? 10_000);
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    worker.once("message", (result) => finish(result.error
      ? extractionError(result.error.code, result.error.message) : null, result));
    worker.once("error", () => finish(extractionError(
      "RESEARCH_OFFICIAL_PDF_INVALID", "The official PDF extraction failed."
    )));
    worker.once("exit", () => finish(extractionError(
      "RESEARCH_OFFICIAL_PDF_INVALID", "The official PDF extraction stopped before completion."
    )));
  });
  if (!extracted.pages.length) {
    throw extractionError("RESEARCH_OFFICIAL_PDF_NO_TEXT", "The PDF has no readable text layer; a verified transcription or OCR is required.");
  }
  return {
    pageCount: extracted.pageCount,
    textlessPages: extracted.textlessPages,
    passages: extracted.pages.map(({ pageNumber, text }, index) => {
      const pageURL = new URL(sourceURL);
      pageURL.hash = `page=${pageNumber}`;
      return {
        index,
        kind: "pdf_page",
        heading: `PDF page ${pageNumber}`,
        intro: "",
        text,
        claim: `[PDF page ${pageNumber}](${pageURL.href}) — ${text.replace(/\s+/g, " ")}`,
        pageNumber,
        sourceURL: pageURL.href,
        contentHash,
        id: `official-passage-${createHash("sha256")
          .update(`${sourceURL}\u0000${contentHash}\u0000${pageNumber}\u0000${text}`)
          .digest("hex").slice(0, 24)}`
      };
    })
  };
}
