import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('  refreshReportArtifacts = async');
const end=source.indexOf('\n  };',start)+5;
assert.ok(start>=0&&end>start);
const updateStart=source.indexOf('    panel._updateReportColumns = () => {');
const updateEnd=source.indexOf('      const comparing',updateStart);
const visibility=source.slice(source.indexOf('\n',updateStart)+1,updateEnd);
assert.match(visibility,/versionsToggle.hidden/);
let remoteHistory=[];
const draft={id:'draft',title:'Unsaved writing',blocks:[{text:'Do not replace'}]};
const historyBody={scrollTop:92,replaceChildren(){}};
const c=vm.createContext({disposed:false,deletingReport:false,deletingVersionID:null,historyMutationGeneration:0,
 requestIdentity:'owner',projectID:'project',isCurrentAccountRequest:()=>true,
 reportRequest:async path=>path.includes('/history/')?{reports:remoteHistory}:{},
 dirty:true,activeDraft:draft,drafts:[],sources:[],sourceWarnings:[],history:[],versionsToggle:{hidden:true},
 refreshIncludedReportComments(){},renderHistory(){},
 panel:{querySelector:selector=>selector==='.report-history'?historyBody:null,
 _updateReportColumns(){vm.runInContext(visibility,c);}},
 renderWorkspaceContent(){throw Error('Dirty document must remain mounted');}
});
vm.runInContext(source.slice(start,end),c);
remoteHistory=[{id:'first-export'}];
assert.equal(await c.refreshReportArtifacts(),true);
assert.equal(c.versionsToggle.hidden,false,'An export arriving during unsaved editing must expose Versions immediately');
assert.equal(c.activeDraft,draft);assert.equal(historyBody.scrollTop,92);
remoteHistory=[];await c.refreshReportArtifacts();
assert.equal(c.versionsToggle.hidden,true,'Removing the last version must hide the empty comparison action');
assert.equal(c.activeDraft,draft);
console.log('PASS: dirty Report history refresh updates Versions availability while retaining editor and list scroll.');
