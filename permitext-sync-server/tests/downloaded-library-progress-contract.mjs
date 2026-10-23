import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const start = source.indexOf('  const paintLibraryDownloadProgress = () => {');
const end = source.indexOf('  const renderOfflineState = async () => {', start);
assert(start > 0 && end > start);
const functions = source.slice(start, end);
const declaration = source.indexOf('let libraryDownloadController = null;');
assert(declaration < source.indexOf('function renderSettings('), 'Download ownership must outlive Settings mounts');
assert.equal(source.indexOf('let libraryDownloadController = null;', declaration + 1), -1);
const listeners = new Set();
const active = {controller: new AbortController(), progress: {phase:'Downloading codes',completed:11,total:578,percent:2,unit:'chapters'}};
function mount() {
  const node = () => ({hidden:false,disabled:false,textContent:'',value:0});
  const context = {panel:{isConnected:true}, offlineDownload:node(),offlineRemove:node(),offlinePause:node(),offlineProgress:node(),offlineStatus:node(),
    hasCapability:()=>true,libraryDownloadProgressEvent:'progress',renderOfflineState(){context.finished=(context.finished||0)+1;},
    window:{addEventListener(_name,fn){listeners.add(fn);},removeEventListener(_name,fn){listeners.delete(fn);}}};
  Object.defineProperty(context,'libraryDownloadController',{get:()=>active.controller});
  Object.defineProperty(context,'libraryDownloadProgress',{get:()=>active.progress});
  vm.runInNewContext(functions + '\nthis.paint=paintLibraryDownloadProgress;this.changed=downloadProgressChanged;',context);
  return context;
}
const first = mount(); first.paint();
assert.equal(first.offlineDownload.disabled,true); assert.equal(first.offlinePause.hidden,false);
assert.match(first.offlineStatus.textContent,/11 of 578 chapters/);
first.panel._disposeLibraryDownloadProgress(); first.panel.isConnected=false;
assert.equal(listeners.size,0,'Closing Settings releases the listener and its DOM');
const reopened = mount(); active.progress={...active.progress,completed:25}; reopened.paint();
assert.match(reopened.offlineStatus.textContent,/25 of 578 chapters/,'Reopened Settings uses the running download');
assert.equal(reopened.offlineDownload.disabled,true,'Reopening must not start another installer');
active.controller=null; reopened.changed();
assert.equal(reopened.finished,1,'Completion refreshes the currently mounted Settings');
reopened.panel._disposeLibraryDownloadProgress(); assert.equal(listeners.size,0);
assert.match(source.slice(source.indexOf('function mountAccountScreenContent('),source.indexOf('function toggleAccountDialog(')),/_disposeLibraryDownloadProgress\?\.\(\)/);
const closeStart=source.indexOf('  dialog.close = () => {',source.indexOf('function toggleAccountDialog('));
assert.match(source.slice(closeStart,source.indexOf('  dialog.addEventListener("keydown"',closeStart)),/_disposeLibraryDownloadProgress\?\.\(\)/);
console.log('Downloaded library Settings passed: shared running progress, reopen ownership, completion refresh and listener disposal.');
