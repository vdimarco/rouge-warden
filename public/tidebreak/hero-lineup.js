// The reference roster is a native grid. Only its own panel scrolls.
export function mountLineup({track,previous,next,position,selected,choose}){
 const cards=()=>[...track.querySelectorAll('[data-hero]')];
 const index=()=>cards().findIndex(b=>+b.dataset.hero===selected());
 function update(){const list=cards(),i=index();position.textContent=i<0?'Choose a hero':`${i+1} / ${list.length}`;previous.disabled=i<=0;next.disabled=i===list.length-1||!list.length;}
 function select(button,focus=false){if(!button)return;choose(+button.dataset.hero);update();button.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});if(focus)button.focus({preventScroll:true});}
 function advance(amount){const list=cards(),current=index();select(list[Math.max(0,Math.min(list.length-1,current+amount))],true);}
 track.addEventListener('click',event=>select(event.target.closest('[data-hero]')));
 track.addEventListener('keydown',event=>{
  const amounts={ArrowLeft:-1,ArrowRight:1,ArrowUp:-4,ArrowDown:4};
  if(!Object.hasOwn(amounts,event.key)&&!['Home','End'].includes(event.key))return;
  event.preventDefault();event.stopPropagation();
  if(event.key==='Home')select(cards()[0],true);else if(event.key==='End')select(cards().at(-1),true);else advance(amounts[event.key]);
 });
 previous.onclick=()=>advance(-1);next.onclick=()=>advance(1);
 return {update,refresh(){update();}};
}
