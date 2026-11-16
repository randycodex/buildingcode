// Build discovery cues only from the authorized library. Headings identify
// candidates; they are never treated as the text of a governing requirement.
export function assistantLibraryNavigation(catalog,chapterSummaries=[]){
 const groups=new Map();
 for(const item of catalog){
  const key=[item.codeVersion,item.codePrefix,item.chapterNumber].join(':');
  if(!groups.has(key)){
   const chapter=chapterSummaries.find(c=>c.codePrefix===item.codePrefix&&String(c.chapterNumber)===String(item.chapterNumber));
   groups.set(key,{id:`C${groups.size+1}`,code:item.codePrefix,chapter:String(item.chapterNumber),edition:item.codeEdition,
    title:item.chapterTitle||chapter?.fullTitle||chapter?.displayTitle||item.headerLine||'',headings:[]});
  }
  groups.get(key).headings.push({id:String(item.id||item.sectionID),number:item.sectionNumber,title:item.title||item.headingLine||item.headerLine||''});
 }
 const chapters=[...groups.values()];
 return {guide:chapters.map(({headings,...c})=>c),outlines:ids=>chapters.filter(c=>ids.includes(c.id)).map(c=>({...c,coverage:'Headings through three number levels. Deeper subsections can be located with search_library or followed from section text.',headings:c.headings.filter(h=>String(h.number||'').split('.').length<=3).map(h=>({id:h.id,label:h.title.startsWith(String(h.number))?h.title:`${h.number} ${h.title}`}))}))};
}

// Map the expanded obligations back to real headings as well as using model
// nominations. This prevents a correctly identified discipline from being lost
// through a mistaken chapter ID. No topic/section-specific routes are used.
export function governingChapterIDs(intent,guide){
 const ignored=new Set('the and for with from this that which where when what whether required requirements requirement provisions provision building buildings code codes chapter section general including applicable apply based use used new york city nyc does must shall how can their its may be or of to in a an by on at as'.split(' '));
 const terms=text=>[...new Set((String(text).toLowerCase().match(/[a-z]+/g)||[]).filter(w=>w.length>3&&!ignored.has(w)).map(w=>w.slice(0,7)))];
 const titleTerms=new Map(guide.map(c=>[c.id,terms(c.title)])),selected=[];
 const add=id=>{if(guide.some(c=>c.id===id)&&!selected.includes(id)&&selected.length<4)selected.push(id);};
 for(const issue of intent?.issues||[]){
  const wanted=new Set(terms(`${issue.question} ${issue.query}`));
  const ranked=guide.map(c=>{const words=titleTerms.get(c.id);return {id:c.id,score:words.filter(w=>wanted.has(w)).reduce((n,w)=>n+Math.log(1+guide.length/guide.filter(g=>titleTerms.get(g.id).includes(w)).length),0)/Math.sqrt(Math.max(1,words.length))};}).filter(c=>c.score>0).sort((a,b)=>b.score-a.score);
  if(ranked.length)add(ranked[0].id);
 }
 for(const id of intent?.chapterIDs||[])add(id);
 return selected;
}

export function governingSectionContext(ids,catalog){
 const result=[];
 const add=(section,contextFor=null)=>{if(section&&!result.some(s=>s.id===String(section.id||section.sectionID)))result.push({id:String(section.id||section.sectionID),contextFor});};
 for(const id of ids){
  const current=catalog.find(s=>String(s.id||s.sectionID)===id);if(!current)continue;add(current);
  const parts=String(current.sectionNumber||'').split('.');
  const family=catalog.filter(s=>s.codeVersion===current.codeVersion&&s.codePrefix===current.codePrefix&&String(s.chapterNumber)===String(current.chapterNumber));
  if(parts.length>1){
   add(family.find(s=>s.sectionNumber===parts.slice(0,-1).join('.')),id);
   const siblings=family.filter(s=>String(s.sectionNumber||'').split('.').length===parts.length&&String(s.sectionNumber||'').split('.').slice(0,-1).join('.')===parts.slice(0,-1).join('.'));
   const index=siblings.findIndex(s=>String(s.id||s.sectionID)===id);
   if(index>0)add(siblings[index-1],id);
   if(index>=0&&index+1<siblings.length)add(siblings[index+1],id);
  }
 }
 return result;
}
