// Run through agent-browser eval --stdin in an isolated seeded global Saved workspace.
// Requires no open detail; first Saved row must be2014section28-101.1.
(async()=>{
 const samples=[];const frame=()=>new Promise(r=>requestAnimationFrame(r));
 for(let i=0;i<30;i++){
  const b=document.querySelector('.saved-section-open');if(!b)throw Error('Saved not ready');
  performance.clearResourceTimings();const start=performance.now();b.click();
  let pane;while(performance.now()-start<10000){pane=document.querySelector('.section-detail-panel');if(pane?.querySelector('textarea'))break;await frame();}
  if(!pane?.querySelector('textarea'))throw Error('Detail readiness timeout');await frame();await frame();
  const elapsed=performance.now()-start;const text=pane.textContent;
  if(!text.includes('28-101.1')||!text.includes('2014')||!text.includes('New York city plumbing code'))throw Error('Content mismatch');
  const resources=performance.getEntriesByType('resource').filter(x=>x.startTime>=start).map(x=>({path:new URL(x.name).pathname,durationMs:Math.round(x.duration*100)/100,transferBytes:x.transferSize}));
  samples.push({sample:i+1,elapsedMs:Math.round(elapsed*100)/100,resources});
  const close=Array.from(pane.querySelectorAll('button')).find(x=>x.getAttribute('aria-label')==='Close saved item'||x.title==='Close saved item');close.click();await frame();await frame();
 }
 return {visibleSavedRows:document.querySelectorAll('.saved-section-open').length,samples};
})()
