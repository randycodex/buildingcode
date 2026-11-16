// Reuse the exact prior excerpt only while it still belongs to the current
// section/edition. Metadata for unselected figures is not binary evidence.
export async function restoreAssistantEvidence(snapshot,canonical,{comparableText,loadVisual}={}){
 if(!canonical||canonical.codeVersion!==snapshot.sourceLibraryVersion)return null;
 const comparable=comparableText||((s)=>String(s||'').replace(/\s+/g,' ').trim());
 const current=comparable(canonical.canonicalText||canonical.text);
 const passages=String(snapshot.passageText||'').split(/\n\s*\n/).map(comparable).filter(Boolean);
 if(!passages.length||!passages.every(text=>current.includes(text)))return null;
 const visualSources=[];
 for(const saved of snapshot.visualSources||[]){
  const visual=(canonical.visualSources||[]).find(v=>v.id===saved.id&&v.contentHash===saved.contentHash);
  if(!visual)return null;
  visualSources.push(await loadVisual(visual));
 }
 const structured=snapshot.structuredSource;
 const rich=structured&&(canonical.richSources||[]).find(s=>s.id===structured.id&&s.contentHash===structured.contentHash);
 if(structured&&!rich)return null;
 return {...canonical,text:snapshot.passageText,sourceID:snapshot.sourceID,visualSources,
  ...(rich?{richSourceID:rich.id,richSourceKind:rich.kind,richSourceReference:rich.reference,richSourceText:rich.text,
   richSourceContentHash:rich.contentHash,richSourceGrids:rich.grids,richSourceRowCount:rich.rowCount}:{}),
  origin:'conversation_recall',retrievalReason:'Revalidated excerpt from an earlier active conversation turn'};
}
