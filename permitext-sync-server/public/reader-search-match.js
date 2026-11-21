// Shared by indexed chapter search and the offline rich-body fallback.
// Preserve exact-first matching, typo thresholds, and result presentation.

export function readerSearchEditDistance(leftValue, rightValue, maximumDistance) {
  const left = String(leftValue || "").toLowerCase();
  const right = String(rightValue || "").toLowerCase();
  if (left === right) return 0;
  if (Math.abs(left.length - right.length) > maximumDistance) return maximumDistance + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let rowMinimum = current[0];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost
      );
      rowMinimum = Math.min(rowMinimum, current[rightIndex]);
    }
    if (rowMinimum > maximumDistance) return maximumDistance + 1;
    previous = current;
  }
  return previous[right.length];
}

export function readerSearchTokenDistanceLimit(token) {
  if (token.length >= 8) return 2;
  if (token.length >= 5) return 1;
  return 0;
}

// A chapter contains many repetitions of the same words. Share typo checks
// within this query and discard the bounded cache when the search finishes.
function prepareReaderMatch(query) {
  const needle = String(query || "").trim().toLowerCase();
  let tokens;
  let cachedWords = 0;
  function matchesToken(token, raw) {
    const word = raw.toLowerCase();
    if (word === token.word) return true;
    if (!token.limit || Math.abs(token.word.length - word.length) > token.limit) return false;
    const cached = token.distances.get(word);
    if (cached !== undefined) return cached;
    const matches = readerSearchEditDistance(token.word, word, token.limit) <= token.limit;
    if (cachedWords < 2048) {
      token.distances.set(word, matches);
      cachedWords++;
    }
    return matches;
  }

  return function match(value) {
    const text = String(value || "");
    if (!needle) return null;
    const index = text.toLowerCase().indexOf(needle);
    if (index >= 0) {
      return { index, length: needle.length, text: text.slice(index, index + needle.length), exact: true };
    }
    tokens ??= (needle.match(/[\p{L}\p{N}]+/gu) || []).map(word => ({
      word, limit: readerSearchTokenDistanceLimit(word), distances: new Map()
    }));
    if (!tokens.length) return null;
    const words = /[\p{L}\p{N}]+/gu;
    let first;
    while ((first = words.exec(text))) {
      if (!matchesToken(tokens[0], first[0])) continue;
      const firstEnd = words.lastIndex;
      let offset = 1;
      for (; offset < tokens.length; offset++) {
        const next = words.exec(text);
        if (!next || !matchesToken(tokens[offset], next[0])) break;
      }
      if (offset === tokens.length) {
        const end = words.lastIndex;
        return { index: first.index, length: end - first.index, text: text.slice(first.index, end), exact: false };
      }
      // A later phrase may overlap this partial match.
      words.lastIndex = firstEnd;
    }
    return null;
  };
}

export function readerSearchMatch(value, query) {
  return prepareReaderMatch(query)(value);
}

export function snippetForMatch(value, match, heading = "") {
  let text = String(value || "").replace(/\s+/g, " ").trim();
  const label = String(heading || "").replace(/\s+/g, " ").trim().replace(/[.!?:;]+$/, "").trim();
  if (label && text.slice(0, label.length).toLowerCase() === label.toLowerCase()) {
    const remainder = text.slice(label.length);
    // Only omit an exact heading followed by punctuation or the end of the block.
    // A shared opening phrase in a different sentence remains intact.
    if (!remainder || /^[.!?:;](?:\s|$)/.test(remainder)) text = remainder.replace(/^[.!?:;\s]+/, "");
  }
  const normalizedMatch = readerSearchMatch(text, match?.text || "");
  if (!normalizedMatch) return text.slice(0, 220);
  const start = Math.max(0, normalizedMatch.index - 70);
  const end = Math.min(text.length, normalizedMatch.index + normalizedMatch.length + 150);
  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
}

export function readerSearchResultHeading(title, blockMatch) {
  if (!blockMatch?.startsWithMatch) return title;
  const definitionLabel = blockMatch.text.match(/^([^.!?]{2,120})[.!?](?:\s|$)/)?.[1]?.trim();
  return definitionLabel || title;
}

function readerSectionNumber(value) {
  return String(value || "").trim().match(/^(?:(?:section|§)\s*)?(\d+(?:[.-]\d+)*(?:\([a-z0-9]+\))*)\.?$/i)?.[1].toLowerCase() || "";
}

// Promote the provision itself ahead of paragraphs that merely cite it. Keep
// the existing chapter/document order for every other match and text query.
export function rankReaderSearchResults(results, query) {
  const number = readerSectionNumber(query);
  if (!number) return results;
  return [...results.filter(result => readerSectionNumber(result.sectionNumber) === number),
    ...results.filter(result => readerSectionNumber(result.sectionNumber) !== number)];
}

/** Search the complete ordered text projection; never only visible Reader rows. */
export function searchReaderTextSections(sections, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (needle.length < 2) return [];
  const sectionQuery = readerSectionNumber(needle);
  const matchQuery = prepareReaderMatch(needle);
  const results = [];
  for (const section of sections || []) {
    const title = section.displayTitle;
    const exactSection = Boolean(sectionQuery) && readerSectionNumber(section.sectionNumber) === sectionQuery;
    const titleMatch = exactSection ? readerSearchMatch(title, section.sectionNumber) : matchQuery(title);
    const blockMatches = (section.blocks || []).flatMap((block, index) => {
      const text = String(block.text || "").replace(/\s+/g, " ").trim();
      const match = matchQuery(text);
      if (!match) return [];
      const leadingText = text.slice(0, match.index).replace(/^[\s§:;,.()\-–—]+/, "");
      return [{ blockID: block.blockID, text, match, startsWithMatch: leadingText.length === 0, index }];
    });
    const blockMatch = blockMatches.sort((left, right) =>
      Number(right.startsWithMatch) - Number(left.startsWithMatch) ||
      Number(right.match.exact) - Number(left.match.exact) ||
      left.match.index - right.match.index || left.index - right.index
    )[0] || null;
    const match = titleMatch || blockMatch?.match;
    if (!match) continue;
    const snippetMatch = blockMatch?.match || match;
    const heading = exactSection ? title : readerSearchResultHeading(title, blockMatch);
    results.push({
      sectionID: section.id,
      sectionNumber: section.sectionNumber || "",
      title: section.title || "",
      heading,
      headingHighlight: titleMatch?.text || blockMatch?.match?.text || query,
      snippet: snippetForMatch(blockMatch?.text || section.title, snippetMatch, heading),
      snippetHighlight: snippetMatch.text,
      matchText: match.text,
      blockID: exactSection ? "" : blockMatch?.blockID || ""
    });
  }
  return rankReaderSearchResults(results, query);
}
