import { definitionBundleID, definitionsForReader } from './reader-definition-registry.js?v=20260915-definitions-v7';
import { installDefinitionLinks } from './reader-definition-popover.js?v=20260915-definitions-v7';

const contexts=new WeakMap();
let registryPromise;
function loadRegistry() {
  if(!registryPromise)registryPromise=fetch('/web/reader-definition-registry.json?v=20260915-definitions-v7')
    .then(response=>{if(!response.ok)throw Error('Definition registry unavailable');return response.json();})
    .then(registry=>{if(registry.schemaVersion!==1||!Array.isArray(registry.books))throw Error('Unsupported definition registry');return registry;})
    .catch(error=>{registryPromise=null;throw error;});
  return registryPromise;
}
export function setReaderDefinitionContext(reader, chapter, codeVersion) {
  contexts.set(reader,{bundle:definitionBundleID(codeVersion),codeSectionID:chapter.codeSectionID,chapterNumber:chapter.chapterNumber});
}
export function decorateReaderDefinitions(root,reader) {
  const context=contexts.get(reader);
  if(!context?.bundle||context.codeSectionID==null)return;
  // Do not delay chapter rendering. The captured context belongs to this DOM
  // instance, so a later code switch cannot change its definition edition.
  void loadRegistry().then(registry=>{
    const entries=context.entries || (context.entries=definitionsForReader(registry,context));
    if(!entries.length)return;
    for(const block of root.querySelectorAll('.annotated-code-block > :first-child')) {
      const prose=block.matches('p,li,td,th')?[block]:[...block.querySelectorAll('p,li,td,th')].filter(node=>!node.querySelector('p,li,td,th'));
      for(const paragraph of prose.length?prose:[block])installDefinitionLinks(paragraph,entries);
    }
  }).catch(()=>{ /* Reading remains available if definitions are unavailable. */ });
}
