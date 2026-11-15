// Pages are the export renderer's output. Selection chrome and the live editor
// survive page refreshes, so saving/reflowing never replaces a focused editor.
export function createReportPageEditor({host, isCurrent, describe, field, actions, preceding = () => undefined, onSelect, onFinish}) {
  const overlay = document.createElement('div'); overlay.className = 'report-page-edit-overlay'; overlay.hidden = true;
  const inspector = document.createElement('section'); inspector.className = 'report-page-inspector'; inspector.hidden = true;
  inspector.setAttribute('aria-label','Selected report item');
  host.append(overlay);
  let container, layout, selected, entry, row, origin, editorOrigin, stopped = false, resize, pendingFocus = false, pointer;
  const focusEditor = () => {
    if(!pendingFocus || overlay.hidden || !entry) return;
    const editable=entry.element.matches('input,textarea,[contenteditable="true"]') ? entry.element : entry.element.querySelector('[contenteditable="true"],input,textarea');
    if(!editable) return;
    pendingFocus=false;editable.focus({preventScroll:true});
    if(pointer && editable.isContentEditable) {
      const range=document.caretRangeFromPoint?.(pointer.x,pointer.y);
      if(range && editable.contains(range.startContainer)) {const selection=document.getSelection();selection.removeAllRanges();selection.addRange(range);}
    }
    pointer=null;
  };
  const valid = () => !stopped && isCurrent();
  const restore = () => {
    if (entry?.element && editorOrigin?.parent.isConnected) editorOrigin.parent.append(entry.element);
    if (row && origin?.parent.isConnected) origin.parent.append(row);
    row?.classList.remove('is-page-inspected');
    overlay.replaceChildren(); overlay.hidden = true; inspector.replaceChildren(); inspector.hidden = true;
    entry = row = origin = editorOrigin = null;
    pendingFocus=false;pointer=null;
  };
  const regionFor = id => layout?.regions.find(region => region.id === id || region.id.startsWith(`${id}-`));
  const locate = id => {
    let region = regionFor(id);
    if(!region && id==='__introduction' && layout?.pages[1]) {
      const page=layout.pages[1];return {id,page:2,x:page.margin,y:page.margin,width:page.width-page.margin*2,height:24};
    }
    if (!region && layout?.pages.length && id !== '__title') {
      const previous=preceding(id);
      const last = layout.regions.filter(item=>item.page > 1 && item.id!=='__empty' &&
        (previous===undefined || item.id===previous || item.id.startsWith(`${previous}-`))).at(-1);
      const page = last ? layout.pages[last.page-1] : layout.pages[1] || layout.pages.at(-1);
      region = {id,page:page.page,x:page.margin,y:Math.min(page.height-page.margin-24,last ? last.y+last.height+12 : page.margin),
        width:page.width-page.margin*2,height:24};
    }
    if(region?.editorY!==undefined && field(id)) region={...region,y:region.editorY,height:Math.max(20,region.y+region.height-region.editorY)};
    return region;
  };
  const position = () => {
    if (!entry || !container || !valid()) return;
    const region = locate(selected), page = region && container.querySelector(`[data-page="${region.page}"]`);
    if (!page) {overlay.hidden = true; return;}
    const pageData = layout.pages[region.page-1], bounds = page.getBoundingClientRect(), root = host.getBoundingClientRect();
    const scale = bounds.width/pageData.width, top = bounds.top + region.y*scale;
    const viewport = container.getBoundingClientRect();
    overlay.hidden = top >= viewport.bottom || top + region.height*scale <= viewport.top;
    overlay.style.left = `${bounds.left-root.left+pageData.margin*scale}px`;
    overlay.style.top = `${top-root.top}px`;
    overlay.style.width = `${(pageData.width-pageData.margin*2)*scale}px`;
    overlay.style.minHeight = `${Math.max(region.height*scale,24)}px`;
    overlay.style.maxHeight = `${Math.max(40,(pageData.height-pageData.margin-region.y)*scale)}px`;
    overlay.style.setProperty('--report-page-edit-scale',String(scale));
    overlay.style.setProperty('--report-page-edit-font-size',`${(entry.size || 10)*scale}px`);
    if(entry.element.tagName==='TEXTAREA') {entry.element.style.height='auto';entry.element.style.height=`${entry.element.scrollHeight}px`;}
    overlay.style.clipPath = `inset(${Math.max(0,viewport.top-top)}px 0 ${Math.max(0,top+overlay.offsetHeight-viewport.bottom)}px 0)`;
    focusEditor();
  };
  const finish = () => {if (!entry) return; restore(); onFinish?.();};
  const select = (id, {focus = false, reveal = true, point} = {}) => {
    if (!valid()) return;
    if (id !== selected || (!entry && !row)) {
      restore(); selected = id; onSelect(id);
      row = actions(id);
      if (row) {
        origin = {parent:row.parentNode}; row.classList.add('is-page-inspected'); inspector.append(row); inspector.hidden = false;
      }
      entry = field(id);
      if (entry) {
        editorOrigin = {parent:entry.element.parentNode}; overlay.append(entry.element); overlay.hidden = false;
      }
    }
    const region = locate(id), page = region && container?.querySelector(`[data-page="${region.page}"]`);
    if (reveal && page) container.scrollTo({top:page.offsetTop+region.y*page.clientWidth/layout.pages[region.page-1].width-40,behavior:'smooth'});
    pendingFocus=focus;pointer=point;position();
    container?.querySelectorAll('.report-page-item-target').forEach(target=>target.setAttribute('aria-pressed',String(target.dataset.itemId===id)));
  };
  overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish();}});
  overlay.addEventListener('input',()=>{position();});
  overlay.addEventListener('focusout',event=>{
    if (event.relatedTarget && !overlay.contains(event.relatedTarget) && !inspector.contains(event.relatedTarget) && !event.relatedTarget.closest('.report-editor-controls')) finish();
  });
  return {
    inspector, select, finish,
    reset() {restore(); selected = undefined;},
    pages(next) {
      if (!valid() || !next.layout) return;
      container = next.container; layout = next.layout;
      container.addEventListener('scroll',position,{passive:true});
      for (const region of layout.regions) {
        const page = container.querySelector(`[data-page="${region.page}"]`), info = layout.pages[region.page-1];
        if (!page || region.id === '__empty') continue;
        const target = document.createElement('button'); target.type='button'; target.className='report-page-item-target';
        target.dataset.itemId = region.id;
        target.setAttribute('aria-label',describe(region.id)); target.setAttribute('aria-pressed',String(selected===region.id));
        Object.assign(target.style,{left:`${info.margin/info.width*100}%`,top:`${region.y/info.height*100}%`,
          width:`${(info.width-info.margin*2)/info.width*100}%`,height:`${Math.max(20,region.height)/info.height*100}%`});
        target.addEventListener('click',event=>select(region.id,{focus:true,reveal:false,point:{x:event.clientX,y:event.clientY}})); page.append(target);
      }
      if (selected !== undefined && !entry && !row) select(selected,{reveal:false});
      position();
    },
    observe() {resize ||= new ResizeObserver(position); resize.observe(host);},
    dispose() {stopped=true;restore();resize?.disconnect();overlay.remove();inspector.remove();}
  };
}
