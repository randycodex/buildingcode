// A small text-only block vocabulary. List markers describe presentation;
// source wording, inline formatting and citation IDs remain untouched.
export function researchAnswerBlocks(value) {
  const blocks=[], stack=[];
  let blank=false, fence='';
  const paragraph=(container,text,separate)=>{
    const previous=container.at(-1);
    if(previous?.type==='paragraph'&&!separate)previous.text+='\n'+text;
    else container.push({type:'paragraph',text});
  };
  for(const raw of String(value || '').replace(/\r\n?/g,'\n').split('\n')){
    if(!raw.trim()){blank=true;continue;}
    const line=raw.replace(/^\t+/,tabs=>'    '.repeat(tabs.length));
    const indent=line.match(/^ */)[0].length;
    const fenceMarker=line.trimStart().match(/^(`{3,}|~{3,})/);
    const marker=!fence&&!fenceMarker&&line.match(/^( *)(?:([-+*•])|(\d{1,9})[.)])[ \t]+(.*)$/);
    if(marker&&stack.length<16){
      const ordered=marker[3]!==undefined;
      while(stack.length&&stack.at(-1).indent>indent)stack.pop();
      if(stack.at(-1)?.indent===indent&&stack.at(-1).list.ordered!==ordered)stack.pop();
      if(!stack.length||stack.at(-1).indent<indent){
        const container=stack.length?stack.at(-1).list.items.at(-1).blocks:blocks;
        const list={type:'list',ordered,items:[]};container.push(list);stack.push({indent,list});
      }
      stack.at(-1).list.items.push({...(ordered?{number:Number(marker[3])}:{}),
        contentIndent:line.length-marker[4].length,blocks:[{type:'paragraph',text:marker[4]}]});
    }else{
      if(stack.length&&blank&&indent<=stack[0].indent)stack.length=0;
      while(stack.length>1&&indent<=stack.at(-1).indent)stack.pop();
      const item=stack.at(-1)?.list.items.at(-1);
      paragraph(item?.blocks || blocks,item?line.slice(Math.min(indent,item.contentIndent)):line,blank);
      if(fenceMarker){
        if(!fence)fence=fenceMarker[1][0];
        else if(fenceMarker[1][0]===fence)fence='';
      }
    }
    blank=false;
  }
  return blocks;
}
