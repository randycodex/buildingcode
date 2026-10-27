import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function extract(name,async=false){const start=source.indexOf(`${async?'async ':''}function ${name}(`);return source.slice(start,source.indexOf('\n}',start)+2);}
let refreshIDs=[],focused=false;const panel={dataset:{paneId:'utility:analysis:v2'},scrollTop:0,scrollHeight:100,clientHeight:100};
const input={dataset:{researchDraftKey:'followup:v2'},value:'Unsent v2 draft',selectionStart:3,selectionEnd:7,matches:s=>s.includes('.rv2-input'),closest:()=>panel,focus(){focused=true;},setSelectionRange(a,b){assert.deepEqual([a,b],[3,7]);}};
const context=vm.createContext({Map,Set,Array,String,CSS:{escape:s=>s},
  activeAccount:()=>({userID:'local',sessionToken:'session'}),activeWorkspaceID:'workspace',state:{researchConversationID:'v2'},
  researchConversationPaneIsOpen:()=>false,supplementalResearchConversationIDs:[],supplementalResearchConversations:new Map(),
  paneIDForResearchConversation:()=>panel.dataset.paneId,document:{activeElement:input},
  readResearchConversationList:{invalidate(){}},researchHistoryPageReaders:new Map(),
  transitionWorkspace:async(_,{refreshPaneIDs})=>{refreshIDs=refreshPaneIDs;},
  track:{querySelectorAll:selector=>selector.includes('.research-v2-panel')?[panel]:[],
    querySelector:selector=>selector.includes('rv2-input')?input:selector.includes('research-v2-panel')||selector.includes('workspace-panel')?panel:null}
});
vm.runInContext(extract('researchArtifactConsumersVisible')+'\n'+extract('refreshVisibleResearchArtifactConsumers',true),context);
assert.equal(vm.runInContext('researchArtifactConsumersVisible()',context),true);
assert.equal(await vm.runInContext('refreshVisibleResearchArtifactConsumers()',context),true);
assert.deepEqual(Array.from(refreshIDs),['utility:analysis:v2']);assert(focused);assert.equal(input.value,'Unsent v2 draft');
console.log('V2 sync refresh: visible pane detection, targeted rerender, composer focus/selection restoration and retained draft passed.');
