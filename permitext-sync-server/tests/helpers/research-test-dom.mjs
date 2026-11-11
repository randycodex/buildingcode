export class Element {
  constructor(tag){this.tagName=tag;this.children=[];this.handlers={};this.attributes={};this.dataset={};this.className='';this.isConnected=true;this.hidden=false;this.value='';this.style={setProperty(){}};this._text='';}
  set textContent(value){this._text=String(value);}get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  get lastChild(){return this.children.at(-1);}
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
  replaceChildren(...nodes){this.children=[];this._text='';this.append(...nodes);}
  setAttribute(key,value){this.attributes[key]=String(value);}removeAttribute(key){delete this.attributes[key];}
  addEventListener(name,fn){this.handlers[name]=fn;}removeEventListener(name){delete this.handlers[name];}
  focus(){this.focused=true;}scrollIntoView(){this.scrolled=true;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
  closest(selector){for(let node=this;node;node=node.parent)if(matches(node,selector))return node;return null;}
  querySelectorAll(selector){return all(this).filter(node=>node!==this&&matches(node,selector));}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  get classList(){const values=()=>new Set(this.className.split(/\s+/).filter(Boolean));return {
    add:(...names)=>{this.className=[...new Set([...values(),...names])].join(' ');},
    remove:(...names)=>{this.className=[...values()].filter(name=>!names.includes(name)).join(' ');},
    contains:name=>values().has(name),toggle:(name,on)=>{const set=values(),active=on??!set.has(name);active?set.add(name):set.delete(name);this.className=[...set].join(' ');return active;}};}
}
const matches=(node,selector)=>selector.split(',').some(part=>{part=part.trim();return part.startsWith('.')?node.classList.contains(part.slice(1)):node.tagName===part;});
export const all=root=>[root,...root.children.flatMap(all)];
export const document={createElement:tag=>new Element(tag),createTextNode:text=>Object.assign(new Element('#text'),{textContent:text})};
export const tick=()=>new Promise(resolve=>setImmediate(resolve));
export const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
