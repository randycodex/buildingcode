import { createHash } from "node:crypto";
import { parse } from "parse5";
import { researchOfficialPDFPassages } from "./research-official-pdf-attribution.mjs";
import { researchOfficialPDFPageScores } from "./research-official-pdf-ranking.mjs";

const defaultMaximumBytes = 1_500_000;
const defaultMaximumPDFBytes = 15_000_000;
const defaultTimeoutMilliseconds = 12_000;
const maximumRedirects = 3;
const maximumSelectedPassages = 8;

const ignoredNodeNames = new Set(["script", "style", "noscript", "template", "svg"]);
const semanticNodeNames = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "table"
]);
const queryStopWords = new Set([
  "about", "after", "also", "and", "are", "current", "does", "from", "have", "include",
  "into", "official", "page", "that", "the", "their", "this", "those", "under", "using",
  "what", "when", "where", "which", "with", "without"
]);

function normalizedText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedDomain(value) {
  return normalizedText(value).toLowerCase().replace(/^www\./, "");
}

function officialHostnameAllowed(hostname, officialDomains = []) {
  const normalizedHostname = normalizedDomain(hostname);
  return officialDomains.some((domain) => {
    const normalizedOfficialDomain = normalizedDomain(domain);
    return normalizedHostname === normalizedOfficialDomain ||
      normalizedHostname.endsWith(`.${normalizedOfficialDomain}`);
  });
}

function approvedOfficialURL(value, officialDomains) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  if (!officialHostnameAllowed(url.hostname, officialDomains)) return null;
  url.hash = "";
  return url;
}

function nodeText(node) {
  if (!node || ignoredNodeNames.has(node.nodeName)) return "";
  if (node.nodeName === "#text") return node.value || "";
  return (node.childNodes || []).map(nodeText).join(" ");
}

function attribute(node, name) {
  return node?.attrs?.find((item) => item.name === name)?.value;
}

function linkedFAQPairs(document) {
  const nodes = [];
  const collect = (node) => {
    nodes.push(node);
    for (const child of node.childNodes || []) collect(child);
  };
  collect(document);
  const byID = new Map(), references = new Map();
  for (const node of nodes) {
    const id = attribute(node, "id"), target = attribute(node, "data-answer");
    if (id) byID.set(id, [...(byID.get(id) || []), node]);
    if (target) references.set(target, [...(references.get(target) || []), node]);
  }
  const pairs = new Map(), answers = new Set();
  for (const [id, questions] of references) {
    if (questions.length !== 1 || byID.get(id)?.length !== 1) continue;
    const question = questions[0], answer = byID.get(id)[0];
    const siblings = question.parentNode?.childNodes || [];
    const nextElement = siblings.slice(siblings.indexOf(question) + 1).find((node) => node.tagName);
    // Group only an explicit, unique link to the next answer container. An
    // orphan, duplicate ID or intervening heading must not acquire a new scope.
    if (nextElement !== answer || !/(?:^|\s)faq-questions(?:\s|$)/.test(attribute(question, "class") || "") ||
        !/(?:^|\s)faq-answers(?:\s|$)/.test(attribute(answer, "class") || "")) continue;
    pairs.set(question, answer);
    answers.add(answer);
  }
  return { pairs, answers };
}

function semanticNodesInDocumentOrder(node, faq, output = []) {
  if (!node || ignoredNodeNames.has(node.nodeName)) return output;
  if (faq.answers.has(node)) return output;
  if (faq.pairs.has(node)) {
    output.push({ nodeName: "#faq_pair", question: node, answer: faq.pairs.get(node) });
    return output;
  }
  if (semanticNodeNames.has(node.nodeName)) {
    output.push(node);
    return output;
  }
  for (const child of node.childNodes || []) semanticNodesInDocumentOrder(child, faq, output);
  return output;
}

function directChildren(node, nodeName) {
  return (node?.childNodes || []).filter((child) => child?.nodeName === nodeName);
}

function claimText({ heading, intro, text }) {
  return [heading, intro, text].map(normalizedText).filter(Boolean).join(" — ");
}

