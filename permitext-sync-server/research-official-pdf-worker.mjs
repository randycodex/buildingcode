import { parentPort, workerData } from "node:worker_threads";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

// Text extraction stays off the request thread so a malformed document cannot
// prevent the parent from enforcing its deadline or honoring cancellation.
let loadingTask;
try {
  loadingTask = getDocument({
    data: new Uint8Array(workerData.bytes),
    isEvalSupported: false,
    useWorkerFetch: false,
    useWasm: false,
    disableFontFace: true,
    useSystemFonts: true,
    stopAtErrors: true,
    verbosity: 0
  });
  const document = await loadingTask.promise;
  if (document.numPages > workerData.maximumPages) {
    throw Object.assign(new Error("The PDF exceeds the page limit."), {
      code: "RESEARCH_OFFICIAL_PDF_TOO_MANY_PAGES"
    });
  }
  const pages = [];
  const textlessPages = [];
  let characterCount = 0;
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    // Preserve PDF reading order, explicit line endings, and the complete page.
    // Splitting a table/list into isolated cells can detach its qualifications.
    const text = content.items.filter((item) => typeof item.str === "string")
      .map((item) => `${item.str}${item.hasEOL ? "\n" : " "}`)
      .join("").replace(/[^\S\n]+/g, " ").replace(/ *\n */g, "\n").trim();
    characterCount += text.length;
    if (characterCount > workerData.maximumCharacters || text.length > workerData.maximumPageCharacters) {
      throw Object.assign(new Error("The PDF exceeds the text extraction limit."), {
        code: "RESEARCH_OFFICIAL_PDF_TOO_MUCH_TEXT"
      });
    }
    if (/[\p{L}\p{N}]{2}/u.test(text)) pages.push({ pageNumber, text });
    else textlessPages.push(pageNumber);
    page.cleanup();
  }
  parentPort.postMessage({ pages, pageCount: document.numPages, textlessPages });
} catch (error) {
  parentPort.postMessage({ error: {
    code: typeof error?.code === "string" && error.code.startsWith("RESEARCH_")
      ? error.code : (error?.name === "PasswordException"
        ? "RESEARCH_OFFICIAL_PDF_ENCRYPTED" : "RESEARCH_OFFICIAL_PDF_INVALID"),
    message: "The official PDF could not be read reliably."
  } });
} finally {
  await loadingTask?.destroy();
}
