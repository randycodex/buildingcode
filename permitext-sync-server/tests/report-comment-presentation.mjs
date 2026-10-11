import assert from 'node:assert/strict';
import {reportCommentPresentation} from '../public/project-workflow.js';
const sources = [
 {kind:'evidence',id:'whole',sectionID:10,sourceLibraryVersion:'2022',notes:[{body:'Section review'}, {blockID:'p1',body:'Passage review'}]},
 {kind:'evidence',id:'passage',sectionID:10,sourceLibraryVersion:'2022',selectionBlockID:'p1',notes:[{blockID:'p1',body:'Passage review'}]},
 {kind:'evidence',id:'older',sectionID:10,sourceLibraryVersion:'2014',notes:[{body:'Section review'}]}
];
const blocks = [
 {id:'p',kind:'evidence',sourceID:'passage'},
 {id:'w',kind:'evidence',sourceID:'whole',excludedCommentKeys:['p1']},
 {id:'o',kind:'evidence',sourceID:'older'}
];
let comments = reportCommentPresentation(blocks,sources);
assert.equal(comments.has('p'),false,'covered passage contributes to whole-section owner');
assert.deepEqual(comments.get('w').map(item=>item.text),['Passage review','Section review']);
assert.equal(comments.get('o').length,1,'different edition keeps its own comments');
blocks[1].excludedCommentKeys=[];
comments=reportCommentPresentation(blocks,sources);
assert.equal(comments.get('w').length,2,'identical selected passage comments appear once');
blocks[0].excludedCommentKeys=['p1']; blocks[1].excludedCommentKeys=['p1'];
assert.deepEqual(reportCommentPresentation(blocks,sources).get('w').map(item=>item.text),['Section review']);
assert.equal(reportCommentPresentation([blocks[0]],sources).get('p').length,0);
console.log('Report comments passed: export ownership, inclusion union, exact exclusions, deduplication and edition separation.');