export function researchOfficialHTMLPassages(html, sourceURL) {
  const document = parse(String(html || ""));
  const semanticNodes = semanticNodesInDocumentOrder(document, linkedFAQPairs(document));
  const headingPath = [];
  const passages = [];
  let precedingParagraph = "";
  let passageIndex = 0;

  const appendPassage = ({ kind, intro = "", text }) => {
    const cleanText = normalizedText(text);
    if (!cleanText) return;
    const heading = normalizedText(headingPath.filter(Boolean).join(" > "));
    const claim = claimText({ heading, intro, text: cleanText });
    if (!claim) return;
    passages.push({
      index: passageIndex,
      kind,
      heading,
      intro: normalizedText(intro),
      text: cleanText,
      claim
    });
    passageIndex += 1;
  };

  for (const node of semanticNodes) {
    if (node.nodeName === "#faq_pair") {
      appendPassage({ kind: "faq_pair", intro: nodeText(node.question), text: nodeText(node.answer) });
      precedingParagraph = "";
      continue;
    }
    if (/^h[1-6]$/.test(node.nodeName)) {
      const level = Number(node.nodeName.slice(1));
      headingPath.splice(level - 1);
      headingPath[level - 1] = normalizedText(nodeText(node));
      precedingParagraph = "";
      continue;
    }
    if (node.nodeName === "p") {
      precedingParagraph = normalizedText(nodeText(node));
      appendPassage({ kind: "paragraph", text: precedingParagraph });
      continue;
    }
    if (node.nodeName === "ul" || node.nodeName === "ol") {
      appendPassage({ kind: "list", intro: precedingParagraph,
        text: directChildren(node, "li").map((item, index) => `${node.nodeName === "ol" ? `${index + 1}.` : "•"} ${nodeText(item)}`).join("\n") });
      precedingParagraph = "";
      continue;
    }
    if (node.nodeName === "table") {
      const rows = [];
      const collectRows = (candidate) => {
        if (candidate?.nodeName === "tr") rows.push(candidate);
        for (const child of candidate?.childNodes || []) collectRows(child);
      };
      collectRows(node);
      let headers = [];
      for (const row of rows) {
        const cells = (row.childNodes || []).filter((cell) =>
          cell?.nodeName === "th" || cell?.nodeName === "td"
        ).map((cell) => normalizedText(nodeText(cell))).filter(Boolean);
        if (!cells.length) continue;
        if ((row.childNodes || []).some((cell) => cell?.nodeName === "th")) {
          headers = cells;
          continue;
        }
        const rowText = headers.length === cells.length
          ? cells.map((cell, index) => `${headers[index]}: ${cell}`).join("; ")
          : cells.join("; ");
        appendPassage({ kind: "table_row", intro: precedingParagraph, text: rowText });
      }
      precedingParagraph = "";
    }
  }

  const contentHash = createHash("sha256").update(String(html || "")).digest("hex");
  return passages.map((passage) => ({
    ...passage,
    id: `official-passage-${createHash("sha256")
      .update(`${sourceURL}\u0000${contentHash}\u0000${passage.index}\u0000${passage.claim}`)
      .digest("hex")
      .slice(0, 24)}`,
    contentHash
  }));
}

function queryTokens(value) {
  return new Set(
    normalizedText(value).toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g)?.filter((token) =>
      token.length >= 3 && !queryStopWords.has(token)
    ) || []
  );
}

export function selectResearchOfficialHTMLPassages(passages, query, options = {}) {
  const candidates = Array.isArray(passages) ? passages : [];
  const pdfScores = researchOfficialPDFPageScores(candidates, query);
  const tokens = queryTokens(query);
  const requiredTerms = new Set((options.requiredPassageTerms || []).map((term) => normalizedText(term).toLowerCase()));
  const maximum = Math.max(1, Number(options.maximum || maximumSelectedPassages));
  return candidates
    .map((passage) => {
      if (passage?.kind === "pdf_page") return { passage, score: pdfScores.get(passage) || 0 };
      const searchableText = passage?.kind === "pdf_page" ? passage.text : passage?.claim;
      const passageTokens = queryTokens(searchableText);
      const sharedTokens = [...tokens].filter((token) => passageTokens.has(token));
      const phraseBoost = [...tokens].reduce((total, token) =>
        total + (normalizedText(searchableText).toLowerCase().includes(token) ? 1 : 0), 0);
      return {
        passage,
        score: sharedTokens.length ? sharedTokens.length * 10 + phraseBoost + (["list", "list_item"].includes(passage?.kind) ? 2 : 0) : 0
      };
    })
    .filter(({ passage, score }) => score > 0 && (!requiredTerms.size ||
      [...queryTokens(passage?.kind === "pdf_page" ? passage.text : passage.claim)]
        .some((token) => requiredTerms.has(token))))
    .sort((left, right) => right.score - left.score || left.passage.index - right.passage.index)
    .slice(0, maximum)
    .sort((left, right) => left.passage.index - right.passage.index)
    .map(({ passage }) => passage);
}

