const compact = value => String(value || '').replace(/\s+/g, ' ').trim();

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

export const tableFootnoteInstruction = ' Read every labeled table footnote independently. tableFootnotes contains quotes derived from the exact source text, not new authority. Bind each row to its actual markers, then read each named note separately. A note shared by several rows does not inherit the occupancy, use, location, or other limiting condition of a different footnote or one of those rows. Do not merge adjacent footnotes into one rule. Check these distinctions in the narrative, claims and missingFacts as well as arithmetic. If a marker or boundary is ambiguous, state that limit instead of guessing.';
