import { MAX_CHICKS, HOME, createRun, step, callFlock, toggleDive, birdPosition, clamp, lakeNumber, lakeSeed, shareLine } from './crossing.js';
const $=s=>document.querySelector(s), canvas=$('#game'),ctx=canvas.getContext('2d');
const panel=$('#panel'),call=$('#call'),dive=$('#dive'),controls=$('#controls'),pauseButton=$('#pause'),message=$('#message');
const art={};
for(const name of ['lake','parent','chick','rock','boat','nest','mint-chick']){art[name]=new Image();art[name].src=new URL(`./art/${name}.webp`,import.meta.url).href;}
let W,H,P,offset,run=null,paused=false,last=0,audio,pointer=null,noticeUntil=0,shake=0,particles=[],ripples=[],wobble=[],cues=[],banner=null,hatchAt=9,celebration=null,hops=[],floats=[],outro=null;
const sounds=[];// the last tones and their tags, for the tests
const keys=new Set();
function resize(){W=innerWidth;H=innerHeight;P=Math.min(W,H*.78,680);offset=(W-P)/2;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
addEventListener('resize',resize);resize();
function tone(freq=500,len=.12,type='sine',gain=.045,tag=''){
  sounds.push({n:(sounds.at(-1)?.n||0)+1,freq,tag});if(sounds.length>200)sounds.shift();
  try{audio??=new AudioContext();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*.65,audio.currentTime+len);g.gain.setValueAtTime(gain,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+len);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+len);}catch{}
}
function notice(text,len=4){message.textContent=text;noticeUntil=(run?.elapsed||0)+len;}
// Today's lake comes from the date at the cottage in Ontario, so the whole crew swims the same lake. A link with #lake=N opens lake N.
function cottageDay(d=new Date()){
  try{const p={};for(const x of new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d))p[x.type]=x.value;if(p.year&&p.month&&p.day)return `${p.year}-${p.month}-${p.day}`;}catch{}
  return d.toISOString().slice(0,10);
}
let lake=1;
function pickLake(){const linked=Number((location.hash.match(/lake=(\d{1,6})\b/)||[])[1]);lake=linked>0?linked:lakeNumber(cottageDay());
  $('#today').textContent=linked>0?`LAKE #${lake}`:`TODAY: LAKE #${lake}`;$('#lake-label').textContent=`LAKE #${lake}`;}
