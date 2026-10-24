import {createGame, command, step, selectedShip, fireStatus, selectContact, bearing, distance, wrap, clamp, angleDiff, intercept, scopeFov} from './engine.js';
import {Renderer} from './render.js';
import {PatrolAudio} from './audio.js';

const $=id=>document.getElementById(id);
const canvas=$('scene'),renderer=new Renderer(canvas),audio=new PatrolAudio();
let game=createGame(),patrol=0,lastFrame=0,lastUI=0,lastLog='',shownResult=false,pointer=null,visualTime=0;
let best=0;
try{best=Number(localStorage.getItem('silent-depth-best'))||0;}catch{/* Optional records must not block private browsing. */}
const heading=n=>`${String(Math.round(wrap(n))%360).padStart(3,'0')}°`;
const cardinal=n=>['N','NE','E','SE','S','SW','W','NW'][Math.round(wrap(n)/45)%8];
const clock=seconds=>{const t=5*3600+40*60+Math.floor(seconds);return[Math.floor(t/3600)%24,Math.floor(t/60)%60,t%60].map(n=>String(n).padStart(2,'0')).join(':');};
const number=n=>Math.round(n).toLocaleString('en-US');
const modal=$('modal');
let modalKind='briefing';

function showModal(kind){
  modalKind=kind;
  const briefing=kind==='briefing',help=kind==='help',paused=kind==='pause',result=kind==='result';
  $('modal-kicker').textContent=briefing?'Your orders, Captain':help?'Captain’s handbook':paused?'All stations standing by':game.phase==='won'?'Patrol complete':'Patrol ended';
  $('modal-title').innerHTML=briefing?'A quiet sea.<br>A dangerous crossing.':help?'Know your boat.':paused?'Hold your course.':game.phase==='won'?'Silent. Unseen.<br>Homeward bound.':'The sea had<br>other plans.';
  $('modal-description').textContent=briefing?'Luzon Strait, October 1943. A convoy is crossing your patrol sector. You have eight torpedoes and one chance to get your crew home.':help?'The chart reveals the convoy and lets you plot a course. The hydrophone gives bearings at any depth. Fast engines and a raised periscope make you easier to find.':paused?'The patrol is paused. Take your time — the convoy can wait.':game.result;
  $('briefing-steps').hidden=!(briefing||help);
  $('result-stats').hidden=!result;
  $('modal-note').hidden=result;
  $('modal-action').innerHTML=`${briefing?'Take command':result?'Sail another patrol':'Resume patrol'}<svg><use href="#i-arrow"/></svg>`;
  $('modal-secondary').hidden=!paused;
  $('modal-secondary').textContent='Read patrol instructions';
  if(result){
    const stats=$('result-stats');stats.replaceChildren();
    for(const [value,label] of [[number(game.tonnage),'Tons sunk'],[`${game.sunk} / 2`,'Merchants'],[`${Math.ceil(game.sub.hull)}%`,'Hull returned']]){
      const cell=document.createElement('div'),strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=value;span.textContent=label;cell.append(strong,span);stats.append(cell);
    }
    const note=document.createElement('p');note.className='result-note';note.textContent=`Best patrol: ${number(best)} tons · ${Math.floor(game.time/60)} min ${Math.floor(game.time%60)} sec ship time.`;stats.append(note);
  }
  if(!modal.open)modal.showModal();
}
function closeModal(){
  modal.close();game.paused=false;lastFrame=performance.now();updateUI();
}
function act(action,value){
  if(action==='pause'){
    if(game.phase!=='playing')return;
    command(game,'pause');
    if(game.paused)showModal('pause');else closeModal();
  }else command(game,action,value);
  updateUI();
}
$('modal-action').addEventListener('click',()=>{
  if(modalKind==='briefing'){command(game,'start');closeModal();}
  else if(modalKind==='result'){game=createGame(++patrol);lastLog='';shownResult=false;command(game,'start');closeModal();}
  else closeModal();
});
$('modal-secondary').addEventListener('click',()=>showModal('help'));
modal.addEventListener('cancel',event=>{event.preventDefault();if(game.phase==='playing')closeModal();});
$('help').addEventListener('click',()=>{if(game.phase==='playing'){game.paused=true;showModal('help');}else showModal(game.phase==='briefing'?'briefing':'result');});
$('pause').addEventListener('click',()=>act('pause'));
$('sound').addEventListener('click',async()=>{
  try{const enabled=await audio.toggle();$('sound').setAttribute('aria-label',enabled?'Mute sound':'Enable sound');$('sound').innerHTML=`<svg><use href="#i-${enabled?'sound':'mute'}"/></svg>`;}
  catch{$('sound').setAttribute('aria-label','Sound is unavailable in this browser');}
});
document.querySelectorAll('[data-station]').forEach(b=>b.addEventListener('click',()=>act('station',b.dataset.station)));
document.querySelectorAll('[data-turn]').forEach(b=>b.addEventListener('click',()=>act('heading',Number(b.dataset.turn))));
document.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>act('speed',Number(b.dataset.speed))));
document.querySelectorAll('[data-depth]').forEach(b=>b.addEventListener('click',()=>act('depth',Number(b.dataset.depth))));
document.querySelectorAll('[data-rate]').forEach(b=>b.addEventListener('click',()=>act('rate',Number(b.dataset.rate))));
$('fire').addEventListener('click',()=>act('fire'));
$('torpedo-fire').addEventListener('click',()=>act('fire'));
document.querySelectorAll('[data-tube]').forEach(b=>b.addEventListener('click',()=>act('tube',Number(b.dataset.tube))));
$('scope-toggle').addEventListener('click',()=>act('periscope',!game.periscopeRaised));
$('raise-scope').addEventListener('click',()=>{act('depth',12);act('periscope',true);});
$('visit-helm').addEventListener('click',()=>{document.querySelector('.helm').scrollIntoView({behavior:renderer.reducedMotion?'instant':'smooth',block:'center'});document.querySelector('[data-turn="-5"]').focus({preventScroll:true});});
$('next-contact').addEventListener('click',()=>act('next'));
$('zoom').addEventListener('click',()=>{game.zoom=game.zoom===1?2:1;updateUI();});

