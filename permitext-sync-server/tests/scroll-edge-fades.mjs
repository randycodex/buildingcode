import assert from 'node:assert/strict';
import {scrollFadeEdges} from '../public/scroll-edge-fades.js';

assert.deepEqual(scrollFadeEdges({scrollTop:0, scrollHeight:600, clientHeight:600}), {top:false,bottom:false});
assert.deepEqual(scrollFadeEdges({scrollTop:0, scrollHeight:1200, clientHeight:600}), {top:false,bottom:true});
assert.deepEqual(scrollFadeEdges({scrollTop:300, scrollHeight:1200, clientHeight:600}), {top:true,bottom:true});
assert.deepEqual(scrollFadeEdges({scrollTop:600, scrollHeight:1200, clientHeight:600}), {top:true,bottom:false});
assert.deepEqual(scrollFadeEdges({scrollTop:170.909, scrollHeight:1181, clientHeight:1009}), {top:true,bottom:false}, 'Fractional final offsets must uncover the last item');
assert.deepEqual(scrollFadeEdges({scrollTop:-20, scrollHeight:1200, clientHeight:600}), {top:false,bottom:true}, 'Elastic scrolling must not fade the first item');
assert.deepEqual(scrollFadeEdges({scrollTop:0, scrollHeight:1200, clientHeight:0}), {top:false,bottom:false}, 'Hidden columns must not show fades');
console.log('Scroll fades: first, middle, last, zoom rounding, overscroll and hidden columns passed.');