pickLake();addEventListener('hashchange',pickLake);
function start(){run=createRun(lakeSeed(lake));paused=false;pointer=null;keys.clear();particles=[];ripples=[];wobble=[];cues=[];banner=null;hatchAt=9;celebration=null;hops=[];floats=[];outro=null;shake=0;panel.hidden=true;controls.hidden=false;pauseButton.hidden=false;pauseButton.textContent='Ⅱ';pauseButton.setAttribute('aria-label','Pause rescue');last=performance.now();tone(680,.3);audio?.resume().catch(()=>{});notice('Swim to a golden chick. Then lead it back to the nest.',7);updateHud();}
$('#start').onclick=start;
function gather(){if(run&&!paused&&callFlock(run)){tone(880,.4,'triangle');consumeEvents();updateHud();}}
function submerge(){if(run&&!paused&&toggleDive(run)){tone(run.diving?180:550,.2);consumeEvents();updateHud();}}
call.onclick=gather;dive.onclick=submerge;
function steer(e){if(run&&!paused&&!run.ended)run.target={x:clamp((e.clientX-offset)/P,.1,.9),y:clamp(e.clientY/H,.19,.82)};}
canvas.addEventListener('pointerdown',e=>{pointer=e.pointerId;canvas.setPointerCapture(e.pointerId);steer(e);});
canvas.addEventListener('pointermove',e=>{if(pointer===e.pointerId)steer(e);});
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>pointer=null);
addEventListener('keydown',e=>{
  if(e.key===' '&&(e.target instanceof HTMLButtonElement||e.target instanceof HTMLAnchorElement))return;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','w','a','s','d','e','Escape','p'].includes(e.key))e.preventDefault();
  keys.add(e.key.toLowerCase());
  if(e.key===' '&&!e.repeat)submerge();if(e.key.toLowerCase()==='e'&&!e.repeat)gather();
  if((e.key==='Escape'||e.key.toLowerCase()==='p')&&!e.repeat)togglePause();
});
addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());if(run&&!pointer&&['arrowleft','arrowright','arrowup','arrowdown','w','a','s','d'].includes(e.key.toLowerCase()))run.target={x:run.x,y:run.y};});
function togglePause(force){
  if(!run||run.ended)return;paused=typeof force==='boolean'?force:!paused;keys.clear();pointer=null;
  pauseButton.textContent=paused?'▶':'Ⅱ';pauseButton.setAttribute('aria-label',paused?'Resume rescue':'Pause rescue');
  if(paused){panel.innerHTML='<span class="eyebrow">TAKE A BREATHER</span><h1>LAKE<br>BREAK</h1><p>The eel can wait.</p><button id="resume">BACK TO THE RESCUE</button>';panel.hidden=false;$('#resume').onclick=()=>togglePause(false);}
  else{panel.hidden=true;last=performance.now();}updateHud();
}
pauseButton.onclick=()=>togglePause();addEventListener('blur',()=>togglePause(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)togglePause(true);});
const CAUSE={eel:'THE EEL GOT THE LAST BITE',boat:'A BOAT ENDED THE RESCUE'};
// Copies the result line and a link to this lake. If the page may not write to the clipboard, the line is selected for a manual copy.
async function copyResult(button){
  const text=`Loon Echo · ${shareLine(run,lake)} · ${run.score.toLocaleString('en-US')} points\n${location.origin}${location.pathname}#lake=${lake}`;
  let ok=false;
  try{await navigator.clipboard.writeText(text);ok=true;}catch{}
  if(!ok)try{const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.cssText='position:fixed;opacity:0';document.body.append(area);area.select();ok=document.execCommand('copy');area.remove();}catch{}
  if(!ok){const range=document.createRange();range.selectNodeContents($('#share-line'));getSelection().removeAllRanges();getSelection().addRange(range);}
  button.textContent=ok?'COPIED':'SELECT AND COPY';tone(ok?990:300,.15,'triangle',.04,'copy');
}
function finish(){
  let best=0,before=0;try{before=Number(localStorage.getItem('loon-echo-rescue-best'))||0;best=Math.max(before,run.score);localStorage.setItem('loon-echo-rescue-best',String(best));}catch{best=run.score;}
  const n=v=>v.toLocaleString('en-US'),left=MAX_CHICKS-run.home;
  const close=!before?'Your first run.':run.score>before?'A new best.':run.score===before?'You matched your best.':`${n(before-run.score)} short of your best (${n(best)}).`;
  panel.innerHTML=`<span class="eyebrow">${CAUSE[run.cause]||'OUT OF ENERGY'}</span><h1>${run.saved} CHICKS<br>HOME.</h1><div class="result">${n(run.score)}</div><p>points · ${close}</p><p>Clutch ${run.clutch}: ${run.home} of 8 home. ${left} more would hatch clutch ${run.clutch+1}.</p>`+
    `<div class="share"><span id="share-line">${shareLine(run,lake).split(' · ').map(s=>`<b>${s}</b>`).join('&nbsp;· ')}</span><button id="copy" type="button" aria-label="Copy your result and a link to this lake">COPY</button></div>`+
    `<p class="small">${run.trips} deliver${run.trips===1?'y':'ies'} · biggest group ${run.biggest}. A bigger group scores more: 100 × group².</p><button id="again">SWIM AGAIN</button>`;
  panel.hidden=false;controls.hidden=true;pauseButton.hidden=true;message.textContent='';$('#again').onclick=start;$('#copy').onclick=e=>copyResult(e.currentTarget);
}
// Sounds and pictures that come a little later, in game order. They run from the frame clock, so a pause holds them.
function cue(delay,fn){cues.push({delay,fn});}
const PENTA=[523,587,659,784,880,1047,1175,1319];
// The banked chicks hop into the nest one by one. A bank of four or more is a big moment: the lake goes to slow motion,
// each chick lands on the next note of a rising scale, and "+100 × n²" counts up. Eight at once also sets off fireworks.
const HOP=.22,SLOW=.25;
function bankMoment(e){
  const big=e.count>=4,gap=big?.1:.06;
  e.spots.forEach((s,i)=>hops.push({x:s.x,y:s.y,id:i+1,delay:i*gap,t:0,note:big?PENTA[i]:0}));
  burst(HOME.x,HOME.y,'#f8df7c');
  if(!big){tone(1100,.2);floats.push({text:`+${e.points.toLocaleString()}`,life:1});return;}
  celebration={count:e.count,points:e.points,t:0,dur:Math.max(.6,(e.count-1)*gap+HOP+.3),notes:0,shown:0,text:`+100 × ${e.count}²`};
  tone(700,.25,'triangle',.04,'big');
  if(e.count===MAX_CHICKS)[.2,.5,.8,1.1,1.4].forEach((d,i)=>cue(d,()=>firework(i)));
}
const FIRE=['#ffe27a','#9cf0ff','#ff9fd8','#c6ee89','#ffb36b'];
function firework(i){
  const x=.5+[-.22,.24,-.08,.14,0][i],y=.3+[.04,0,.1,.13,.02][i];tone(1400+i*160,.3,'square',.022,'firework');shake=Math.max(shake,.12);
  for(let k=0;k<36;k++){const a=k/36*Math.PI*2,s=.16+Math.random()*.1;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s*.62,life:1.6,color:FIRE[(i+k)%FIRE.length],size:3.4,fall:.22});}
}
function consumeEvents(){for(const e of run.events.splice(0)){
  if(e.text)notice(e.text);
  if(e.kind==='rescue'){tone(850,.2);burst(e.x,e.y,'#f8df7c');}
  if(e.kind==='fish'){tone(850,.2);burst(e.x,e.y,'#b4f4f0');}
  if(e.kind==='bank')bankMoment(e);
  if(e.kind==='hit'){tone(120,.2,'sawtooth');shake=.3;burst(run.x,run.y,'#edaaeb');}
  if(e.kind==='nip'){tone(330,.14,'square',.03);ripple(e.x,e.y,'#ffbfa8');burst(e.x,e.y,'#ffbfa8');}
  if(e.kind==='bonk'){tone(150,.1,'sine',.04);ripple(e.x,e.y,'#d6f3ff');wobble[e.rock]=.35;}
  if(e.kind==='eel'){tone(180,.4,'sawtooth',.03);cue(.2,()=>tone(150,.45,'sawtooth',.03));ripple(e.x,e.y,'#c9a8ff');}
  if(e.kind==='clutch'){const wait=celebration?celebration.dur:0;hatchAt=-wait;cue(wait,()=>banner={text:`CLUTCH ${e.clutch}`,life:1});run.chicks.forEach((c,i)=>cue(wait+.3+i*.07,()=>{tone(PENTA[i],.12,'triangle',.03);ripple(c.x,c.y,'#ffe594');}));}
  if(e.kind==='warning')tone(250,.3,'triangle');
  // The end: the loon spins down, the lake dims, and three notes fall. The card comes 0.9 s later.
  if(e.kind==='end'){outro={t:0};controls.hidden=true;burst(run.x,run.y,'#f2ffe9');[330,262,196].forEach((f,i)=>cue(i*.22,()=>tone(f,i<2?.22:.5,'triangle',.05,'end')));}
}}
function updateHud(){
  $('#clutch-label').textContent=`CLUTCH ${run.clutch}`;$('#flock').textContent=`${run.home} / 8 home`;
  const counting=celebration?celebration.points-celebration.shown:0;// the HUD score counts up with the big-bank moment
  $('#chapter').textContent=`${run.flock.length?`${run.flock.length} in your line`:`${8-run.home} to rescue`} · ${(run.score-counting).toLocaleString()} pts`;
  $('#hearts').textContent='♥ '.repeat(run.hearts)+'♡ '.repeat(3-run.hearts);$('#hearts').setAttribute('aria-label',`${run.hearts} energy`);
  $('#progress').value=run.home;$('#breath').value=run.breath;
  $('#breath-label').textContent=run.diving?`BREATH ${run.breath.toFixed(1)}s`:run.exhausted?'CATCH YOUR BREATH':'DIVE BREATH';
  dive.textContent=run.diving?'SURFACE ↑':'DIVE ↓';dive.classList.toggle('active',run.diving);dive.disabled=paused||(!run.diving&&(run.exhausted||run.breath<.8));
  call.disabled=paused||run.diving||run.cooldown>0;call.classList.toggle('active',run.call>0);call.textContent=run.cooldown>0?`HONK ${Math.ceil(run.cooldown)}s`:'HONK';
  message.style.opacity=run.elapsed>noticeUntil?'0':'1';
}
function burst(x,y,color){for(let i=0;i<16;i++)particles.push({x,y,vx:(Math.random()-.5)*.3,vy:(Math.random()-.5)*.2,life:1,color});}
function ripple(x,y,color){ripples.push({x,y,color,life:1});}
const px=x=>offset+x*P;
function ellipse(x,y,rx,ry,color,line='#162732'){ctx.beginPath();ctx.ellipse(x,y,Math.max(0,rx),Math.max(0,ry),0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();if(line){ctx.strokeStyle=line;ctx.lineWidth=2.5;ctx.stroke();}}
function sprite(name,x,y,width,angle=0){const img=art[name];if(!img.complete||!img.naturalWidth)return false;const height=width*img.height/img.width;ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.drawImage(img,-width/2,-height/2,width,height);ctx.restore();return true;}
function label(text,x,y,color='#fff1b3',size=11){ctx.font=`800 ${size}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#123135';ctx.lineWidth=4;ctx.strokeStyle='#123135';ctx.strokeText(text,px(x),y*H);ctx.fillStyle=color;ctx.fillText(text,px(x),y*H);}
function bird(b,index,t,waiting=false,scale=1){
  const size=(index?Math.min(23,P*.056):Math.min(30,P*.074))*scale,sx=px(b.x),sy=b.y*H+Math.sin(t*7+index)*1.5,angle=waiting?Math.sin(t*2)*.06:b.angle||0;
  ellipse(sx,sy+5,size*.7,size*.27,'#8becbd30',null);
  if(!index){// the loon gets a light ring that turns with it, so it stands out from the chicks
    ctx.save();ctx.translate(sx,sy);ctx.rotate(angle);for(const [w,c] of [[6,'#0c2a30'],[2.5,'#f2ffe9']]){ctx.lineWidth=w;ctx.strokeStyle=c;ctx.beginPath();ctx.ellipse(0,0,size*.98,size*1.38,0,0,7);ctx.stroke();}ctx.restore();
    ctx.shadowColor='#f2ffe9';ctx.shadowBlur=7;
  }
  if(!sprite(index?(index%2?'chick':'mint-chick'):'parent',sx,sy,size,angle))ellipse(sx,sy,size*.45,size*.6,index?'#efd774':'#b5dddd');
  ctx.shadowBlur=0;
}
function drawBackground(t){
  ctx.fillStyle='#101e25';ctx.fillRect(0,0,W,H);const img=art.lake;
  if(img.complete&&img.naturalWidth){if(offset){ctx.globalAlpha=.18;ctx.drawImage(img,0,0,W,H);ctx.globalAlpha=1;}ctx.drawImage(img,offset,0,P,H);}
  else{ctx.fillStyle='#23534f';ctx.fillRect(offset,0,P,H);}
  ctx.strokeStyle='#b3f1cf21';ctx.lineWidth=1.5;for(let i=0;i<18;i++){const x=px(.17+((i*.137)%.66)),y=((i*79+t*8)%H);ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+9,y+4,x+24,y);ctx.stroke();}
}
function drawEel(e){
  if(!e.active)return;
  if(e.phase==='windup'&&!e.stun){ctx.strokeStyle='#ffbc9a';ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.beginPath();ctx.moveTo(px(e.x),e.y*H);ctx.lineTo(px(e.aim.x),e.aim.y*H);ctx.stroke();ctx.setLineDash([]);label('!',e.x,e.y-.034,'#ffc49d',22);}
  const trail=e.trail;
  ctx.lineCap='round';for(let i=1;i<trail.length;i++){ctx.strokeStyle=i%3?'#977db1':'#d0aad1';ctx.lineWidth=4+i/trail.length*11;ctx.beginPath();ctx.moveTo(px(trail[i-1].x),trail[i-1].y*H);ctx.lineTo(px(trail[i].x),trail[i].y*H);ctx.stroke();}
  ctx.save();ctx.translate(px(e.x),e.y*H);ctx.rotate(e.angle);ellipse(0,0,13,20,e.stun?'#97b4b3':'#b29acb');
  ellipse(-8,-10,7,8,'#fff');ellipse(8,-10,7,8,'#fff');ellipse(-7,-12,2.4,3,e.phase==='lunge'?'#d95642':'#172b30');ellipse(7,-12,2.4,3,'#172b30');ctx.restore();
  if(e.stun>1)label('✦',e.x,e.y-.04,'#d9f592',20);
}
function drawWorld(t){
  ellipse(px(HOME.x),HOME.y*H,P*.12,H*.058,'#a4c98b');sprite('nest',px(HOME.x),HOME.y*H,P*.12);
  label(run.deposit?'UNLOADING…':'SAFE NEST',HOME.x,HOME.y+.067,'#d9f7ab');
  if(run.home)label(`${run.home}/8`,HOME.x,HOME.y+.007,'#fff7c7',16);
  run.rocks.forEach((rock,i)=>{const s=P*.13*(1+Math.sin((wobble[i]||0)*40)*(wobble[i]||0)*.12);if(!sprite('rock',px(rock.x),rock.y*H,s))ellipse(px(rock.x),rock.y*H,P*.06,H*.035,'#a78baf');});
  for(const f of run.fish)if(!f.cooldown){ctx.save();ctx.globalAlpha=run.diving?1:.38;ctx.translate(px(f.x),f.y*H);ellipse(0,0,10,5,'#b4f4f0');ctx.fillStyle='#b4f4f0';ctx.beginPath();ctx.moveTo(6,0);ctx.lineTo(16,-7);ctx.lineTo(16,7);ctx.fill();ellipse(-5,-1,1.5,1.5,'#173d46',null);ctx.restore();}
  for(const c of run.chicks)if(c.state==='waiting'){
    const pop=run.clutch>1?clamp((hatchAt-.3-c.id*.07)/.2,0,1):1;if(!pop)continue;// a new clutch pops in one chick at a time
    ctx.strokeStyle='#ffe594';ctx.lineWidth=2;ctx.setLineDash([3,5]);ctx.beginPath();ctx.arc(px(c.x),c.y*H,(Math.min(P*.052,24)+Math.sin(t*4+c.id)*2)*pop,0,7);ctx.stroke();ctx.setLineDash([]);bird(c,c.id+1,t,true,pop);
  }
  for(const b of run.boats){
    if(b.age<1.5){label(b.direction>0?'BOAT →':'← BOAT',b.direction>0?.16:.84,b.y,'#ffc3ba',12);ctx.setLineDash([4,7]);ctx.strokeStyle='#efb5b680';ctx.beginPath();ctx.moveTo(px(.12),b.y*H);ctx.lineTo(px(.88),b.y*H);ctx.stroke();ctx.setLineDash([]);}
    else{ctx.save();ctx.translate(px(b.x),b.y*H);ctx.scale(b.direction,1);sprite('boat',0,0,P*.23);ctx.restore();}
  }
  run.eels.forEach(drawEel);
  if(run.call>0){ctx.strokeStyle='#d1f48a';ctx.lineWidth=3;ctx.globalAlpha=run.call/2;ctx.beginPath();ctx.ellipse(px(run.x),run.y*H,P*(.07+(2-run.call)*.13),H*(.07+(2-run.call)*.13)/1.65,0,0,7);ctx.stroke();ctx.globalAlpha=1;}
  if(run.diving){ctx.fillStyle='#0a306842';ctx.fillRect(offset,0,P,H);}
  for(let i=run.flock.length;i>=0;i--){const b=birdPosition(run,i),k=outro&&!i?Math.min(1,outro.t/.9):0;ctx.globalAlpha=run.diving?.4:k?1-k*.7:run.invincible&&Math.floor(t*10)%2?.45:1;bird(k?{...b,angle:b.angle+k*k*9}:b,i,t,false,1-k*.45);ctx.globalAlpha=1;if(run.diving){ellipse(px(b.x)+9,b.y*H-12,3,3,'#b5f1f9',null);ellipse(px(b.x)-7,b.y*H-19,2,2,'#b5f1f9',null);}}
  if(run.diving&&run.breath<.75)label('SURFACING!',run.x,run.y-.055,'#ffd89c',13);
  if(pointer!==null){ctx.strokeStyle='#cdf4c2a0';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(px(run.target.x),run.target.y*H,11,0,7);ctx.stroke();}
}
// One step of game time, in seconds. The animation frame calls it, and the tests call it through window.__echo.
function update(dt){
  if(!run||paused)return;
  for(const c of cues)c.delay-=dt;const due=cues.filter(c=>c.delay<=0);cues=cues.filter(c=>c.delay>0);due.forEach(c=>c.fn());
  if(celebration){const c=celebration;c.t+=dt;c.shown=Math.round(c.points*clamp((c.t-.05)/(c.dur-.3),0,1));if(c.t>=c.dur)celebration=null;}
  for(const h of hops){if((h.delay-=dt)>0)continue;if((h.t+=dt)<HOP)continue;h.done=true;ripple(HOME.x,HOME.y,'#ffe594');if(h.note){tone(h.note,.2,'triangle',.05,'hop');if(celebration)celebration.notes++;}}
  hops=hops.filter(h=>!h.done);
  if(!run.ended){
    const dx=(keys.has('arrowright')||keys.has('d')?1:0)-(keys.has('arrowleft')||keys.has('a')?1:0);
    const dy=(keys.has('arrowdown')||keys.has('s')?1:0)-(keys.has('arrowup')||keys.has('w')?1:0);
    if(dx||dy)run.target={x:run.x+dx*.2,y:run.y+dy*.12};
    step(run,dt*(celebration?SLOW:1));consumeEvents();
  }
  updateHud();
  if(outro&&!outro.done&&(outro.t+=dt)>=.9){outro.done=true;finish();}
  shake=Math.max(0,shake-dt);hatchAt+=dt;if(banner&&(banner.life-=dt*.55)<=0)banner=null;
  for(const f of floats)f.life-=dt*.9;floats=floats.filter(f=>f.life>0);
  for(const p of particles){p.life-=dt*1.7;p.vy+=(p.fall||0)*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}particles=particles.filter(p=>p.life>0);
  for(const w of ripples)w.life-=dt*2.2;ripples=ripples.filter(w=>w.life>0);
  wobble=wobble.map(v=>Math.max(0,v-dt));
}
function render(ts){
  const t=run?.elapsed||ts/1000;drawBackground(t);ctx.save();ctx.beginPath();ctx.rect(offset,0,P,H);ctx.clip();
  if(run){if(shake)ctx.translate(Math.sin(ts*.07)*shake*12,0);
    if(celebration){const k=celebration.t/celebration.dur;for(let i=0;i<3;i++){const s=(k*1.6+i/3)%1;ctx.globalAlpha=(1-s)*.5*(1-k*.6);ctx.strokeStyle='#ffe594';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(px(HOME.x),HOME.y*H,P*(.12+s*.3),H*(.058+s*.14),0,0,7);ctx.stroke();}ctx.globalAlpha=1;}
    drawWorld(t);
    for(const h of hops){const k=h.delay>0?0:clamp(h.t/HOP,0,1);bird({x:h.x+(HOME.x-h.x)*k,y:h.y+(HOME.y-h.y)*k-Math.sin(k*Math.PI)*.07,angle:0},h.id,t,true,1-k*.3);}
    for(const p of particles){ctx.globalAlpha=Math.max(0,Math.min(1,p.life));ellipse(px(p.x),p.y*H,p.size||3,p.size||3,p.color,null);}ctx.globalAlpha=1;
    for(const w of ripples){ctx.globalAlpha=Math.max(0,w.life);ctx.strokeStyle=w.color;ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(px(w.x),w.y*H,P*(.02+(1-w.life)*.06),P*(.012+(1-w.life)*.036),0,0,7);ctx.stroke();}ctx.globalAlpha=1;
    if(celebration){const c=celebration,pop=1+Math.max(0,.25-c.t)*1.6;label(c.text,.5,HOME.y+.125,'#fff3a6',Math.round(Math.min(34,P*.085)*pop));label(`+${c.shown.toLocaleString()}`,.5,HOME.y+.17,'#c9f58a',Math.round(Math.min(24,P*.06)));}
    for(const f of floats){ctx.globalAlpha=Math.min(1,f.life*2);label(f.text,.5,HOME.y+.11-(1-f.life)*.05,'#fff3a6',Math.round(Math.min(22,P*.055)));ctx.globalAlpha=1;}
    if(outro){ctx.fillStyle=`rgba(3,14,22,${Math.min(.5,outro.t*.6).toFixed(3)})`;ctx.fillRect(offset,0,P,H);}
    if(banner){ctx.globalAlpha=Math.min(1,banner.life*3);label(banner.text,.5,.47,'#c9f58a',Math.round(Math.min(46,P*.11)*(1.15-banner.life*.15)));ctx.globalAlpha=1;}
  }ctx.restore();
}
let manual=false;
function draw(ts){requestAnimationFrame(draw);const dt=Math.min(.05,(ts-last)/1000||0);last=ts;if(!manual)update(dt);render(ts);}
requestAnimationFrame(draw);
// Hooks for the browser tests in qa/echo/. manual(true) stops the frame clock, and advance(s) then moves game time by hand.
window.__echo={get run(){return run},get paused(){return paused},get celebration(){return celebration},get hops(){return hops.length},get particles(){return particles.length},get banner(){return banner?.text||''},sounds,
  manual(on=true){manual=on;last=performance.now();},advance(seconds){for(let t=0;t<seconds-1e-9;t+=1/60)update(1/60);},start,gather,submerge,togglePause};
