const compact = value => String(value || '').replace(/\s+/g, ' ').trim();
const comparable = value => compact(value).normalize('NFKC').replace(/[‐‑–—−]/g, '-');

// Only expose structure for an entire canonical table already contained in
// the selected passage. A partial selection cannot import the other rows.
export function researchSelectedTables(text, richSources = []) {
  const selected = comparable(text);
  return (Array.isArray(richSources) ? richSources : []).filter(table => table?.kind === 'table' && table.text &&
    selected.includes(comparable(table.text)) && Array.isArray(table.grids) &&
    table.grids.every(grid => Array.isArray(grid?.rows) && grid.rows.every(row => Array.isArray(row?.cells) &&
      row.cells.every(cell => cell && typeof cell.text === 'string')))).flatMap(table => {
    const grids = table.grids.map(grid => ({rows: (grid.rows || []).map(row => ({cells: (row.cells || []).map(cell => ({
      text: String(cell.text || ''), rowSpan: cell.rowSpan || 1, columnSpan: cell.columnSpan || 1,
      ...(Array.isArray(cell.lines) && cell.lines.every(line => typeof line === 'string') &&
        comparable(cell.lines.join(' ')) === comparable(cell.text) ? {lines: [...cell.lines]} : {})
    }))}))}));
    if (!grids.length || grids.some(grid => !grid.rows.length || grid.rows.some(row => !row.cells.length ||
        row.cells.some(cell => !comparable(table.text).includes(comparable(cell.text)))))) return [];
    const value = {kind: 'table', reference: table.reference, text: table.text, grids};
    // This is optional structure, not permission to consume another evidence
    // budget or silently truncate a large table. Its exact text stays intact.
    return JSON.stringify(value).length <= 18000 ? [value] : [];
  });
}

// Derived labels expose the boundaries already present in the exact passage.
// They supply no new rules, applicability decisions, or neighboring text.
export function researchTableFootnotes(text) {
  if (!/\btable\s+\d/i.test(text)) return [];
  const matches = [...text.matchAll(/(?:^|\s)([a-z])\.\s+(?=[A-Z])/g)];
  if (matches.length < 2) return [];
  return matches.flatMap((match, index) => {
    if (matches.filter(other => other[1] === match[1]).length !== 1) return [];
    const quote = compact(text.slice(match.index + match[0].length, matches[index + 1]?.index ?? text.length));
    return quote && quote.length <= 3000 ? [{marker:match[1], quote}] : [];
  });
}

function occupancyGroups(text) {
  const groups = new Set();
  for (const match of text.toUpperCase().matchAll(/\bGROUPS?\s+([A-Z](?:-\d+)?(?:\s*(?:,|\/|OR|AND)\s*(?:GROUPS?\s+)?[A-Z](?:-\d+)?)*)\b/g)) {
    for (const group of match[1].match(/\b[A-Z](?:-\d+)?\b/g) || []) groups.add(group);
  }
  return groups;
}

// A narrow, deterministic cross-note check supplements the full AI review.
// Only explicit limiting claims are checked; examples, questions, negations and
// multi-note comparisons remain for the reviewer, avoiding inferred code scope.
export function researchFootnoteScopeIssues(draft, sources) {
  const issues = [];
  const texts = [draft?.answerText, ...(draft?.claims || []).map(claim => claim.text)];
  for (const text of texts.filter(value => typeof value === 'string')) {
    for (const clause of text.split(/;|\n|(?<=[.!?])\s+/)) {
      const mentions = [...clause.matchAll(/\b(?:footnote|note)\s+([a-z])\b/gi)];
      if (mentions.length !== 1 || /\?|\b(?:not|no|unlike|without)\b|rather than/i.test(clause) ||
          !/\b(?:concerns|limited to|restricted to|only|specifically|is for)\b/i.test(clause)) continue;
      const marker = mentions[0][1].toLowerCase(), groups = occupancyGroups(clause);
      if (!groups.size) continue;
      const ids = [...clause.matchAll(/\[(S\d+)\]/g)].map(match => match[1]);
      const candidates = sources.filter(source => (!ids.length || ids.includes(source.id)) &&
        source.tableFootnotes?.some(note => note.marker === marker));
      if (!candidates.length) continue;
      for (const group of groups) {
        if (candidates.some(source => occupancyGroups(source.tableFootnotes.find(note => note.marker === marker).quote).has(group))) continue;
        if (!candidates.some(source => source.tableFootnotes.some(note => note.marker !== marker && occupancyGroups(note.quote).has(group)))) continue;
        issues.push({code:'table_footnote_scope', detail:`The claim about note ${marker} transfers Group ${group} from a different labeled footnote. Compare the exact note ${marker} quote and row markers independently; do not inherit another note's occupancy restriction.`});
      }
    }
  }
  return [...new Map(issues.map(issue => [issue.detail, issue])).values()];
}

export const tableFootnoteInstruction = ' Read every labeled table footnote independently. tableFootnotes contains quotes derived from the exact source text, not new authority. tables preserves the canonical rows, cells and spans of complete tables already quoted in that same selected text; it never adds unselected rows. Use that structure instead of treating flattened neighboring cells as one rule. First identify the requested row, each factor and basis, and the literal footnote markers in its cells. Then explain each referenced note independently, preserving its complete trigger and consequence. When the question asks to preserve table footnotes, account for every supplied labeled note, including general unit or measurement notes, not only the row-specific markers. Keep each numerical trigger, comparison operator and required consequence in both the narrative and any claim summarizing that note. A shared marker does not transfer another row\'s occupancy restriction into that note. Do not describe adjacent notes as sharing a limitation unless each note states it. A conditional note can be explained without asserting that its trigger is met: explicitly leave its application unresolved if the necessary facts are absent. Do not imply a conditional requirement applies unconditionally, or require facts about an unrelated scenario merely to explain the selected rule. Check these distinctions independently in the narrative, every claim and missingFacts as well as arithmetic. If a marker or boundary is ambiguous, state that limit instead of guessing.';
