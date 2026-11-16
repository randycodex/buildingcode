// Evaluation only: source families, topic changes, corrections and contextual exceptions.
import {naturalFollowupCases as existing} from './assistant-natural-followup-cases.mjs';
export const naturalFollowupCases=[
 ...existing.filter(c=>['mechanical','zoning','fuel-gas'].includes(c.id)).map(c=>({...c,requireCitations:true})),
 {id:'stair-context',requireCitations:true,description:'Proposed new eight-story NYC Group R-2 apartment building. Height is proposed at 90 feet. A common resident roof terrace is proposed. Two interior exit stairways are proposed; arrangement, door layout, sprinkler coverage and detailed construction remain unverified.',turns:[
  ['Does the roof need two exits?',/roof|exit/i],
  ['Can both stairs be next to each other?',/stair|separat|adjacent|scissor/i],
  ["But this is a residential building. Doesn't that make a difference?",/R-2|residen|scissor|stair/i]
 ]}
];
