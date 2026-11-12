// BlockNote table cells contain inline runs. Convert HTML paragraph boundaries
// into explicit breaks before its normal paste parser flattens the wrappers.
// Marks, links and all other paste sanitization remain with the editor.
export function notebookTablePasteHTML(html, document = globalThis.document) {
  if (!/<table\b/i.test(html) || !document) return html;
  const template=document.createElement('template');
  template.innerHTML=html;
  let changed=false;
  const significant=(node,direction)=>{
    let sibling=node[direction];
    while(sibling?.nodeType===3 && !sibling.textContent.trim()) sibling=sibling[direction];
    return sibling;
  };
  for(const cell of template.content.querySelectorAll('td,th')) {
    for(const block of cell.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,pre,blockquote')) {
      if(block.closest('td,th')!==cell) continue;
      const previous=significant(block,'previousSibling'), next=significant(block,'nextSibling');
      if(previous && previous.nodeName!=='BR') block.before(document.createElement('br'));
      if(next && next.nodeName!=='BR') block.after(document.createElement('br'));
      block.replaceWith(...block.childNodes);
      changed=true;
    }
  }
  return changed ? template.innerHTML : html;
}
