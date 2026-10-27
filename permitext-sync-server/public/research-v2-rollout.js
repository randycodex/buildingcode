// A server-authorized choice per signed-in account, independent of hostname.
// URL/session preferences select an interface; they never authorize generation.
export function createResearchV2Rollout({scope,isCurrent,load,storage,url,now=Date.now}){
  let cached=null,flight=null,seenQuery;
  const choices=new Map();
  const unavailable=()=>({available:false,defaultEngine:'legacy'});
  const key=owner=>`permitext:research-engine:${owner.userID}`;
  function choice(){
    const owner=scope();if(!owner?.userID)return null;
    const current=new URL(url()),requested=current.searchParams.get('research');
    if(seenQuery!==requested){
      seenQuery=requested;
      if(['legacy','v2'].includes(requested)){choices.set(key(owner),requested);try{storage.setItem(key(owner),requested);}catch{}}
    }
    try{
      let value=storage.getItem(key(owner))||choices.get(key(owner));
      if(['localhost','127.0.0.1','[::1]'].includes(current.hostname)&&storage.getItem('permitext:local-research-v2')==='1'){
        if(!value){value='v2';choices.set(key(owner),value);storage.setItem(key(owner),value);}storage.removeItem('permitext:local-research-v2');
      }
      return ['legacy','v2'].includes(value)?value:null;
    }catch{return choices.get(key(owner))||null;}
  }
  const configuration=()=>cached?.key===scope()?.key?cached.value:unavailable();
  return {
    configuration,
    requested(){return (choice()||configuration().defaultEngine)==='v2';},
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
