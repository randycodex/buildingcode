// Fixture-only synchronous wrapper; timings are inclusive, so nested calls overlap.
export function fixtureMeasureSync(name, fn, stats, clock) {
  return function (...args) {
    const started = clock();
    try { return Reflect.apply(fn, this, args); }
    finally {
      const elapsed = Math.max(0, clock() - started);
      const record = stats[name] ||= {count: 0, totalMs: 0, maxMs: 0};
      record.count += 1;
      record.totalMs += elapsed;
      record.maxMs = Math.max(record.maxMs, elapsed);
    }
  };
}
export function summaryAttributionPrelude() {
  return `// Capability-gated fixture instrumentation; never served to normal app requests.\n${fixtureMeasureSync.toString()}\n` +
    `const fixtureSummaryStats = globalThis.__permitextFixtureSummaryStats;\n` +
    `if (fixtureSummaryStats) {\n` + ['currentContentSummary', 'projectEvidenceCount', 'summarizeMutations'].map(name =>
      `  ${name} = fixtureMeasureSync(${JSON.stringify(name)}, ${name}, fixtureSummaryStats, () => performance.now());`).join('\n') + `\n}\n`;
}
