// The edit surface uses regions measured while painting the export itself.
// No second HTML paginator gets to decide where a source, image or table ends.
export function captureReportEditLayout(document) {
  let page = 1, active = null;
  const regions = [], pages = [];
  const pageInfo = () => ({page, width:document.page.width, height:document.page.height, margin:document.page.margins.top});
  pages.push(pageInfo());
  document.on('pageAdded', () => {page += 1; pages.push(pageInfo());});
  const mark = (x, y, width, height) => {
    if (!active || ![x,y,width,height].every(Number.isFinite)) return;
    let region = active.pages.get(page);
    if (!region) {
      region = {id:active.id, kind:active.kind, page, x, y, width, height};
      active.pages.set(page, region); regions.push(region);
    } else {
      const right = Math.max(region.x + region.width, x + width), bottom = Math.max(region.y + region.height, y + height);
      region.x = Math.min(region.x, x); region.y = Math.min(region.y, y);
      region.width = right - region.x; region.height = bottom - region.y;
    }
  };
  const fragment = document._fragment;
  document._fragment = function(text, x, y, options = {}) {
    if (String(text).trim()) mark(x,y,this.widthOfString(text,options),this.currentLineHeight(true));
    return fragment.call(this,text,x,y,options);
  };
  const rect = document.rect;
  document.rect = function(x,y,width,height,...rest) {mark(x,y,width,height);return rect.call(this,x,y,width,height,...rest);};
  const image = document.image;
  document.image = function(...args) {
    const x = typeof args[1] === 'number' ? args[1] : this.x;
    const y = typeof args[2] === 'number' ? args[2] : this.y;
    const result = image.apply(this,args);
    mark(x,y,this.page.width-this.page.margins.left-this.page.margins.right,Math.max(0,this.y-y));
    return result;
  };
  document._reportBegin = (id, kind) => {active = {id,kind,pages:new Map()};};
  document._reportEditBody = () => {if(active) active.body={page,y:document.y};};
  document._reportEnd = () => {
    if (active && !active.pages.size) mark(document.page.margins.left,document.y,
      document.page.width-document.page.margins.left-document.page.margins.right,20);
    if(active?.body) for(const region of active.pages.values()) {
      if(region.page===active.body.page) region.editorY=active.body.y;
    }
    active = null;
  };
  return () => ({pages,regions});
}
