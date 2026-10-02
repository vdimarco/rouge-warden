// Horizontal roster navigation. Native touch panning and mouse dragging share selection.
export function mountLineup({track, previous, next, position, selected, choose}) {
  let timer, dragging=null, userScroll=false, suppressClick=false;
  const motion=matchMedia('(prefers-reduced-motion: no-preference)');
  const observer=new IntersectionObserver(entries=>entries.forEach(({target,isIntersecting})=>{const source=target.querySelector('source');if(!source)return;if(isIntersecting&&motion.matches)source.srcset=source.dataset.gif;else source.removeAttribute('srcset');}),{root:track,rootMargin:'0px 50px'});
  motion.addEventListener('change',()=>refresh());
  const cards=()=>[...track.querySelectorAll('[data-hero]')];
  const index=()=>cards().findIndex(b=>+b.dataset.hero===selected());
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  function update(){const list=cards(),i=index();position.textContent=i<0?'Choose a hero':`${i+1} / ${list.length}`;previous.disabled=i===0||!list.length;next.disabled=i===list.length-1||!list.length;}
  function center(b,animate=true){if(!b)return;userScroll=false;track.scrollTo({left:b.offsetLeft-track.offsetLeft-(track.clientWidth-b.offsetWidth)/2,behavior:animate&&!reduced()?'smooth':'instant'});}
  function select(b,animate=true){if(!b)return;choose(+b.dataset.hero);update();center(b,animate);}
  function advance(n){const list=cards();select(list[Math.max(0,Math.min(list.length-1,index()+n))]);}
  function settle(){if(!userScroll||dragging)return;userScroll=false;const list=cards(),mid=track.scrollLeft+track.clientWidth/2;const b=track.scrollLeft<2?list[0]:track.scrollLeft>=track.scrollWidth-track.clientWidth-2?list.at(-1):list.reduce((best,b)=>Math.abs(b.offsetLeft-track.offsetLeft+b.offsetWidth/2-mid)<Math.abs(best.offsetLeft-track.offsetLeft+best.offsetWidth/2-mid)?b:best,list[0]);select(b);}
  track.addEventListener('click',e=>{const b=e.target.closest('[data-hero]');if(!b)return;if(suppressClick){e.preventDefault();suppressClick=false;return;}select(b);});
  track.addEventListener('pointerdown',e=>{if(e.button!==0)return;clearTimeout(timer);suppressClick=false;userScroll=true;if(e.pointerType==='mouse'){e.preventDefault();dragging={id:e.pointerId,x:e.clientX,left:track.scrollLeft,moved:false};track.setPointerCapture(e.pointerId);}});
  track.addEventListener('pointermove',e=>{if(e.pointerId!==dragging?.id)return;const dx=e.clientX-dragging.x;if(Math.abs(dx)>6)dragging.moved=true;track.scrollLeft=dragging.left-dx;});
  track.addEventListener('pointerup',e=>{if(e.pointerId!==dragging?.id)return;const moved=dragging.moved;dragging=null;if(moved){suppressClick=true;settle();}else{const b=e.target.closest('[data-hero]')||document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-hero]');select(b);}if(track.hasPointerCapture(e.pointerId))track.releasePointerCapture(e.pointerId);});
  track.addEventListener('pointercancel',e=>{if(e.pointerType==='mouse'){dragging=null;userScroll=false;}});
  track.addEventListener('lostpointercapture',()=>{dragging=null;});
  track.addEventListener('wheel',()=>{userScroll=true;},{passive:true});
  track.addEventListener('scroll',()=>{clearTimeout(timer);timer=setTimeout(settle,140);},{passive:true});
  track.addEventListener('scrollend',settle);
  track.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();if(e.key==='Home')select(cards()[0]);else if(e.key==='End')select(cards().at(-1));else advance(e.key==='ArrowRight'?1:-1);});
  previous.onclick=()=>advance(-1);next.onclick=()=>advance(1);
  const refresh=()=>{observer.disconnect();cards().forEach(b=>observer.observe(b));update();requestAnimationFrame(()=>center(cards()[Math.max(0,index())],false));};
  new ResizeObserver(()=>center(cards()[Math.max(0,index())],false)).observe(track);
  return {refresh,update};
}
