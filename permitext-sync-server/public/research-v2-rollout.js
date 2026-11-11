// The sole Research interface is authorized separately for each account.
// Retiring URL/browser choices never grants generation access.
export function createResearchV2Rollout({scope,isCurrent,load,storage,url,replaceURL,now=Date.now}){
  let cached=null,flight=null;
  const unavailable=()=>({available:false,defaultEngine:'legacy'});
  const key=owner=>`permitext:research-engine:${owner.userID}`;
  function choice(){
    const owner=scope();if(!owner?.userID)return null;
    const current=new URL(url());
    if(current.searchParams.get('research')==='legacy'){
      current.searchParams.delete('research');replaceURL?.(current.href);
    }
    try{
      if(storage.getItem(key(owner))!=='v2')storage.setItem(key(owner),'v2');
      if(storage.getItem('permitext:local-research-v2')==='1')storage.removeItem('permitext:local-research-v2');
    }catch{ /* Browser preferences cannot re-enable the retired interface. */ }
    return 'v2';
  }
  const configuration=()=>cached?.key===scope()?.key?cached.value:unavailable();
  return {
    configuration,
    requested(){return choice()==='v2';},
    enabled(){return configuration().available===true&&this.requested();},
    clear(){cached=null;flight=null;},
    async refresh({force=false}={}){
      const owner=scope();if(!owner?.userID)return unavailable();
      choice();
      if(flight?.key===owner.key)return flight.promise;
      if(!force&&cached?.key===owner.key&&now()-cached.at<30000)return cached.value;
      const entry={key:owner.key};
      entry.promise=(async()=>{
        let value;try{const result=await load();value={...result,available:result?.available===true,defaultEngine:result?.defaultEngine==='v2'?'v2':'legacy'};}catch{value=unavailable();}
        if(!isCurrent(owner)||scope()?.key!==owner.key)return unavailable();
        cached={key:owner.key,value,at:now()};return value;
      })().finally(()=>{if(flight===entry)flight=null;});
      flight=entry;return entry.promise;
    }
  };
}
