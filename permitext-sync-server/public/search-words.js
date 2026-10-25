// Shared by online and offline Search. These are lexical matches, not AI relevance.
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordIndexes = new WeakMap();
const completesWord = word => /^\p{L}{3,}$/u.test(word);

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
  const forms = searchWordForms(word).map(escape);
  if (completesWord(word)) forms.push(`${escape(word)}[\\p{L}]*`);
  return new RegExp(`(?<![\\p{L}\\p{N}_])(?:${forms.join("|")})(?![\\p{L}\\p{N}_])`, "iu");
}

export function matchesSearchWords(values, query) {
  const words = searchWords(query);
  const text = (Array.isArray(values) ? values : [values]).filter(Boolean).join(" ");
  return words.length > 0 && words.every(word => searchWordPattern(word).test(text));
}

export function prepareSearchWordIndex(index, prepared) {
  if (prepared) wordIndexes.set(index, prepared);
  if (!wordIndexes.has(index)) {
    const aliases = new Map();
    for (const [token, ids] of index) {
      if (!/\p{L}[-‐‑–]\p{L}/u.test(token)) continue;
      for (const part of searchWords(token)) {
        if (!aliases.has(part)) aliases.set(part, new Set());
        for (const id of ids) aliases.get(part).add(id);
      }
    }
    wordIndexes.set(index, { aliases, vocabulary: [...new Set([...index.keys(), ...aliases.keys()])].sort() });
  }
  return wordIndexes.get(index);
}

export function searchWordPosting(index, word) {
  // Online builds can prepare the same aliases/vocabulary ahead of time.
  // Offline callers retain the identical lazy preparation path.
  const { aliases, vocabulary } = prepareSearchWordIndex(index);
  const sectionIDs = new Set();
  const collect = token => {
    for (const id of index.get(token) || []) sectionIDs.add(id);
    for (const id of aliases.get(token) || []) sectionIDs.add(id);
  };
  searchWordForms(word).forEach(collect);
  if (completesWord(word)) {
    let left = 0, right = vocabulary.length;
    while (left < right) {
      const middle = (left + right) >>> 1;
      if (vocabulary[middle] < word) left = middle + 1;
      else right = middle;
    }
    for (let position = left; position < vocabulary.length && vocabulary[position].startsWith(word); position++) collect(vocabulary[position]);
  }
  return [...sectionIDs].sort((a, b) => a - b);
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
  // A table row can be far from the section's subject heading. One clipped
  // window then hides the very term that made this a match. Show a few exact
  // source excerpts rather than implying that distant words are adjacent.
  if (best.end - best.start > 420) {
    const seen = new Set(), groups = [];
    for (const match of matches) {
      if (match.index < best.start || match.index + match.length > best.end || seen.has(match.word)) continue;
      seen.add(match.word);
      const last = groups.at(-1);
      if (last && match.index - last.end < 70) last.end = match.index + match.length;
      else groups.push({ start: match.index, end: match.index + match.length });
    }
    const selected = groups.length > 3 ? [groups[0], groups[Math.floor(groups.length / 2)], groups.at(-1)] : groups;
    const budget = Math.floor(220 / Math.max(1, selected.length));
    return selected.map(group => {
      let start = Math.max(0, group.start - 20);
      let end = Math.min(text.length, Math.max(group.end + 45, start + budget));
      end = Math.min(end, start + budget);
      if (start) { const boundary = text.indexOf(' ', start); if (boundary < group.start) start = boundary + 1; }
      if (end < text.length) { const boundary = text.lastIndexOf(' ', end); if (boundary >= group.end) end = boundary; }
      return text.slice(start, end);
    }).filter(Boolean).join(' … ').replace(/^/, '… ').replace(/$/, ' …');
  }
  let start = Math.max(0, best.start - 60);
  if (start) { const boundary = text.indexOf(" ", start); if (boundary < best.start) start = boundary + 1; }
  let end = Math.min(text.length, Math.max(start + 220, Math.min(best.end + 80, start + 420)));
  if (end < text.length) { const boundary = text.lastIndexOf(" ", end); if (boundary > best.end) end = boundary; }
  return `${start ? "… " : ""}${text.slice(start, end)}${end < text.length ? " …" : ""}`;
}
