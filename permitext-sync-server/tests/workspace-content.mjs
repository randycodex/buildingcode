import assert from 'node:assert/strict';
import {workspaceContentRetirements} from '../workspace-content.mjs';
import {captureTrash, restoreTrash, trashBatchForWorkspace, trashBatchWithoutWorkspace, trashSummary} from '../trash-recovery.mjs';
import {planSavedEvidenceDelete} from '../saved-evidence-delete.mjs';

const userID='owner', codeVersion='nyc-2022', old='2026-11-01T00:00:00Z', now='2026-11-02T00:00:00Z';
const wrap=(kind,record)=>({[kind]:{userID,codeVersion,updatedAt:old,...record}});
const project=id=>wrap('project',{id,clientID:id,name:id});
const link=(id,folderClientID,sectionID,blockID='')=>wrap('projectSection',{id,folderClientID,sectionID,blockID});
const save=(id,sectionID,blockID='')=>wrap('savedItem',{id,sectionID,blockID});
const note=(id,sectionID,blockID='',extra={})=>wrap('annotation',{id,sectionID,blockID,noteBody:id,tags:['keep'],...extra});
const remove=m=>{const[k,r]=Object.entries(m)[0];return {[k]:{...r,updatedAt:now,deletedAt:now}};};
const a=project('a'),b=project('b');
const la=link('la','a',1),lb=link('lb','b',1),onlyA=link('only-a','a',2);
const existing=[a,b,la,lb,onlyA,save('shared',1),save('private',2),note('shared-note',1),note('private-note',2),
  save('legacy-unassigned',3), note('legacy-note',3),save('other-edition',2,'x')];
const before=structuredClone(existing);
const cascading=workspaceContentRetirements(userID,existing,[remove(a)]);
assert(cascading.some(m=>m.projectSection?.id==='la'));
assert(cascading.some(m=>m.projectSection?.id==='only-a'));
assert(cascading.some(m=>m.savedItem?.id==='private'&&m.savedItem.deletedAt));
assert(cascading.some(m=>m.annotation?.id==='private-note'&&m.annotation.noteBody===''));
assert.deepEqual(cascading.find(m=>m.annotation)?.annotation.tags,['keep']);
assert(!cascading.some(m=>['shared','shared-note','legacy-unassigned','legacy-note','other-edition'].includes(Object.values(m)[0].id)));
assert.deepEqual(existing,before,'Planning never changes existing records.');
assert.equal(workspaceContentRetirements(userID,existing,[{project:{...a.project,archivedAt:now,updatedAt:now}}]).length,0,'Archiving preserves content.');
assert.equal(workspaceContentRetirements(userID,existing,[{project:{...a.project,deletedAt:now,updatedAt:'2020-01-01'}}]).length,0,'Stale deletes cannot cascade.');
assert.equal(workspaceContentRetirements('another',existing,[remove(a)]).length,0,'Ownership is enforced.');
assert.equal(workspaceContentRetirements(userID, existing.filter(m => Object.values(m)[0].sectionID !== 2), [remove(a)]).filter(m => m.projectSection).length, 1, 'Delete omitted links even when all passages are shared.');
const partialNoteEdit={annotation:{id:'private-note',userID,codeVersion,updatedAt:now,tags:['new']}};
assert(workspaceContentRetirements(userID,existing,[remove(a),partialNoteEdit]).some(m=>m.annotation?.id==='private-note'&&m.annotation.noteBody===''), 'A partial tag edit cannot keep an orphan section note alive.');
const unlink=workspaceContentRetirements(userID,existing,[remove(onlyA)]);
assert(unlink.some(m=>m.savedItem?.id==='private'));
assert(unlink.some(m=>m.annotation?.id==='private-note'));
assert.equal(workspaceContentRetirements(userID,existing,[remove(la)]).length,0,'Another workspace still owns shared content.');
const transfer=[remove(onlyA),link('moved','b',2)];
assert.equal(workspaceContentRetirements(userID,existing,transfer).length,0,'A move in the same batch does not trash content.');

