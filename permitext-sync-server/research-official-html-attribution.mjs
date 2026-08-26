import { createHash } from "node:crypto";
import { parse } from "parse5";

const defaultMaximumBytes = 1_500_000;
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

function semanticNodesInDocumentOrder(node, output = []) {
  if (!node || ignoredNodeNames.has(node.nodeName)) return output;
  if (semanticNodeNames.has(node.nodeName)) {
    output.push(node);
    return output;
  }
  for (const child of node.childNodes || []) semanticNodesInDocumentOrder(child, output);
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
  const semanticNodes = semanticNodesInDocumentOrder(document);
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
      for (const item of directChildren(node, "li")) {
        appendPassage({
          kind: "list_item",
          intro: precedingParagraph,
          text: nodeText(item)
        });
      }
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
  const tokens = queryTokens(query);
  const maximum = Math.max(1, Number(options.maximum || maximumSelectedPassages));
  return (Array.isArray(passages) ? passages : [])
    .map((passage) => {
      const passageTokens = queryTokens(passage?.claim);
      const sharedTokens = [...tokens].filter((token) => passageTokens.has(token));
      const phraseBoost = [...tokens].reduce((total, token) =>
        total + (normalizedText(passage?.claim).toLowerCase().includes(token) ? 1 : 0), 0);
      return {
        passage,
        score: sharedTokens.length * 10 + phraseBoost + (passage?.kind === "list_item" ? 2 : 0)
      };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.passage.index - right.passage.index)
    .slice(0, maximum)
    .sort((left, right) => left.passage.index - right.passage.index)
    .map(({ passage }) => passage);
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
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export async function fetchResearchOfficialHTMLPassages(sourceURL, options = {}) {
  const officialDomains = options.officialDomains || [];
  const fetchImpl = options.fetchImpl || fetch;
  const maximumBytes = Number(options.maximumBytes || defaultMaximumBytes);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(
    options.timeoutMilliseconds || defaultTimeoutMilliseconds
  ));
  const abortFromParent = () => controller.abort();
  options.signal?.addEventListener?.("abort", abortFromParent, { once: true });
  let currentURL = approvedOfficialURL(sourceURL, officialDomains);
  if (!currentURL) {
    clearTimeout(timeout);
    const error = new Error("The official source URL is outside Permitext's approved domains.");
    error.code = "RESEARCH_OFFICIAL_SOURCE_DISALLOWED";
    throw error;
  }
  try {
    for (let redirect = 0; redirect <= maximumRedirects; redirect += 1) {
      const response = await fetchImpl(currentURL, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "text/html,application/xhtml+xml",
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
        currentURL = redirectedURL;
        continue;
      }
      if (!response.ok) {
        const error = new Error(`The official source returned HTTP ${response.status}.`);
        error.code = "RESEARCH_OFFICIAL_SOURCE_UNAVAILABLE";
        throw error;
      }
      const contentType = normalizedText(response.headers?.get?.("content-type")).toLowerCase();
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
        const error = new Error("The official source was not an HTML document.");
        error.code = "RESEARCH_OFFICIAL_SOURCE_UNSUPPORTED";
        throw error;
      }
      const html = await responseBodyWithinLimit(response, maximumBytes);
      return {
        url: currentURL.toString(),
        passages: researchOfficialHTMLPassages(html, currentURL.toString())
      };
    }
  } catch (error) {
    if (error?.name === "AbortError") {
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

export async function bindResearchWebSupportToOfficialHTML(webSupport, options = {}) {
  const originalSources = Array.isArray(webSupport?.sources) ? webSupport.sources : [];
  const officialDomains = options.officialDomains || [];
  const sources = [];
  const validationFailures = [];
  for (const source of originalSources.slice(0, 3)) {
    try {
      const fetched = await fetchResearchOfficialHTMLPassages(source.url, {
        officialDomains,
        fetchImpl: options.fetchImpl,
        signal: options.signal,
        timeoutMilliseconds: options.timeoutMilliseconds,
        maximumBytes: options.maximumBytes
      });
      const providerContext = (source.attributedClaims || []).map((claim) => claim?.text).join(" ");
      const selected = selectResearchOfficialHTMLPassages(
        fetched.passages,
        `${options.question || ""} ${providerContext}`
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
          contentHash: passage.contentHash
        })),
        sourceContentHash: selected[0].contentHash,
        sourceValidation: "official_html"
      });
    } catch (error) {
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
      method: "official_html",
      attemptedSourceCount: originalSources.slice(0, 3).length,
      validatedSourceCount: sources.length,
      failures: validationFailures
    },
    ...(sources.length === 0 ? {
      limitation: "Permitext found an approved official page but could not bind the answer to its retrieved HTML; the guidance was not used."
    } : {})
  };
}
