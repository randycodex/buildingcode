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
  return [
    manifest.codeEdition ? `Project default: ${manifest.codeEdition}` : 'Project default: not recorded',
    ...(research.length ? [
      `Included Research basis: ${editions.length ? editions.join('; ') : 'not recorded; review the original sources'}`,
      'Source applicability must be verified for this Project.'
    ] : [])
  ];
}
