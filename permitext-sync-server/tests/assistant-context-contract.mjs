import assert from 'node:assert/strict';
import {assistantWorkTypes, assistantWorkTypeForMenu, assistantWorkContext, assistantWorkFacts, assistantDraftForConversation, normalizeAssistantViews} from '../public/assistant-context.js';
import {normalizeWorkspaceLayout} from '../public/workspace-state.js';
const facts=['Existing building has 37 apartments.', 'Proposed work: New construction', 'Proposed uses: Apartments and retail', 'Applicant has not confirmed construction type.'];
const copy=structuredClone(facts), scope=assistantWorkContext(facts);
assert.equal(scope.workType,'New construction');assert.equal(scope.uses,'Apartments and retail');
assert.deepEqual(assistantWorkFacts(scope),[facts[1],facts[2],facts[0],facts[3]]);
assert.deepEqual(facts,copy,'Reading context cannot change stored facts');
assert.equal(assistantWorkTypeForMenu(scope.workType),'New building');
assert.equal(assistantWorkTypeForMenu('Addition'),'Enlargement / addition');
assert.equal(assistantWorkTypeForMenu('Change of use'),'Change of use or occupancy');
assert.equal(assistantWorkTypeForMenu('Demolition'),'Demolition','An ambiguous saved demolition scope must not be upgraded to full demolition');
assert.equal(assistantWorkTypeForMenu('constructor'),'constructor','Custom work descriptions remain plain strings');
for (const workType of assistantWorkTypes.filter(type=>type!=='Unspecified')) {
  const workFacts = assistantWorkFacts({workType});
  assert.deepEqual(workFacts,[`Proposed work: ${workType}`],'A scope selection cannot assert a filing type, CO requirement, or governing edition');
  assert.equal(assistantWorkContext(workFacts).workType,workType);
}
assert.equal(assistantWorkContext(['Existing residential building']).workType,'Unspecified','Existing inventory does not establish proposed work');
assert.deepEqual(assistantWorkFacts({workType:'Unspecified',uses:'',additionalFacts:''}),[]);
const conflicting=['Proposed work: New construction','Proposed work: Alteration'];
assert.deepEqual(assistantWorkFacts(assistantWorkContext(conflicting)),conflicting,'Do not silently discard additional facts with similar labels');
assert.throws(()=>assistantWorkFacts({additionalFacts:Array.from({length:21},(_,i)=>`Fact ${i}`).join('\n')}));
assert.throws(()=>assistantWorkFacts({uses:'a'.repeat(500)}));
assert.throws(()=>assistantWorkFacts({additionalFacts:'Same\nSame'}));
const view={tab:'work',collapsed:true,splitRatio:0.62,draft:{projectID:'project-a',...scope}};
const normalized=normalizeAssistantViews({'utility:analysis':view});
assert.deepEqual(normalizeWorkspaceLayout({researchViewState:{assistantViews:normalized}}).researchViewState.assistantViews,normalized,'Work drafts and selected-panel state must survive a workspace reload');
const closed = normalizeAssistantViews({'utility:analysis':{...view,tab:''}});
assert.equal(normalizeWorkspaceLayout({researchViewState:{assistantViews:closed}}).researchViewState.assistantViews['utility:analysis'].tab,'','A closed context panel stays closed after workspace reload');
assert.deepEqual(closed['utility:analysis'].draft,normalized['utility:analysis'].draft,'Closing a context panel preserves its work draft');
assert.equal(closed['utility:analysis'].splitRatio,0.62,'The divider position survives closing and restoring a context panel');
assert.equal(normalizeAssistantViews({pane:{splitRatio:2}}).pane.splitRatio,0.8);
assert.equal(normalizeAssistantViews({pane:{splitRatio:-2}}).pane.splitRatio,0.2);
assert.equal(normalizeAssistantViews({pane:{splitRatio:NaN}}).pane.splitRatio,0.45);
assert.equal(normalizeAssistantViews({pane:{tab:'unknown',collapsed:'true',draft:{workType:null}}}).pane.draft.workType,'Unspecified');
assert.equal(normalizeAssistantViews({pane:{draft:{workType:'Demolition'}}}).pane.draft.workType,'Demolition','Existing user-provided work labels survive a draft reload');
for (const tab of ['project','basis','sources','settings']) {
  const migrated = normalizeAssistantViews({pane:{tab,draft:normalized['utility:analysis'].draft}}).pane;
  assert.equal(migrated.tab,'work','Removed informational panels restore to Work');
  assert.deepEqual(migrated.draft,normalized['utility:analysis'].draft,'Migrating a removed panel preserves work drafts');
}
assert.deepEqual(normalizeAssistantViews(null),{});
console.log('Assistant context passed: scope stays explicit, existing facts survive, limits enforced, drafts and sidebar state reload.');

const linked = {primaryProjectID:'a',projectContext:{projectID:'a',facts:['Proposed work: New construction']}};
assert.equal(assistantDraftForConversation(linked,'a').workType,'New construction');
assert.equal(assistantDraftForConversation(linked,'b').workType,'Unspecified','New chat cannot inherit another property');
assert.equal(assistantDraftForConversation({...linked,projectContextReviewRequired:true},'a').workType,'Unspecified','New chat cannot bypass required context review');
assert.equal(assistantDraftForConversation({...linked,projectContext:{projectID:'old',facts:linked.projectContext.facts}},'a').workType,'Unspecified');
