// Render only from the immutable manifest. No live source lookup or snapshot rewrite.
const text = (value) => String(value || '').trim();

// Correct a known whitespace defect in the imported BC 1020.6 display only.
// Keep the captured enacted-source text and hash unchanged.
export function reportEvidenceDisplayText(value) {
  return String(value || '').replaceAll(
    'intervening rooms.Where the path of egress travel',
    'intervening rooms. Where the path of egress travel');
}

export function reportResearchPlainText(value) {
  return String(value || '')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1 ($2)')
    .replace(/(?<!\\)(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2')
    .replace(/(?<![\\\w])([*_])(?=\S)([^\n]*?\S)\1(?!\w)/g, '$2')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^ {0,3}#{1,6}[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/gm, '$1')
    .trim();
}

export function reportCitationLabel(citation, evidence = [], answerEdition = '') {
  const matching = evidence.filter((source) =>
    Boolean(text(citation.sectionID)) && text(source.sectionID) === text(citation.sectionID) &&
    (!(citation.sourceIDs || []).length || (citation.sourceIDs || []).some((id) =>
      [source.sourceID, source.passageID, source.id].includes(id)
    ))
  );
  const source = matching[0] || {};
  const sectionNumber = text(citation.sectionNumber || source.sectionNumber);
  if (!sectionNumber) return 'Citation details unavailable in this saved Report; review the original Research evidence.';
  const code = text(citation.codePrefix || source.codeBook || source.codePrefix);
  const edition = text(citation.codeEdition || source.codeEdition || answerEdition);
  return [
    [code, `§ ${sectionNumber}`, text(citation.title || source.title)].filter(Boolean).join(' · '),
    edition || 'Edition not recorded'
  ].join(' — ');
}

export function reportCodeBasisLines(manifest) {
  const research = (manifest.items || []).filter((item) => item.kind === 'researchAnswer');
  const editions = [...new Set(research.flatMap((item) => [
    item.codeEdition, ...(item.citations || []).map((citation) => citation.codeEdition)
  ]).map(text).filter(Boolean))];
  const evidence = (manifest.items || []).filter(item => item.kind === 'evidence');
  const evidenceEditions = [...new Set(evidence.map(reportEvidenceEdition))];
  return [
    ...(evidence.length ? [`Included code passages: ${evidenceEditions.join('; ')}`] : []),
    manifest.codeEdition ? `Project default: ${manifest.codeEdition}` : 'Project default: not recorded',
    ...(research.length ? [
      `Included Research basis: ${editions.length ? editions.join('; ') : 'not recorded; review the original sources'}`,
      'Source applicability must be verified for this Project.'
    ] : [])
  ];
}

export function reportEvidenceEdition(item = {}) {
  if (text(item.codeEdition)) return text(item.codeEdition);
  const version = text(item.sourceLibraryVersion || item.codeVersion);
  if (text(item.codePrefix || item.codeBook) === 'BC68') return '1968 NYC Building Code';
  if (version.includes('2026-zoning-resolution')) return 'NYC Zoning Resolution — text through 2026-08-13';
  if (version.includes('2026-existing-building-code')) return 'NYC Existing Building Code — effective 2027-07-17';
  if (version.includes('2026-enacted-administrative-code')) return 'NYC Administrative Code — through 2026-07-25';
  const year = version.match(/(?:^|\/)(1968|2008|2014|2022|2025)-(?:construction|specialty|building)-codes?\b/i)?.[1];
  return year ? `${year} NYC Codes` : 'Edition not recorded';
}

// Preview the same source fields that the PDF renders, without trusting HTML.
export function reportItemPreview(item) {
  const parts = [];
  const add = (label, content) => {
    const value = Array.isArray(content) ? content.filter(Boolean).join('\n\n') : String(content || '');
    if (value.trim()) parts.push({kind:'text',label,text:item.kind === 'researchAnswer' ? reportResearchPlainText(value) : item.kind === 'evidence' ? reportEvidenceDisplayText(value.trim()) : value.trim()});
  };
  if (item.kind === 'evidence') {
    let remaining = item.passageText || '';
    for (const table of item.tables || []) {
      const position = remaining.indexOf(table.text);
      if (position < 0) continue;
      add('',remaining.slice(0,position));
      parts.push({kind:'table',rows:table.rows});
      remaining = remaining.slice(position + table.text.length);
    }
    add('',remaining);
  } else if (item.kind === 'researchAnswer') {
    add('Question',item.question);
    add('Research basis',[item.authorityLabel || item.authorityStatus,item.codeEdition,item.sourceAsOf,
      item.codeBasis?.disclosure,item.codeBasis?.limitation]);
    add('Conclusion',item.conclusion);
    add('What the selected evidence establishes',(item.supportedPoints || []).map(point=>[point.heading,point.explanation].filter(Boolean).join(': ')));
    add('Explanation',item.explanation);
    add('Assumptions',item.assumptions);
    add('Project facts to verify',item.missingFacts);
    add('Limits of this answer',item.limitations);
    add('Additional evidence needed',item.additionalEvidenceNeeded);
    add('Citations',[...new Set((item.citations || []).map(citation=>reportCitationLabel(citation,item.evidence || [],item.codeEdition)))]);
    add('Professional-use notice',item.disclaimer);
  } else if (item.kind === 'projectFacts') {
    add('Address',item.address);
    const facts = reportFactPresentation(item);
    add('Project facts',facts.rows.map(row => [row.text,
      ...[row.qualification,row.source].filter(Boolean).map(id => `[${id}]`)].join(' ')));
    add('Fact qualifications and sources',facts.notes.map((note,index) => `[${index+1}] ${note.kind}: ${note.text}`));
  } else {
    add('',item.plainText || item.text);
  }
  return parts;
}

// Compact only the known fact-projection envelope. Unrecognized/legacy prose
// remains verbatim; every qualification and source string stays in the snapshot.
export function reportFactPresentation(item) {
  const notes = [];
  const reference = (kind, value) => {
    if (!value) return null;
    let index = notes.findIndex(note => note.kind === kind && note.text === value);
    if (index < 0) { index = notes.length; notes.push({ kind, text: value }); }
    return index + 1;
  };
  const rows = String(item.facts || '').split(/\n\n/).map(original => {
    if (!/^(?:Unknown: )?(?:Building \/ Code|Zoning|Custom) Fact — /.test(original)) return { text: original };
    const marker = ' Original user/source wording: ';
    const position = original.indexOf(marker);
    const source = position < 0 ? '' : original.slice(position + marker.length);
    const line = position < 0 ? original : original.slice(0, position);
    const match = line.match(/ \(([^()]*)\)\.$/);
    if (!match) return { text: original };
    return { text: line.slice(0, match.index),
      qualification: reference('Qualification', match[1]), source: reference('Original user/source wording', source) };
  });
  return { rows, notes };
}