canvas.addEventListener('pointerdown',e=>{
  if(game.phase!=='playing'||game.paused)return;
  pointer={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,moved:false};canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
  if(!pointer||pointer.id!==e.pointerId)return;
  if(Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>6)pointer.moved=true;
  if(game.station==='scope'&&pointer.moved)game.viewBearing=wrap(game.viewBearing-(e.clientX-pointer.lastX)/(renderer.scopeAperture?.radius*2||renderer.width)*scopeFov(game));
  pointer.lastX=e.clientX;
});
canvas.addEventListener('pointerup',e=>{
  if(!pointer||pointer.id!==e.pointerId)return;
  if(!pointer.moved){const bounds=canvas.getBoundingClientRect(),x=e.clientX-bounds.left,y=e.clientY-bounds.top,id=renderer.hitTest(x,y);if(id)selectContact(game,id);else if(game.station==='chart')command(game,'course',renderer.plotCourse(game,x,y));}
  pointer=null;updateUI();
});
canvas.addEventListener('pointercancel',()=>pointer=null);
window.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
  if(modal.open){if(e.key.toLowerCase()==='p'&&game.phase==='playing'){e.preventDefault();closeModal();}return;}
  const key=e.key.toLowerCase();
  if(key===' '&&e.target.closest('button,a'))return;
  const actions={'1':['station','command'],'2':['station','scope'],'3':['station','chart'],'4':['station','torpedo'],'5':['station','sonar'],'a':['heading',-5],'d':['heading',5],' ':['fire'],'p':['pause'],'tab':null};
  if(actions[key]){e.preventDefault();act(...actions[key]);}
  else if(key==='arrowleft'||key==='arrowright'){e.preventDefault();game.viewBearing=wrap(game.viewBearing+(key==='arrowleft'?-3:3));}
  else if(key==='w'||key==='s'){e.preventDefault();const speeds=[3,7,14],i=speeds.indexOf(game.sub.orderedSpeed);act('speed',speeds[clamp(i+(key==='w'?1:-1),0,2)]);}
  else if(key==='c'){e.preventDefault();act('depth',game.sub.orderedDepth===80?12:80);}
  else if(key==='n'){e.preventDefault();act('next');}
  else if(key==='h')$('help').click();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.phase==='playing'&&!game.paused)act('pause');lastFrame=performance.now();});

