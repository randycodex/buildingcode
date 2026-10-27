// Vocabulary help for retrieval only. These aliases never establish a code rule.
const aliases=[[/\bhallways?\b/gi,'corridor'],[/\bstaircases?\b/gi,'stairway'],[/\bwheelchair\s+ramps?\b/gi,'accessible ramp']];
const filler=new Set('what which how why when where does do did is are was were would could should can may must the a an me my i we our you your please explain tell show find affects affect about for of to in under according requirements requirement need needs definition define'.split(' '));
export function researchDiscoveryTerms(question,{sourceNeed=false}={}){
  let text=String(question||'');const expansions=[];
  if(sourceNeed)text=text.replace(/[,;]\s*(?:including|with)\s+(?:any|its|the|relevant)\b.*$/i,'');
  text=text.replace(/(?<=[a-z])[-‐‑–](?=[a-z])/gi,' ');
  for(const [pattern,replacement] of aliases){const matched=text.match(pattern);if(matched){expansions.push(`${matched[0]} → ${replacement}`);text=text.replace(pattern,replacement);}}
  const terms=text.toLowerCase().match(/[a-z0-9]+(?:[.:-][a-z0-9]+)*/g)||[];
  const sourceFraming=new Set('applicable source sources provision provisions code including any relevant supplied selected provided attached current complete required missing establishing specifying governing needed and or'.split(' '));
  return {query:terms.filter(term=>!filler.has(term)&&(!sourceNeed||!sourceFraming.has(term))).join(' ').slice(0,200)||text.slice(0,200),expansions};
}
export const researchDiscoveryQuery=question=>researchDiscoveryTerms(question).query;
