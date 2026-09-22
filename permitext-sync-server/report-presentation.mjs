// Render only from the immutable manifest. No live source lookup or snapshot rewrite.
const text = (value) => String(value || '').trim();

export function reportResearchPlainText(value) {
  return String(value || '')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1 ($2)')
    .replace(/(?<!\\)(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2')
    .replace(/(?<![\\\w])([*_])(?=\S)([^\n]*?\S)\1(?!\w)/g, '$2')
    .replace(/`([^`\n]+)`/g, '$1')
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
