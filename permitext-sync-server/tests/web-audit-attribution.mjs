// Read-only, opt-in fixture telemetry. Production assets never import this file.
export function webAuditAttributionPrelude(source) {
  const names = ["currentContentSummary", "projectEvidenceCount", "summarizeMutations", "consolidatedSavedAnnotations", "renderSectionContent", "renderSearchResults", "appendPaneSequence", "captureReaderScrollPositions", "applyReaderScrollPosition", "refreshVisibleSyncedDerivedState", "syncReaderNoteBookmarkButtons", "saveWorkspaceState", "syncWorkflowNavigation", "syncResearchColumnLayout"];
  return `const auditStats = globalThis.__permitextAuditStats;\n` + names.filter(name => source.includes(`function ${name}(`)).map(name =>
    `if (auditStats) { const original = ${name}; ${name} = function (...args) { const start = performance.now(); try { return Reflect.apply(original, this, args); } finally { const elapsed = performance.now() - start; const row = auditStats[${JSON.stringify(name)}] ||= { count: 0, totalMs: 0, maxMs: 0 }; row.count++; row.totalMs += elapsed; row.maxMs = Math.max(row.maxMs, elapsed); } }; }`
  ).join("\n") + "\n";
}
