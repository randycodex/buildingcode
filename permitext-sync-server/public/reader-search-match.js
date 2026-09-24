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

export function readerSearchMatch(value, query) {
  const text = String(value || "");
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return null;
  const exactIndex = text.toLowerCase().indexOf(needle);
  if (exactIndex >= 0) {
    return { index: exactIndex, length: needle.length, text: text.slice(exactIndex, exactIndex + needle.length), exact: true };
  }
  const queryTokens = needle.match(/[\p{L}\p{N}]+/gu) || [];
  if (!queryTokens.length) return null;
  const textTokens = Array.from(text.matchAll(/[\p{L}\p{N}]+/gu)).map((match) => ({
    value: match[0].toLowerCase(),
    index: match.index,
    length: match[0].length
  }));
  for (let start = 0; start <= textTokens.length - queryTokens.length; start += 1) {
    const matched = queryTokens.every((token, offset) => {
      const limit = readerSearchTokenDistanceLimit(token);
      return readerSearchEditDistance(token, textTokens[start + offset].value, limit) <= limit;
    });
    if (!matched) continue;
    const first = textTokens[start];
    const last = textTokens[start + queryTokens.length - 1];
    const end = last.index + last.length;
    return { index: first.index, length: end - first.index, text: text.slice(first.index, end), exact: false };
  }
  return null;
}

export function snippetForMatch(value, match) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
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

/** Search the complete ordered text projection; never only visible Reader rows. */
export function searchReaderTextSections(sections, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (needle.length < 2) return [];
  const results = [];
  for (const section of sections || []) {
    const title = section.displayTitle;
    const titleMatch = readerSearchMatch(title, needle);
    const blockMatches = (section.blocks || []).flatMap((block, index) => {
      const text = String(block.text || "").replace(/\s+/g, " ").trim();
      const match = readerSearchMatch(text, needle);
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
    results.push({
      sectionID: section.id,
      sectionNumber: section.sectionNumber || "",
      title: section.title || "",
      heading: readerSearchResultHeading(title, blockMatch),
      headingHighlight: titleMatch?.text || blockMatch?.match?.text || query,
      snippet: snippetForMatch(blockMatch?.text || section.title, snippetMatch),
      snippetHighlight: snippetMatch.text,
      matchText: match.text,
      blockID: blockMatch?.blockID || ""
    });
  }
  return results;
}
