import assert from 'node:assert/strict';
import {isAmbiguousResearchProjectCorrection, projectScopeClarification} from '../research-project-scope.mjs';
import {researchClarificationAnswer,isCanonicalResearchClarification} from '../research-conversation-continuity.mjs';
import {immutableResearchAnswer} from '../project-foundation-contract.mjs';
for(const question of ['no no, this is a new project -','Actually, it’s a different project.','I meant a new job','This is a new project']) {
 assert(isAmbiguousResearchProjectCorrection(question));
 assert.deepEqual(researchClarificationAnswer(question,'project_scope'),projectScopeClarification());
 assert(isCanonicalResearchClarification(question,projectScopeClarification()));
}
for(const question of ['how do you determine the use group for this site?','for this specific project, which use groups apply to it?',
 'This is a new building at the same property','This is a different property at 1 Centre Street',
 'This is a new project. Which use groups apply?','This is not a new project','Does a new project require sprinklers?']) {
 assert(!isAmbiguousResearchProjectCorrection(question),question);
 assert(!isCanonicalResearchClarification(question,projectScopeClarification()));
}
const record={owner:{kind:'user',id:'test'},conversationID:'conversation',projectID:'project',question:'no no, this is a new project -',
 answer:projectScopeClarification(),model:'permitext-conversation-clarification',evidence:[],citations:[],researchSystemVersion:'test'};
assert.doesNotThrow(()=>immutableResearchAnswer(record));
assert.throws(()=>immutableResearchAnswer({...record,projectID:null}),/require evidence/);
const forged=structuredClone(record);forged.answer.answerText='The building is R-2.';
assert.throws(()=>immutableResearchAnswer(forged),/require evidence/);
console.log('Project scope correction: exact clarification only, linked Project required, mixed legal questions and forged claims rejected.');
