import assert from 'node:assert/strict';
import { researchEvidenceRetrievalQuery } from '../research-evidence-assembly.mjs';
const root = 'For a hypothetical new Group B office under the 2022 NYC Building Code, what is the maximum exit access travel distance with and without sprinklers? This is a general rule question, not a determination for the Flatiron project.';
const projectFacts = ['NYC Landmarks Preservation Commission building record; zoning MIH area.'];
const initial = researchEvidenceRetrievalQuery({question:root,projectFacts});
assert.equal(initial.projectFactsApplied,false);
const follow = researchEvidenceRetrievalQuery({question:'What if only the office floor has sprinklers, not the rest of the building? Can I still use the 300-foot value?',previousTopic:root,projectFacts});
assert.equal(follow.previousTopicApplied,true);
assert.equal(follow.projectFactsApplied,false);
assert(!follow.retrievalQuery.includes('Preservation Commission'));
const apply = researchEvidenceRetrievalQuery({question:'Now apply that to my building. What do our project facts establish?',previousTopic:root,projectFacts});
assert.equal(apply.projectFactsApplied,true);
const ordinary = researchEvidenceRetrievalQuery({question:'Does this building need sprinklers?',projectFacts});
assert.equal(ordinary.projectFactsApplied,true);
const switched = researchEvidenceRetrievalQuery({question:'New topic: does my building need LPC approval?',previousTopic:root,projectFacts});
assert.equal(switched.projectFactsApplied,true);
console.log('Explicit general-rule scope excludes unrelated saved project facts; project application restores them.');

const afterApplication = researchEvidenceRetrievalQuery({question:"What should I check next?",topicContext:{rootTopic:root,currentTopic:'Now apply that to my building. What do our project facts establish?'},projectFacts});
assert.equal(afterApplication.projectFactsApplied,true, 'The latest explicit project application overrides an older general-rule topic.');

const presentation = await (await import('node:fs/promises')).readFile(new URL('../research-question-intent.mjs', import.meta.url), 'utf8');
assert(presentation.includes('Honor hypothetical premises over saved facts within that scenario'));
assert(presentation.includes('never mark hypothetical facts verified'));

const switchWithApplicable = researchEvidenceRetrievalQuery({question:'New topic: can an accessible means-of-egress ramp use a 1:8 slope? Explain the applicable limit. This is a general rule question.',previousTopic:root,projectFacts});
assert.equal(switchWithApplicable.topicDecision.decision,'topic_switch');
assert.equal(switchWithApplicable.previousTopicApplied,false);
assert(!switchWithApplicable.retrievalQuery.includes('travel distance'));