// A curated heading is a source location, never an answer. Preserve its whole
// section (including subheadings) so ranking cannot separate adjacent limits.
// Missing or oversized sections fail source validation instead of being cut.
export function researchOfficialHTMLSectionPassages(passages, sectionHeadings, sourceURL) {
  const sections = [];
  for (const section of [...new Set(sectionHeadings)].slice(0, 3)) {
    const selected = passages.filter((passage) => passage.heading.split(" > ").includes(section));
    if (!selected.length) throw Object.assign(new Error("A requested official HTML section is unavailable."),
      { code: "RESEARCH_OFFICIAL_SOURCE_SECTION_UNAVAILABLE" });
    const contentHash = selected[0].contentHash;
    if (selected.some((passage) => passage.contentHash !== contentHash)) throw new Error("Mixed official section content hashes.");
    const text = selected.map((passage) => passage.claim).join("\n\n");
    if (text.length > 16_000) throw Object.assign(new Error("The complete official HTML section exceeds its retrieval bound."),
      { code: "RESEARCH_OFFICIAL_SOURCE_SECTION_TOO_LARGE" });
    sections.push({ index: selected[0].index, kind: "html_section", heading: section, intro: "", text,
      claim: text, contentHash,
      id: `official-passage-${createHash("sha256").update(`${sourceURL}\u0000${contentHash}\u0000${section}\u0000${text}`).digest("hex").slice(0, 24)}` });
  }
  return sections;
}

async function responseBodyWithinLimit(response, maximumBytes) {
  const declaredLength = Number(response.headers?.get?.("content-length") || 0);
  if (declaredLength > maximumBytes) {
    const error = new Error("The official source exceeded Permitext's retrieval limit.");
    error.code = "RESEARCH_OFFICIAL_SOURCE_TOO_LARGE";
    throw error;
  }
  let bytes;
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = [];
    let byteLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maximumBytes) {
        await reader.cancel();
        const error = new Error("The official source exceeded Permitext's retrieval limit.");
        error.code = "RESEARCH_OFFICIAL_SOURCE_TOO_LARGE";
        throw error;
      }
      chunks.push(value);
    }
    bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
  } else {
    bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maximumBytes) {
      const error = new Error("The official source exceeded Permitext's retrieval limit.");
      error.code = "RESEARCH_OFFICIAL_SOURCE_TOO_LARGE";
      throw error;
    }
  }
  return bytes;
}

export async function fetchResearchOfficialDocumentPassages(sourceURL, options = {}) {
  const officialDomains = options.officialDomains || [];
  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new DOMException("Official source timed out.", "TimeoutError")), Number(
    options.timeoutMilliseconds || defaultTimeoutMilliseconds
  ));
  const abortFromParent = () => controller.abort(options.signal.reason);
  options.signal?.addEventListener?.("abort", abortFromParent, { once: true });
  let currentURL = approvedOfficialURL(sourceURL, officialDomains);
  if (!currentURL) {
    clearTimeout(timeout);
    options.signal?.removeEventListener?.("abort", abortFromParent);
    const error = new Error("The official source URL is outside Permitext's approved domains.");
    error.code = "RESEARCH_OFFICIAL_SOURCE_DISALLOWED";
    throw error;
  }
  try {
    if (options.signal?.aborted) abortFromParent();
    controller.signal.throwIfAborted();
    for (let redirect = 0; redirect <= maximumRedirects; redirect += 1) {
      const response = await fetchImpl(currentURL, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "text/html,application/xhtml+xml,application/pdf",
          "user-agent": "Mozilla/5.0 (compatible; Permitext/1.0; +https://permitext.com)"
        }
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers?.get?.("location");
        const redirectedURL = location
          ? approvedOfficialURL(new URL(location, currentURL).toString(), officialDomains)
          : null;
        if (!redirectedURL || redirect === maximumRedirects) {
          const error = new Error("The official source redirected outside Permitext's approved policy.");
          error.code = "RESEARCH_OFFICIAL_SOURCE_REDIRECT_REJECTED";
          throw error;
        }
        await response.body?.cancel();
        currentURL = redirectedURL;
        continue;
      }
      if (!response.ok) {
        const error = new Error(`The official source returned HTTP ${response.status}.`);
        error.code = "RESEARCH_OFFICIAL_SOURCE_UNAVAILABLE";
        throw error;
      }
      const contentType = normalizedText(response.headers?.get?.("content-type")).toLowerCase();
      const isPDF = contentType.split(";")[0].trim() === "application/pdf";
      if (!isPDF && !contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
        const error = new Error("The official source was not a supported HTML or PDF document.");
        error.code = "RESEARCH_OFFICIAL_SOURCE_UNSUPPORTED";
        throw error;
      }
      const bytes = await responseBodyWithinLimit(response, Number(options.maximumBytes ??
        (isPDF ? defaultMaximumPDFBytes : defaultMaximumBytes)));
      controller.signal.throwIfAborted();
      if (isPDF) {
        return {
          url: currentURL.toString(),
          format: "pdf",
          ...await researchOfficialPDFPassages(bytes, currentURL.toString(), {
            ...options,
            signal: controller.signal
          })
        };
      }
      const html = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      return {
        url: currentURL.toString(),
        format: "html",
        passages: researchOfficialHTMLPassages(html, currentURL.toString())
      };
    }
  } catch (error) {
    if (options.signal?.aborted) throw options.signal.reason || error;
    if (controller.signal.aborted || error?.name === "AbortError" || error?.name === "TimeoutError") {
      const timeoutError = new Error("The official source retrieval timed out.");
      timeoutError.code = "RESEARCH_OFFICIAL_SOURCE_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener?.("abort", abortFromParent);
  }
  const error = new Error("The official source could not be retrieved.");
  error.code = "RESEARCH_OFFICIAL_SOURCE_UNAVAILABLE";
  throw error;
}

