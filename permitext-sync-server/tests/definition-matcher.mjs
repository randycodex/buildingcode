import test from 'node:test';
import assert from 'node:assert/strict';
import {createDefinitionMatcher} from '../public/definition-matcher.js';

test('matches whole terms and longest phrases without changing source text',()=>{
 const match=createDefinitionMatcher([{id:'a',term:'FIRE'},{id:'b',term:'FIRE WALL'}]);
 assert.deepEqual(match('Fire wall; fire. Fireworks.').map(m=>[m.text,m.entries[0].id]),[['Fire wall','b'],['fire','a']]);
});
test('matches wrapped phrases and retains original offsets',()=>{
 const source='A fire\n  wall is here.';
 const [m]=createDefinitionMatcher([{id:'a',term:'FIRE WALL'}])(source);
 assert.equal(source.slice(m.start,m.end),'fire\n  wall');
 assert.equal(m.entries[0].id,'a');
});
test('does not guess plurals and keeps multiple applicable sources explicit',()=>{
 const match=createDefinitionMatcher([{id:'a',term:'EXIT'},{id:'b',term:'EXIT'}]);
 assert.equal(match('exits').length,0);
 assert.equal(match('exit')[0].entries.length,2);
});
test('recognizes only explicit aliases and respects Unicode word boundaries',()=>{
 const match=createDefinitionMatcher([{id:'a',term:'EXIT',aliases:['EXITS']}]);
 assert.equal(match('éexit exité').length,0);
 assert.equal(match('exits')[0].entries[0].id,'a');
});
