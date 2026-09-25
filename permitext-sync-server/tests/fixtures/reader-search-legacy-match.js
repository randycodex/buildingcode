// Frozen pre-PERF-10 browser block ranking, retained only as an independent parity oracle.
function readerSearchBlockMatches(section, query, reader = null) {
  return annotatedBlocksForSection(section).flatMap((block, index) => {
    const text = plainTextForSearchBlock(block).replace(/\s+/g, " ").trim();
    const match = readerSearchMatch(text, query);
    if (!match) return [];
    const target = annotationTargetForBlock(section, block, reader, index);
    const leadingText = text.slice(0, match.index).replace(/^[\s§:;,.()\-–—]+/, "");
    return [{
      block,
      blockID: target.blockID,
      text,
      match,
      startsWithMatch: leadingText.length === 0,
      index
    }];
  });
}

function bestReaderSearchBlockMatch(section, query, reader = null) {
  return readerSearchBlockMatches(section, query, reader).sort((left, right) =>
    Number(right.startsWithMatch) - Number(left.startsWithMatch) ||
    Number(right.match.exact) - Number(left.match.exact) ||
    left.match.index - right.match.index ||
    left.index - right.index
  )[0] || null;
}