const deletes=[remove(a),...cascading];
const trash=captureTrash(userID,existing,deletes,new Date(now));
const inA=trashBatchForWorkspace(trash,'a');
assert(inA.records.some(item=>item.record.id==='private-note'));
assert.equal(trashBatchForWorkspace(trash,'b'),null);
assert(trashSummary(inA).containsWorkspaces);
const both=captureTrash(userID,existing,[remove(a),remove(b),...workspaceContentRetirements(userID,existing,[remove(a),remove(b)])],new Date(now));
const scoped=trashBatchForWorkspace(both,'a'), remainder=trashBatchWithoutWorkspace(both,'a');
assert(scoped.records.some(item=>item.record.id==='a'));
assert(!scoped.records.some(item=>item.record.id==='b'||item.record.id==='lb'));
assert(remainder.records.some(item=>item.record.id==='b'));
assert(!remainder.records.some(item=>item.record.id==='a'||item.record.id==='la'));
assert(remainder.records.some(item=>item.record.id==='shared'),'Shared recovery remains available in the other workspace.');
assert.equal(trashBatchWithoutWorkspace(scoped,'a')?.records.some(item=>item.record.id==='a')||false,false);
const restored=restoreTrash(inA,deletes,new Date('2026-11-03'));
assert(restored.mutations.some(m=>m.annotation?.noteBody==='private-note'));

const selection={projectID:'a',items:[{sectionID:2,codeVersion}]};
const notesPlan=planSavedEvidenceDelete(userID,existing,{...selection,scope:'notes'});
assert.equal(notesPlan.mutations.length,1);assert.equal(notesPlan.mutations[0].annotation.noteBody,'');
assert.deepEqual(notesPlan.mutations[0].annotation.tags,['keep']);
assert.throws(()=>planSavedEvidenceDelete(userID,existing,{projectID:'a',scope:'notes',items:[{sectionID:1,codeVersion}]}),/shared with another workspace/);
assert.throws(()=>planSavedEvidenceDelete(userID,existing,{...selection,scope:'other'}),/scope/);
assert.throws(()=>planSavedEvidenceDelete(userID,existing,{...selection,scope:'notes',projectID:null}),/workspace/);
const passagePlan=planSavedEvidenceDelete(userID,existing,selection);
assert(passagePlan.mutations.some(m=>m.savedItem?.id==='private'));
assert(passagePlan.mutations.some(m=>m.annotation?.id==='private-note'));
assert(!passagePlan.mutations.some(m=>m.savedItem?.id==='shared'));
console.log('Workspace lifecycle and recovery passed: last destination, sharing, editions, ownership, stale writes, transfers, scoped Trash, restore and note/tag preservation.');

// Undo restores notes removed with the passage, without overwriting newer text
// or tags, and is fenced to the original account and workspace.
const {readFile} = await import('node:fs/promises');
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const undoSource = source.slice(source.indexOf('async function restoreBookmarkUndoNotes('), source.indexOf('\nfunction showBookmarkUndo'));
let currentWorkspace='a', currentNotes=[], writes=[], pushes=[];
const context = {requireCurrentAccountRequest: identity => assert.equal(identity,'owner'),
  currentContentSummary:()=>({annotations:currentNotes}), upsertLocalAnnotation:record=>writes.push(record),
  annotationMutationForRecord:record=>({annotation:record}), pushMutationBatch:async records=>pushes.push(...records)};
const undo = new Function(...Object.keys(context), 'activeWorkspaceID', undoSource+';return restoreBookmarkUndoNotes([arguments[arguments.length-1]], "owner", "a");');
const originalNote={id:'undo-note',sectionID:1,noteBody:'Original',tags:['original'],updatedAt:old};
currentNotes=[{...originalNote,noteBody:'',tags:['new-tag'],updatedAt:now}];
await undo(...Object.values(context),currentWorkspace,originalNote);
assert.equal(writes[0].noteBody,'Original'); assert.deepEqual(writes[0].tags,['new-tag']);
assert.deepEqual(writes[0].syncFields,['noteBody']); assert.equal(pushes.length,1);
writes=[];pushes=[];currentNotes=[{...originalNote,noteBody:'Newer text'}];
await undo(...Object.values(context),currentWorkspace,originalNote);
assert.equal(writes.length,0);
await assert.rejects(undo(...Object.values(context),'b',originalNote),/workspace changed/);
console.log('Bookmark Undo preserves notes, newer text, tags and workspace boundaries.');