export async function bindResearchWebSupportToOfficialDocuments(webSupport, options = {}) {
  const originalSources = Array.isArray(webSupport?.sources) ? webSupport.sources : [];
  const officialDomains = options.officialDomains || [];
  const sources = [];
  const validationFailures = [];
  for (const source of originalSources.slice(0, 3)) {
    try {
      const fetched = await fetchResearchOfficialDocumentPassages(source.url, {
        ...options,
        officialDomains,
        fetchImpl: options.fetchImpl,
        signal: options.signal,
        timeoutMilliseconds: options.timeoutMilliseconds,
        maximumBytes: options.maximumBytes
      });
      const providerContext = (source.attributedClaims || []).map((claim) => claim?.text).join(" ");
      const candidates = fetched.format === "html" && source.sectionHeadings?.length
        ? researchOfficialHTMLSectionPassages(fetched.passages, source.sectionHeadings, fetched.url)
        : fetched.passages;
      const selected = selectResearchOfficialHTMLPassages(
        candidates,
        `${options.question || ""} ${providerContext}`,
        { ...(fetched.format === "pdf" ? { maximum: 3 } : {}), requiredPassageTerms: options.requiredPassageTerms }
      );
      if (!selected.length) {
        validationFailures.push({ url: source.url, code: "RESEARCH_OFFICIAL_SOURCE_NO_RELEVANT_PASSAGE" });
        continue;
      }
      sources.push({
        ...source,
        url: fetched.url,
        attributedClaims: selected.map((passage) => ({
          id: passage.id,
          text: passage.claim,
          verbatimText: passage.text,
          heading: passage.heading,
          intro: passage.intro,
          contentHash: passage.contentHash,
          ...(passage.pageNumber ? { pageNumber: passage.pageNumber, sourceURL: passage.sourceURL } : {})
        })),
        sourceContentHash: selected[0].contentHash,
        sourceValidation: fetched.format === "pdf" ? "official_pdf" : "official_html",
        ...(fetched.format === "pdf" ? {
          pageCount: fetched.pageCount,
          textlessPages: fetched.textlessPages,
          extractionLimitations: [
            "PDF text extraction preserves whole pages; diagrams, scanned content, and complex table geometry are not independently verified.",
            ...(fetched.textlessPages.length ? [
              `No readable text was available on PDF pages ${fetched.textlessPages.join(", ")}.`
            ] : [])
          ]
        } : {})
      });
    } catch (error) {
      if (options.signal?.aborted) throw options.signal.reason || error;
      validationFailures.push({
        url: source.url,
        code: String(error?.code || error?.name || "RESEARCH_OFFICIAL_SOURCE_UNAVAILABLE")
      });
    }
  }
  return {
    ...webSupport,
    sources,
    sourceValidation: {
      method: sources.some((source) => source.sourceValidation === "official_pdf")
        ? "official_documents" : "official_html",
      attemptedSourceCount: originalSources.slice(0, 3).length,
      validatedSourceCount: sources.length,
      failures: validationFailures
    },
    ...(sources.length === 0 ? {
      limitation: "Permitext could not bind the guidance to readable text from an approved official HTML or PDF source; the guidance was not used."
    } : validationFailures.length ? {
      limitation: [webSupport.limitation,
        `Some requested official documents could not be validated: ${validationFailures.map((failure) => `${failure.url} (${failure.code})`).join("; ")}. Their conditions and exceptions remain unverified; the retrieved passages do not establish what the missing documents say.`
      ].filter(Boolean).join(" ")
    } : {})
  };
}

// Compatibility for existing callers and retained local evidence.
export const fetchResearchOfficialHTMLPassages = fetchResearchOfficialDocumentPassages;
export const bindResearchWebSupportToOfficialHTML = bindResearchWebSupportToOfficialDocuments;
