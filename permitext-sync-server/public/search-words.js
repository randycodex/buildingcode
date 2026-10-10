// Shared by online and offline Search. These are lexical matches, not AI relevance.
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hyphenPostings = new WeakMap();

export function searchWords(query) {
  return [...new Set((String(query || "").toLowerCase()
    .replace(/(?<=\p{L})[-‐‑–](?=\p{L})/gu, " ")
    .match(/[\p{L}\p{N}]+(?:[.-][\p{L}\p{N}]+)*/gu) || []))];
}

export function searchWordForms(word) {
  if (!/^[a-z]{3,}$/.test(word) || /(?:ss|us|is)$/.test(word)) return [word];
  if (word.endsWith("s") && word.length < 4) return [word];
  return word.endsWith("s") ? [word, word.slice(0, -1)] : [word, `${word}s`];
}

export function searchWordPattern(word) {
  return new RegExp(`(?<![\\p{L}\\p{N}_])(?:${searchWordForms(word).map(escape).join("|")})(?![\\p{L}\\p{N}_])`, "iu");
}

export function matchesSearchWords(values, query) {
  const words = searchWords(query);
  const text = (Array.isArray(values) ? values : [values]).filter(Boolean).join(" ");
  return words.length > 0 && words.every(word => searchWordPattern(word).test(text));
}

export function searchWordPosting(index, word) {
  // Build only the hyphen aliases once per loaded index; keep original postings intact.
  if (!hyphenPostings.has(index)) {
    const aliases = new Map();
    for (const [token, ids] of index) {
      if (!/\p{L}[-‐‑–]\p{L}/u.test(token)) continue;
      for (const part of searchWords(token)) {
        if (!aliases.has(part)) aliases.set(part, new Set());
        for (const id of ids) aliases.get(part).add(id);
      }
    }
    hyphenPostings.set(index, aliases);
  }
  return [...new Set(searchWordForms(word).flatMap(form => [
    ...index.get(form) || [], ...hyphenPostings.get(index).get(form) || []
  ]))].sort((a, b) => a - b);
}

export function searchWordsSnippet(value, query) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const patterns = searchWords(query).map(searchWordPattern);
  const matches = patterns.flatMap((pattern, word) => [...text.matchAll(new RegExp(pattern.source, "giu"))]
    .map(match => ({ word, index: match.index, length: match[0].length })) ).sort((a,b) => a.index-b.index);
  if (!matches.length) return text.slice(0, 220);
  const needed = new Set(matches.map(match => match.word)).size;
  const counts = new Map();
  let left = 0, best = { start: matches[0].index, end: text.length };
  for (const right of matches) {
    counts.set(right.word, (counts.get(right.word) || 0) + 1);
    while (counts.size === needed) {
      const first = matches[left];
      if (right.index + right.length - first.index < best.end - best.start) best = { start: first.index, end: right.index + right.length };
      counts.set(first.word, counts.get(first.word)-1);
      if (!counts.get(first.word)) counts.delete(first.word);
      left += 1;
    }
  }
  let start = Math.max(0, best.start - 60);
  if (start) { const boundary = text.indexOf(" ", start); if (boundary < best.start) start = boundary + 1; }
  let end = Math.min(text.length, Math.max(start + 220, Math.min(best.end + 80, start + 420)));
  if (end < text.length) { const boundary = text.lastIndexOf(" ", end); if (boundary > best.end) end = boundary; }
  return `${start ? "… " : ""}${text.slice(start, end)}${end < text.length ? " …" : ""}`;
}
