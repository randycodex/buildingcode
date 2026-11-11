// A deliberately small inline Markdown vocabulary. Never interpret model HTML.
export function researchInlineRuns(value, styles = {}, depth = 0) {
  const text = String(value || '');
  if (depth > 4) return [{text,...styles}];
  const tokens = /\\[\\`*_]|`([^`\n]+)`|(\*\*|__)(?=\S)([\s\S]*?\S)\2|(?<![\w*])([*_])(?=\S)([^\n]*?\S)\4(?![\w*])/g;
  const runs = []; let offset = 0;
  for (const match of text.matchAll(tokens)) {
    if (match.index > offset) runs.push({text:text.slice(offset,match.index),...styles});
    if (match[0].startsWith('\\')) runs.push({text:match[0].slice(1),...styles});
    else if (match[1] !== undefined) runs.push({text:match[1],...styles,code:true});
    else runs.push(...researchInlineRuns(match[3] ?? match[5], {...styles,...(match[2] ? {bold:true} : {italic:true})},depth+1));
    offset = match.index + match[0].length;
  }
  if (offset < text.length) runs.push({text:text.slice(offset),...styles});
  return runs;
}
