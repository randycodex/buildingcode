// Navigation only. This never selects, includes or changes Research evidence.
const compact=value=>String(value||'').normalize('NFKC').replace(/\s+/g,' ').replace(/\s+([,.;:!?])/g,'$1').trim().toLowerCase();
export function researchReaderPassageTarget(section,source){
  if(!section)return null;
  const raw=String(source.suggestedText||source.readerText||source.selectedText||source.passageText||''),exact=compact(raw);
  const table=compact(source.tableReference).replace(/^[a-z]+\s+(?=table\b)/,'');
  if(table){
    section._readerBlockWindow?.ensureText(table);
    const captionPattern=new RegExp(`^${table.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?:$|\\s|\\.(?=\\s|$))`,'i');
    const captions=[...section.querySelectorAll('caption,h2,h3,h4,h5,h6,p,strong,b,.section-block,.section-html')].filter(node=>captionPattern.test(compact(node.innerText||node.textContent)));
    const leaves=captions.filter(node=>!captions.some(other=>other!==node&&node.contains(other)));
    if(leaves.length===1)return leaves[0].closest?.('caption,h2,h3,h4,h5,h6,p')||leaves[0];
    const matches=[...section.querySelectorAll('.code-table,table')].filter(node=>{
      const text=compact(node.textContent).slice(0,160);return new RegExp(`(?:^|[^a-z0-9])${table.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?=$|[^0-9.]|\\.(?![0-9]))`,'i').test(text);
    });
    const outer=matches.filter(node=>!matches.some(other=>other!==node&&other.contains(node)));
    if(outer.length===1)return outer[0];
    return null;
  }
  if(exact.length<24)return null;
  const prefix=exact.slice(0,160);
  const located=section._readerBlockWindow?.ensureText(raw);
  if(!located)section._readerBlockWindow?.ensureText(raw.slice(0,160));
  const matches=[...section.querySelectorAll('p,li,dt,dd,tr,.section-block,.section-html')].filter(node=>compact(node.textContent).includes(exact));
  const smallest=matches.filter(node=>!matches.some(other=>other!==node&&node.contains(other)));
  if(smallest.length===1)return smallest[0];
  // A multi-paragraph selection may have no single leaf containing it. Its
  // exact beginning can locate the first paragraph without guessing by title.
  if(!smallest.length&&exact.length>160){
    const starts=[...section.querySelectorAll('p,li,dt,dd,tr,.section-block,.section-html')].filter(node=>compact(node.textContent).includes(prefix));
    const leaves=starts.filter(node=>!starts.some(other=>other!==node&&node.contains(other)));
    if(leaves.length===1)return leaves[0];
  }
  return null;
}