function updateUI(){
  const g=game,s=g.sub,target=selectedShip(g),deep=s.depth>16,scopeDown=deep||!g.periscopeRaised;
  $('viewport').dataset.view=g.station;
  $('clock').textContent=clock(g.time);
  for(const b of document.querySelectorAll('[data-station]')){const active=b.dataset.station===g.station;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);}
  $('station-title').textContent={command:'Control room · Commander’s station',scope:'Observation periscope',chart:'Tactical chart · Patrol sector',torpedo:'Torpedo control · Bow compartment',sonar:'Hydrophone · Passive bearings'}[g.station];
  $('depth-status').textContent=`${Math.round(s.depth)} m · ${s.depth<2?'Surfaced':s.depth<16?'Periscope depth':'Submerged'}`;
  $('scene-tip').textContent={command:'Choose a station · Helm orders remain in effect',scope:'Drag to look · Tap a vessel to identify',chart:'Tap a ship to track · Tap open water to set course',torpedo:'Select a tube · The solution leads a steady target',sonar:'Tap a bearing to track · Listen at any depth'}[g.station];
  $('scene-tip').hidden=(scopeDown&&g.station==='scope')||g.station==='command'||g.station==='torpedo';
  $('bearing-label').hidden=g.station!=='scope'||scopeDown;
  $('bearing-label').textContent=heading(g.viewBearing);
  $('control-room').hidden=g.station!=='command';
  $('torpedo-station').hidden=g.station!=='torpedo';
  $('submerged').hidden=!(scopeDown&&g.station==='scope');
  $('submerged-title').textContent=deep?'Below the surface':'Periscope lowered';
  $('submerged-description').textContent=deep?'The periscope is submerged. Use the hydrophone to listen, or return to scope depth.':'Raise the observation periscope to identify ships and build a visual firing solution.';
  $('raise-scope').textContent=deep?'Return to scope depth':'Raise periscope';
  $('scope-toggle').hidden=g.station!=='scope'||deep;
  $('scope-toggle').textContent=g.periscopeRaised?'Lower scope':'Raise scope';
  $('zoom').hidden=g.station!=='scope'||scopeDown;
  $('zoom').textContent=g.zoom===1?'1.5×':'6×';$('zoom').setAttribute('aria-label',g.zoom===1?'Switch to high power, 6 times magnification':'Switch to low power, 1.5 times magnification');
  canvas.setAttribute('aria-label',g.station==='scope'?'Periscope. Drag to look or tap a ship. Next contact also selects a ship.':g.station==='chart'?'Tactical chart. Tap a ship to track or open water to set course.':g.station==='command'?'Submarine control room. Choose a station to take command.':g.station==='torpedo'?'Bow torpedo compartment. Select a ready tube and fire.':'Hydrophone. Tap a contact bearing to track.');
  if(target){
    $('contact-number').textContent=`Contact ${String(target.id).padStart(2,'0')}`;
    $('contact-type').textContent=target.sunk?'SUNK':target.type==='escort'?'ESCORT':target.type==='tanker'?'TANKER':'MERCHANT';
    $('contact-name').textContent=target.name;
    $('contact-status').textContent=target.sunk?'Sinking · Tonnage confirmed':scopeDown?'Hydrophone contact · Bearing only':Math.abs(angleDiff(bearing(s,target),g.viewBearing))<scopeFov(g)/2?'Visual contact · Tracking':'Contact outside periscope view';
    $('range').innerHTML=scopeDown?'— <small>m</small>':`${number(distance(s,target))} <small>m</small>`;
    $('bearing').textContent=heading(bearing(s,target));
    $('course').innerHTML=scopeDown?'—':`${heading(target.heading)} <span>${cardinal(target.heading)}</span>`;
  }
  $('solution-value').textContent=`${Math.floor(g.solution)}%`;
  $('solution').setAttribute('aria-valuenow',Math.floor(g.solution));$('solution').firstElementChild.style.width=`${g.solution}%`;
  $('solution-tip').textContent=scopeDown?'Raise the periscope at scope depth for a solution.':target?.sunk?'Select the next contact to continue your patrol.':g.solution>=75?'Solution ready. Torpedoes lead a steady target.':'Keep the contact in view to calculate its course.';
  $('ammo').textContent=`${g.ammo} TORPEDOES`;
  if(!$('tubes').children.length){for(let i=0;i<4;i++){const tube=document.createElement('div');tube.className='tube';tube.innerHTML=`<i></i><svg><use href="#i-torpedo"/></svg><span>${i+1}</span>`;$('tubes').append(tube);}}
  [...$('tubes').children].forEach((el,i)=>{const cooldown=g.tubes[i];el.classList.toggle('loading',cooldown>0||g.ammo<=0);el.setAttribute('aria-label',`Tube ${i+1}: ${cooldown>0?`reloading ${Math.ceil(cooldown)} seconds`:g.ammo<=0?'empty':'ready'}`);el.firstElementChild.style.width=`${100-cooldown/38*100}%`;});
  const reason=fireStatus(g);$('fire').disabled=!!reason;
  $('torpedo-fire').disabled=!!reason;
  const nextTube=g.armedTube??g.tubes.findIndex(t=>t<=0);
  for(const b of document.querySelectorAll('[data-tube]')){const i=Number(b.dataset.tube),ready=g.tubes[i]<=0&&g.ammo>0;b.classList.toggle('active',i===nextTube);b.setAttribute('aria-pressed',i===nextTube);b.querySelector('.tube-state').textContent=g.ammo<=0?'Empty':ready?'Ready':`${Math.ceil(g.tubes[i])} s`;}
  $('torpedo-fire-label').textContent=nextTube>=0?`Fire tube ${nextTube+1}`:'Tubes reloading';
  $('torpedo-reason').textContent=reason||'Firing solution accepted · Ready to launch';
  const aim=target&&!target.sunk?intercept(s,target):null;
  $('lead-bearing').textContent=aim&&g.solution>=75?heading(aim.heading):'—';
  $('run-time').textContent=aim&&g.solution>=75?`${Math.round(aim.time)} s`:'—';
  $('weapon-target').textContent=target?.name||'No target';
  $('weapon-solution').textContent=`${Math.floor(g.solution)}%`;
  $('fire-status').textContent=g.phase==='briefing'?'Awaiting your command':reason||'Solution ready · Torpedo armed';
  $('heading').innerHTML=`${heading(s.heading).slice(0,-1)}<span>° ${cardinal(s.heading)}</span>`;
  $('heading-order').textContent=Math.abs(angleDiff(s.orderedHeading,s.heading))<.5?'HOLD COURSE':`STEER ${heading(s.orderedHeading)}`;
  $('speed').innerHTML=`${s.speed.toFixed(1)} <span>kn</span>`;
  $('depth').innerHTML=`${Math.round(s.depth)} <span>m</span>`;
  for(const [attr,value] of [['speed',s.orderedSpeed],['depth',s.orderedDepth],['rate',g.rate]])for(const b of document.querySelectorAll(`[data-${attr}]`)){const active=Number(b.dataset[attr])===value;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);}
  for(const resource of ['hull','battery','air']){$(`${resource}-value`).textContent=`${Math.ceil(s[resource])}%`;$(`${resource}-bar`).style.width=`${s[resource]}%`;$(`${resource}-bar`).style.background=s[resource]<25?'var(--danger)':'#8da995';}
  $('detection').textContent=g.alert>65?'Escort pursuing':g.alert>28?'Escort searching':g.alert>10?'Caution':'Undetected';
  $('detection').style.color=g.alert>28?'var(--danger)':g.alert>10?'var(--amber)':'var(--green)';$('alert-dot').style.background=$('detection').style.color;
  $('objective').textContent=g.sunk>=2?g.escape>0?`Breaking contact… ${Math.floor(g.escape)} / 40 sec`:'Dive deep and run silent to escape.':'Sink 2 merchants, then escape.';
  $('score').textContent=g.sunk>=2?`${number(g.tonnage)} t`:`${g.sunk} / 2`;
  const logKey=`${g.log.length}:${g.log[0]?.time}:${g.log[0]?.text}`;
  if(lastLog!==logKey){lastLog=logKey;$('log').replaceChildren();for(const entry of g.log.slice(0,8)){const row=document.createElement('div');row.className=`log-entry ${entry.kind}`;const time=document.createElement('time'),text=document.createElement('span');time.textContent=clock(entry.time).slice(0,5);text.textContent=entry.text;row.append(time,text);$('log').append(row);}$('log-count').textContent=`${String(g.log.length).padStart(2,'0')} ${g.log.length===1?'ENTRY':'ENTRIES'}`;}
  for(const event of g.events.splice(0)){audio.event(event);if(event==='blast'){$('damage-flash').classList.add('flash');setTimeout(()=>$('damage-flash').classList.remove('flash'),300);}}
  if((g.phase==='won'||g.phase==='lost')&&!shownResult){shownResult=true;best=Math.max(best,g.tonnage);try{localStorage.setItem('silent-depth-best',String(best));}catch{/* The patrol works without storage. */}showModal('result');}
}

function frame(now){
  const dt=lastFrame?Math.min((now-lastFrame)/1000,.1):0;lastFrame=now;
  const switchOpen=window.GameSwitch?.isOpen;
  if(!switchOpen)step(game,dt*game.rate);
  if(!game.paused&&!switchOpen)visualTime+=dt;
  renderer.draw(game,visualTime);
  if(now-lastUI>100){updateUI();lastUI=now;}
  requestAnimationFrame(frame);
}
updateUI();showModal('briefing');requestAnimationFrame(frame);
