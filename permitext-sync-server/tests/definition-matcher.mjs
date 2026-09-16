import test from 'node:test';
import assert from 'node:assert/strict';
import {createDefinitionMatcher} from '../public/definition-matcher.js';

test('inline definition headings stop links without suppressing preceding application prose',()=>{
 const match=createDefinitionMatcher([{id:'a',term:'LICENSE'}]);
 const text='A license is required. **§28-401.3 Definitions. LICENSE. A license meaning.';
 assert.deepEqual(match(text).map(m=>m.text),['license']);
 assert.equal(match('A license is required in the next passage.').length,1);
});

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
test('a partial longer phrase does not suppress a valid shorter whole term',()=>{
 const match=createDefinitionMatcher([{id:'a',term:'FIRE'},{id:'b',term:'FIRE WALL'}]);
 assert.deepEqual(match('fire wallboard').map(m=>m.text),['fire']);
});
test('large chapters preserve Unicode boundaries and match offsets',()=>{
 const match=createDefinitionMatcher([{id:'exit',term:'EXIT'}]);
 const text=('𝒜exit exit𝒜 exit. ').repeat(10000);
 const matches=match(text);
 assert.equal(matches.length,10000);
 for(const item of matches)assert.equal(text.slice(item.start,item.end),'exit');
});

test('explicit plural aliases respect word boundaries and longer defined phrases',()=>{
 const match=createDefinitionMatcher([{id:'story',term:'STORY',aliases:['STORIES']},{id:'unit',term:'DWELLING UNIT',aliases:['DWELLING UNITS']},{id:'dwelling',term:'DWELLING',aliases:['DWELLINGS']}]);
 assert.deepEqual(match('Stories contain dwelling units; dwellings. Storytelling histories.').map(m=>[m.text,m.entries[0].id]),[['Stories','story'],['dwelling units','unit'],['dwellings','dwelling']]);
});
